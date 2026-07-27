import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type SttLang = "ko" | "zh";

export type SttResult =
  | {
      ok: true;
      text: string;
      provenance: {
        provider: string;
        model: string;
        language: string;
      };
    }
  | { ok: false; message: string };

const audioExtension = (type: string) => {
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4")) return "m4a";
  if (type.includes("wav")) return "wav";
  return "webm";
};

export async function requestSttTranscript(
  audio: Blob,
  lang: SttLang,
): Promise<SttResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? SUPABASE_ANON_KEY;
  const form = new FormData();
  form.append(
    "file",
    audio,
    `interpretation.${audioExtension(audio.type)}`,
  );
  form.append("lang", lang);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stt`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: form,
    });
    const payload = await response.json() as {
      text?: unknown;
      error?: unknown;
      provenance?: {
        provider?: unknown;
        model?: unknown;
        language?: unknown;
      };
    };

    if (!response.ok || typeof payload.text !== "string" || !payload.text.trim()) {
      return {
        ok: false,
        message: typeof payload.error === "string"
          ? payload.error
          : "자동 전사에 실패했습니다.",
      };
    }

    return {
      ok: true,
      text: payload.text.trim(),
      provenance: {
        provider: typeof payload.provenance?.provider === "string"
          ? payload.provenance.provider
          : "openai",
        model: typeof payload.provenance?.model === "string"
          ? payload.provenance.model
          : "gpt-4o-transcribe",
        language: typeof payload.provenance?.language === "string"
          ? payload.provenance.language
          : lang,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error
        ? error.message
        : "자동 전사에 실패했습니다.",
    };
  }
}
