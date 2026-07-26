// 「실제 자료에서 생성」 (Authentic Source Import) — AdminGenerator 내부 패널.
// 관리자가 실제 중국어/한국어 자료(이미지 또는 문구)를 입력하면 edge function
// generate-scenario(action:"authentic_analyze")가 분석해 '활용 후보'를 제안한다.
// 후보를 고르면 onApply로 상위(AdminGenerator)의 생성기 폼에 값이 채워지고,
// 그 다음부터는 기존 생성→검수→draft 저장 경로를 그대로 탄다.
//
// 이 패널은 원자료(실제 문구)와 AI가 새로 구성한 내용을 화면에서 분리해 보여준다.
// 업로드 이미지는 분석에만 쓰이고 저장/학습자 노출하지 않는다(전송 후 폐기).

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  SPEECH_ACT_UI,
  LEVEL,
  PDR_POWER_SHORT,
  PDR_DISTANCE_SHORT,
  PDR_BURDEN_SHORT,
  DOMAIN,
  INDUSTRY,
  CHANNEL_UI,
} from "@/lib/pragma/enums";
import type {
  SpeechActUI,
  LearnerLevel,
  LanguageDirection,
  ChannelUI,
  PdrPower,
  PdrDistance,
  PdrBurden,
  Domain,
  IndustrySector,
  ComplexTaskUI,
} from "@/lib/pragma/enums";
import type { CoreProvenance, CoreSourceType } from "@/lib/pragma/coreSchema";

// ── 활용 유형 라벨 ──────────────────────────────────────────────────────
type UsageType =
  | "scenario_seed"
  | "preceding_turn"
  | "translation_source"
  | "response_task"
  | "expression_resource"
  | "unsuitable";

const USAGE_KO: Record<UsageType, string> = {
  scenario_seed: "시나리오 씨앗",
  preceding_turn: "선행 발화",
  translation_source: "번역 출발문",
  response_task: "후속 반응 과제",
  expression_resource: "표현 자원",
  unsuitable: "미션 부적합",
};
const USAGE_TONE: Record<UsageType, string> = {
  scenario_seed: "border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46]",
  preceding_turn: "border-[#93C5FD] bg-[#DBEAFE] text-[#1E40AF]",
  translation_source: "border-[#C4B5FD] bg-[#EDE9FE] text-[#5B21B6]",
  response_task: "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]",
  expression_resource: "border-[#EAE4D2] bg-[#FAF7EE] text-[#5B5446]",
  unsuitable: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
};
// 생성기로 전달 가능한 유형(억지 화행화 금지 유형은 전달 버튼 없음).
const GENERATABLE: UsageType[] = [
  "scenario_seed",
  "preceding_turn",
  "translation_source",
  "response_task",
];

// ── AI 응답 타입(관대하게 받는다) ───────────────────────────────────────
interface RawCandidate {
  usage_type?: string;
  label_ko?: string;
  speech_act?: string | null;
  language_direction?: string;
  domain?: string;
  industry?: string | null;
  channel?: string;
  complex_task?: string;
  level?: string;
  pdr_power?: string;
  pdr_distance?: string;
  pdr_burden?: string;
  situation_seed_ko?: string | null;
  source_text?: string | null;
  preceding_turn?: string | null;
  source_usage_note_ko?: string | null;
  ai_adaptation_note_ko?: string | null;
  expression?: {
    text?: string;
    meaning_ko?: string;
    usage_note_ko?: string;
    example_zh?: string;
    tags?: string[];
  } | null;
}
interface RawAnalysis {
  source_original?: string;
  extraction_confidence?: string;
  scene_ko?: string;
  linguistic_features_ko?: string;
  recommended_uses?: string[];
  recommendation_reason_ko?: string;
  connectable_speech_acts?: string[];
  unsuitable_reason_ko?: string | null;
  candidates?: RawCandidate[];
}

// 상위 생성기 폼에 전달할 정규화된 후보(모든 enum 키가 유효).
export interface AuthenticApply {
  usage_type: UsageType;
  speech_act_ui: SpeechActUI;
  language_direction: LanguageDirection;
  domain: Domain;
  industry: IndustrySector | null;
  channel: ChannelUI;
  complex_task: ComplexTaskUI;
  level: LearnerLevel;
  pdr_power: PdrPower;
  pdr_distance: PdrDistance;
  pdr_burden: PdrBurden;
  source_text: string;
  /** provenance-lite(0-q·98) — 지금까지 버려지던 출처를 상위로 넘긴다 */
  provenance: CoreProvenance;
}

// ── enum 방어 정규화 ────────────────────────────────────────────────────
const SPEECH_ACTS = Object.keys(SPEECH_ACT_UI) as SpeechActUI[];
function asSpeechAct(v?: string | null): SpeechActUI {
  return SPEECH_ACTS.includes(v as SpeechActUI) ? (v as SpeechActUI) : "request";
}
function asDirection(v?: string | null): LanguageDirection {
  return v === "zh_ko" ? "zh_ko" : v === "ko_zh" ? "ko_zh" : "zh_ko";
}
function asDomain(v?: string | null): Domain {
  return v === "daily" || v === "school" || v === "work" ? v : "work";
}
function asIndustry(v?: string | null): IndustrySector | null {
  return v && v in INDUSTRY ? (v as IndustrySector) : null;
}
function asChannel(v?: string | null): ChannelUI {
  return v === "email" || v === "messenger" || v === "facetoface" || v === "phone"
    ? v
    : "messenger";
}
function asComplexTask(v?: string | null): ComplexTaskUI {
  return v === "none" || v === "persuade" || v === "coordinate" || v === "negotiate"
    ? v
    : "none";
}
function asLevel(v?: string | null): LearnerLevel {
  return v === "beginner_intermediate" || v === "intermediate" || v === "advanced"
    ? v
    : "intermediate";
}
// pdr는 AI가 JSON 이름(speaker_lower 등) 또는 enum 키(higher 등)로 답할 수 있어 둘 다 수용.
function asPower(v?: string | null): PdrPower {
  if (v === "speaker_lower") return "higher";
  if (v === "speaker_higher") return "lower";
  return v === "higher" || v === "equal" || v === "lower" ? v : "equal";
}
function asDistance(v?: string | null): PdrDistance {
  if (v === "distant") return "formal";
  return v === "close" || v === "acquaintance" || v === "formal" ? v : "acquaintance";
}
function asBurden(v?: string | null): PdrBurden {
  return v === "low" || v === "mid" || v === "high" ? v : "mid";
}
function asUsageType(v?: string | null): UsageType {
  return (["scenario_seed", "preceding_turn", "translation_source", "response_task", "expression_resource", "unsuitable"] as UsageType[]).includes(
    v as UsageType,
  )
    ? (v as UsageType)
    : "unsuitable";
}

// provenance는 후보(candidate)가 아니라 패널 입력 상태에서 나오므로 여기서 제외한다.
function normalizeApply(c: RawCandidate): Omit<AuthenticApply, "provenance"> {
  return {
    usage_type: asUsageType(c.usage_type),
    speech_act_ui: asSpeechAct(c.speech_act),
    language_direction: asDirection(c.language_direction),
    domain: asDomain(c.domain),
    industry: asIndustry(c.industry),
    channel: asChannel(c.channel),
    complex_task: asComplexTask(c.complex_task),
    level: asLevel(c.level),
    pdr_power: asPower(c.pdr_power),
    pdr_distance: asDistance(c.pdr_distance),
    pdr_burden: asBurden(c.pdr_burden),
    source_text: (c.source_text ?? "").trim(),
  };
}

const CONFIDENCE_KO: Record<string, { label: string; tone: string }> = {
  high: { label: "인식 신뢰도 높음", tone: "bg-[#D1FAE5] text-[#065F46]" },
  medium: { label: "인식 신뢰도 보통 — 확인 권장", tone: "bg-[#FEF3C7] text-[#92400E]" },
  low: { label: "인식 불확실 — 추출 문구를 확인해 주세요", tone: "bg-[#FEE2E2] text-[#991B1B]" },
  text_input: { label: "직접 입력 문구", tone: "bg-[#EAE4D2] text-[#5B5446]" },
};

interface Props {
  onApply: (a: AuthenticApply) => void;
}

const AuthenticImportPanel = ({ onApply }: Props) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [note, setNote] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [direction, setDirection] = useState<LanguageDirection>("zh_ko");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  // 원자료 취득 경로 = provenance.source_type(0-q·98). 명시적 입력 행위에서만 바뀐다.
  // 이미지에서 뽑은 텍스트를 관리자가 고쳐 재분석해도 출처는 여전히 이미지다.
  const [inputOrigin, setInputOrigin] = useState<CoreSourceType>("authentic_text");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RawAnalysis | null>(null);
  const [editedOriginal, setEditedOriginal] = useState("");
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickImage = (file: File | null) => {
    if (!file) return;
    if (!/image\/(jpeg|jpg|png|webp)/.test(file.type)) {
      setError("jpg·png·webp 이미지만 지원합니다.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("이미지는 6MB 이하로 업로드하세요.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setImageName(file.name);
      setInputOrigin("authentic_image");
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageDataUrl(null);
    setImageName(null);
    setInputOrigin("authentic_text");
    if (fileRef.current) fileRef.current.value = "";
  };

  // reAnalyzeText: 관리자가 추출 원문을 수정한 뒤 그 텍스트로만 재분석(이미지 제외).
  const runAnalyze = async (overrideText?: string) => {
    const useText = (overrideText ?? text).trim();
    if (!useText && !imageDataUrl) {
      setError("이미지를 업로드하거나 문구를 입력하세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setAppliedIdx(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-scenario", {
        body: {
          action: "authentic_analyze",
          authentic: {
            text: useText || null,
            // 재분석(수정 원문)일 때는 이미지 제외 — 관리자가 확정한 텍스트를 신뢰.
            image_data_url: overrideText !== undefined ? null : imageDataUrl,
            source_ref: sourceRef.trim() || null,
            note: note.trim() || null,
            language_direction: direction,
          },
        },
      });
      if (fnErr) throw fnErr;
      if (!data?.analysis) throw new Error(data?.error ?? "분석 결과가 비어 있습니다.");
      const a = data.analysis as RawAnalysis;
      setAnalysis(a);
      setEditedOriginal((a.source_original ?? useText ?? "").trim());
    } catch (e) {
      setError((e as Error).message ?? "분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // C. YouTube 중국어 자막 자동 입력 — 기존 youtube-transcript(supadata) edge 함수 재호출.
  // 신규 연동/함수 수정 없음(§7 준수) — 가져온 자막을 텍스트 칸에 채워 관리자가 다듬은 뒤 분석.
  const fetchCaption = async () => {
    const u = youtubeUrl.trim();
    if (!u) {
      setError("YouTube URL을 입력하세요.");
      return;
    }
    setYtLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("youtube-transcript", {
        body: { url: u, lang: "zh", text: false },
      });
      if (fnErr) throw fnErr;
      if (data?.error) {
        const em = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
        throw new Error(em);
      }
      if (data?.async) {
        setError("자막이 비동기 처리 중입니다 — 잠시 후 다시 시도하거나 문구를 직접 붙여넣어 주세요.");
        return;
      }
      const content = (data?.raw as { content?: unknown } | undefined)?.content;
      const caption =
        typeof content === "string"
          ? content
          : Array.isArray(content)
          ? content.map((s: { text?: string }) => s?.text ?? "").join(" ")
          : (data?.textPreview as string | undefined) ?? "";
      if (!caption.trim()) {
        setError("이 영상에서 중국어 자막(CC)을 찾지 못했습니다. 다른 영상이나 직접 입력을 사용하세요.");
        return;
      }
      setText(caption.trim());
      setInputOrigin("authentic_youtube");
      // 출처가 비어 있으면 영상 URL을 기본 출처로 채운다(provenance 0-q·98).
      if (!sourceRef.trim()) setSourceRef(u);
      setDirection("zh_ko");
    } catch (e) {
      const msg = (e as Error).message ?? "";
      setError(
        msg.includes("SUPADATA_API_KEY")
          ? "서버에 SUPADATA_API_KEY가 설정되지 않았습니다 — 배포 환경변수 설정 필요(이미지·문구 입력은 정상 동작)."
          : msg || "자막을 가져오지 못했습니다.",
      );
    } finally {
      setYtLoading(false);
    }
  };

  const apply = (c: RawCandidate, i: number) => {
    const base = normalizeApply(c);
    // 관리자가 확정한 원문을 우선한다(없으면 모델이 판독한 원문).
    const original = (editedOriginal || analysis?.source_original || "").trim();
    onApply({
      ...base,
      provenance: {
        source_type: inputOrigin,
        source_ref: sourceRef.trim() || null,
        source_original: original || null,
        // 사용 원문이 원자료와 다르면 AI가 재구성한 것이다.
        ai_adapted: original.length > 0 && base.source_text.trim() !== original,
        // anonymized는 수집 UI가 아직 없어 미설정으로 둔다(스키마 optional).
      },
    });
    setAppliedIdx(i);
  };

  return (
    <div className="rounded-lg border border-[#EAE4D2] bg-[#FBEFD9]/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-medium text-[#7A4A0A]">
          🎬 실제 자료에서 생성 · Authentic Source Import
          <span className="whitespace-nowrap rounded-full bg-[#BA7517]/15 px-2 py-0.5 text-[10.5px] font-normal text-[#7A4A0A]">
            이미지·문구 → 활용 후보
          </span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-[13px] text-[#8a857c]">{open ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#EAE4D2] px-4 py-4">
          <p className="text-[11.5px] leading-relaxed text-[#5B5446]">
            중국 쇼츠·드라마 캡처, 소설·메신저 문구 등 실제 자료를 입력하면 AI가 화용적 활용 방식을
            분석해 후보를 제안합니다. 후보를 고르면 아래 생성기 조건이 채워지고, 이후는 기존
            생성·검수·draft 저장 경로를 그대로 따릅니다. (업로드 이미지는 분석에만 쓰이고 저장·학습자
            노출되지 않습니다.)
          </p>

          {/* 1단계: 자료 입력 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* 이미지 */}
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">A. 이미지 1장 (선택)</label>
              {!imageDataUrl ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-1.5 flex h-24 w-full items-center justify-center rounded-md border border-dashed border-[#EAE4D2] bg-[#FAF7EE] text-[12px] text-muted-foreground hover:bg-muted"
                >
                  + 캡처 이미지 업로드 (jpg·png·webp)
                </button>
              ) : (
                <div className="mt-1.5 relative">
                  <img
                    src={imageDataUrl}
                    alt={imageName ?? "미리보기"}
                    className="max-h-40 w-full rounded-md border border-[#EAE4D2] object-contain bg-[#FAF7EE]"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-white hover:bg-black/80"
                  >
                    제거
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* 텍스트 */}
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">B. 문구 직접 입력</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="짧은 중국어 또는 한국어 문구 (예: 每天都有忙不完的事)"
                className="mt-1.5 h-24 w-full resize-none rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#BA7517]/40"
              />
            </div>
          </div>

          {/* C. YouTube 중국어 자막 자동 입력 (기존 youtube-transcript 재사용) */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">
              C. YouTube 중국어 자막 자동 입력 (선택 · CC 지원 영상만)
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="h-9 flex-1 rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#BA7517]/40"
              />
              <Button
                type="button"
                onClick={fetchCaption}
                disabled={ytLoading || !youtubeUrl.trim()}
                className="shrink-0 bg-[#BA7517] text-white hover:bg-[#BA7517]/90 disabled:opacity-60"
              >
                {ytLoading ? "가져오는 중…" : "중국어 자막 가져오기"}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              중국어 자막(CC)이 있는 영상만. 가져온 자막은 위 <b>B. 문구</b> 칸에 채워지니, 필요한 부분만
              남기고 「활용 가능성 분석」을 실행하세요.
            </p>
          </div>

          {/* 선택 입력 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="text-[12px] text-muted-foreground">출처 URL·책·시점 (선택)</label>
              <input
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#BA7517]/40"
              />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground">관리자 메모 (선택)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#BA7517]/40"
              />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground">기본 언어 방향</label>
              <div className="mt-1.5 flex gap-1.5">
                {(["zh_ko", "ko_zh"] as LanguageDirection[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={[
                      "h-9 flex-1 rounded-md text-[12.5px] font-medium transition-colors",
                      direction === d
                        ? "border-2 border-[#BA7517] bg-[#FBEFD9] text-[#7A4A0A]"
                        : "border border-[#EAE4D2] bg-transparent text-muted-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {d === "zh_ko" ? "중→한" : "한→중"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={() => runAnalyze()}
            disabled={loading || (!text.trim() && !imageDataUrl)}
            className="w-full bg-[#1d2336] text-white hover:bg-[#1d2336]/90 disabled:opacity-60"
          >
            🔍 {loading ? "분석 중..." : "활용 가능성 분석"}
          </Button>

          {error && (
            <div className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#991B1B]">
              {error}
            </div>
          )}

          {/* 2단계: 원자료 확인 + 3단계: 분석 + 4단계: 후보 */}
          {analysis && (
            <div className="space-y-4">
              {/* 원자료 (관리자 수정 가능) */}
              <div className="rounded-md border border-[#EAE4D2] bg-[#FAF7EE] p-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a857c]">
                    ① 원자료 (실제 자료에서 추출·입력)
                  </span>
                  {analysis.extraction_confidence && (
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                        (CONFIDENCE_KO[analysis.extraction_confidence] ?? CONFIDENCE_KO.text_input).tone,
                      ].join(" ")}
                    >
                      {(CONFIDENCE_KO[analysis.extraction_confidence] ?? CONFIDENCE_KO.text_input).label}
                    </span>
                  )}
                </div>
                <textarea
                  value={editedOriginal}
                  onChange={(e) => setEditedOriginal(e.target.value)}
                  className="h-16 w-full resize-none rounded-md border border-[#EAE4D2] bg-background px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#BA7517]/40"
                />
                <button
                  type="button"
                  onClick={() => runAnalyze(editedOriginal)}
                  disabled={loading || !editedOriginal.trim()}
                  className="mt-2 rounded-md border border-[#EAE4D2] bg-background px-3 py-1 text-[11.5px] text-[#1d2336] hover:bg-muted disabled:opacity-60"
                >
                  ↻ 수정한 원문으로 재분석
                </button>
              </div>

              {/* AI 분석 */}
              <div className="rounded-md border border-[#C4B5FD] bg-[#EDE9FE]/40 p-3 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5B21B6]">
                  ② AI 분석 (새로 해석한 내용)
                </span>
                {analysis.scene_ko && (
                  <p className="text-[12.5px] text-foreground">
                    <b className="text-[#5B21B6]">장면·주제 · </b>{analysis.scene_ko}
                  </p>
                )}
                {analysis.linguistic_features_ko && (
                  <p className="text-[12px] text-muted-foreground">
                    <b className="text-[#5B21B6]">언어 특징 · </b>{analysis.linguistic_features_ko}
                  </p>
                )}
                {analysis.recommended_uses && analysis.recommended_uses.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11.5px] text-[#5B21B6]">권장 활용 순위 ·</span>
                    {analysis.recommended_uses.map((u, i) => {
                      const ut = asUsageType(u);
                      return (
                        <span key={i} className={["rounded border px-1.5 py-0.5 text-[11px]", USAGE_TONE[ut]].join(" ")}>
                          {i + 1}. {USAGE_KO[ut]}
                        </span>
                      );
                    })}
                  </div>
                )}
                {analysis.recommendation_reason_ko && (
                  <p className="text-[12px] text-muted-foreground">
                    <b className="text-[#5B21B6]">이유 · </b>{analysis.recommendation_reason_ko}
                  </p>
                )}
                {analysis.connectable_speech_acts && analysis.connectable_speech_acts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] text-[#5B21B6]">연결 가능 화행 ·</span>
                    {analysis.connectable_speech_acts.map((s, i) => (
                      <span key={i} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[#5B21B6]">
                        {SPEECH_ACT_UI[asSpeechAct(s)]}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.unsuitable_reason_ko && (
                  <p className="rounded border border-[#FCA5A5] bg-[#FEE2E2] px-2 py-1 text-[11.5px] text-[#991B1B]">
                    독립 미션화 주의 · {analysis.unsuitable_reason_ko}
                  </p>
                )}
              </div>

              {/* 후보 카드 */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a857c]">
                  ③ 활용 후보 · {analysis.candidates?.length ?? 0}개
                </span>
                {(analysis.candidates ?? []).map((c, i) => {
                  const ut = asUsageType(c.usage_type);
                  const canGen = GENERATABLE.includes(ut) && !!(c.source_text ?? "").trim();
                  const norm = canGen ? normalizeApply(c) : null;
                  return (
                    <div key={i} className="rounded-md border border-border bg-background p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={["rounded border px-1.5 py-0.5 text-[11px] font-medium", USAGE_TONE[ut]].join(" ")}>
                          {USAGE_KO[ut]}
                        </span>
                        <span className="text-[12.5px] font-medium text-foreground">{c.label_ko ?? "(제목 없음)"}</span>
                      </div>

                      {/* AI 재구성 내용 */}
                      {c.situation_seed_ko && (
                        <p className="text-[12px] leading-relaxed text-foreground">
                          <span className="text-[#5B21B6]">AI 상황 · </span>{c.situation_seed_ko}
                        </p>
                      )}
                      {c.source_text && (
                        <div className="rounded border border-[#EAE4D2] bg-[#FAF7EE] px-2.5 py-1.5 text-[12.5px] leading-relaxed">
                          <span className="text-[10.5px] text-[#8a857c]">출발문(source_text) · </span>
                          {c.source_text}
                        </div>
                      )}
                      {c.preceding_turn && (
                        <div className="rounded border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1.5 text-[12px] leading-relaxed text-[#1E40AF]">
                          <span className="text-[10.5px]">선행 발화 · </span>{c.preceding_turn}
                        </div>
                      )}

                      {/* 표현 자원(비생성 후보) — 후속 「오늘의 살아 있는 표현」 카드 후보 */}
                      {c.expression?.text && (
                        <div className="rounded border border-[#EAE4D2] bg-[#FAF7EE] px-2.5 py-1.5 text-[12px] space-y-0.5">
                          <div>
                            <span className="font-medium text-foreground">{c.expression.text}</span>
                            {c.expression.meaning_ko && <span className="text-muted-foreground"> — {c.expression.meaning_ko}</span>}
                          </div>
                          {c.expression.usage_note_ko && (
                            <div className="text-[11px] text-muted-foreground">{c.expression.usage_note_ko}</div>
                          )}
                          {c.expression.example_zh && (
                            <div className="text-[11px] text-foreground">例：{c.expression.example_zh}</div>
                          )}
                          {c.expression.tags && c.expression.tags.length > 0 && (
                            <div className="text-[10.5px] text-[#8a857c]">#{c.expression.tags.join(" #")}</div>
                          )}
                        </div>
                      )}

                      {/* 매핑된 PRAGMA 필드 */}
                      {norm && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {[
                            SPEECH_ACT_UI[norm.speech_act_ui],
                            norm.language_direction === "zh_ko" ? "중→한" : "한→중",
                            DOMAIN[norm.domain],
                            ...(norm.industry ? [INDUSTRY[norm.industry]] : []),
                            CHANNEL_UI[norm.channel],
                            LEVEL[norm.level],
                            PDR_POWER_SHORT[norm.pdr_power],
                            PDR_DISTANCE_SHORT[norm.pdr_distance],
                            PDR_BURDEN_SHORT[norm.pdr_burden],
                          ].map((t) => (
                            <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 원자료 활용 / AI 변형 설명 */}
                      {(c.source_usage_note_ko || c.ai_adaptation_note_ko) && (
                        <div className="space-y-0.5 border-t border-border pt-1.5 text-[11px] leading-relaxed">
                          {c.source_usage_note_ko && (
                            <p className="text-muted-foreground"><b className="text-[#065F46]">원자료 활용 · </b>{c.source_usage_note_ko}</p>
                          )}
                          {c.ai_adaptation_note_ko && (
                            <p className="text-muted-foreground"><b className="text-[#5B21B6]">AI 변형 · </b>{c.ai_adaptation_note_ko}</p>
                          )}
                        </div>
                      )}

                      {/* 전달 버튼 */}
                      {canGen ? (
                        <Button
                          onClick={() => apply(c, i)}
                          className={[
                            "w-full text-[12.5px]",
                            appliedIdx === i
                              ? "bg-[#065F46] text-white hover:bg-[#065F46]"
                              : "bg-[#BA7517] text-white hover:bg-[#BA7517]/90",
                          ].join(" ")}
                        >
                          {appliedIdx === i ? "✓ 생성기에 채웠습니다 — 아래에서 수정·생성" : "↓ 이 후보로 생성기 채우기"}
                        </Button>
                      ) : (
                        <p className="rounded-md border border-dashed border-[#EAE4D2] bg-[#FAF7EE] px-2.5 py-1.5 text-[11px] text-muted-foreground">
                          이 유형은 독립 미션으로 억지 변환하지 않습니다. 표현 자원·상황 배경으로만 참고하세요.
                        </p>
                      )}
                    </div>
                  );
                })}
                {(analysis.candidates ?? []).length === 0 && (
                  <p className="rounded-md border border-dashed border-[#EAE4D2] bg-[#FAF7EE] px-3 py-2 text-[12px] text-muted-foreground">
                    제안된 활용 후보가 없습니다. 원문을 수정해 재분석하거나 다른 자료를 시도하세요.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthenticImportPanel;
