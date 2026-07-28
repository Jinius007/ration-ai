import type { NutrientVector } from "./nutrientRequirements";
import { computeRequirement } from "./nutrientRequirements";
import {
  optimizeRation,
  RationFeedInput,
  RationLine,
  RationResult,
  supplyAtFarmerMax,
} from "./rationOptimizer";
import { feedById, feedsForLocation } from "./regionalFeeds";
import type { FeedItem } from "./feedLibrary";
import { mineralMixtureIdForLocation } from "./location";
import {
  AdvisorySession,
  AnimalRecord,
  animalProfileFromRecord,
  detectSeason,
} from "./types";

export interface AnimalRationPlan {
  animal: AnimalRecord;
  requirement: ReturnType<typeof computeRequirement>;
  /** Optimised using only feeds the farmer said they use (±25%). */
  farmerOnlyResult: RationResult;
  /** True when farmer feeds alone meet INAPH needs without library additions. */
  farmerOnlyAdequate: boolean;
  /** Shortfall after farmer-only phase (empty if adequate). */
  nutrientGaps: Partial<NutrientVector>;
  /** Full plan: farmer feeds + library supplements. */
  result: RationResult;
  /** Feeds added from the regional library (not in farmer list). */
  libraryAdditions: RationLine[];
  /** Lines to show in step 1 (farmer feeds, optimised or at entered qty). */
  farmerDisplayLines: RationLine[];
  /** Feeds the farmer said they use (for tagging library additions). */
  farmerFeedIds: string[];
  /** Other library feeds that could help fill remaining gaps. */
  alternatives: string[];
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
    return `${g} gram`;
  }
  const rounded = Math.round(kg);
  return lang === "hi" ? `${rounded} किलोग्राम` : `${rounded} kilogram`;
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
    let score = 0;
    const reasons: string[] = [];
    if (gaps.tdn && f.tdn > 80) {
      score += f.tdn / Math.max(f.rate, 1);
      reasons.push(lang === "hi" ? "urja" : "energy");
    }
    if (gaps.cp && f.cp > 40) {
      score += (f.cp * 2) / Math.max(f.rate, 1);
      reasons.push(lang === "hi" ? "protein" : "protein");
    }
    if (gaps.ca && f.ca > 2) {
      score += f.ca * 10;
      reasons.push(lang === "hi" ? "calcium" : "calcium");
    }
    if (gaps.p && f.p > 1) {
      score += f.p * 10;
      reasons.push(lang === "hi" ? "phosphorus" : "phosphorus");
    }
    if (score > 0) {
      const reasonStr =
        lang === "hi"
          ? `${reasons.join(" + ")} ke liye upyukt`
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
      kg = Math.round(kg * 100) / 100;
      return lang === "hi"
        ? `${s.feed.name} — ${fmtKg(kg, lang)} roz (${s.reason})`
        : `${s.feed.name} — ${fmtKg(kg, lang)} daily (${s.reason})`;
    });
}

function planForAnimal(
  session: AdvisorySession,
  animal: AnimalRecord,
  farmerInputs: RationFeedInput[],
  fullInputs: RationFeedInput[],
  pool: FeedItem[],
  lang: "hi" | "en"
): AnimalRationPlan {
  const profile = animalProfileFromRecord(animal);
  const requirement = computeRequirement(profile);
  const req = requirement.total;
  const farmerFeedIds = new Set(session.feeds.map((f) => f.feedId));

  const farmerOnlyResult = optimizeRation(farmerInputs, profile, requirement);
  const farmerSupply =
    farmerOnlyResult.feasible && farmerOnlyResult.lines.length
      ? farmerOnlyResult.supply
      : supplyAtFarmerMax(farmerInputs);

  const farmerOnlyAdequate = meetsRequirement(
    farmerSupply,
    req,
    farmerOnlyResult.relaxed
  );
  const nutrientGaps = farmerOnlyAdequate ? {} : computeNutrientGaps(farmerSupply, req);

  const result = optimizeRation(fullInputs, profile, requirement);
  const libraryAdditions = result.lines.filter((l) => !farmerFeedIds.has(l.feed.id));

  const farmerDisplayLines: RationLine[] =
    farmerOnlyResult.feasible && farmerOnlyResult.lines.length
      ? farmerOnlyResult.lines
      : farmerInputs
          .filter((i) => i.currentQty > 0)
          .map((i) => ({
            feed: i.feed,
            qty: i.currentQty,
            price: i.price,
            cost: Math.round(i.currentQty * i.price * 100) / 100,
            currentQty: i.currentQty,
            suggested: false,
          }));

  const usedIds = new Set(result.lines.map((l) => l.feed.id));
  const alternatives = suggestAlternatives(pool, nutrientGaps, usedIds, lang);

  return {
    animal,
    requirement,
    farmerOnlyResult,
    farmerOnlyAdequate,
    nutrientGaps,
    result,
    libraryAdditions,
    farmerDisplayLines,
    farmerFeedIds: [...farmerFeedIds],
    alternatives,
  };
}

export function computeHerdRation(session: AdvisorySession): HerdRationReport {
  const season = detectSeason();
  const pool = feedsForLocation(session.location, season);
  const farmerInputs = buildFarmerFeedInputs(session);
  const fullInputs = buildFullFeedInputs(session);
  const lang = session.lang === "en" ? "en" : "hi";

  const plans = session.animals.map((animal) =>
    planForAnimal(session, animal, farmerInputs, fullInputs, pool, lang)
  );

  const totalDailyCost = plans.reduce((s, p) => s + p.result.totalCost, 0);
  const totalCurrentCost = plans.reduce((s, p) => s + p.result.currentCost, 0);

  return {
    season,
    plans,
    totalDailyCost: Math.round(totalDailyCost * 100) / 100,
    totalCurrentCost: Math.round(totalCurrentCost * 100) / 100,
    savings: Math.round((totalCurrentCost - totalDailyCost) * 100) / 100,
  };
}

/** Advice when quantity should go up, down, or stay the same. */
function formatFarmerFeedAdvice(
  line: RationLine,
  lang: "hi" | "en",
  needsAdditionalFeeds: boolean
): string {
  const cur = line.currentQty;
  const rec = line.qty;
  const name = line.feed.name;
  if (cur <= 0) return "";

  if (rec < 0.05) {
    return lang === "hi"
      ? `Aap ${name} ${fmtKg(cur, lang)} dete the — ab iski zarurat nahi, hata sakte ho.`
      : `You give ${fmtKg(cur, lang)} ${name} — you can stop this; it is not needed now.`;
  }

  if (Math.abs(rec - cur) < 0.2) {
    return lang === "hi"
      ? `${name} ${fmtKg(rec, lang)} theek hai.`
      : `${name} at ${fmtKg(rec, lang)} is fine.`;
  }

  if (rec > cur) {
    return lang === "hi"
      ? `Aap ${name} ${fmtKg(cur, lang)} dete the — poshan poora karne ke liye ${fmtKg(rec, lang)} dena hoga.`
      : `You give ${fmtKg(cur, lang)} ${name} — increase to ${fmtKg(rec, lang)} for full nutrition.`;
  }

  if (needsAdditionalFeeds) {
    return lang === "hi"
      ? `Aap ${name} ${fmtKg(cur, lang)} dete the — poori khurak mein ${fmtKg(rec, lang)} kaafi hai (saath mein neeche wala chara bhi dena hai).`
      : `You give ${fmtKg(cur, lang)} ${name} — in the full ration ${fmtKg(rec, lang)} is enough (give the extras below too).`;
  }

  return lang === "hi"
    ? `Aap ${name} ${fmtKg(cur, lang)} dete the — poshan aur kharch ke liye ${fmtKg(rec, lang)} kaafi hai, thoda kam kar sakte ho.`
    : `You give ${fmtKg(cur, lang)} ${name} — for nutrition and cost, ${fmtKg(rec, lang)} is enough; you can reduce a little.`;
}

function formatAdditionAdvice(line: RationLine, lang: "hi" | "en"): string {
  return lang === "hi"
    ? `${line.feed.name} ${fmtKg(line.qty, lang)} roz`
    : `${line.feed.name} ${fmtKg(line.qty, lang)} daily`;
}

export function formatPlanSummary(report: HerdRationReport, lang: "hi" | "en" = "hi"): string {
  const lines: string[] = [];

  if (lang === "hi") {
    lines.push("Aapke pashu ke liye khurak ki salah:");
  } else {
    lines.push("Feeding advice for your animal:");
  }

  for (const plan of report.plans) {
    const a = plan.animal;
    const animalLine =
      lang === "hi"
        ? `\n${a.label}${a.inMilk ? `, ${a.milkYieldKg} litre doodh` : ", sukha"}:`
        : `\n${a.label}${a.inMilk ? `, ${a.milkYieldKg} L milk` : ", dry"}:`;
    lines.push(animalLine);

    const farmerIds = new Set(plan.farmerFeedIds);
    const needsExtras = !plan.farmerOnlyAdequate && plan.libraryAdditions.length > 0;

    const recLines = plan.farmerOnlyAdequate
      ? plan.farmerOnlyResult.lines
      : plan.result.feasible
        ? plan.result.lines.filter((l) => farmerIds.has(l.feed.id))
        : plan.farmerOnlyResult.lines;

    const farmerRecById = new Map(recLines.map((l) => [l.feed.id, l] as const));

    if (plan.farmerDisplayLines.length) {
      lines.push(lang === "hi" ? "\nJo aap ab khilate ho:" : "\nWhat you feed now:");
      for (const display of plan.farmerDisplayLines) {
        const rec = farmerRecById.get(display.feed.id);
        if (rec) {
          const advice = formatFarmerFeedAdvice(
            { ...rec, currentQty: display.currentQty },
            lang,
            needsExtras
          );
          if (advice) lines.push(`- ${advice}`);
        } else if (plan.result.feasible) {
          lines.push(
            lang === "hi"
              ? `- Aap ${display.feed.name} ${fmtKg(display.currentQty, lang)} dete the — ab iski zarurat nahi, hata sakte ho.`
              : `- You give ${fmtKg(display.currentQty, lang)} ${display.feed.name} — you can stop this now.`
          );
        } else {
          lines.push(
            lang === "hi"
              ? `- Aap ${display.feed.name} ${fmtKg(display.currentQty, lang)} dete the.`
              : `- You give ${fmtKg(display.currentQty, lang)} ${display.feed.name}.`
          );
        }
      }
    }

    if (plan.farmerOnlyAdequate) {
      lines.push(
        lang === "hi"
          ? "\nAapke chara se poshan poora ho sakta hai — bas upar wali matra follow karein."
          : "\nYour feeds can meet nutrition — follow the amounts above."
      );
    } else {
      lines.push(
        lang === "hi"
          ? "\nSirf in charo se poshan poora nahi hota."
          : "\nThese feeds alone do not meet full nutrition needs."
      );
    }

    if (plan.libraryAdditions.length) {
      lines.push(
        lang === "hi"
          ? "\nPoshan ki zarurat poora karne ke liye aapko yeh bhi dena chahiye:"
          : "\nTo meet nutrition, you should also give:"
      );
      for (const line of plan.libraryAdditions) {
        lines.push(`- ${formatAdditionAdvice(line, lang)}`);
      }
    }

    if (!plan.result.feasible) {
      lines.push(
        lang === "hi"
          ? "\nAbhi poori khurak tayyar nahi ho payi — aur chara batayein ya vet se salah lein."
          : "\nCould not build a full ration yet — share more feeds or consult your vet."
      );
      continue;
    }

    lines.push(
      lang === "hi"
        ? `\nRoz ki kul kharch lagbhag ${fmtRs(plan.result.totalCost)} (abhi aap ${fmtRs(plan.result.currentCost)} kharch karte ho).`
        : `\nTotal daily cost about ${fmtRs(plan.result.totalCost)} (you now spend ${fmtRs(plan.result.currentCost)}).`
    );
    if (plan.result.currentCost - plan.result.totalCost > 0.5) {
      const save = Math.round((plan.result.currentCost - plan.result.totalCost) * 100) / 100;
      lines.push(
        lang === "hi"
          ? `Is salah se lagbhag ${fmtRs(save)} bach sakte ho.`
          : `You may save about ${fmtRs(save)} per day.`
      );
    }

    if (plan.alternatives.length) {
      lines.push(
        lang === "hi"
          ? "\nAap yeh bhi de sakte hain (vikalp):"
          : "\nYou can also use these alternatives:"
      );
      for (const alt of plan.alternatives) {
        lines.push(`- ${alt}`);
      }
    }
  }

  return lines.join("\n");
}
