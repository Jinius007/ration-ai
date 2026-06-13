// Browser geolocation + free reverse geocoding (BigDataCloud client API — no
// key needed). Used to auto-detect the farmer's district/state so the advisor
// can suggest locally available feeds and the area-specific mineral mixture.

export interface DetectedLocation {
  district: string;
  state: string;
  /** Human readable "District, State" */
  label: string;
}

export async function detectLocation(timeoutMs = 12000): Promise<DetectedLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  const pos = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600000 }
    );
  });
  if (!pos) return null;

  try {
    const { latitude, longitude } = pos.coords;
    const resp = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const district: string =
      data.localityInfo?.administrative?.find((a: { adminLevel?: number }) => a.adminLevel === 5)?.name ||
      data.city ||
      data.locality ||
      "";
    const state: string = data.principalSubdivision || "";
    if (!district && !state) return null;
    const label = [district, state].filter(Boolean).join(", ");
    return { district, state, label };
  } catch {
    return null;
  }
}

/**
 * Pick the area-specific mineral mixture (ASMM) for a district/state if one
 * exists in the feed library, else fall back to BIS mineral mixture.
 */
export function mineralMixtureIdForLocation(district: string, state: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const d = norm(district);
  const s = norm(state);
  const asmm: Record<string, string> = {
    mathura: "asmm_mathura", jalgaon: "asmm_jalgaon", etawah: "asmm_etawah",
    chittoor: "asmm_chittoor", bikaner: "asmm_bikaner", jodhpur: "asmm_jodhpur",
    meerut: "asmm_meerut", kolhapur: "asmm_kolhapur", moradabad: "asmm_moradabad",
    ajmer: "asmm_ajmer", dhaulpur: "asmm_dhaulpur", mehsana: "asmm_mehsana",
    surat: "asmm_surat", panchmahal: "asmm_panchmahal", anand: "asmm_anand",
    kaira: "asmm_kaira", kutch: "asmm_kutch", junagadh: "asmm_junagadh",
    udaipur: "asmm_udaipur", bharatpur: "asmm_bharatpur",
    sabarkantha: "asmm_sabarkantha", banaskantha: "asmm_banaskantha",
    agra: "asmm_agra", bulandshahr: "asmm_bulandshahr", bangalore: "asmm_bangalore",
  };
  if (asmm[d]) return asmm[d];
  const stateMap: Record<string, string> = {
    bihar: "asmm_bihar",
    madhyapradesh: "asmm_madhya_pradesh",
    kerala: "asmm_kerala",
    rajasthan: "asmm___rajasthan",
    uttarpradesh: "asmm___western_up",
  };
  if (stateMap[s]) return stateMap[s];
  return "mineral_mixture_bis";
}
