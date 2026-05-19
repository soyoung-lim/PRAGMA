const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type TtsLang = "ko" | "zh";

export const DEFAULT_TTS_VOICE_BY_LANG: Record<TtsLang, string> = {
  ko: "21m00Tcm4TlvDq8ikWAM",
  zh: "21m00Tcm4TlvDq8ikWAM",
};

export const FREE_TIER_TTS_VOICE_IDS = [
  "EXAVITQu4vr4xnSDxMaL",
  "9BWtsMINqrJLrRacOk9x",
] as const;

const DISABLED_TTS_VOICE_STORAGE_KEY = "tts-disabled-voices";

type TtsSuccess = {
  ok: true;
  blob: Blob;
  requestedVoiceId: string;
  usedVoiceId: string;
  fallbackUsed: boolean;
};

type TtsFailure = {
  ok: false;
  message: string;
  requestedVoiceId: string;
  providerCode?: string;
  fallback?: boolean;
  status?: number;
};

export type TtsResult = TtsSuccess | TtsFailure;

const canUseSessionStorage = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const readDisabledVoices = () => {
  if (!canUseSessionStorage()) return new Set<string>();

  try {
    const raw = window.sessionStorage.getItem(DISABLED_TTS_VOICE_STORAGE_KEY);
    if (!raw) return new Set<string>();

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((value): value is string => typeof value === "string")) : new Set<string>();
  } catch {
    return new Set<string>();
  }
};

const writeDisabledVoices = (voices: Set<string>) => {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(DISABLED_TTS_VOICE_STORAGE_KEY, JSON.stringify(Array.from(voices)));
  } catch {
    // ignore session storage errors
  }
};

export const disableTtsVoiceForSession = (voiceId?: string | null) => {
  if (!voiceId) return;
  const voices = readDisabledVoices();
  voices.add(voiceId);
  writeDisabledVoices(voices);
};

export const getSessionTtsVoice = (lang: TtsLang, preferredVoiceId?: string) => {
  const preferred = preferredVoiceId ?? DEFAULT_TTS_VOICE_BY_LANG[lang];
  const disabledVoices = readDisabledVoices();

  if (!disabledVoices.has(preferred)) {
    return preferred;
  }

  return FREE_TIER_TTS_VOICE_IDS.find((voiceId) => !disabledVoices.has(voiceId)) ?? preferred;
};

export const isTtsRelatedErrorMessage = (value: unknown) => {
  const text = typeof value === "string"
    ? value
    : value && typeof value === "object"
      ? [
          (value as { message?: string }).message,
          (value as { error?: string }).error,
          (value as { reason?: string }).reason,
        ].filter(Boolean).join(" ")
      : "";

  return /functions\/v1\/tts|edge function returned|paid_plan_required|voice_not_found|unauthorized_free_user|detected_unusual_activity|tts/i.test(text);
};

const isFallbackableProviderCode = (code?: string) =>
  Boolean(code && [
    "paid_plan_required",
    "voice_not_found",
    "unauthorized_free_user",
    "payment_required",
    "detected_unusual_activity",
    "http_401",
    "http_402",
  ].includes(code));

export const requestTtsAudio = async ({
  text,
  lang,
  preferredVoiceId,
  logPrefix = "[TTS]",
}: {
  text: string;
  lang: TtsLang;
  preferredVoiceId?: string;
  logPrefix?: string;
}): Promise<TtsResult> => {
  const requestedVoiceId = getSessionTtsVoice(lang, preferredVoiceId);

  try {
    console.log(`${logPrefix} sending:`, { text, lang, requestedVoiceId });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ text, lang, voiceId: requestedVoiceId }),
    });

    const contentType = response.headers.get("content-type") || "";
    console.log(`${logPrefix} status:`, response.status, "content-type:", contentType);

    if (contentType.includes("audio")) {
      const blob = await response.blob();
      const usedVoiceId = response.headers.get("X-TTS-Voice-Id") || requestedVoiceId;
      const fallbackUsed = response.headers.get("X-TTS-Fallback-Used") === "1";
      console.log(`${logPrefix} blob:`, { size: blob.size, type: blob.type, valid: blob.size > 0, usedVoiceId, fallbackUsed });

      if (blob.size === 0) {
        return {
          ok: false,
          message: "빈 오디오 응답입니다.",
          requestedVoiceId,
          status: response.status,
        };
      }

      if (fallbackUsed && usedVoiceId !== requestedVoiceId) {
        disableTtsVoiceForSession(requestedVoiceId);
      }

      return {
        ok: true,
        blob,
        requestedVoiceId,
        usedVoiceId,
        fallbackUsed,
      };
    }

    let payload: Record<string, unknown> | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const providerCode = typeof payload?.providerCode === "string" ? payload.providerCode : undefined;
    const disabledVoiceId = typeof payload?.disabledVoiceId === "string" ? payload.disabledVoiceId : undefined;
    const message = typeof payload?.error === "string"
      ? payload.error
      : !response.ok
        ? `TTS 실패 (${response.status})`
        : "오디오 응답이 아닙니다.";

    if (disabledVoiceId) {
      disableTtsVoiceForSession(disabledVoiceId);
    } else if (isFallbackableProviderCode(providerCode)) {
      disableTtsVoiceForSession(requestedVoiceId);
    }

    console.warn(`${logPrefix} non-audio response:`, {
      status: response.status,
      providerCode,
      message,
      requestedVoiceId,
    });

    return {
      ok: false,
      message,
      requestedVoiceId,
      providerCode,
      fallback: Boolean(payload?.fallback),
      status: response.status,
    };
  } catch (error) {
    console.error(`${logPrefix} unexpected error:`, error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "음성 생성에 실패했습니다. 다시 시도해 주세요.",
      requestedVoiceId,
    };
  }
};