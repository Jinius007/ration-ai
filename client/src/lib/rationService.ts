import { computeRequirement } from "./nutrientRequirements";
import { optimizeRation, RationFeedInput, RationResult } from "./rationOptimizer";
import { feedById, feedsForLocation } from "./regionalFeeds";
import { mineralMixtureIdForLocation } from "./location";
import {
  AdvisorySession,
  AnimalRecord,
  FarmerFeedEntry,
  animalProfileFromRecord,
  detectSeason,
} from "./types";

export interface AnimalRationPlan {
  animal: AnimalRecord;
  requirement: ReturnType<typeof computeRequirement>;
  result: RationResult;
}

export interface HerdRationReport {
  season: string;
  plans: AnimalRationPlan[];
  totalDailyCost: number;
  totalCurrentCost: number;
  savings: number;
}

function buildFeedInputs(session: AdvisorySession): RationFeedInput[] {
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

  // Drop feeds not relevant if farmer didn't mention them (keep pool + farmer entries only)
  return inputs.filter((i) => poolIds.has(i.feed.id) || session.feeds.some((e) => e.feedId === i.feed.id));
}

export function computeHerdRation(session: AdvisorySession): HerdRationReport {
  const inputs = buildFeedInputs(session);
  const plans: AnimalRationPlan[] = session.animals.map((animal) => {
    const profile = animalProfileFromRecord(animal);
    const requirement = computeRequirement(profile);
    const result = optimizeRation(inputs, profile, requirement);
    return { animal, requirement, result };
  });

  const totalDailyCost = plans.reduce((s, p) => s + p.result.totalCost, 0);
  const totalCurrentCost = plans.reduce((s, p) => s + p.result.currentCost, 0);

  return {
    season: detectSeason(),
    plans,
    totalDailyCost: Math.round(totalDailyCost * 100) / 100,
    totalCurrentCost: Math.round(totalCurrentCost * 100) / 100,
    savings: Math.round((totalCurrentCost - totalDailyCost) * 100) / 100,
  };
}

export function formatPlanSummary(report: HerdRationReport, lang: "hi" | "en" = "hi"): string {
  const lines: string[] = [];
  if (lang === "hi") {
    lines.push(`📋 ${report.plans.length} पशुओं के लिए संतुलित खुराक (RBP)`);
    lines.push(`💰 कुल दैनिक लागत: ₹${report.totalDailyCost} (पहले ₹${report.totalCurrentCost})`);
    if (report.savings > 0) lines.push(`✅ संभावित बचत: ₹${report.savings}/दिन`);
  } else {
    lines.push(`📋 Balanced ration for ${report.plans.length} animal(s) (NDDB RBP)`);
    lines.push(`💰 Total daily cost: ₹${report.totalDailyCost} (was ₹${report.totalCurrentCost})`);
    if (report.savings > 0) lines.push(`✅ Possible saving: ₹${report.savings}/day`);
  }

  for (const plan of report.plans) {
    const a = plan.animal;
    const title =
      lang === "hi"
        ? `${a.label} — ${a.inMilk ? `${a.milkYieldKg} L doodh` : "sukhi"}`
        : `${a.label} — ${a.inMilk ? `${a.milkYieldKg} L milk` : "dry"}`;
    lines.push(`\n🐄 ${title}`);
    if (!plan.result.feasible) {
      lines.push(lang === "hi" ? "⚠️ समाधान संभव नहीं — और चारा जोड़ें" : "⚠️ No feasible mix — add more feeds");
      continue;
    }
    for (const line of plan.result.lines) {
      lines.push(`  • ${line.feed.name}: ${line.qty} kg (₹${line.cost})`);
    }
    lines.push(
      lang === "hi"
        ? `  TDN ${plan.result.supply.tdn}/${plan.result.requirement.tdn} g, CP ${plan.result.supply.cp}/${plan.result.requirement.cp} g`
        : `  TDN ${plan.result.supply.tdn}/${plan.result.requirement.tdn} g, CP ${plan.result.supply.cp}/${plan.result.requirement.cp} g`
    );
  }
  return lines.join("\n");
}
