import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import { t } from "../lib/i18n";
import {
  emptyDraft,
  initialStage,
  openingLine,
  processInput,
  type ConvDraft,
} from "../lib/localVoiceConversation";
import type { ConvStage } from "../lib/conversationScripts";
import { computeHerdRation } from "../lib/rationService";
import {
  listenOnce,
  preloadVoices,
  speak,
  speechLang,
  speechSupported,
  stopSpeaking,
  type SpeechStatus,
} from "../lib/speech";

interface ChatLine {
  role: "user" | "agent";
  text: string;
}

function TranscriptPanel({ lines, lang }: { lines: ChatLine[]; lang: Parameters<typeof t>[0] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="flex-1 flex flex-col min-h-0 call-transcript">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2 px-1">{t(lang, "transcriptLive")}</p>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[200px] max-h-[50vh] sm:max-h-none">
        {!lines.length ? (
          <p className="text-sm text-[var(--muted)] italic px-2 py-8 text-center">{t(lang, "transcriptEmpty")}</p>
        ) : (
          lines.map((m, i) => (
            <div
              key={i}
              className={`call-bubble ${m.role === "user" ? "call-bubble-user" : "call-bubble-agent"}`}
            >
              <span className="call-bubble-label">{m.role === "user" ? t(lang, "you") : t(lang, "advisor")}</span>
              <p className="text-sm sm:text-base leading-relaxed">{m.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/** Free browser voice — fallback when ElevenLabs is not configured */
export function LocalVoicePanel({ autoStart = false }: { autoStart?: boolean }) {
  const { session, applyVoiceResult } = useAdvisory();
  const lang = session.lang;
  const speechCode = speechLang(lang);

  const [lines, setLines] = useState<ChatLine[]>([]);
  const [live, setLive] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [partial, setPartial] = useState("");

  const stageRef = useRef<ConvStage>(initialStage());
  const draftRef = useRef<ConvDraft>(emptyDraft());
  const liveRef = useRef(false);
  const startedRef = useRef(false);
  const loopRef = useRef(false);

  const pushLine = useCallback((role: ChatLine["role"], text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLines((prev) => [...prev, { role, text: trimmed }]);
  }, []);

  const sayAndListen = useCallback(async () => {
    if (!liveRef.current || loopRef.current) return;
    loopRef.current = true;
    setError(null);
    setPartial("");

    try {
      setSpeechStatus("listening");
      const heard = await listenOnce(speechCode, setPartial);
      const input = heard.trim();
      if (!liveRef.current) return;

      if (!input) {
        setError(
          lang === "en"
            ? "I didn't hear you — try again, or type your answer below."
            : "Sunai nahi diya — phir boliye, ya neeche likh dijiye."
        );
        setSpeechStatus("idle");
        loopRef.current = false;
        if (liveRef.current) void sayAndListen();
        return;
      }

      pushLine("user", input);
      const result = processInput(lang, stageRef.current, { ...draftRef.current }, input);
      draftRef.current = result.draft;
      stageRef.current = result.stage;

      if (result.session) {
        const report = computeHerdRation(result.session);
        applyVoiceResult(result.session, report);
      }

      setSpeechStatus("speaking");
      pushLine("agent", result.reply);
      await speak(result.reply, speechCode);

      if (stageRef.current === "done") {
        setLive(false);
        liveRef.current = false;
        setSpeechStatus("idle");
        loopRef.current = false;
        return;
      }

      if (liveRef.current) {
        loopRef.current = false;
        void sayAndListen();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSpeechStatus("idle");
      loopRef.current = false;
    }
  }, [applyVoiceResult, lang, pushLine, speechCode]);

  const agentSays = useCallback(
    async (text: string) => {
      setSpeechStatus("speaking");
      pushLine("agent", text);
      await speak(text, speechCode);
      setSpeechStatus("idle");
    },
    [pushLine, speechCode]
  );

  const startCall = useCallback(async () => {
    if (!speechSupported()) {
      setError(
        lang === "en"
          ? "Use Chrome or Edge for voice. You can type answers below."
          : "Awaz ke liye Chrome ya Edge use karein. Neeche likh kar bhi jawab de sakte hain."
      );
      setShowTextInput(true);
      setLive(true);
      liveRef.current = true;
      stageRef.current = initialStage();
      draftRef.current = emptyDraft();
      setLines([]);
      await agentSays(openingLine(lang));
      return;
    }

    setError(null);
    setLive(true);
    liveRef.current = true;
    stageRef.current = initialStage();
    draftRef.current = emptyDraft();
    setLines([]);
    preloadVoices();
    await agentSays(openingLine(lang));
    void sayAndListen();
  }, [agentSays, lang, sayAndListen]);

  const endCall = useCallback(() => {
    setLive(false);
    liveRef.current = false;
    loopRef.current = false;
    stopSpeaking();
    setSpeechStatus("idle");
    setPartial("");
  }, []);

  const submitText = useCallback(async () => {
    const input = textInput.trim();
    if (!input) return;
    setTextInput("");
    pushLine("user", input);
    const result = processInput(lang, stageRef.current, { ...draftRef.current }, input);
    draftRef.current = result.draft;
    stageRef.current = result.stage;
    if (result.session) {
      const report = computeHerdRation(result.session);
      applyVoiceResult(result.session, report);
    }
    await agentSays(result.reply);
    if (stageRef.current !== "done" && liveRef.current && speechSupported()) {
      void sayAndListen();
    }
  }, [agentSays, applyVoiceResult, lang, pushLine, sayAndListen, textInput]);

  useEffect(() => {
    preloadVoices();
  }, []);

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    void startCall();
  }, [autoStart, startCall]);

  const statusKey =
    speechStatus === "speaking"
      ? "live"
      : speechStatus === "listening"
        ? "connecting"
        : live
          ? "live"
          : "off";

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 py-4 sm:px-6 sm:py-6 max-w-2xl mx-auto w-full gap-4">
      <div className="flex flex-col items-center gap-3 py-2">
        <div className={`call-avatar ${live ? "call-avatar-live" : ""}`}>
          {speechStatus === "listening" ? (
            <Mic size={36} className="text-green-300" />
          ) : speechStatus === "speaking" ? (
            <Radio size={36} className="animate-pulse text-[var(--warm)]" />
          ) : live ? (
            <Mic size={36} />
          ) : (
            <MicOff size={36} />
          )}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">{t(lang, "talkToAdvisor")}</h2>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-sm mx-auto">{t(lang, "callHint")}</p>
          <p className="text-[10px] text-[var(--muted)] mt-1">
            {lang === "en" ? "Browser voice (fallback)" : "Browser awaz (backup)"}
          </p>
        </div>
        <span className={`call-status-badge ${live ? "call-status-live" : ""}`}>
          {live && <Radio size={12} className="animate-pulse" />}
          {speechStatus === "listening"
            ? lang === "en"
              ? "Listening…"
              : "Sun raha hoon…"
            : t(lang, statusKey as Parameters<typeof t>[1])}
        </span>
        {partial && speechStatus === "listening" && (
          <p className="text-xs text-[var(--muted)] italic max-w-md text-center">"{partial}"</p>
        )}
      </div>

      <TranscriptPanel lines={lines} lang={lang} />

      {error && (
        <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {(showTextInput || !speechSupported()) && live && (
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submitText()}
            placeholder={lang === "en" ? "Type your answer…" : "Jawab likhiye…"}
          />
          <button type="button" className="btn btn-secondary px-3" onClick={() => void submitText()}>
            <Keyboard size={18} />
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {!live ? (
          <button type="button" className="btn btn-warm flex-1 py-4 text-base" onClick={() => void startCall()}>
            <Mic size={22} /> {t(lang, "continue")}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary px-4"
              onClick={() => setShowTextInput((v) => !v)}
            >
              <Keyboard size={20} />
            </button>
            <button type="button" className="btn btn-secondary flex-1 py-4" onClick={endCall}>
              <PhoneOff size={22} /> {t(lang, "endCall")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
