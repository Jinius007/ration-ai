// Nutrient requirement engine based on NDDB "Revised nutrient requirement
// Tables for Ration Balancing Programme (RBP)" (INAPH Nutrition Masters,
// Sept 2015 — values from NRC 1989/2001, Kearl 1982, ICAR 2013).
//
// All requirement values are grams per day (maintenance) or grams per kg of
// milk (production), for TDN, CP, Ca and P.

export type Species = "cattle" | "buffalo";

export interface NutrientVector {
  tdn: number;
  cp: number;
  ca: number;
  p: number;
}

interface WeightRow extends NutrientVector {
  wt: number;
}

interface FatRow extends NutrientVector {
  fat: number;
}

// ----- Table 1: growing non-pregnant cattle (maintenance) -----
const CATTLE_GROWING_NP: WeightRow[] = [
  { wt: 100, tdn: 1840, cp: 421, ca: 17, p: 9 },
  { wt: 150, tdn: 2410, cp: 562, ca: 19, p: 11 },
  { wt: 200, tdn: 2950, cp: 699, ca: 20, p: 14 },
  { wt: 250, tdn: 3480, cp: 718, ca: 22, p: 16 },
  { wt: 300, tdn: 4010, cp: 752, ca: 23, p: 17 },
  { wt: 350, tdn: 4560, cp: 874, ca: 24, p: 18 },
  { wt: 400, tdn: 5120, cp: 1007, ca: 25, p: 19 },
  { wt: 450, tdn: 5710, cp: 1151, ca: 28, p: 19 },
  { wt: 500, tdn: 6340, cp: 1311, ca: 28, p: 20 },
];

// ----- Table 2: growing pregnant cattle -----
const CATTLE_GROWING_P: WeightRow[] = [
  { wt: 250, tdn: 4176, cp: 862, ca: 26, p: 19 },
  { wt: 300, tdn: 4812, cp: 902, ca: 28, p: 20 },
  { wt: 350, tdn: 5472, cp: 1049, ca: 29, p: 23 },
  { wt: 400, tdn: 6144, cp: 1208, ca: 30, p: 23 },
  { wt: 450, tdn: 6852, cp: 1381, ca: 34, p: 23 },
  { wt: 500, tdn: 7608, cp: 1573, ca: 34, p: 24 },
];

// ----- Table 3: adult non-pregnant cattle -----
const CATTLE_ADULT_NP: WeightRow[] = [
  { wt: 300, tdn: 2620, cp: 351, ca: 14, p: 9 },
  { wt: 350, tdn: 2950, cp: 394, ca: 16, p: 10 },
  { wt: 400, tdn: 3270, cp: 436, ca: 18, p: 11 },
  { wt: 450, tdn: 3580, cp: 476, ca: 20, p: 13 },
  { wt: 500, tdn: 3880, cp: 515, ca: 23, p: 14 },
  { wt: 550, tdn: 4180, cp: 553, ca: 25, p: 16 },
  { wt: 600, tdn: 4470, cp: 591, ca: 27, p: 17 },
  { wt: 650, tdn: 4750, cp: 627, ca: 30, p: 19 },
  { wt: 700, tdn: 5030, cp: 663, ca: 32, p: 20 },
  { wt: 750, tdn: 5310, cp: 698, ca: 34, p: 21 },
  { wt: 800, tdn: 5580, cp: 733, ca: 36, p: 23 },
];

// ----- Table 4: adult pregnant cattle -----
const CATTLE_ADULT_P: WeightRow[] = [
  { wt: 300, tdn: 3400, cp: 725, ca: 20, p: 12 },
  { wt: 350, tdn: 3780, cp: 807, ca: 23, p: 14 },
  { wt: 400, tdn: 4150, cp: 890, ca: 26, p: 16 },
  { wt: 450, tdn: 4530, cp: 973, ca: 30, p: 18 },
  { wt: 500, tdn: 4900, cp: 1053, ca: 33, p: 20 },
  { wt: 550, tdn: 5270, cp: 1131, ca: 36, p: 22 },
  { wt: 600, tdn: 5620, cp: 1207, ca: 39, p: 24 },
  { wt: 650, tdn: 5970, cp: 1281, ca: 43, p: 26 },
  { wt: 700, tdn: 6310, cp: 1355, ca: 46, p: 28 },
  { wt: 750, tdn: 6650, cp: 1427, ca: 49, p: 30 },
  { wt: 800, tdn: 6980, cp: 1497, ca: 53, p: 32 },
];

// ----- Table 6: growing non-pregnant buffalo -----
const BUFFALO_GROWING_NP: WeightRow[] = [
  { wt: 100, tdn: 2470, cp: 487, ca: 14, p: 11 },
  { wt: 150, tdn: 2860, cp: 506, ca: 14, p: 12 },
  { wt: 200, tdn: 3220, cp: 525, ca: 14, p: 13 },
  { wt: 250, tdn: 3550, cp: 547, ca: 15, p: 12 },
  { wt: 300, tdn: 4010, cp: 569, ca: 17, p: 16 },
  { wt: 350, tdn: 4450, cp: 607, ca: 17, p: 16 },
  { wt: 400, tdn: 4880, cp: 645, ca: 18, p: 16 },
  { wt: 450, tdn: 5310, cp: 683, ca: 20, p: 17 },
  { wt: 500, tdn: 5720, cp: 721, ca: 23, p: 18 },
];

// ----- Table 7: growing pregnant buffalo -----
const BUFFALO_GROWING_P: WeightRow[] = [
  { wt: 300, tdn: 4812, cp: 683, ca: 20, p: 19 },
  { wt: 350, tdn: 5340, cp: 728, ca: 21, p: 19 },
  { wt: 400, tdn: 5856, cp: 774, ca: 22, p: 19 },
  { wt: 450, tdn: 6372, cp: 820, ca: 24, p: 20 },
  { wt: 500, tdn: 6864, cp: 865, ca: 28, p: 22 },
];

// ----- Table 8: adult non-pregnant buffalo -----
const BUFFALO_ADULT_NP: WeightRow[] = [
  { wt: 350, tdn: 2950, cp: 423, ca: 16, p: 11 },
  { wt: 400, tdn: 3270, cp: 469, ca: 18, p: 13 },
  { wt: 450, tdn: 3580, cp: 512, ca: 20, p: 14 },
  { wt: 500, tdn: 3880, cp: 553, ca: 23, p: 15 },
  { wt: 550, tdn: 4180, cp: 597, ca: 25, p: 16 },
  { wt: 600, tdn: 4470, cp: 633, ca: 27, p: 17 },
  { wt: 650, tdn: 4750, cp: 683, ca: 30, p: 18 },
  { wt: 700, tdn: 5030, cp: 714, ca: 32, p: 19 },
  { wt: 750, tdn: 5310, cp: 752, ca: 34, p: 20 },
  { wt: 800, tdn: 5580, cp: 788, ca: 36, p: 21 },
];

// ----- Table 9: adult pregnant buffalo -----
const BUFFALO_ADULT_P: WeightRow[] = [
  { wt: 400, tdn: 4200, cp: 644, ca: 23, p: 18 },
  { wt: 450, tdn: 4500, cp: 720, ca: 26, p: 20 },
  { wt: 500, tdn: 4800, cp: 776, ca: 29, p: 22 },
  { wt: 550, tdn: 5000, cp: 832, ca: 31, p: 24 },
  { wt: 600, tdn: 5300, cp: 889, ca: 34, p: 26 },
  { wt: 650, tdn: 5600, cp: 944, ca: 36, p: 28 },
  { wt: 700, tdn: 5900, cp: 992, ca: 39, p: 30 },
  { wt: 750, tdn: 6100, cp: 1064, ca: 42, p: 32 },
  { wt: 800, tdn: 6400, cp: 1116, ca: 44, p: 34 },
];

// ----- Table 5: per-kg milk requirement for cattle, by fat % -----
// CP per kg milk is 96 g up to 4.5% fat then rises ~1 g per 0.1% fat.
const CATTLE_MILK: FatRow[] = [
  { fat: 3.5, tdn: 310, cp: 96, ca: 2.97, p: 1.83 },
  { fat: 4.0, tdn: 330, cp: 96, ca: 3.21, p: 1.98 },
  { fat: 4.5, tdn: 350, cp: 96, ca: 3.45, p: 2.13 },
  { fat: 5.0, tdn: 370, cp: 101, ca: 3.69, p: 2.28 },
  { fat: 5.5, tdn: 390, cp: 107, ca: 3.93, p: 2.43 },
  { fat: 6.0, tdn: 410, cp: 112, ca: 4.17, p: 2.58 },
];

// ----- Table 10: per-kg milk requirement for buffalo, by fat % -----
const BUFFALO_MILK: FatRow[] = [
  { fat: 6.0, tdn: 440, cp: 124, ca: 4.1, p: 2.4 },
  { fat: 6.5, tdn: 460, cp: 124, ca: 4.35, p: 2.5 },
  { fat: 7.0, tdn: 480, cp: 124, ca: 4.6, p: 2.6 },
  { fat: 7.5, tdn: 500, cp: 126, ca: 4.8, p: 2.7 },
  { fat: 8.0, tdn: 520, cp: 128, ca: 4.8, p: 2.8 },
  { fat: 8.5, tdn: 540, cp: 133, ca: 4.8, p: 2.9 },
  { fat: 9.0, tdn: 560, cp: 138, ca: 4.8, p: 3.0 },
  { fat: 10.0, tdn: 600, cp: 149, ca: 4.8, p: 3.2 },
  { fat: 11.0, tdn: 640, cp: 159, ca: 4.8, p: 3.4 },
  { fat: 12.0, tdn: 680, cp: 159, ca: 4.8, p: 3.6 },
  { fat: 13.0, tdn: 720, cp: 159, ca: 4.8, p: 3.8 },
  { fat: 14.0, tdn: 800, cp: 159, ca: 4.8, p: 4.0 },
];

function interpolate<T extends NutrientVector>(
  rows: T[],
  getKey: (r: T) => number,
  value: number
): NutrientVector {
  if (value <= getKey(rows[0])) return pick(rows[0]);
  const last = rows[rows.length - 1];
  if (value >= getKey(last)) return pick(last);
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const ka = getKey(a);
    const kb = getKey(b);
    if (value >= ka && value <= kb) {
      const t = (value - ka) / (kb - ka);
      return {
        tdn: a.tdn + t * (b.tdn - a.tdn),
        cp: a.cp + t * (b.cp - a.cp),
        ca: a.ca + t * (b.ca - a.ca),
        p: a.p + t * (b.p - a.p),
      };
    }
  }
  return pick(last);
}

function pick(r: NutrientVector): NutrientVector {
  return { tdn: r.tdn, cp: r.cp, ca: r.ca, p: r.p };
}

export interface AnimalProfile {
  species: Species;
  /** Body weight kg */
  weight: number;
  /** Has the animal calved at least once (adult)? */
  adult: boolean;
  pregnant: boolean;
  /** Month of pregnancy 1-9/10 */
  pregnancyMonth: number;
  /** Currently giving milk */
  inMilk: boolean;
  /** kg of milk per day */
  milkYield: number;
  /** Milk fat % */
  milkFat: number;
  /** Months since last calving */
  monthsAfterCalving: number;
  /** Rs per kg milk (for economics) */
  milkPrice: number;
}

export interface RequirementBreakdown {
  maintenance: NutrientVector;
  production: NutrientVector;
  total: NutrientVector;
  /** Whether pregnancy allowance was applied (>= 7 months pregnant) */
  pregnancyApplied: boolean;
}

/**
 * Per the RBP constraints doc, the extra pregnancy allowance is applied only
 * from the 7th month of pregnancy onwards (for both cattle and buffalo).
 */
export function computeRequirement(a: AnimalProfile): RequirementBreakdown {
  const pregnantForCalc = a.pregnant && a.pregnancyMonth >= 7;
  let table: WeightRow[];
  if (a.species === "cattle") {
    table = a.adult
      ? pregnantForCalc ? CATTLE_ADULT_P : CATTLE_ADULT_NP
      : pregnantForCalc ? CATTLE_GROWING_P : CATTLE_GROWING_NP;
  } else {
    table = a.adult
      ? pregnantForCalc ? BUFFALO_ADULT_P : BUFFALO_ADULT_NP
      : pregnantForCalc ? BUFFALO_GROWING_P : BUFFALO_GROWING_NP;
  }
  const maintenance = interpolate(table, (r) => r.wt, a.weight);

  let production: NutrientVector = { tdn: 0, cp: 0, ca: 0, p: 0 };
  if (a.inMilk && a.milkYield > 0) {
    const milkTable = a.species === "cattle" ? CATTLE_MILK : BUFFALO_MILK;
    const perKg = interpolate(milkTable, (r) => r.fat, a.milkFat);
    production = {
      tdn: perKg.tdn * a.milkYield,
      cp: perKg.cp * a.milkYield,
      ca: perKg.ca * a.milkYield,
      p: perKg.p * a.milkYield,
    };
  }

  return {
    maintenance,
    production,
    total: {
      tdn: maintenance.tdn + production.tdn,
      cp: maintenance.cp + production.cp,
      ca: maintenance.ca + production.ca,
      p: maintenance.p + production.p,
    },
    pregnancyApplied: pregnantForCalc,
  };
}

/**
 * Dry matter intake range as % of body weight — from "Other constraints used
 * for RBP" doc (same for cattle and buffalo).
 */
export function dmRangePercent(a: AnimalProfile): { min: number; max: number } {
  if (!a.inMilk) return { min: 2.0, max: 4.0 };
  const m = a.monthsAfterCalving;
  if (m <= 2) return { min: 2.0, max: 2.5 };
  if (m <= 3) return { min: 2.0, max: 3.0 };
  return { min: 2.0, max: 4.0 };
}

/**
 * Maximum concentrate share of total dry matter — from the constraints doc
 * (ratio type "L" = concentrate must be Lower than/equal to this %).
 */
export function maxConcentratePercent(a: AnimalProfile): number {
  if (!a.inMilk) return 40;
  const y = a.milkYield;
  if (y <= 5) return 40;
  if (y <= 10) return 50;
  if (y <= 15) return 60;
  return 70;
}
