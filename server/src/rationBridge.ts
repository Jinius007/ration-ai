import { FEED_LIBRARY, FeedItem } from "./lib/feedLibrary.js";
import { formatEstimatedPriceNote, resolveFeedPrice } from "./lib/feedPrice.js";
import { computeHerdRation, formatPlanSummary } from "./lib/rationService.js";
import type { AdvisorySession, AnimalRecord, FarmerFeedEntry, LangCode, Species } from "./lib/types.js";
import { defaultWeight, uid } from "./lib/types.js";
import { normalizeVoiceText } from "./lib/voiceText.js";

const FEED_ALIASES: Record<string, string> = {
  "wheat straw": "wheat_straw",
  "gehu bhusa": "wheat_straw",
  "gehu ka bhusa": "wheat_straw",
  "gehun ka bhoosa": "wheat_straw",
  "gehun ki bhoosi": "wheat_straw",
  "gehun ka bhusa": "wheat_straw",
  "paddy straw": "paddy_straw",
  "parali": "paddy_straw",
  "dhan ki pural": "paddy_straw",
  "berseem": "barseem_fodder",
  "barseem": "barseem_fodder",
  "rijka": "lucerne_fodder",
  "lucerne": "lucerne_fodder",
  "maize fodder": "maize_fodder",
  "makka chara": "maize_fodder",
  "makke ka hara chara": "maize_fodder",
  "makka hara chara": "maize_fodder",
  "makke ka hara": "maize_fodder",
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
  "amul daan": "cattle_feed_bis_ii",
  "amul dan": "cattle_feed_bis_ii",
  "mineral mixture": "mineral_mixture_bis",
  "mineral mix": "mineral_mixture_bis",
  "napier": "grass_hybrid_napier",
  "hybrid napier": "grass_hybrid_napier",
  "napier hybrid": "grass_hybrid_napier",
  "napier hybrid grass": "grass_hybrid_napier",
  "hybrid napier grass": "grass_hybrid_napier",
  "hybrid napier ghass": "grass_hybrid_napier",
  "napier ghass": "grass_hybrid_napier",
  "napier bajra": "napier_bajra___nb_21",
};

function tokenScore(query: string, feedName: string): number {
  const tokens = query.split(/\s+/).filter((t) => t.length > 2);
  const fn = feedName.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (fn.includes(t)) score += t.length;
  }
  if (query.includes("napier") && fn.includes("napier")) score += 10;
  if (query.includes("hybrid") && fn.includes("hybrid")) score += 8;
  if (query.includes("ghass") && fn.includes("grass")) score += 6;
  if (query.includes("grass") && fn.includes("grass")) score += 6;
  return score;
}

export function matchFeedByName(name: string): FeedItem | undefined {
  const norm = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!norm) return undefined;
  if (FEED_ALIASES[norm]) {
    return FEED_LIBRARY.find((f) => f.id === FEED_ALIASES[norm]);
  }
  const exact = FEED_LIBRARY.find((f) => f.name.toLowerCase() === norm);
  if (exact) return exact;

  let best: { feed: FeedItem; score: number } | null = null;
  for (const f of FEED_LIBRARY) {
    const score = tokenScore(norm, f.name);
    if (score > 0 && (!best || score > best.score)) best = { feed: f, score };
  }
  if (best && best.score >= 8) return best.feed;

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
  /** True when farmer explicitly said they don't know the price — library estimate allowed */
  price_unknown?: boolean;
}

export interface VoiceRationRequest {
  farmer_name?: string;
  lang?: LangCode;
  district: string;
  state: string;
  state_code?: string;
  animals: VoiceAnimalInput[];
  feeds: VoiceFeedInput[];
  /** Feeds farmer can get locally but did not list as current ration. */
  neighborhood_feeds?: VoiceFeedInput[];
}

function feedHasPrice(f: VoiceFeedInput): boolean {
  if (f.price_unknown) return true;
  return f.price_rs != null && Number.isFinite(f.price_rs) && f.price_rs > 0;
}

function missingPriceError(feeds: VoiceFeedInput[], lang: "hi" | "en"): string {
  const names = feeds.map((f) => f.name.trim()).filter(Boolean).join(", ");
  const example = feeds[0]?.name?.trim() || "chara";
  if (lang === "en") {
    return `Ask the farmer the price per kilogram for EVERY feed before computing. Still missing price for: ${names}. Ask e.g. "How much per kilogram for ${example}?" If they don't know, farmer may say so — then send price_unknown: true for that feed.`;
  }
  return `Hisaab se pehle har chara ka daam zaroor poochhiye. Abhi daam nahi mila: ${names}. Farmer se poochhiye: "${example} ek kilogram ka kitna rupaya dete ho?" Agar pata nahi ho to farmer "pata nahi" kahe — tab us chara ke liye price_unknown true bhejiye, market rate lagega.`;
}

function feedsMissingPrice(feeds: VoiceFeedInput[]): VoiceFeedInput[] {
  return feeds.filter((f) => f.name.trim() && !feedHasPrice(f));
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
  const estimatedPrices: { name: string; price: number }[] = [];
  for (const f of req.feeds) {
    const item = matchFeedByName(f.name);
    if (!item) {
      warnings.push(`Feed not found in library: "${f.name}" — skipped`);
      continue;
    }
    const { price, estimated } = resolveFeedPrice(f.price_rs, item);
    if (estimated) estimatedPrices.push({ name: item.name, price });
    feeds.push({
      feedId: item.id,
      feedName: item.name,
      spokenName: f.name.trim(),
      qtyKg: f.qty_kg,
      priceRs: price,
      category: item.category,
    });
  }

  const neighborhoodFeeds: FarmerFeedEntry[] = [];
  for (const f of req.neighborhood_feeds ?? []) {
    const item = matchFeedByName(f.name);
    if (!item) {
      warnings.push(`Neighborhood feed not found: "${f.name}" — skipped`);
      continue;
    }
    const { price, estimated } = resolveFeedPrice(f.price_rs, item);
    if (estimated) estimatedPrices.push({ name: item.name, price });
    neighborhoodFeeds.push({
      feedId: item.id,
      feedName: item.name,
      spokenName: f.name.trim(),
      qtyKg: f.qty_kg ?? 0,
      priceRs: price,
      category: item.category,
    });
  }

  const priceNote =
    estimatedPrices.length > 0
      ? formatEstimatedPriceNote(
          [...new Map(estimatedPrices.map((e) => [e.name, e])).values()],
          lang === "en" ? "en" : "hi"
        )
      : "";

  return {
    session: {
      farmerName: req.farmer_name ?? "",
      lang,
      location,
      animals,
      feeds,
      neighborhoodFeeds: neighborhoodFeeds.length ? neighborhoodFeeds : undefined,
      priceEstimateNote: priceNote || undefined,
    },
    warnings,
  };
}

export type VoiceComputeResult =
  | { ok: false; error: string; warnings: string[] }
  | {
      ok: true;
      report: ReturnType<typeof computeHerdRation>;
      summary: string;
      /** Brief farmer-facing text for this step only. */
      chatText: string;
      step: "first" | "second";
      warnings: string[];
      session: AdvisorySession;
    };

export function computeFromVoiceRequest(req: VoiceRationRequest): VoiceComputeResult {
  const lang = req.lang === "en" ? "en" : "hi";
  const missingMain = feedsMissingPrice(req.feeds);
  if (missingMain.length) {
    return { ok: false, error: missingPriceError(missingMain, lang), warnings: [] };
  }
  const missingLocal = feedsMissingPrice(req.neighborhood_feeds ?? []);
  if (missingLocal.length) {
    return { ok: false, error: missingPriceError(missingLocal, lang), warnings: [] };
  }

  const { session, warnings } = sessionFromVoiceRequest(req);
  if (!session.animals.length) {
    return { ok: false, error: "At least one animal required.", warnings };
  }
  if (session.feeds.length < 2) {
    return {
      ok: false,
      error: "Need at least 2 feeds (green/dry roughage + concentrate). Ask farmer what they feed.",
      warnings,
    };
  }
  const report = computeHerdRation(session);
  const lang = session.lang === "en" ? "en" : "hi";
  const text = normalizeVoiceText(formatPlanSummary(report, lang, session));
  const step = session.neighborhoodFeeds?.length ? "second" : "first";
  return { ok: true, report, summary: text, chatText: text, step, warnings, session };
}
