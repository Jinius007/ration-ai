export type Region = "north" | "south" | "east" | "west" | "central";

export type Species = "cattle" | "buffalo";

export type LangCode = "hi" | "en" | "gu" | "mr" | "bn" | "ta" | "te" | "kn" | "ml" | "pa" | "or" | "as" | "ur";

export interface FarmerLocation {
  district: string;
  state: string;
  stateCode?: string;
  village?: string;
  label: string;
}

export interface FarmerFeedEntry {
  feedId: string;
  feedName: string;
  /** Name the farmer used (for Hindi chat display). */
  spokenName?: string;
  qtyKg: number;
  priceRs: number;
  category: "roughage" | "concentrate" | "mineral";
}

export interface AnimalRecord {
  id: string;
  label: string;
  species: Species;
  breed?: string;
  weightKg: number;
  calvings: number;
  inMilk: boolean;
  monthsAfterCalving: number;
  milkYieldKg: number;
  milkFatPct: number;
  milkPriceRs: number;
  pregnant: boolean;
  pregnancyMonth: number;
}

export interface AdvisorySession {
  farmerName: string;
  lang: LangCode;
  location: FarmerLocation | null;
  animals: AnimalRecord[];
  feeds: FarmerFeedEntry[];
  /** Other feeds available nearby (not currently fed, but farmer says they can get). */
  neighborhoodFeeds?: FarmerFeedEntry[];
  /** When farmer did not give prices, note about library estimates used. */
  priceEstimateNote?: string;
  notes?: string;
}

export function defaultWeight(species: Species): number {
  return species === "cattle" ? 400 : 450;
}

export function animalProfileFromRecord(a: AnimalRecord) {
  return {
    species: a.species,
    weight: a.weightKg,
    adult: a.calvings > 0,
    pregnant: a.pregnant,
    pregnancyMonth: a.pregnancyMonth,
    inMilk: a.inMilk,
    milkYield: a.milkYieldKg,
    milkFat: a.milkFatPct,
    monthsAfterCalving: a.monthsAfterCalving,
    milkPrice: a.milkPriceRs,
  };
}

export function detectSeason(): "kharif" | "rabi" | "summer" {
  const m = new Date().getMonth();
  if (m >= 6 && m <= 9) return "kharif";
  if (m >= 10 || m <= 2) return "rabi";
  return "summer";
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
