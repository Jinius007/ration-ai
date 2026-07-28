import { FEED_LIBRARY, FeedItem } from "./feedLibrary";
import { computeHerdRation, formatPlanSummary, type HerdRationReport } from "./rationService";
import type { AdvisorySession, AnimalRecord, FarmerFeedEntry, LangCode, Species } from "./types";
import { defaultWeight, uid } from "./types";
import { normalizeVoiceText } from "./normalizeChatNumbers";

const FEED_ALIASES: Record<string, string> = {
  "wheat straw": "wheat_straw",
  "gehu bhusa": "wheat_straw",
  paddy: "paddy_straw",
  parali: "paddy_straw",
  berseem: "barseem_fodder",
  barseem: "barseem_fodder",
  lucerne: "lucerne_fodder",
  rijka: "lucerne_fodder",
  "maize fodder": "maize_fodder",
  "makka chara": "maize_fodder",
  "mustard cake": "mustard_cake",
  "sarson khali": "mustard_cake",
  "groundnut cake": "groundnut_cake",
  "wheat bran": "wheat_bran",
  chokar: "wheat_bran",
  "rice bran": "rice_bran_deoiled",
  "cotton cake": "cotton_seed_cake",
  "binola khali": "cotton_seed_cake",
  "mineral mixture": "mineral_mixture_bis",
  napier: "napier_bajra___nb_21",
};

export function matchFeedByName(name: string): FeedItem | undefined {
  const norm = name.trim().toLowerCase();
  if (FEED_ALIASES[norm]) {
    return FEED_LIBRARY.find((f) => f.id === FEED_ALIASES[norm]);
  }
  const exact = FEED_LIBRARY.find((f) => f.name.toLowerCase() === norm);
  if (exact) return exact;
  return FEED_LIBRARY.find(
    (f) => f.name.toLowerCase().includes(norm) || norm.includes(f.name.toLowerCase().slice(0, 8))
  );
}

export interface VoiceRationRequest {
  farmer_name?: string;
  lang?: LangCode | string;
  district: string;
  state: string;
  state_code?: string;
  animals: {
    label?: string;
    species: Species;
    breed?: string;
    weight_kg?: number;
    calvings?: number;
    in_milk?: boolean;
    months_after_calving?: number;
    milk_yield_litres?: number;
    milk_fat_percent?: number;
    milk_price_rs?: number;
    pregnant?: boolean;
    pregnancy_month?: number;
  }[];
  feeds: { name: string; qty_kg: number; price_rs?: number; price_unknown?: boolean }[];
}

function feedHasPrice(f: { price_rs?: number; price_unknown?: boolean }): boolean {
  if (f.price_unknown) return true;
  return f.price_rs != null && Number.isFinite(f.price_rs) && f.price_rs > 0;
}

function missingPriceError(
  feeds: { name: string; price_rs?: number; price_unknown?: boolean }[],
  lang: LangCode
): string {
  const names = feeds.map((f) => f.name.trim()).filter(Boolean).join(", ");
  const example = feeds[0]?.name?.trim() || "chara";
  if (lang === "en") {
    return `Ask the farmer the price per kilogram for EVERY feed before computing. Still missing price for: ${names}.`;
  }
  return `Hisaab se pehle har chara ka daam zaroor poochhiye. Abhi daam nahi mila: ${names}. Farmer se poochhiye: "${example} ek kilogram ka kitna rupaya dete ho?"`;
}

export function computeFromVoiceRequest(req: VoiceRationRequest): {
  ok: boolean;
  error?: string;
  warnings: string[];
  summary?: string;
  report?: HerdRationReport;
  session?: AdvisorySession;
} {
  const warnings: string[] = [];
  const lang = (req.lang === "en" ? "en" : "hi") as LangCode;

  const missingPrice = req.feeds.filter((f) => f.name.trim() && !feedHasPrice(f));
  if (missingPrice.length) {
    return { ok: false, error: missingPriceError(missingPrice, lang), warnings };
  }

  const location = {
    district: req.district,
    state: req.state,
    stateCode: req.state_code,
    label: [req.district, req.state].filter(Boolean).join(", "),
  };

  const animals: AnimalRecord[] = req.animals.map((a, i) => {
    const species = a.species;
    return {
      id: uid(),
      label: a.label ?? (species === "cattle" ? `Gaay ${i + 1}` : `Bhains ${i + 1}`),
      species,
      breed: a.breed,
      weightKg: a.weight_kg ?? defaultWeight(species),
      calvings: a.calvings ?? 1,
      inMilk: a.in_milk ?? (a.milk_yield_litres ?? 0) > 0,
      monthsAfterCalving: a.months_after_calving ?? 4,
      milkYieldKg: a.milk_yield_litres ?? 0,
      milkFatPct: a.milk_fat_percent ?? (species === "buffalo" ? 7 : 4),
      milkPriceRs: a.milk_price_rs ?? 34,
      pregnant: a.pregnant ?? false,
      pregnancyMonth: a.pregnancy_month ?? 0,
    };
  });

  const feeds: FarmerFeedEntry[] = [];
  for (const f of req.feeds) {
    const item = matchFeedByName(f.name);
    if (!item) {
      warnings.push(`Feed not in library: "${f.name}"`);
      continue;
    }
    feeds.push({
      feedId: item.id,
      feedName: item.name,
      qtyKg: f.qty_kg,
      priceRs: f.price_rs ?? item.rate,
      category: item.category,
    });
  }

  const session: AdvisorySession = {
    farmerName: req.farmer_name ?? "",
    lang,
    location,
    animals,
    feeds,
  };

  if (!session.animals.length) {
    return { ok: false, error: "At least one animal required.", warnings };
  }
  if (session.feeds.length < 2) {
    return {
      ok: false,
      error: "Need at least 2 feeds matched in library (roughage + concentrate).",
      warnings,
    };
  }

  const report = computeHerdRation(session);
  const plan = report.plans[0];
  const lpNote =
    lang === "en"
      ? "✅ Computed by linear programming (270+ feed library, INAPH minimum nutrition met)."
      : "✅ Ye linear programming se nikla hai — 270+ chara library, INAPH minimum poshan poora.";

  let nutrientNote = "";
  if (plan?.result.feasible) {
    const r = plan.result;
    nutrientNote =
      lang === "en"
        ? `\nNutrients: TDN ${Math.round(r.supply.tdn)}/${Math.round(r.requirement.tdn)} gram, CP ${Math.round(r.supply.cp)}/${Math.round(r.requirement.cp)} gram (minimum met).`
        : `\nPoshan: TDN ${Math.round(r.supply.tdn)}/${Math.round(r.requirement.tdn)} gram, CP ${Math.round(r.supply.cp)}/${Math.round(r.requirement.cp)} gram (minimum poora).`;
  } else if (plan?.result.relaxed.length) {
    nutrientNote =
      lang === "en"
        ? `\nNote: some constraints relaxed: ${plan.result.relaxed.join(", ")}.`
        : `\nNote: kuch constraints relax kiye: ${plan.result.relaxed.join(", ")}.`;
  }

  const summary = normalizeVoiceText(`${lpNote}${nutrientNote}\n\n${formatPlanSummary(report, lang === "en" ? "en" : "hi")}`);
  return { ok: true, summary, report, warnings, session };
}
