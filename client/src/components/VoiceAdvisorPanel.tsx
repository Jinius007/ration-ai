import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
} from "@elevenlabs/react";
import { Loader2, Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import { t } from "../lib/i18n";
import {
  callComputeRation,
  callListRegionalFeeds,
  computeRequirementsLocal,
} from "../lib/voiceRationTools";

interface ElevenLabsConfig {
  configured: boolean;
  agentId?: string;
  agentName?: string;
  missing?: string[];
  serverReachable?: boolean;
}

interface ChatLine {
  role: "user" | "agent";
  text: string;
}

function resolveAgentId(config: ElevenLabsConfig | null): string | undefined {
  return config?.agentId || import.meta.env.VITE_ELEVENLABS_AGENT_ID || undefined;
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

function LiveCallControls({
  lang,
  lines,
  autoStart,
}: {
  lang: Parameters<typeof t>[0];
  lines: ChatLine[];
  autoStart: boolean;
}) {
  const { session } = useAdvisory();
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const startedRef = useRef(false);
  const live = status === "connected" || status === "connecting";

  const statusKey =
    status === "connected"
      ? "live"
      : status === "connecting"
        ? "connecting"
        : status === "disconnected"
          ? "off"
          : "ending";

  const startCall = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const resp = await fetch("/api/elevenlabs/signed-url");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not start voice session");
      await startSession({
        signedUrl: data.signed_url,
        connectionType: "websocket",
        dynamicVariables: {
          farmer_name: session.farmerName || "",
          district: session.location?.district || "",
          village: session.location?.village || "",
          state: session.location?.state || "",
          animal_count: String(session.animals.length),
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

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 py-4 sm:px-6 sm:py-6 max-w-2xl mx-auto w-full gap-5">
      <div className="flex flex-col items-center gap-3 py-4">
        <div className={`call-avatar ${status === "connected" ? "call-avatar-live" : ""}`}>
          {status === "connected" ? <Mic size={36} /> : connecting ? <Loader2 className="animate-spin" size={36} /> : <MicOff size={36} />}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">{t(lang, "talkToAdvisor")}</h2>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-xs mx-auto">{t(lang, "callHint")}</p>
        </div>
        <span className={`call-status-badge ${status === "connected" ? "call-status-live" : ""}`}>
          {status === "connected" && <Radio size={12} className="animate-pulse" />}
          {t(lang, statusKey as Parameters<typeof t>[1])}
        </span>
      </div>

      <TranscriptPanel lines={lines} lang={lang} />

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
          <p className="mt-1 text-[var(--muted)]">{t(lang, "micRequired")}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {!live && !connecting && (
          <button type="button" className="btn btn-warm flex-1 py-4 text-base" onClick={startCall}>
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

function VoiceSession({
  agentId,
  lang,
  autoStart,
}: {
  agentId: string;
  lang: Parameters<typeof t>[0];
  autoStart: boolean;
}) {
  const [lines, setLines] = useState<ChatLine[]>([]);

  return (
    <ConversationProvider
      agentId={agentId}
      clientTools={{
        compute_balanced_ration: async (params: Record<string, unknown>) => callComputeRation(params),
        list_regional_feeds: async (params: { district?: string; state?: string }) =>
          callListRegionalFeeds({
            district: String(params.district ?? ""),
            state: String(params.state ?? ""),
          }),
        get_nutrient_requirements: async (params: Record<string, unknown>) =>
          computeRequirementsLocal(params as Parameters<typeof computeRequirementsLocal>[0]),
      }}
      onMessage={(ev) => {
        const source = ev.source === "user" ? "user" : "agent";
        const text = ev.message?.trim();
        if (!text) return;
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === source) {
            return [...prev.slice(0, -1), { role: source, text: `${last.text} ${text}`.trim() }];
          }
          return [...prev, { role: source, text }];
        });
      }}
    >
      <LiveCallControls lang={lang} lines={lines} autoStart={autoStart} />
    </ConversationProvider>
  );
}

export function VoiceAdvisorPanel({ autoStart = false }: { autoStart?: boolean }) {
  const { session } = useAdvisory();
  const lang = session.lang;
  const [config, setConfig] = useState<ElevenLabsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch("/api/elevenlabs/config")
      .then((r) => {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then((data: ElevenLabsConfig) => setConfig({ ...data, serverReachable: true }))
      .catch(() => {
        setFetchError(true);
        setConfig({ configured: false, serverReachable: false });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
        <Loader2 className="animate-spin" size={20} /> {t(lang, "voiceLoading")}
      </div>
    );
  }

  const agentId = resolveAgentId(config);
  const canStart = Boolean(agentId && config?.configured);

  if (!canStart) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3 max-w-md mx-auto">
        <Mic size={32} className="text-[var(--warm)]" />
        <h3 className="font-semibold">{t(lang, "voiceSetupTitle")}</h3>
        <p className="text-sm text-[var(--muted)]">{t(lang, "voiceSetupHint")}</p>
        {fetchError && (
          <p className="text-xs text-amber-400/90">
            {lang === "hi"
              ? "API server nahi chal raha — `npm run dev` se client + server dono chalayein."
              : "API server not reachable — run `npm run dev` to start client and server together."}
          </p>
        )}
        {!fetchError && config?.missing?.length ? (
          <p className="text-xs text-[var(--muted)]">Missing: {config.missing.join(", ")}</p>
        ) : null}
      </div>
    );
  }

  return <VoiceSession agentId={agentId!} lang={lang} autoStart={autoStart} />;
}

export function useSyncSessionToServer() {
  const { session } = useAdvisory();
  useEffect(() => {
    const t = setTimeout(() => {
      void fetch("/api/ration/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [session]);
}
