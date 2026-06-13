import { computeFromVoiceRequest } from "./voiceSessionBridge";
import { computeRequirement } from "./nutrientRequirements";
import { feedsForLocation } from "./regionalFeeds";
import { detectSeason, defaultWeight, type Species } from "./types";
import type { VoiceToolParams } from "./voiceRationTools";

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

export function voiceParamsToRequest(p: VoiceToolParams) {
  const species: Species = p.species === "buffalo" ? "buffalo" : "cattle";
  return {
    farmer_name: p.farmer_name,
    lang: p.lang,
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
}

/** Runs LP in-browser — same engine as the wizard (feed library + INAPH + constraints). */
export function computeRationViaLp(params: VoiceToolParams | Record<string, unknown>) {
  const p = params as VoiceToolParams;
  const result = computeFromVoiceRequest(voiceParamsToRequest(p));
  if (!result.ok) {
    const msg = result.error ?? "Computation failed";
    const warn = result.warnings.length ? `\n${result.warnings.join("; ")}` : "";
    return { ok: false as const, message: `${msg}${warn}` };
  }
  const warn = result.warnings.length ? `\n\nNote: ${result.warnings.join("; ")}` : "";
  return {
    ok: true as const,
    message: `${result.summary}${warn}`,
    session: result.session!,
    report: result.report!,
  };
}

export function requirementsViaInaph(params: Record<string, unknown>): string {
  const species: Species = params.species === "buffalo" ? "buffalo" : "cattle";
  const req = computeRequirement({
    species,
    weight: Number(params.weight_kg) || defaultWeight(species),
    adult: (Number(params.calvings) || 1) > 0,
    pregnant: !!params.pregnant,
    pregnancyMonth: Number(params.pregnancy_month) || 0,
    inMilk: !!params.in_milk || (Number(params.milk_yield_litres) || 0) > 0,
    milkYield: Number(params.milk_yield_litres) || 0,
    milkFat: Number(params.milk_fat_percent) || (species === "buffalo" ? 7 : 4),
    monthsAfterCalving: Number(params.months_after_calving) || 4,
    milkPrice: 34,
  });
  return `INAPH minimum daily need: TDN ${Math.round(req.total.tdn)}g, CP ${Math.round(req.total.cp)}g, Ca ${req.total.ca.toFixed(1)}g, P ${req.total.p.toFixed(1)}g.`;
}

export function regionalFeedsText(district: string, state: string): string {
  if (!district) return "District and state required for regional feed list.";
  const season = detectSeason();
  const feeds = feedsForLocation({ district, state, label: `${district}, ${state}` }, season).slice(0, 25);
  const lines = feeds.map((f) => `• ${f.name} (₹${f.rate}/kg)`);
  return `Season ${season}. Feeds for ${district}, ${state}:\n${lines.join("\n")}`;
}
