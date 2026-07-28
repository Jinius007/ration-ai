import type { NutrientVector } from "./nutrientRequirements.js";
import { computeRequirement } from "./nutrientRequirements.js";
import {
  optimizeRation,
  optimizeStatedBestEffort,
  optimizeFarmerPlusNeighborhoodBestEffort,
  RationFeedInput,
  RationLine,
  RationResult,
  supplyAtFarmerMax,
} from "./rationOptimizer.js";
import { feedById, feedsForLocation } from "./regionalFeeds.js";
import type { FeedItem } from "./feedLibrary.js";
import { displayFeedName } from "./feedDisplayNames.js";
import { capFeedQty, rbpMaxQty, rbpMinQty } from "./feedConstraints.js";
import { mineralMixtureIdForLocation } from "./location.js";
import {
  AdvisorySession,
  AnimalRecord,
  animalProfileFromRecord,
  detectSeason,
} from "./types.js";

export interface AnimalRationPlan {
  animal: AnimalRecord;
  requirement: ReturnType<typeof computeRequirement>;
  /** Way 1: only feeds the farmer stated. */
  way1Result: RationResult;
  way1MeetsNutrition: boolean;
  way1AutoMineralId: string | null;
  nutrientGaps: Partial<NutrientVector>;
  /** Step 2: farmer + named neighborhood feeds only (no library extras in the plan). */
  way2Result: RationResult | null;
  way2MeetsNutrition: boolean;
  /** Optional regional suggestions — not part of the step-2 plan. */
  way2OptionalSuggestions: string[];
  /** True when farmer has not yet named neighborhood feeds. */
  way2NeedsFarmerInput: boolean;
  way2RegionalExamples: string[];
  /** Way 3: library optimisation when Way 1/2 still short. */
  way3Result: RationResult | null;
  way3MeetsNutrition: boolean;
  way3Needed: boolean;
  way3LibraryAdditions: RationLine[];
  alternatives: string[];
  farmerFeedIds: string[];
  farmerStated: { feedName: string; feedId: string; currentQty: number; spokenName?: string }[];
  neighborhoodFeedIds: string[];
}

export interface HerdRationReport {
  season: string;
  plans: AnimalRationPlan[];
  totalDailyCost: number;
  totalCurrentCost: number;
  savings: number;
}

function fmtKg(kg: number, lang: "hi" | "en"): string {
  if (kg < 1) {
    const g = Math.round(kg * 1000);
    return lang === "hi" ? `${g} ग्राम` : `${g} gram`;
  }
  const rounded = Math.round(kg);
  return lang === "hi" ? `${rounded} किलोग्राम` : `${rounded} kilogram`;
}

function buildSpokenMap(session?: AdvisorySession): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of session?.feeds ?? []) {
    if (f.spokenName) m.set(f.feedId, f.spokenName);
  }
  for (const f of session?.neighborhoodFeeds ?? []) {
    if (f.spokenName) m.set(f.feedId, f.spokenName);
  }
  return m;
}

function feedLabel(
  feedId: string,
  lang: "hi" | "en",
  spokenMap: Map<string, string>
): string {
  return displayFeedName(feedId, lang, spokenMap.get(feedId));
}

function fmtRs(amount: number): string {
  return `₹${Math.round(amount)}`;
}

function buildFarmerFeedInputs(session: AdvisorySession): RationFeedInput[] {
  const inputs: RationFeedInput[] = [];
  for (const entry of session.feeds) {
    const feed = feedById(entry.feedId);
    if (!feed) continue;
    inputs.push({
      feed,
      currentQty: entry.qtyKg,
      price: entry.priceRs,
    });
  }
  return inputs;
}

function buildWay1Inputs(session: AdvisorySession): {
  inputs: RationFeedInput[];
  autoMineralId: string | null;
} {
  const inputs = buildFarmerFeedInputs(session);
  const hasMineral = inputs.some((i) => i.feed.category === "mineral");
  if (hasMineral) return { inputs, autoMineralId: null };

  const mineralId = mineralMixtureIdForLocation(
    session.location?.district ?? "",
    session.location?.state ?? ""
  );
  const mineral = feedById(mineralId);
  if (!mineral) return { inputs, autoMineralId: null };

  inputs.push({
    feed: mineral,
    currentQty: 0,
    price: mineral.rate,
    suggested: true,
  });
  return { inputs, autoMineralId: mineralId };
}

function buildNeighborhoodFeedInputs(session: AdvisorySession): RationFeedInput[] {
  const { inputs } = buildWay1Inputs(session);
  const seen = new Set(inputs.map((i) => i.feed.id));

  for (const entry of session.neighborhoodFeeds ?? []) {
    const feed = feedById(entry.feedId);
    if (!feed || seen.has(feed.id)) continue;
    inputs.push({
      feed,
      currentQty: entry.qtyKg,
      price: entry.priceRs,
      suggested: true,
    });
    seen.add(feed.id);
  }

  return inputs;
}

/** Farmer + named neighborhood feeds + regional candidates (no exotic leaves unless farmer named them). */
function buildNeighborhoodExpandedInputs(
  session: AdvisorySession,
  pool: FeedItem[]
): RationFeedInput[] {
  const inputs = buildNeighborhoodFeedInputs(session);
  const seen = new Set(inputs.map((i) => i.feed.id));
  const farmerIds = new Set(session.feeds.map((f) => f.feedId));
  const neighborhoodIds = new Set((session.neighborhoodFeeds ?? []).map((f) => f.feedId));

  for (const f of pool) {
    if (seen.has(f.id) || farmerIds.has(f.id)) continue;
    if (f.group === "Leaves" && !neighborhoodIds.has(f.id)) continue;
    inputs.push({
      feed: f,
      currentQty: 0,
      price: f.rate,
      suggested: true,
    });
    seen.add(f.id);
  }

  const mineralId = mineralMixtureIdForLocation(
    session.location?.district ?? "",
    session.location?.state ?? ""
  );
  if (!seen.has(mineralId)) {
    const mineral = feedById(mineralId);
    if (mineral) {
      inputs.push({ feed: mineral, currentQty: 0, price: mineral.rate, suggested: true });
    }
  }

  return inputs;
}

function buildFullFeedInputs(session: AdvisorySession): RationFeedInput[] {
  const season = detectSeason();
  const pool = feedsForLocation(session.location, season);
  const poolIds = new Set(pool.map((f) => f.id));
  const mineralId = mineralMixtureIdForLocation(
    session.location?.district ?? "",
    session.location?.state ?? ""
  );

  const inputs: RationFeedInput[] = [];
  const seen = new Set<string>();

  for (const entry of session.feeds) {
    const feed = feedById(entry.feedId);
    if (!feed) continue;
    inputs.push({
      feed,
      currentQty: entry.qtyKg,
      price: entry.priceRs,
    });
    seen.add(feed.id);
  }

  for (const f of pool) {
    if (seen.has(f.id)) continue;
    inputs.push({
      feed: f,
      currentQty: 0,
      price: f.rate,
      suggested: true,
    });
    seen.add(f.id);
  }

  if (!seen.has(mineralId)) {
    const mineral = feedById(mineralId);
    if (mineral) {
      inputs.push({ feed: mineral, currentQty: 0, price: mineral.rate, suggested: true });
    }
  }

  return inputs.filter(
    (i) => poolIds.has(i.feed.id) || session.feeds.some((e) => e.feedId === i.feed.id)
  );
}

function nutritionCoveragePercent(supply: NutrientVector, req: NutrientVector): number {
  const ratios = [supply.tdn / req.tdn, supply.cp / req.cp, supply.ca / req.ca, supply.p / req.p];
  return Math.round(Math.min(...ratios) * 100);
}

function nutritionStatusLine(
  meets: boolean,
  supply: NutrientVector,
  req: NutrientVector,
  lang: "hi" | "en"
): string {
  if (meets) {
    return lang === "hi"
      ? "- पोषण पूरा हो जाएगा (100%)।"
      : "- Full nutrition will be met (100%).";
  }
  const pct = Math.min(100, nutritionCoveragePercent(supply, req));
  return lang === "hi"
    ? `- पोषण 100% पूरा नहीं हो पाया — इन चारों से लगभग ${pct}% तक पहुँच सकते हैं।`
    : `- Full nutrition not possible — these feeds reach about ${pct}% of requirement.`;
}

function meetsRequirement(supply: NutrientVector, req: NutrientVector, relaxed: string[]): boolean {
  if (relaxed.length > 0) return false;
  return (
    supply.tdn >= req.tdn * 0.98 &&
    supply.cp >= req.cp * 0.98 &&
    supply.ca >= req.ca * 0.95 &&
    supply.p >= req.p * 0.95
  );
}

function computeNutrientGaps(supply: NutrientVector, req: NutrientVector): Partial<NutrientVector> {
  const gaps: Partial<NutrientVector> = {};
  if (supply.tdn < req.tdn * 0.98) gaps.tdn = Math.round(req.tdn - supply.tdn);
  if (supply.cp < req.cp * 0.98) gaps.cp = Math.round(req.cp - supply.cp);
  if (supply.ca < req.ca * 0.95) gaps.ca = Math.round((req.ca - supply.ca) * 10) / 10;
  if (supply.p < req.p * 0.95) gaps.p = Math.round((req.p - supply.p) * 10) / 10;
  return gaps;
}

function suggestAlternatives(
  pool: FeedItem[],
  gaps: Partial<NutrientVector>,
  excludeIds: Set<string>,
  lang: "hi" | "en"
): string[] {
  if (!Object.keys(gaps).length) return [];

  const scored: { feed: FeedItem; score: number; reason: string }[] = [];
  for (const f of pool) {
    if (excludeIds.has(f.id)) continue;
    if (f.group === "Leaves") continue;
    let score = 0;
    const reasons: string[] = [];
    if (gaps.tdn && f.tdn > 80) {
      score += f.tdn / Math.max(f.rate, 1);
      reasons.push(lang === "hi" ? "ऊर्जा" : "energy");
    }
    if (gaps.cp && f.cp > 40) {
      score += (f.cp * 2) / Math.max(f.rate, 1);
      reasons.push(lang === "hi" ? "प्रोटीन" : "protein");
    }
    if (gaps.ca && f.ca > 2) {
      score += f.ca * 10;
      reasons.push(lang === "hi" ? "कैल्शियम" : "calcium");
    }
    if (gaps.p && f.p > 1) {
      score += f.p * 10;
      reasons.push(lang === "hi" ? "फॉस्फोरस" : "phosphorus");
    }
    if (score > 0) {
      const reasonStr =
        lang === "hi"
          ? `${reasons.join(" + ")} के लिए उपयुक्त`
          : `good for ${reasons.join(" + ")}`;
      scored.push({ feed: f, score, reason: reasonStr });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => {
      let kg = 2;
      if (gaps.cp && s.feed.cp > 0) {
        kg = Math.min(6, Math.max(0.5, (gaps.cp * 0.25) / s.feed.cp));
      } else if (gaps.tdn && s.feed.tdn > 0) {
        kg = Math.min(8, Math.max(1, (gaps.tdn * 0.2) / s.feed.tdn));
      }
      kg = capFeedQty(s.feed, Math.round(kg * 100) / 100);
      const name = displayFeedName(s.feed.id, lang);
      return lang === "hi"
        ? `${name} — रोज़ ${fmtKg(kg, lang)} (${s.reason})`
        : `${s.feed.name} — ${fmtKg(kg, lang)} daily (${s.reason})`;
    });
}

function regionalNeighborhoodExamples(
  pool: FeedItem[],
  farmerIds: Set<string>,
  limit = 5
): string[] {
  const isLocalRoughage = (f: FeedItem) =>
    !farmerIds.has(f.id) &&
    f.category !== "mineral" &&
    (f.category === "roughage" || f.group === "Green Fodder" || f.group === "Hay" || f.group === "Straw");

  const preferred = pool.filter(isLocalRoughage);
  const source = preferred.length >= 3 ? preferred : pool.filter((f) => !farmerIds.has(f.id) && f.category !== "mineral");
  return source.slice(0, limit).map((f) => f.name);
}

function supplyFromLines(lines: RationLine[]): NutrientVector & { dm: number } {
  const s = { tdn: 0, cp: 0, ca: 0, p: 0, dm: 0 };
  for (const line of lines) {
    s.tdn += line.qty * line.feed.tdn;
    s.cp += line.qty * line.feed.cp;
    s.ca += line.qty * line.feed.ca;
    s.p += line.qty * line.feed.p;
    s.dm += line.qty * line.feed.dm;
  }
  return {
    tdn: Math.round(s.tdn),
    cp: Math.round(s.cp),
    ca: Math.round(s.ca * 10) / 10,
    p: Math.round(s.p * 10) / 10,
    dm: Math.round(s.dm),
  };
}

function rbpBounds(currentQty: number, feed?: FeedItem): { min: number; max: number } {
  if (feed && currentQty > 0) {
    return { min: rbpMinQty(feed, currentQty), max: rbpMaxQty(feed, currentQty) };
  }
  return {
    min: Math.round(currentQty * 0.75 * 100) / 100,
    max: Math.round(currentQty * 1.25 * 100) / 100,
  };
}

/** Every stated feed + optional auto mineral within RBP / caps. */
function linesForWay1Display(
  way1Inputs: RationFeedInput[],
  autoMineralId: string | null,
  result: RationResult
): RationLine[] {
  const farmerOnly = way1Inputs.filter((i) => i.currentQty > 0);
  const byId = new Map(result.lines.map((l) => [l.feed.id, l] as const));
  const lines: RationLine[] = farmerOnly.map((i) => {
      const { min, max } = rbpBounds(i.currentQty, i.feed);
      const hit = byId.get(i.feed.id);
      const qty = capFeedQty(i.feed, hit ? Math.min(max, Math.max(min, hit.qty)) : min);
      return {
        feed: i.feed,
        qty,
        price: i.price,
        cost: Math.round(qty * i.price * 100) / 100,
        currentQty: i.currentQty,
        suggested: false,
      };
    });

  if (autoMineralId) {
    const hit = byId.get(autoMineralId);
    const mineralInput = way1Inputs.find((i) => i.feed.id === autoMineralId);
    if (!mineralInput) return lines;
    const qty = capFeedQty(
      mineralInput.feed,
      hit && hit.qty > 0.005 ? hit.qty : 0.1
    );
    lines.push({
      feed: mineralInput.feed,
      qty,
      price: mineralInput.price,
      cost: Math.round(qty * mineralInput.price * 100) / 100,
      currentQty: 0,
      suggested: true,
    });
  }
  return lines;
}

function pickWay1Result(
  way1Inputs: RationFeedInput[],
  autoMineralId: string | null,
  profile: ReturnType<typeof animalProfileFromRecord>,
  requirement: ReturnType<typeof computeRequirement>
): { result: RationResult; meets: boolean; gaps: Partial<NutrientVector> } {
  const req = requirement.total;
  const farmerOnly = way1Inputs.filter((i) => i.currentQty > 0);
  const lp = optimizeRation(way1Inputs, profile, requirement, { boundMode: "rbp_stated" });

  const finalize = (base: RationResult): RationResult => {
    const lines = linesForWay1Display(way1Inputs, autoMineralId, base);
    const supply = lines.length ? supplyFromLines(lines) : base.supply;
    return {
      ...base,
      lines,
      totalCost: Math.round(lines.reduce((s, l) => s + l.cost, 0) * 100) / 100,
      supply,
    };
  };

  if (lp.feasible && lp.lines.length && meetsRequirement(lp.supply, req, lp.relaxed)) {
    return { result: finalize(lp), meets: true, gaps: {} };
  }

  if (lp.feasible && lp.lines.length) {
    const result = finalize(lp);
    return { result, meets: false, gaps: computeNutrientGaps(result.supply, req) };
  }

  const best = optimizeStatedBestEffort(way1Inputs, profile, requirement);
  const result = finalize(best);
  const currentCost = farmerOnly.reduce((acc, i) => acc + i.currentQty * i.price, 0);
  return {
    result: {
      ...result,
      feasible: result.lines.length > 0,
      currentCost: Math.round(currentCost * 100) / 100,
    },
    meets: false,
    gaps: computeNutrientGaps(result.supply, req),
  };
}

function pickWay2Result(
  namedInputs: RationFeedInput[],
  farmerFeedIds: Set<string>,
  neighborhoodFeedIds: Set<string>,
  profile: ReturnType<typeof animalProfileFromRecord>,
  requirement: ReturnType<typeof computeRequirement>,
  pool: FeedItem[],
  lang: "hi" | "en"
): {
  result: RationResult;
  meets: boolean;
  optionalSuggestions: string[];
} {
  const req = requirement.total;
  let lp = optimizeRation(namedInputs, profile, requirement, { boundMode: "farmer_plus_local" });
  let meets =
    lp.feasible && lp.lines.length > 0 && meetsRequirement(lp.supply, req, lp.relaxed);

  if (!meets) {
    const best = optimizeFarmerPlusNeighborhoodBestEffort(namedInputs, profile, requirement);
    if (best.lines.length) {
      lp = best;
      meets = meetsRequirement(best.supply, req, best.relaxed);
    }
  }

  const allowedIds = new Set([...farmerFeedIds, ...neighborhoodFeedIds]);
  const planLines = lp.lines
    .filter((l) => allowedIds.has(l.feed.id))
    .map((l) => ({
      ...l,
      qty: capFeedQty(l.feed, l.qty),
      cost: Math.round(capFeedQty(l.feed, l.qty) * l.price * 100) / 100,
    }));
  const supply = planLines.length ? supplyFromLines(planLines) : lp.supply;
  const gaps = meets ? {} : computeNutrientGaps(supply, req);
  const optionalSuggestions = suggestAlternatives(pool, gaps, allowedIds, lang);

  return {
    result: {
      ...lp,
      lines: planLines,
      totalCost: Math.round(planLines.reduce((s, l) => s + l.cost, 0) * 100) / 100,
      supply,
    },
    meets,
    optionalSuggestions,
  };
}

function planForAnimal(
  session: AdvisorySession,
  animal: AnimalRecord,
  farmerInputs: RationFeedInput[],
  neighborhoodInputs: RationFeedInput[],
  pool: FeedItem[],
  lang: "hi" | "en"
): AnimalRationPlan {
  const profile = animalProfileFromRecord(animal);
  const requirement = computeRequirement(profile);
  const farmerFeedIds = new Set(session.feeds.map((f) => f.feedId));
  const neighborhoodFeedIds = new Set((session.neighborhoodFeeds ?? []).map((f) => f.feedId));
  const hasNeighborhood = neighborhoodFeedIds.size > 0;

  const { inputs: way1Inputs, autoMineralId } = buildWay1Inputs(session);
  const way1 = pickWay1Result(way1Inputs, autoMineralId, profile, requirement);

  let way2Result: RationResult | null = null;
  let way2Meets = false;
  let way2OptionalSuggestions: string[] = [];
  let way2NeedsFarmerInput = !hasNeighborhood;
  let way2RegionalExamples: string[] = [];

  if (!hasNeighborhood) {
    way2RegionalExamples = regionalNeighborhoodExamples(pool, farmerFeedIds);
  } else {
    const way2 = pickWay2Result(
      neighborhoodInputs,
      farmerFeedIds,
      neighborhoodFeedIds,
      profile,
      requirement,
      pool,
      lang
    );
    way2Result = way2.result;
    way2Meets = way2.meets;
    way2OptionalSuggestions = way2.optionalSuggestions;
  }

  return {
    animal,
    requirement,
    way1Result: way1.result,
    way1MeetsNutrition: way1.meets,
    way1AutoMineralId: autoMineralId,
    nutrientGaps: way1.gaps,
    way2Result,
    way2MeetsNutrition: way2Meets,
    way2OptionalSuggestions,
    way2NeedsFarmerInput,
    way2RegionalExamples,
    way3Result: null,
    way3MeetsNutrition: false,
    way3Needed: false,
    way3LibraryAdditions: [],
    alternatives: [],
    farmerFeedIds: [...farmerFeedIds],
    neighborhoodFeedIds: [...neighborhoodFeedIds],
    farmerStated: session.feeds.map((f) => ({
      feedId: f.feedId,
      feedName: f.feedName,
      spokenName: f.spokenName,
      currentQty: f.qtyKg,
    })),
  };
}

export function computeHerdRation(session: AdvisorySession): HerdRationReport {
  const season = detectSeason();
  const pool = feedsForLocation(session.location, season);
  const farmerInputs = buildFarmerFeedInputs(session);
  const neighborhoodInputs = buildNeighborhoodFeedInputs(session);
  const lang = session.lang === "en" ? "en" : "hi";

  const plans = session.animals.map((animal) =>
    planForAnimal(session, animal, farmerInputs, neighborhoodInputs, pool, lang)
  );

  const totalDailyCost = plans.reduce(
    (s, p) => s + (p.way2Result?.totalCost ?? p.way1Result.totalCost),
    0
  );
  const totalCurrentCost = plans.reduce(
    (s, p) => s + (p.way2Result?.currentCost ?? p.way1Result.currentCost),
    0
  );

  return {
    season,
    plans,
    totalDailyCost: Math.round(totalDailyCost * 100) / 100,
    totalCurrentCost: Math.round(totalCurrentCost * 100) / 100,
    savings: Math.round((totalCurrentCost - totalDailyCost) * 100) / 100,
  };
}

/** Stated-feed recommendation within RBP ±25% band. */
function formatStatedFeedRecommendation(
  line: RationLine,
  lang: "hi" | "en",
  displayName: string
): string {
  const cur = line.currentQty;
  const rec = line.qty;
  const { min, max } = rbpBounds(cur, line.feed);

  if (Math.abs(rec - cur) < 0.15) {
    return lang === "hi"
      ? `${displayName}: रोज़ ${fmtKg(rec, lang)} दें — यह मात्रा ठीक है`
      : `${displayName}: give ${fmtKg(rec, lang)} daily — this amount is fine`;
  }
  if (rec > cur) {
    return lang === "hi"
      ? `${displayName}: रोज़ ${fmtKg(rec, lang)} दें (अभी ${fmtKg(cur, lang)}, बढ़ाकर ${fmtKg(max, lang)} तक)`
      : `${displayName}: give ${fmtKg(rec, lang)} daily (now ${fmtKg(cur, lang)}, may increase up to ${fmtKg(max, lang)})`;
  }
  return lang === "hi"
    ? `${displayName}: रोज़ ${fmtKg(rec, lang)} दें (अभी ${fmtKg(cur, lang)}, घटाकर ${fmtKg(min, lang)} तक)`
    : `${displayName}: give ${fmtKg(rec, lang)} daily (now ${fmtKg(cur, lang)}, may reduce down to ${fmtKg(min, lang)})`;
}

function formatAutoMineralLine(line: RationLine, lang: "hi" | "en", displayName: string): string {
  return lang === "hi"
    ? `${displayName}: रोज़ ${fmtKg(line.qty, lang)} दें (खनिज मिश्रण — हमेशा दें)`
    : `${displayName}: give ${fmtKg(line.qty, lang)} daily (mineral mixture — always give)`;
}

function formatNeighborhoodFeedLine(
  line: RationLine,
  lang: "hi" | "en",
  displayName: string
): string {
  return lang === "hi"
    ? `${displayName}: रोज़ ${fmtKg(line.qty, lang)} दें (आपने बताया — इलाके में मिलता है)`
    : `${displayName}: give ${fmtKg(line.qty, lang)} daily (local feed you mentioned)`;
}

function orderedWay2Lines(plan: AnimalRationPlan): RationLine[] {
  if (!plan.way2Result) return [];
  const byId = new Map(
    plan.way2Result.lines.filter((l) => l.qty > 0.05).map((l) => [l.feed.id, l] as const)
  );
  const ordered: RationLine[] = [];
  for (const id of plan.farmerFeedIds) {
    const line = byId.get(id);
    if (line) ordered.push(line);
  }
  for (const id of plan.neighborhoodFeedIds) {
    const line = byId.get(id);
    if (line) ordered.push(line);
  }
  return ordered;
}

function animalHeader(plan: AnimalRationPlan, lang: "hi" | "en"): string {
  const a = plan.animal;
  if (lang === "hi") {
    const label = a.species === "buffalo" ? "भैंस" : "गाय";
    return `\n${label}${a.inMilk ? `, ${a.milkYieldKg} लीटर दूध` : ", सूखी"}:`;
  }
  return `\n${a.label}${a.inMilk ? `, ${a.milkYieldKg} L milk` : ", dry"}:`;
}

function formatStatedPlanBlock(
  plan: AnimalRationPlan,
  lang: "hi" | "en",
  spokenMap: Map<string, string>
): string[] {
  const lines: string[] = [animalHeader(plan, lang)];

  const displayById = new Map(plan.farmerStated.map((f) => [f.feedId, f.currentQty] as const));

  for (const line of plan.way1Result.lines) {
    const name = feedLabel(line.feed.id, lang, spokenMap);
    if (plan.way1AutoMineralId && line.feed.id === plan.way1AutoMineralId) {
      lines.push(`- ${formatAutoMineralLine(line, lang, name)}`);
    } else {
      lines.push(
        `- ${formatStatedFeedRecommendation(
          { ...line, currentQty: displayById.get(line.feed.id) ?? line.currentQty },
          lang,
          name
        )}`
      );
    }
  }

  if (plan.way1Result.lines.length) {
    lines.push(
      lang === "hi"
        ? `- रोज़ खर्च लगभग ${fmtRs(plan.way1Result.totalCost)} (अभी ${fmtRs(plan.way1Result.currentCost)})।`
        : `- Daily cost about ${fmtRs(plan.way1Result.totalCost)} (you now spend ${fmtRs(plan.way1Result.currentCost)}).`
    );
  }

  lines.push(
    nutritionStatusLine(
      plan.way1MeetsNutrition,
      plan.way1Result.supply,
      plan.way1Result.requirement,
      lang
    )
  );

  lines.push(
    lang === "hi"
      ? "\nक्या आपके इलाके में और चारा मिलता है?"
      : "\nCan you get any other feeds in your area?"
  );

  return lines;
}

function formatLocalPlanBlock(
  plan: AnimalRationPlan,
  lang: "hi" | "en",
  spokenMap: Map<string, string>
): string[] {
  const lines: string[] = [animalHeader(plan, lang)];

  if (!plan.way2Result?.lines.length) {
    lines.push(
      lang === "hi" ? "- अभी पूरी खुराक तैयार नहीं हो पाई।" : "- Could not build a full ration yet."
    );
    return lines;
  }

  const displayById = new Map(plan.farmerStated.map((f) => [f.feedId, f.currentQty] as const));
  const neighborhoodIds = new Set(plan.neighborhoodFeedIds);

  for (const line of orderedWay2Lines(plan)) {
    const name = feedLabel(line.feed.id, lang, spokenMap);
    if (neighborhoodIds.has(line.feed.id)) {
      lines.push(`- ${formatNeighborhoodFeedLine(line, lang, name)}`);
    } else {
      lines.push(
        `- ${formatStatedFeedRecommendation(
          { ...line, currentQty: displayById.get(line.feed.id) ?? line.currentQty },
          lang,
          name
        )}`
      );
    }
  }

  lines.push(
    lang === "hi"
      ? `- रोज़ कुल खर्च लगभग ${fmtRs(plan.way2Result.totalCost)} (अभी आप ${fmtRs(plan.way2Result.currentCost)} खर्च करते हैं)।`
      : `- Total daily cost about ${fmtRs(plan.way2Result.totalCost)} (you now spend ${fmtRs(plan.way2Result.currentCost)}).`
  );

  lines.push(
    nutritionStatusLine(
      plan.way2MeetsNutrition,
      plan.way2Result.supply,
      plan.way2Result.requirement,
      lang
    )
  );

  if (plan.way2OptionalSuggestions.length) {
    lines.push(lang === "hi" ? "\nज़रूरत हो तो ये भी दे सकते हैं:" : "\nOptional extras if needed:");
    for (const tip of plan.way2OptionalSuggestions) {
      lines.push(`- ${tip}`);
    }
  }

  return lines;
}

export function formatPlanSummary(
  report: HerdRationReport,
  lang: "hi" | "en" = "hi",
  session?: AdvisorySession
): string {
  const spokenMap = buildSpokenMap(session);
  const hasNeighborhood = report.plans.some((p) => !p.way2NeedsFarmerInput && p.way2Result);

  if (hasNeighborhood) {
    const lines: string[] = [];
    for (const plan of report.plans) {
      lines.push(...formatLocalPlanBlock(plan, lang, spokenMap));
    }
    return lines.join("\n");
  }

  const lines: string[] = [];
  for (const plan of report.plans) {
    lines.push(...formatStatedPlanBlock(plan, lang, spokenMap));
  }
  return lines.join("\n");
}
