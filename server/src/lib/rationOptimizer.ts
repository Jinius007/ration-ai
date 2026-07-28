// Least-cost ration formulation using linear programming, following the NDDB
// RBP methodology and the "Other constraints used for RBP" document:
//  - meet TDN / CP / Ca / P requirement (minimums)
//  - total dry matter within stage-specific % of body weight
//  - concentrate share of DM capped by milk-yield band (40-70%)
//  - mineral mixture always part of the final formulation
//  - farmer-entered feed quantities bounded to +/- 25% of entered value
//  - at least one forage item in the final mix
import solver from "javascript-lp-solver";

type LpModel = {
  optimize: string;
  opType: "min" | "max";
  constraints: Record<string, { min?: number; max?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
};
import { FeedItem } from "./feedLibrary.js";
import {
  AnimalProfile,
  NutrientVector,
  RequirementBreakdown,
  dmRangePercent,
  maxConcentratePercent,
} from "./nutrientRequirements.js";
import { capFeedQty, isDryFodder, DRY_FODDER_MAX_KG, rbpMaxQty, rbpMinQty } from "./feedConstraints.js";

export interface RationFeedInput {
  feed: FeedItem;
  /** Quantity the farmer currently feeds, kg fresh per day (0 = candidate feed) */
  currentQty: number;
  /** Price the farmer pays, Rs/kg (defaults to library rate) */
  price: number;
  /** True when feed was added by the optimizer as a market suggestion */
  suggested?: boolean;
}

export interface RationLine {
  feed: FeedItem;
  qty: number;
  price: number;
  cost: number;
  currentQty: number;
  suggested: boolean;
}

export interface RationResult {
  feasible: boolean;
  /** Constraints that had to be relaxed to find a solution */
  relaxed: string[];
  lines: RationLine[];
  totalCost: number;
  /** Cost of the farmer's current (pre-optimization) feeding, Rs/day */
  currentCost: number;
  supply: NutrientVector & { dm: number };
  requirement: NutrientVector;
  dmRange: { min: number; max: number };
  concentratePctOfDm: number;
  maxConcentratePct: number;
}

/** Practical per-day caps (kg fresh) for feeds the optimizer adds on its own. */
function suggestedCap(feed: FeedItem): number {
  switch (feed.category) {
    case "mineral":
      return 0.2;
    case "roughage":
      // fresh greens can go high in volume; dry roughages stay lower
      return feed.dm <= 400 ? 30 : 8;
    default:
      return 6;
  }
}

function buildModel(
  inputs: RationFeedInput[],
  requirement: NutrientVector,
  dmMinG: number,
  dmMaxG: number,
  concMaxPct: number,
  options: {
    enforceMinerals: boolean;
    enforceCaP: boolean;
    enforceDmMax: boolean;
    /** rbp = ±25% on farmer qty; rbp_stated = ±25% on stated feeds only (no new feeds);
     *  farmer_expand = allow higher qty on stated feeds only;
     *  farmer_plus_local = way2: stated feeds flexible + local candidate feeds */
    boundMode?: "rbp" | "rbp_stated" | "farmer_expand" | "mixed" | "farmer_plus_local";
  }
): LpModel {
  const constraints: LpModel["constraints"] = {
    tdn: { min: requirement.tdn },
    cp: { min: requirement.cp },
    dm: options.enforceDmMax ? { min: dmMinG, max: dmMaxG } : { min: dmMinG },
    // concentrate DM - concMax% of total DM <= 0
    concbal: { max: 0 },
    // at least ~1 kg fresh forage so a forage item is always present
    forage: { min: 1 },
  };
  if (options.enforceCaP) {
    constraints.ca = { min: requirement.ca };
    constraints.p = { min: requirement.p };
  }

  const variables: LpModel["variables"] = {};
  for (const item of inputs) {
    const f = item.feed;
    const isConc = f.category === "concentrate" ? 1 : 0;
    const col: Record<string, number> = {
      cost: item.price,
      tdn: f.tdn,
      cp: f.cp,
      ca: f.ca,
      p: f.p,
      dm: f.dm,
      concbal: f.dm * (isConc - concMaxPct / 100),
      forage: f.category === "roughage" ? 1 : 0,
    };
    // per-variable bounds via dedicated constraint rows
    const boundKey = `qty_${f.id}`;
    col[boundKey] = 1;
    const boundMode =
      options.boundMode === "rbp_stated"
        ? "rbp_stated"
        : options.boundMode === "farmer_plus_local"
          ? "farmer_plus_local"
          : options.boundMode === "farmer_expand"
            ? "farmer_expand"
            : options.boundMode === "rbp"
              ? "rbp"
              : item.currentQty > 0
                ? "rbp"
                : "library";

    if (boundMode === "rbp_stated") {
      if (item.currentQty > 0) {
        constraints[boundKey] = {
          min: rbpMinQty(f, item.currentQty),
          max: rbpMaxQty(f, item.currentQty),
        };
      } else if (f.category === "mineral" && item.suggested) {
        constraints[boundKey] = { min: 0.05, max: 0.2 };
      } else {
        constraints[boundKey] = { min: 0, max: 0 };
      }
    } else if (boundMode === "farmer_plus_local") {
      if (item.suggested || item.currentQty <= 0) {
        const cap = isDryFodder(f) ? DRY_FODDER_MAX_KG : suggestedCap(f);
        constraints[boundKey] = { min: 0, max: cap };
      } else {
        constraints[boundKey] = {
          min: rbpMinQty(f, item.currentQty),
          max: rbpMaxQty(f, item.currentQty),
        };
      }
    } else if (item.currentQty > 0) {
      if (boundMode === "farmer_expand") {
        const cap = Math.max(suggestedCap(f), item.currentQty * 4);
        constraints[boundKey] = {
          min: Math.max(0, item.currentQty * 0.5),
          max: cap,
        };
      } else {
        constraints[boundKey] = {
          min: rbpMinQty(f, item.currentQty),
          max: rbpMaxQty(f, item.currentQty),
        };
      }
    } else {
      const cap = isDryFodder(f) ? DRY_FODDER_MAX_KG : suggestedCap(f);
      constraints[boundKey] = { min: 0, max: cap };
    }
    if (f.category === "mineral" && options.enforceMinerals && item.currentQty === 0) {
      // mineral mixture must appear in the final formulation (>= 50 g)
      constraints[boundKey] = { min: 0.05, max: 0.2 };
    }
    variables[f.id] = col;
  }

  return { optimize: "cost", opType: "min", constraints, variables };
}

function computeSupply(inputs: RationFeedInput[], qty: Record<string, number>) {
  const s = { tdn: 0, cp: 0, ca: 0, p: 0, dm: 0, concDm: 0 };
  for (const item of inputs) {
    const q = qty[item.feed.id] || 0;
    s.tdn += q * item.feed.tdn;
    s.cp += q * item.feed.cp;
    s.ca += q * item.feed.ca;
    s.p += q * item.feed.p;
    s.dm += q * item.feed.dm;
    if (item.feed.category === "concentrate") s.concDm += q * item.feed.dm;
  }
  return s;
}

/** Nutrients if farmer feeds the upper bound (+25%) of what they entered. */
export function supplyAtFarmerMax(inputs: RationFeedInput[]) {
  const qty: Record<string, number> = {};
  for (const item of inputs) {
    if (item.currentQty > 0) qty[item.feed.id] = item.currentQty * 1.25;
  }
  const s = computeSupply(inputs, qty);
  return {
    tdn: Math.round(s.tdn),
    cp: Math.round(s.cp),
    ca: Math.round(s.ca * 10) / 10,
    p: Math.round(s.p * 10) / 10,
    dm: Math.round(s.dm),
  };
}

/**
 * Solve the least-cost ration. Tries the full RBP model first; if infeasible
 * with the given feeds, relaxes constraints step by step (Ca/P first, then the
 * DM ceiling) so the farmer always gets a usable answer plus a note about
 * what could not be met.
 */
export type OptimizeOptions = {
  /** How to bound farmer-entered feed quantities. Default mixed (±25% farmer, cap for library). */
  boundMode?: "rbp" | "rbp_stated" | "farmer_expand" | "mixed" | "farmer_plus_local";
};

export function optimizeRation(
  inputs: RationFeedInput[],
  animal: AnimalProfile,
  requirement: RequirementBreakdown,
  optimizeOpts: OptimizeOptions = {}
): RationResult {
  const boundMode = optimizeOpts.boundMode ?? "mixed";
  const dmPct = dmRangePercent(animal);
  const dmMinG = (animal.weight * dmPct.min * 1000) / 100;
  const dmMaxG = (animal.weight * dmPct.max * 1000) / 100;
  const concMaxPct = maxConcentratePercent(animal);
  const req = requirement.total;
  const enforceMinerals = inputs.some(
    (i) => i.feed.category === "mineral" && (i.currentQty > 0 || i.suggested)
  );

  const attempts: {
    relaxed: string[];
    opts: Parameters<typeof buildModel>[5];
  }[] = [
    {
      relaxed: [],
      opts: { enforceMinerals, enforceCaP: true, enforceDmMax: true, boundMode },
    },
    {
      relaxed: ["caP"],
      opts: { enforceMinerals, enforceCaP: false, enforceDmMax: true, boundMode },
    },
    {
      relaxed: ["caP", "dmMax"],
      opts: { enforceMinerals, enforceCaP: false, enforceDmMax: false, boundMode },
    },
  ];

  for (const attempt of attempts) {
    const model = buildModel(inputs, req, dmMinG, dmMaxG, concMaxPct, attempt.opts);
    const sol = solver.Solve(model) as Record<string, number | boolean> & { feasible?: boolean };
    if (!sol.feasible) continue;

    const qty: Record<string, number> = {};
    for (const item of inputs) {
      const v = sol[item.feed.id];
      const raw = typeof v === "number" && v > 0.005 ? Math.round(v * 100) / 100 : 0;
      qty[item.feed.id] = capFeedQty(item.feed, raw);
    }
    const supply = computeSupply(inputs, qty);
    const lines: RationLine[] = inputs
      .filter((i) => qty[i.feed.id] > 0)
      .map((i) => ({
        feed: i.feed,
        qty: qty[i.feed.id],
        price: i.price,
        cost: Math.round(qty[i.feed.id] * i.price * 100) / 100,
        currentQty: i.currentQty,
        suggested: !!i.suggested,
      }))
      .sort((a, b) => b.qty - a.qty);

    const currentCost = inputs.reduce((acc, i) => acc + i.currentQty * i.price, 0);

    return {
      feasible: true,
      relaxed: attempt.relaxed,
      lines,
      totalCost: Math.round(lines.reduce((acc, l) => acc + l.cost, 0) * 100) / 100,
      currentCost: Math.round(currentCost * 100) / 100,
      supply: {
        tdn: Math.round(supply.tdn),
        cp: Math.round(supply.cp),
        ca: Math.round(supply.ca * 10) / 10,
        p: Math.round(supply.p * 10) / 10,
        dm: Math.round(supply.dm),
      },
      requirement: req,
      dmRange: { min: dmMinG, max: dmMaxG },
      concentratePctOfDm: supply.dm > 0 ? Math.round((supply.concDm / supply.dm) * 100) : 0,
      maxConcentratePct: concMaxPct,
    };
  }

  return {
    feasible: false,
    relaxed: [],
    lines: [],
    totalCost: 0,
    currentCost: Math.round(inputs.reduce((acc, i) => acc + i.currentQty * i.price, 0) * 100) / 100,
    supply: { tdn: 0, cp: 0, ca: 0, p: 0, dm: 0 },
    requirement: req,
    dmRange: { min: dmMinG, max: dmMaxG },
    concentratePctOfDm: 0,
    maxConcentratePct: concMaxPct,
  };
}

function resultFromQty(
  inputs: RationFeedInput[],
  qty: Record<string, number>,
  req: NutrientVector,
  dmMinG: number,
  dmMaxG: number,
  concMaxPct: number,
  relaxed: string[]
): RationResult {
  const supply = computeSupply(inputs, qty);
  const lines: RationLine[] = inputs
    .filter((i) => qty[i.feed.id] > 0)
    .map((i) => ({
      feed: i.feed,
      qty: qty[i.feed.id],
      price: i.price,
      cost: Math.round(qty[i.feed.id] * i.price * 100) / 100,
      currentQty: i.currentQty,
      suggested: !!i.suggested,
    }))
    .sort((a, b) => b.qty - a.qty);
  const currentCost = inputs.reduce((acc, i) => acc + i.currentQty * i.price, 0);
  return {
    feasible: true,
    relaxed,
    lines,
    totalCost: Math.round(lines.reduce((acc, l) => acc + l.cost, 0) * 100) / 100,
    currentCost: Math.round(currentCost * 100) / 100,
    supply: {
      tdn: Math.round(supply.tdn),
      cp: Math.round(supply.cp),
      ca: Math.round(supply.ca * 10) / 10,
      p: Math.round(supply.p * 10) / 10,
      dm: Math.round(supply.dm),
    },
    requirement: req,
    dmRange: { min: dmMinG, max: dmMaxG },
    concentratePctOfDm: supply.dm > 0 ? Math.round((supply.concDm / supply.dm) * 100) : 0,
    maxConcentratePct: concMaxPct,
  };
}

/**
 * Best effort within RBP ±25% bounds when full nutrition cannot be met.
 * Keeps DM min, concentrate cap, and forage minimum.
 */
export function optimizeStatedBestEffort(
  inputs: RationFeedInput[],
  animal: AnimalProfile,
  requirement: RequirementBreakdown
): RationResult {
  const stated = inputs.filter((i) => i.currentQty > 0);
  if (!stated.length) {
    return optimizeRation(inputs, animal, requirement, { boundMode: "rbp_stated" });
  }

  const dmPct = dmRangePercent(animal);
  const dmMinG = (animal.weight * dmPct.min * 1000) / 100;
  const dmMaxG = (animal.weight * dmPct.max * 1000) / 100;
  const concMaxPct = maxConcentratePercent(animal);
  const req = requirement.total;

  const constraints: LpModel["constraints"] = {
    dm: { min: dmMinG, max: dmMaxG },
    concbal: { max: 0 },
    forage: { min: 1 },
  };
  const variables: LpModel["variables"] = {};

  for (const item of stated) {
    const f = item.feed;
    const isConc = f.category === "concentrate" ? 1 : 0;
    const boundKey = `qty_${f.id}`;
    variables[f.id] = {
      nutrition: f.tdn + f.cp * 2,
      cost: item.price,
      dm: f.dm,
      concbal: f.dm * (isConc - concMaxPct / 100),
      forage: f.category === "roughage" ? 1 : 0,
      [boundKey]: 1,
    };
    constraints[boundKey] = {
      min: rbpMinQty(f, item.currentQty),
      max: rbpMaxQty(f, item.currentQty),
    };
  }

  for (const item of inputs.filter((i) => i.suggested && i.feed.category === "mineral" && i.currentQty <= 0)) {
    const f = item.feed;
    const boundKey = `qty_${f.id}`;
    if (variables[f.id]) continue;
    variables[f.id] = {
      nutrition: f.tdn + f.cp * 2,
      cost: item.price,
      dm: f.dm,
      concbal: 0,
      forage: 0,
      [boundKey]: 1,
    };
    constraints[boundKey] = { min: 0.05, max: 0.2 };
  }

  const model: LpModel = {
    optimize: "nutrition",
    opType: "max",
    constraints,
    variables,
  };
  const sol = solver.Solve(model) as Record<string, number | boolean> & { feasible?: boolean };
  const mineralAdds = inputs.filter(
    (i) => i.suggested && i.feed.category === "mineral" && i.currentQty <= 0
  );
  const active = [
    ...stated,
    ...mineralAdds.filter((m) => !stated.some((s) => s.feed.id === m.feed.id)),
  ];

  if (!sol.feasible) {
    const qty: Record<string, number> = {};
    for (const item of stated) {
      qty[item.feed.id] = capFeedQty(item.feed, rbpMaxQty(item.feed, item.currentQty));
    }
    for (const item of mineralAdds) {
      qty[item.feed.id] = 0.1;
    }
    return resultFromQty(active, qty, req, dmMinG, dmMaxG, concMaxPct, ["bestEffort"]);
  }

  const qty: Record<string, number> = {};
  for (const item of active) {
    const v = sol[item.feed.id];
    qty[item.feed.id] =
      typeof v === "number" && v > 0.005 ? capFeedQty(item.feed, Math.round(v * 100) / 100) : 0;
  }
  return resultFromQty(active, qty, req, dmMinG, dmMaxG, concMaxPct, ["bestEffort"]);
}

/**
 * Best effort when farmer + named neighborhood feeds cannot meet full nutrition.
 * Farmer feeds stay within ±25%; neighborhood feeds may be added from 0 up to cap.
 */
export function optimizeFarmerPlusNeighborhoodBestEffort(
  inputs: RationFeedInput[],
  animal: AnimalProfile,
  requirement: RequirementBreakdown
): RationResult {
  const active = inputs.filter(
    (i) => i.currentQty > 0 || (i.suggested && inputs.some((x) => x.feed.id === i.feed.id))
  );
  if (!active.length) {
    return optimizeRation(inputs, animal, requirement, { boundMode: "farmer_plus_local" });
  }

  const dmPct = dmRangePercent(animal);
  const dmMinG = (animal.weight * dmPct.min * 1000) / 100;
  const dmMaxG = (animal.weight * dmPct.max * 1000) / 100;
  const concMaxPct = maxConcentratePercent(animal);
  const req = requirement.total;

  const constraints: LpModel["constraints"] = {
    dm: { min: dmMinG, max: dmMaxG },
    concbal: { max: 0 },
    forage: { min: 1 },
  };
  const variables: LpModel["variables"] = {};

  for (const item of active) {
    const f = item.feed;
    const isConc = f.category === "concentrate" ? 1 : 0;
    const boundKey = `qty_${f.id}`;
    variables[f.id] = {
      nutrition: f.tdn + f.cp * 2,
      cost: item.price,
      dm: f.dm,
      concbal: f.dm * (isConc - concMaxPct / 100),
      forage: f.category === "roughage" ? 1 : 0,
      [boundKey]: 1,
    };
    if (item.currentQty > 0 && !item.suggested) {
      constraints[boundKey] = {
        min: rbpMinQty(f, item.currentQty),
        max: rbpMaxQty(f, item.currentQty),
      };
    } else {
      const cap = isDryFodder(f) ? DRY_FODDER_MAX_KG : suggestedCap(f);
      constraints[boundKey] = { min: 0, max: cap };
    }
  }

  const model: LpModel = {
    optimize: "nutrition",
    opType: "max",
    constraints,
    variables,
  };
  const sol = solver.Solve(model) as Record<string, number | boolean> & { feasible?: boolean };
  if (!sol.feasible) {
    const qty: Record<string, number> = {};
    for (const item of active) {
      if (item.currentQty > 0 && !item.suggested) {
        qty[item.feed.id] = Math.round(item.currentQty * 1.25 * 100) / 100;
      }
    }
    return resultFromQty(active, qty, req, dmMinG, dmMaxG, concMaxPct, ["bestEffort"]);
  }

  const qty: Record<string, number> = {};
  for (const item of active) {
    const v = sol[item.feed.id];
    qty[item.feed.id] =
      typeof v === "number" && v > 0.005 ? capFeedQty(item.feed, Math.round(v * 100) / 100) : 0;
  }
  return resultFromQty(active, qty, req, dmMinG, dmMaxG, concMaxPct, ["bestEffort"]);
}
