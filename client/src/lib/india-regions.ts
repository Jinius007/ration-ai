import type { Region } from "./types";

export const INDIAN_STATES: { code: string; name: string; region: Region }[] = [
  { code: "PB", name: "Punjab", region: "north" },
  { code: "HR", name: "Haryana", region: "north" },
  { code: "UP", name: "Uttar Pradesh", region: "north" },
  { code: "UK", name: "Uttarakhand", region: "north" },
  { code: "DL", name: "Delhi NCR", region: "north" },
  { code: "RJ", name: "Rajasthan", region: "west" },
  { code: "GJ", name: "Gujarat", region: "west" },
  { code: "MP", name: "Madhya Pradesh", region: "central" },
  { code: "MH", name: "Maharashtra", region: "central" },
  { code: "CG", name: "Chhattisgarh", region: "central" },
  { code: "KA", name: "Karnataka", region: "south" },
  { code: "AP", name: "Andhra Pradesh", region: "south" },
  { code: "TS", name: "Telangana", region: "south" },
  { code: "TN", name: "Tamil Nadu", region: "south" },
  { code: "KL", name: "Kerala", region: "south" },
  { code: "WB", name: "West Bengal", region: "east" },
  { code: "BR", name: "Bihar", region: "east" },
  { code: "OR", name: "Odisha", region: "east" },
  { code: "AS", name: "Assam", region: "east" },
  { code: "JH", name: "Jharkhand", region: "east" },
];

export function regionForState(code: string): Region {
  return INDIAN_STATES.find((s) => s.code === code)?.region ?? "north";
}

export function seasonLabel(season: "kharif" | "rabi" | "summer", lang: string | null): string {
  const hi: Record<string, string> = {
    kharif: "खरीफ (बारिश के baad — maize/jowar chara)",
    rabi: "रabi (सर्दी — berseem/gajar chara)",
    summer: "गarmi (garmi — napier/paddy bhusa)",
  };
  const en: Record<string, string> = {
    kharif: "Kharif (monsoon — maize/sorghum fodder)",
    rabi: "Rabi (winter — berseem/green fodder)",
    summer: "Summer (napier grass, paddy straw)",
  };
  if (lang === "hi") return hi[season];
  return en[season];
}
