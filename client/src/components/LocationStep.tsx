import { useEffect, useState } from "react";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import { INDIAN_STATES } from "../lib/india-regions";
import { detectLocation } from "../lib/location";
import { Field } from "./ui";

export function LocationStep({ onNext }: { onNext: () => void }) {
  const { session, setLocation } = useAdvisory();
  const [detecting, setDetecting] = useState(false);
  const [district, setDistrict] = useState(session.location?.district ?? "");
  const [stateCode, setStateCode] = useState(session.location?.stateCode ?? "GJ");
  const hi = session.lang === "hi";

  useEffect(() => {
    if (session.location) {
      setDistrict(session.location.district);
      if (session.location.stateCode) setStateCode(session.location.stateCode);
    }
  }, [session.location]);

  const autoDetect = async () => {
    setDetecting(true);
    const loc = await detectLocation();
    setDetecting(false);
    if (loc) {
      setDistrict(loc.district);
      const match = INDIAN_STATES.find(
        (s) => loc.state.toLowerCase().includes(s.name.toLowerCase().split(" ")[0])
      );
      if (match) setStateCode(match.code);
      setLocation({
        district: loc.district,
        state: loc.state,
        stateCode: match?.code,
        label: loc.label,
      });
    }
  };

  const save = () => {
    const st = INDIAN_STATES.find((s) => s.code === stateCode);
    const label = [district, st?.name].filter(Boolean).join(", ");
    setLocation({
      district: district.trim(),
      state: st?.name ?? "",
      stateCode,
      label,
    });
    onNext();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">
          {hi ? "📍 Aap kahan rehte hain?" : "📍 Where is your farm?"}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {hi
            ? "Jile ke hisaab se local chara aur mineral mixture suggest hoga (NDDB RBP)."
            : "We suggest locally available feeds and area mineral mixture per NDDB RBP."}
        </p>
      </div>

      {session.location && (
        <div className="card p-3 flex items-center gap-2 text-sm border-[var(--accent)]/40">
          <MapPin size={16} className="text-[var(--accent-light)]" />
          {session.location.label}
        </div>
      )}

      <button type="button" className="btn btn-secondary w-full" onClick={autoDetect} disabled={detecting}>
        {detecting ? <Loader2 className="animate-spin" size={18} /> : <Navigation size={18} />}
        {hi ? "GPS se jila pakdo" : "Detect district via GPS"}
      </button>

      <Field label={hi ? "Jila / District" : "District"}>
        <input className="input" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Mehsana" />
      </Field>

      <Field label={hi ? "Rajya / State" : "State"}>
        <select className="input" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
          {INDIAN_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <button type="button" className="btn btn-primary w-full" onClick={save} disabled={!district.trim()}>
        {hi ? "Aage badho" : "Continue"}
      </button>
    </div>
  );
}
