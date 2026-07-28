import type { VoiceAnimalInput, VoiceFeedInput, VoiceRationRequest } from "./rationBridge.js";
import type { Species } from "./lib/types.js";
import { defaultWeight } from "./lib/types.js";

function parseFeedsJson(raw: unknown): VoiceFeedInput[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((f) => ({
      name: String((f as VoiceFeedInput).name ?? ""),
      qty_kg: Number((f as VoiceFeedInput).qty_kg ?? 0),
      price_rs: (f as VoiceFeedInput).price_rs != null ? Number((f as VoiceFeedInput).price_rs) : undefined,
      price_unknown: Boolean((f as VoiceFeedInput).price_unknown),
    }));
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parseFeedsJson(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Flat ElevenLabs webhook params → VoiceRationRequest for LP compute. */
export function normalizeVoiceWebhookBody(body: Record<string, unknown>): VoiceRationRequest {
  const species: Species = body.species === "buffalo" ? "buffalo" : "cattle";

  let animals = body.animals as VoiceAnimalInput[] | undefined;
  if (!animals?.length && body.species) {
    animals = [
      {
        species,
        breed: body.breed != null ? String(body.breed) : undefined,
        weight_kg: Number(body.weight_kg) || defaultWeight(species),
        calvings: Number(body.calvings) || 1,
        in_milk: body.in_milk != null ? Boolean(body.in_milk) : (Number(body.milk_yield_litres) || 0) > 0,
        months_after_calving: Number(body.months_after_calving) || 4,
        milk_yield_litres: Number(body.milk_yield_litres) || 0,
        milk_fat_percent: Number(body.milk_fat_percent) || (species === "buffalo" ? 7 : 4),
        pregnant: Boolean(body.pregnant),
        pregnancy_month: Number(body.pregnancy_month) || 0,
      },
    ];
  }

  let feeds = parseFeedsJson(body.feeds);
  if (!feeds.length && body.feeds_json) {
    feeds = parseFeedsJson(body.feeds_json);
  }

  let neighborhood_feeds = parseFeedsJson(body.neighborhood_feeds);
  if (!neighborhood_feeds.length && body.neighborhood_feeds_json) {
    neighborhood_feeds = parseFeedsJson(body.neighborhood_feeds_json);
  }
  if (!neighborhood_feeds.length && body.local_feed_names) {
    neighborhood_feeds = String(body.local_feed_names)
      .split(/[,;]|(?:\s+aur\s+)|(?:\s+and\s+)/i)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, qty_kg: 0 }));
  }
  if (!neighborhood_feeds.length && body.neighborhood_feed_name) {
    neighborhood_feeds = [{ name: String(body.neighborhood_feed_name).trim(), qty_kg: 0 }];
  }

  return {
    farmer_name: body.farmer_name != null ? String(body.farmer_name) : undefined,
    lang: body.lang != null ? (String(body.lang) as VoiceRationRequest["lang"]) : undefined,
    district: String(body.district ?? ""),
    state: String(body.state ?? ""),
    state_code: body.state_code != null ? String(body.state_code) : undefined,
    animals: animals ?? [],
    feeds,
    neighborhood_feeds: neighborhood_feeds.length ? neighborhood_feeds : undefined,
  };
}
