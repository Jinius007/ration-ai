import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import {
  AdvisorySession,
  AnimalRecord,
  FarmerFeedEntry,
  FarmerLocation,
  LangCode,
  defaultWeight,
  uid,
} from "@/lib/types";
import { HerdRationReport, computeHerdRation } from "@/lib/rationService";

export type AppPhase = "language" | "call";

interface AdvisoryContextValue {
  session: AdvisorySession;
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;
  step: number;
  setStep: (n: number) => void;
  setLang: (lang: LangCode) => void;
  setFarmerName: (name: string) => void;
  setLocation: (loc: FarmerLocation | null) => void;
  addAnimal: (partial?: Partial<AnimalRecord>) => string;
  updateAnimal: (id: string, patch: Partial<AnimalRecord>) => void;
  removeAnimal: (id: string) => void;
  addFeed: (entry: FarmerFeedEntry) => void;
  updateFeed: (feedId: string, patch: Partial<FarmerFeedEntry>) => void;
  removeFeed: (feedId: string) => void;
  report: HerdRationReport | null;
  compute: () => HerdRationReport;
  reset: () => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
}

const defaultSession = (): AdvisorySession => ({
  farmerName: "",
  lang: "hi",
  location: null,
  animals: [],
  feeds: [],
});

const AdvisoryContext = createContext<AdvisoryContextValue | null>(null);

export function AdvisoryProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdvisorySession>(defaultSession);
  const [phase, setPhase] = useState<AppPhase>("language");
  const [step, setStep] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [report, setReport] = useState<HerdRationReport | null>(null);

  const value = useMemo<AdvisoryContextValue>(
    () => ({
      session,
      phase,
      setPhase,
      step,
      setStep,
      setLang: (lang) => setSession((s) => ({ ...s, lang })),
      setFarmerName: (farmerName) => setSession((s) => ({ ...s, farmerName })),
      setLocation: (location) => setSession((s) => ({ ...s, location })),
      addAnimal: (partial) => {
        const id = uid();
        const species = partial?.species ?? "cattle";
        const animal: AnimalRecord = {
          id,
          label: partial?.label ?? `Animal ${session.animals.length + 1}`,
          species,
          breed: partial?.breed,
          weightKg: partial?.weightKg ?? defaultWeight(species),
          calvings: partial?.calvings ?? 1,
          inMilk: partial?.inMilk ?? true,
          monthsAfterCalving: partial?.monthsAfterCalving ?? 4,
          milkYieldKg: partial?.milkYieldKg ?? 8,
          milkFatPct: partial?.milkFatPct ?? (species === "buffalo" ? 7 : 4),
          milkPriceRs: partial?.milkPriceRs ?? 34,
          pregnant: partial?.pregnant ?? false,
          pregnancyMonth: partial?.pregnancyMonth ?? 0,
        };
        setSession((s) => ({ ...s, animals: [...s.animals, animal] }));
        return id;
      },
      updateAnimal: (id, patch) =>
        setSession((s) => ({
          ...s,
          animals: s.animals.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeAnimal: (id) =>
        setSession((s) => ({ ...s, animals: s.animals.filter((a) => a.id !== id) })),
      addFeed: (entry) =>
        setSession((s) => ({
          ...s,
          feeds: [...s.feeds.filter((f) => f.feedId !== entry.feedId), entry],
        })),
      updateFeed: (feedId, patch) =>
        setSession((s) => ({
          ...s,
          feeds: s.feeds.map((f) => (f.feedId === feedId ? { ...f, ...patch } : f)),
        })),
      removeFeed: (feedId) =>
        setSession((s) => ({ ...s, feeds: s.feeds.filter((f) => f.feedId !== feedId) })),
      report,
      compute: () => {
        const r = computeHerdRation(session);
        setReport(r);
        return r;
      },
      reset: () => {
        setSession(defaultSession());
        setReport(null);
        setStep(1);
        setPhase("language");
        setShowForm(false);
      },
      showForm,
      setShowForm,
    }),
    [session, phase, step, report, showForm]
  );

  return <AdvisoryContext.Provider value={value}>{children}</AdvisoryContext.Provider>;
}

export function useAdvisory() {
  const ctx = useContext(AdvisoryContext);
  if (!ctx) throw new Error("useAdvisory must be used within AdvisoryProvider");
  return ctx;
}
