import { ChevronDown, ChevronUp } from "lucide-react";
import { AdvisoryProvider, useAdvisory } from "./context/AdvisoryContext";
import { FeedsStep } from "./components/FeedsStep";
import { HerdStep } from "./components/HerdStep";
import { LocationStep } from "./components/LocationStep";
import { ResultsStep } from "./components/ResultsStep";
import { StepProgress } from "./components/ui";
import { VoiceAdvisorPanel, useSyncSessionToServer } from "./components/VoiceAdvisorPanel";
import { LANGUAGES, langLabel, t } from "./lib/i18n";

const FORM_STEPS_HI = ["Jila", "Pashu", "Chara", "Ration"];
const FORM_STEPS_EN = ["Area", "Herd", "Feeds", "Plan"];

function LanguageScreen() {
  const { session, setLang, setPhase } = useAdvisory();
  const lang = session.lang;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 max-w-2xl mx-auto">
      <div className="text-center space-y-3 mb-8">
        <div className="text-5xl animate-pulse-soft">🐄</div>
        <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-[var(--accent-light)] to-[var(--warm)] bg-clip-text text-transparent">
          {t(lang, "appTitle")}
        </h1>
        <p className="text-sm text-[var(--muted)] max-w-md mx-auto leading-relaxed">{t(lang, "appSubtitle")}</p>
      </div>

      <div className="w-full space-y-4">
        <div className="text-center">
          <h2 className="font-semibold text-lg">{t(lang, "chooseLanguage")}</h2>
          <p className="text-xs text-[var(--muted)] mt-1">{t(lang, "chooseLanguageHint")}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LANGUAGES.map(({ code, native, english }) => (
            <button
              key={code}
              type="button"
              className={`lang-btn ${session.lang === code ? "lang-btn-active" : ""}`}
              onClick={() => setLang(code)}
            >
              <span className="text-base font-semibold">{native}</span>
              {code !== "en" && code !== "hi" && (
                <span className="text-[10px] text-[var(--muted)]">{english}</span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary w-full py-4 text-lg mt-4"
          onClick={() => setPhase("call")}
        >
          {t(lang, "continue")}
        </button>
      </div>
    </div>
  );
}

function ManualFormPanel() {
  const { session, step, setStep, reset, showForm, setShowForm } = useAdvisory();
  const lang = session.lang;
  const steps = lang !== "en" ? FORM_STEPS_HI : FORM_STEPS_EN;

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]"
        onClick={() => setShowForm(!showForm)}
      >
        <span>{t(lang, "manualForm")}</span>
        {showForm ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {showForm && (
        <div className="px-4 pb-8 max-w-3xl mx-auto space-y-4">
          <p className="text-xs text-[var(--muted)]">{t(lang, "manualFormHint")}</p>
          <StepProgress steps={steps} current={step - 1} />
          <div className="card p-5 sm:p-6">
            {step === 1 && <LocationStep onNext={() => setStep(2)} />}
            {step === 2 && <HerdStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && <FeedsStep onNext={() => setStep(4)} onBack={() => setStep(2)} />}
            {step === 4 && <ResultsStep onBack={() => setStep(3)} onRestart={reset} />}
          </div>
        </div>
      )}
    </div>
  );
}

function CallScreen() {
  const { session, setPhase } = useAdvisory();
  const lang = session.lang;
  useSyncSessionToServer();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]/60 backdrop-blur">
        <div>
          <h1 className="font-bold text-sm sm:text-base">{t(lang, "talkToAdvisor")}</h1>
          <p className="text-[10px] sm:text-xs text-[var(--muted)]">{langLabel(lang)}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary text-xs py-1.5 px-2.5" onClick={() => setPhase("language")}>
            {t(lang, "changeLanguage")}
          </button>
          {session.farmerName && (
            <span className="hidden sm:inline text-xs text-[var(--muted)] self-center">
              {t(lang, "hello")}, {session.farmerName}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <VoiceAdvisorPanel autoStart />
      </main>

      <ManualFormPanel />
    </div>
  );
}

function AdvisoryFlow() {
  const { phase } = useAdvisory();
  return phase === "language" ? <LanguageScreen /> : <CallScreen />;
}

export default function App() {
  return (
    <AdvisoryProvider>
      <AdvisoryFlow />
    </AdvisoryProvider>
  );
}
