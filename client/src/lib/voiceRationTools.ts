import { computeRationViaLp, regionalFeedsText, requirementsViaInaph } from "./voiceLpTools";
import { defaultWeight, type Species } from "./types";

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

export type ComputeRationResult =
  | { ok: true; summary: string; session: import("./types").AdvisorySession; report: import("./rationService").HerdRationReport }
  | { ok: false; summary: string };

/** LP compute — runs in browser via javascript-lp-solver + feed library + INAPH tables. */
export async function callComputeRation(
  params: VoiceToolParams | Record<string, unknown>
): Promise<string> {
  const result = computeRationViaLp(params);
  return result.message;
}

/** Same as callComputeRation but returns session for UI sync. */
export function callComputeRationWithReport(
  params: VoiceToolParams | Record<string, unknown>
): ComputeRationResult {
  const result = computeRationViaLp(params);
  if (!result.ok) return { ok: false, summary: result.message };
  return { ok: true, summary: result.message, session: result.session, report: result.report };
}

export async function callListRegionalFeeds(params: {
  district: string;
  state: string;
}): Promise<string> {
  return regionalFeedsText(params.district, params.state);
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
  return requirementsViaInaph(params as Record<string, unknown>);
}
