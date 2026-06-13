import { computeRequirement } from "./nutrientRequirements";
import { feedsForLocation } from "./regionalFeeds";
import { detectSeason, defaultWeight, type Species } from "./types";

export interface VoiceToolParams {
  farmer_name?: string;
  lang?: string;
  district?: string;
  state?: string;
  species?: string;
  breed?: string;
  weight_kg?: number;
  calvings?: number;
  in_milk?: boolean;
  months_after_calving?: number;
  milk_yield_litres?: number;
  milk_fat_percent?: number;
  pregnant?: boolean;
  pregnancy_month?: number;
  feeds_json?: string;
}

function parseFeedsJson(raw: string | undefined): { name: string; qty_kg: number; price_rs?: number }[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((f) => ({
      name: String(f.name ?? f.feedName ?? ""),
      qty_kg: Number(f.qty_kg ?? f.qtyKg ?? 0),
      price_rs: f.price_rs != null ? Number(f.price_rs) : f.priceRs != null ? Number(f.priceRs) : undefined,
    }));
  } catch {
    return [];
  }
}

export async function callComputeRation(params: VoiceToolParams | Record<string, unknown>): Promise<string> {
  const p = params as VoiceToolParams;
  const species: Species = p.species === "buffalo" ? "buffalo" : "cattle";
  const body = {
    farmer_name: p.farmer_name,
    lang: p.lang === "en" ? "en" : "hi",
    district: String(p.district ?? ""),
    state: String(p.state ?? ""),
    animals: [
      {
        species,
        breed: p.breed,
        weight_kg: Number(p.weight_kg) || defaultWeight(species),
        calvings: Number(p.calvings) || 1,
        in_milk: p.in_milk ?? (Number(p.milk_yield_litres) || 0) > 0,
        months_after_calving: Number(p.months_after_calving) || 4,
        milk_yield_litres: Number(p.milk_yield_litres) || 0,
        milk_fat_percent: Number(p.milk_fat_percent) || (species === "buffalo" ? 7 : 4),
        pregnant: !!p.pregnant,
        pregnancy_month: Number(p.pregnancy_month) || 0,
      },
    ],
    feeds: parseFeedsJson(p.feeds_json),
  };

  const resp = await fetch("/api/ration/compute-from-voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) return String(data.error ?? "Computation failed — ask farmer for more feed details.");
  if (data.warnings?.length) {
    return `${data.summary}\n\nNote: ${data.warnings.join("; ")}`;
  }
  return data.summary;
}

export async function callListRegionalFeeds(params: {
  district: string;
  state: string;
}): Promise<string> {
  const resp = await fetch("/api/ration/regional-feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await resp.json();
  return data.result ?? "Could not list feeds — confirm district and state.";
}

export function computeRequirementsLocal(params: {
  species: Species | string;
  weight_kg?: number;
  calvings?: number;
  in_milk?: boolean;
  months_after_calving?: number;
  milk_yield_litres?: number;
  milk_fat_percent?: number;
  pregnant?: boolean;
  pregnancy_month?: number;
}): string {
  const species: Species = params.species === "buffalo" ? "buffalo" : "cattle";
  const req = computeRequirement({
    species,
    weight: params.weight_kg ?? defaultWeight(species),
    adult: (params.calvings ?? 1) > 0,
    pregnant: params.pregnant ?? false,
    pregnancyMonth: params.pregnancy_month ?? 0,
    inMilk: params.in_milk ?? (params.milk_yield_litres ?? 0) > 0,
    milkYield: params.milk_yield_litres ?? 0,
    milkFat: params.milk_fat_percent ?? (species === "buffalo" ? 7 : 4),
    monthsAfterCalving: params.months_after_calving ?? 4,
    milkPrice: 34,
  });
  return `Roz ki poshan zaroorat (INAPH/RBP): TDN ${Math.round(req.total.tdn)} gram, CP ${Math.round(req.total.cp)} gram, Calcium ${req.total.ca.toFixed(1)} gram, Phosphorus ${req.total.p.toFixed(1)} gram. (Maintenance + doodh ke liye alag hissa.)`;
}

export function listFeedsLocal(district: string, state: string): string {
  const season = detectSeason();
  const feeds = feedsForLocation({ district, state, label: `${district}, ${state}` }, season).slice(0, 25);
  const lines = feeds.map((f) => `• ${f.name} (₹${f.rate}/kg)`);
  return `Mausam ${season}. ${district}, ${state} mein ye chara mil sakte hain:\n${lines.join("\n")}`;
}
