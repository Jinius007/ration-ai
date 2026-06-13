import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
} from "@elevenlabs/react";
import { Loader2, Mic, PhoneOff, Radio, Sparkles } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import { t } from "../lib/i18n";
import {
  callComputeRationWithReport,
  callListRegionalFeeds,
  computeRequirementsLocal,
} from "../lib/voiceRationTools";

interface ChatLine {
  role: "user" | "agent";
  text: string;
}

function Transcript({ lines, lang }: { lines: ChatLine[]; lang: Parameters<typeof t>[0] }) {
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
              <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{m.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function CallControls({
  agentId,
  lang,
  lines,
  autoStart,
  lpDone,
}: {
  agentId: string;
  lang: Parameters<typeof t>[0];
  lines: ChatLine[];
  autoStart: boolean;
  lpDone: boolean;
}) {
  const { session } = useAdvisory();
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const startedRef = useRef(false);
  const live = status === "connected" || status === "connecting";

  const startCall = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const resp = await fetch("/api/elevenlabs/signed-url");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not start ElevenLabs session");
      await startSession({
        signedUrl: data.signed_url,
        connectionType: "websocket",
        dynamicVariables: {
          farmer_name: session.farmerName || "",
          district: session.location?.district || "",
          village: session.location?.village || "",
          state: session.location?.state || "",
          lang: session.lang,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      startedRef.current = false;
    } finally {
      setConnecting(false);
    }
  }, [session, startSession]);

  useEffect(() => {
    if (!autoStart || startedRef.current || live || connecting) return;
    startedRef.current = true;
    void startCall();
  }, [autoStart, live, connecting, startCall]);

  const statusLabel =
    status === "connected"
      ? t(lang, "live")
      : status === "connecting"
        ? t(lang, "connecting")
        : live
          ? t(lang, "live")
          : t(lang, "off");

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 py-4 sm:px-6 sm:py-6 max-w-2xl mx-auto w-full gap-4">
      <div className="flex flex-col items-center gap-3 py-2">
        <div className={`call-avatar ${status === "connected" ? "call-avatar-live" : ""}`}>
          {connecting ? (
            <Loader2 className="animate-spin" size={36} />
          ) : status === "connected" ? (
            <Mic size={36} />
          ) : (
            <Sparkles size={36} className="text-[var(--warm)]" />
          )}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">{t(lang, "talkToAdvisor")}</h2>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-sm mx-auto">{t(lang, "callHint")}</p>
          <p className="text-[10px] text-[var(--accent-light)] mt-1 flex items-center justify-center gap-1">
            <Sparkles size={10} /> ElevenLabs · LP ration when agent calls compute_balanced_ration
          </p>
          {lpDone && (
            <p className="text-[10px] text-green-400 mt-1">
              {lang === "en" ? "✅ LP ration computed — see form below" : "✅ LP khurak nikli — neeche detail dekhein"}
            </p>
          )}
        </div>
        <span className={`call-status-badge ${status === "connected" ? "call-status-live" : ""}`}>
          {status === "connected" && <Radio size={12} className="animate-pulse" />}
          {statusLabel}
        </span>
      </div>

      <Transcript lines={lines} lang={lang} />

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {!live && !connecting && (
          <button type="button" className="btn btn-warm flex-1 py-4" onClick={() => void startCall()}>
            <Mic size={22} /> {t(lang, "continue")}
          </button>
        )}
        {live && (
          <button type="button" className="btn btn-secondary flex-1 py-4" onClick={() => endSession()}>
            <PhoneOff size={22} /> {t(lang, "endCall")}
          </button>
        )}
      </div>
    </div>
  );
}

export function ElevenLabsVoicePanel({ agentId, autoStart = false }: { agentId: string; autoStart?: boolean }) {
  const { session, applyVoiceResult } = useAdvisory();
  const lang = session.lang;
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [lpDone, setLpDone] = useState(false);

  return (
    <ConversationProvider
      agentId={agentId}
      clientTools={{
        compute_balanced_ration: async (params: Record<string, unknown>) => {
          const result = callComputeRationWithReport(params);
          if (result.ok) {
            applyVoiceResult(result.session, result.report);
            setLpDone(true);
          }
          return result.summary;
        },
        list_regional_feeds: async (params: { district?: string; state?: string }) =>
          callListRegionalFeeds({
            district: String(params.district ?? ""),
            state: String(params.state ?? ""),
          }),
        get_nutrient_requirements: async (params: Record<string, unknown>) =>
          computeRequirementsLocal(params as Parameters<typeof computeRequirementsLocal>[0]),
      }}
      onMessage={(ev) => {
        const role = ev.source === "user" ? "user" : "agent";
        const text = ev.message?.trim();
        if (!text) return;
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === role) {
            return [...prev.slice(0, -1), { role, text: `${last.text} ${text}`.trim() }];
          }
          return [...prev, { role, text }];
        });
      }}
    >
      <CallControls agentId={agentId} lang={lang} lines={lines} autoStart={autoStart} lpDone={lpDone} />
    </ConversationProvider>
  );
}
