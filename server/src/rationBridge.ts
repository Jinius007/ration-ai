import { FEED_LIBRARY, FeedItem } from "./lib/feedLibrary.js";
import { computeHerdRation, formatPlanSummary } from "./lib/rationService.js";
import type { AdvisorySession, AnimalRecord, FarmerFeedEntry, LangCode, Species } from "./lib/types.js";
import { defaultWeight, uid } from "./lib/types.js";

const FEED_ALIASES: Record<string, string> = {
  "wheat straw": "wheat_straw",
  "gehu bhusa": "wheat_straw",
  "gehu ka bhusa": "wheat_straw",
  "paddy straw": "paddy_straw",
  "parali": "paddy_straw",
  "dhan ki pural": "paddy_straw",
  "berseem": "barseem_fodder",
  "barseem": "barseem_fodder",
  "rijka": "lucerne_fodder",
  "lucerne": "lucerne_fodder",
  "maize fodder": "maize_fodder",
  "makka chara": "maize_fodder",
  "jowar fodder": "jowar_fodder",
  "mustard cake": "mustard_cake",
  "sarson khali": "mustard_cake",
  "sarson ki khali": "mustard_cake",
  "groundnut cake": "groundnut_cake",
  "moongphali khali": "groundnut_cake",
  "wheat bran": "wheat_bran",
  "chokar": "wheat_bran",
  "rice bran": "rice_bran_deoiled",
  "cotton cake": "cotton_seed_cake",
  "binola khali": "cotton_seed_cake",
  "maize grain": "maize_grain",
  "makka dan": "maize_grain",
  "cattle feed": "cattle_feed_bis_ii",
  "compound feed": "cattle_feed_bis_ii",
  "mineral mixture": "mineral_mixture_bis",
  "mineral mix": "mineral_mixture_bis",
  "napier": "napier_bajra___nb_21",
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

export interface VoiceAnimalInput {
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
}

export interface VoiceFeedInput {
  name: string;
  qty_kg: number;
  price_rs?: number;
}

export interface VoiceRationRequest {
  farmer_name?: string;
  lang?: LangCode;
  district: string;
  state: string;
  state_code?: string;
  animals: VoiceAnimalInput[];
  feeds: VoiceFeedInput[];
}

export function sessionFromVoiceRequest(req: VoiceRationRequest): {
  session: AdvisorySession;
  warnings: string[];
} {
  const warnings: string[] = [];
  const lang = req.lang ?? "hi";
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
      warnings.push(`Feed not found in library: "${f.name}" — skipped`);
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

  return {
    session: {
      farmerName: req.farmer_name ?? "",
      lang,
      location,
      animals,
      feeds,
    },
    warnings,
  };
}

export function computeFromVoiceRequest(req: VoiceRationRequest) {
  const { session, warnings } = sessionFromVoiceRequest(req);
  if (!session.animals.length) {
    return { ok: false as const, error: "At least one animal required.", warnings };
  }
  if (session.feeds.length < 2) {
    return {
      ok: false as const,
      error: "Need at least 2 feeds (green/dry roughage + concentrate). Ask farmer what they feed.",
      warnings,
    };
  }
  const report = computeHerdRation(session);
  const summary = formatPlanSummary(report, session.lang === "en" ? "en" : "hi");
  return { ok: true as const, report, summary, warnings, session };
}
