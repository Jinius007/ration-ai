import { formatEstimatedPriceNote, resolveFeedPrice } from "./lib/feedPrice.js";
import { matchFeedByName } from "./lib/feedMatch.js";
import { computeHerdRation, formatPlanSummary } from "./lib/rationService.js";
import type { AdvisorySession, AnimalRecord, FarmerFeedEntry, LangCode, Species } from "./lib/types.js";
import { defaultWeight, uid } from "./lib/types.js";
import { normalizeVoiceText } from "./lib/voiceText.js";

export { matchFeedByName } from "./lib/feedMatch.js";

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
