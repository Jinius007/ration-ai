import { AdvisoryProvider, useAdvisory } from "./context/AdvisoryContext";
import { FeedsStep } from "./components/FeedsStep";
import { HerdStep } from "./components/HerdStep";
import { LocationStep } from "./components/LocationStep";
import { ResultsStep } from "./components/ResultsStep";
import { StepProgress } from "./components/ui";
import { VoiceAdvisorPanel, useSyncSessionToServer } from "./components/VoiceAdvisorPanel";
import { LangCode } from "./lib/types";

const STEPS_HI = ["Shuru", "Jila", "Pashu", "Chara", "Ration"];
const STEPS_EN = ["Start", "Area", "Herd", "Feeds", "Plan"];

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { session, setLang, setFarmerName } = useAdvisory();
  const hi = session.lang === "hi";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 py-4">
        <div className="text-4xl">🐄🌾</div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[var(--accent-light)] to-[var(--warm)] bg-clip-text text-transparent">
          Pashu Poshan Ration Advisory
        </h1>
        <p className="text-sm text-[var(--muted)] max-w-lg mx-auto">
          {hi
            ? "NDDB RBP jaise local resource person — sawal puchkar, jile ke charo se, kam lagat wali santulit khurak."
            : "Like a local NDDB RBP advisor — asks about your animals, uses local feeds, least-cost balanced ration via LP."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["hi", "en"] as LangCode[]).map((code) => (
          <button
            key={code}
            type="button"
            className={`btn ${session.lang === code ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setLang(code)}
          >
            {code === "hi" ? "हिन्दी" : "English"}
          </button>
        ))}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{hi ? "Aapka naam" : "Your name"}</span>
        <input
          className="input"
          value={session.farmerName}
          onChange={(e) => setFarmerName(e.target.value)}
          placeholder={hi ? "Ram bhai" : "Ram"}
        />
      </label>

      <ul className="text-sm text-[var(--muted)] space-y-2 card p-4">
        <li>✓ {hi ? "Gaay/bhains, byaat, doodh, garbh" : "Cow/buffalo, lactation, milk, pregnancy"}</li>
        <li>✓ {hi ? "Jile ke hisaab se chara library" : "District-wise feed library"}</li>
        <li>✓ {hi ? "Linear programming — kam kharch, poora poshan" : "Linear programming — least cost, full nutrition"}</li>
        <li>✓ {hi ? "Awaz se baat (ElevenLabs)" : "Voice conversation (ElevenLabs)"}</li>
      </ul>

      <button type="button" className="btn btn-primary w-full" onClick={onNext} disabled={session.farmerName.trim().length < 2}>
        {hi ? "Shuru karein" : "Get started"}
      </button>
    </div>
  );
}

function AdvisoryFlow() {
  const { step, setStep, reset, session } = useAdvisory();
  useSyncSessionToServer();
  const hi = session.lang === "hi";
  const steps = hi ? STEPS_HI : STEPS_EN;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)] uppercase tracking-wider">NDDB RBP · INAPH</p>
          <h1 className="text-lg font-bold">{hi ? "Santulit Khurak Salah" : "Balanced Ration Advisory"}</h1>
        </div>
        {session.farmerName && (
          <span className="text-sm text-[var(--muted)]">
            {hi ? "Namaste" : "Hello"}, {session.farmerName}
          </span>
        )}
      </header>

      <StepProgress steps={steps} current={step} />

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 order-first lg:order-last space-y-4">
          <VoiceAdvisorPanel />
          <div className="card p-4 text-xs text-[var(--muted)] space-y-2 hidden lg:block">
            <p className="font-semibold text-[var(--text)]">{hi ? "Form se bhi bharein" : "Or use the form"}</p>
            <p>{hi ? "Awaz ke saath-saath neeche wizard se data bhar sakte hain — dono sync rahenge." : "Fill the wizard below while talking — both stay in sync."}</p>
          </div>
        </div>
        <div className="lg:col-span-3 card p-5 sm:p-6 order-last lg:order-first">
          {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
          {step === 1 && <LocationStep onNext={() => setStep(2)} />}
          {step === 2 && <HerdStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <FeedsStep onNext={() => setStep(4)} onBack={() => setStep(2)} />}
          {step === 4 && <ResultsStep onBack={() => setStep(3)} onRestart={reset} />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AdvisoryProvider>
      <AdvisoryFlow />
    </AdvisoryProvider>
  );
}
