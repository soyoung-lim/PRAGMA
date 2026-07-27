import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { SPEECH_ACT_UI, LEVEL, DIRECTION_LANGS, type LanguageDirection } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { SCALE4_CODES, SCALE4_LABELS, type Scale4Code } from "@/lib/pragma/targetFeatures";
import { normalizeMission, type MissionV2, type MpjItemV2 } from "@/lib/pragma/missionSchema";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { fetchMissionByScenario, type RunnableMission } from "@/lib/mission/missionDb";
import { saveMissionAttempt, type LearnerDissent } from "@/lib/mission/missionLog";
import { ChatScene, ChatBubble, ChatCaption, ChatAvatar, highlightZh } from "@/components/mission/ChatScene";
import {
  slotsForAct,
  hintForSlot,
  supportTier,
  toneLeaning,
  SLOT_NUMERALS,
  type DiscourseSlot,
  type SupportTier,
  type ToneLeaning,
} from "@/lib/pragma/discourseSlots";
import { requestFeedback } from "@/lib/mission/missionFeedback";
import { requestSttTranscript } from "@/lib/mission/missionStt";
import { requestTtsAudio } from "@/lib/tts";
import {
  SEMANTIC_LABEL,
  GRAMMAR_LABEL,
  type RuntimeFeedback,
} from "@/lib/pragma/feedbackSchema";
import { IS_DEMO } from "@/lib/auth/useProfile";

// 샘플은 v1 → 정규화해 v2로 구동(러너는 정규화 형태만 본다, 0-l·84).
const SAMPLE_MISSION_V2 = normalizeMission(SAMPLE_MISSION_V1).data as MissionV2;

// 방향별 언어 이름 라벨(0-l·85).
const LANG_NAME: Record<"ko" | "zh", string> = { ko: "한국어", zh: "중국어" };
const srcLangName = (dir: LanguageDirection) => LANG_NAME[DIRECTION_LANGS[dir].source];
const tgtLangName = (dir: LanguageDirection) => LANG_NAME[DIRECTION_LANGS[dir].target];

// 학습자 미션 실행 — 계약 스키마 mission_v1을 직접 구동한다(프로토타입 v2 이식).
//   감각 익히기(MPJ 5 → 인계) → 직접 표현하기(상황 살피기 → 산출/통역) → 돌아보고 다듬기(피드백 → 다듬기 → 완료)
//   ※ 3단계는 **표시 서사**일 뿐 화면 순서·문항 수·판정 기준·저장 계약은 종전과 같다.
// 판정은 초점별 band 카탈로그(targetFeatures) 기준. 자유 산출 뒤에는 feedback-lite가
// 의미·문법·화용을 진단하며, 실패 시 참고 표현·핵심 원칙으로 안전하게 폴백한다.

const CONFIDENCE = ["매우 확신", "꽤 확신", "확신 없음"] as const;

// B1(계약 0-g·44·0-e·⑨): 판정 대역은 proposed(확정 정답 아님). 프로토타입 v2 기준 —
// 매 문항 반복 대신 1부 시작에 1회만 지위를 정직하게 고지한다.
const JUDGMENT_STATUS_CAPTION =
  "판정은 현재 강의 기준 · AI 제안(검증 예정)입니다 — 유일한 정답이 아니며, 상황에 따라 다른 적절한 표현도 존재할 수 있습니다.";

// PDR 학습자 라벨(근거 서랍용 — 내부 코드 노출 금지)
const PDR_R_LABEL: Record<string, string> = { low: "가벼운 부탁", mid: "보통", high: "부담이 큼" };
const PDR_D_LABEL: Record<string, string> = { close: "가까운 사이", acquaintance: "아는 사이", distant: "처음/먼 사이" };

// 사이트 헤더(LearnerJourneyShell) 높이 — 문항 맥락 바가 붙는 기준선.
const HEADER_H = 60;

const card = "rounded-xl border border-[#EAE4D2] bg-white p-4";
const srcBox = "rounded-lg border-l-[3px] border-[#EAE4D2] border-l-[#FAD338] bg-[#F5F5F2] p-3";
// 데모/검증 전용 버튼(프로토타입 v2 "데모 채우기") — IS_DEMO(개발·데모 배포)에서만 노출.
// 실제 학습 세션(VITE_ENABLE_DEMO 미설정)에는 나오지 않아 수행 데이터 오염 없음.
const demoBtn =
  "block w-full rounded-lg border border-dashed border-[#D8D0BC] bg-[#F5F5F2] px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-[#EFEEE9]";

// ── 진행 단계 ────────────────────────────────────────────────────────────
// 「오늘의 생생 표현」(보상 슬롯)은 콘텐츠 파이프라인이 붙기 전까지 렌더하지 않는다.
// 자리표시자인데도 완료 화면에서 시각 무게가 가장 컸다. 콘텐츠가 생기면 true로.
const LIVING_EXPRESSION_READY = false;

type Phase = "mpj" | "handoff" | "ctx" | "produce" | "feedback" | "revise" | "done";

// 서사 3단계 — 화면 순서·문항 수·판정 기준·저장 계약은 모두 그대로이고 표시만 묶는다.
// 「1부 판단 연습 / 2부 실전 적용」은 시험 2부작으로 읽혀, 미션을 마쳐도 "문항을
// 풀었다"는 기억만 남았다. 같은 흐름을 감각 → 표현 → 다듬기의 한 사건으로 보인다.
type Stage = 0 | 1 | 2;
const STAGE_OF: Record<Phase, Stage> = {
  mpj: 0,
  handoff: 0,
  ctx: 1,
  produce: 1,
  feedback: 2,
  revise: 2,
  done: 2,
};
const STAGE_TITLES = ["감각 익히기", "직접 표현하기", "돌아보고 다듬기"] as const;
// 단계 안의 잔걸음. MPJ 유형명(scale4·reason_conf…)은 더 이상 노출하지 않는다 —
// 기술 용어가 진행바에 있으면 그 자체로 시험지처럼 읽힌다.
const STEP_INDEX: Partial<Record<Phase, number>> = { ctx: 0, produce: 1, feedback: 0, revise: 1, done: 2 };
const stageSteps = (stage: Stage, interp: boolean) =>
  stage === 1 ? ["상황 살피기", interp ? "통역하기" : "옮겨 쓰기"] : ["피드백 보기", "다듬기", "완료"];

// ── band 라벨 헬퍼 ──────────────────────────────────────────────────────
function bandLabel(featureCode: string, code: string): string {
  const feat = getTargetFeature(featureCode);
  return feat?.band_schema.find((b) => b.code === code)?.label_ko ?? code;
}
/** 초점의 band 선택지(카탈로그 우선, 없으면 문항에 등장한 코드로 폴백). */
function bandOptions(featureCode: string, fallback: string[]): { code: string; label: string }[] {
  const feat = getTargetFeature(featureCode);
  if (feat) return feat.band_schema.map((b) => ({ code: b.code, label: b.label_ko }));
  return [...new Set(fallback)].map((c) => ({ code: c, label: c }));
}

// ── 상황 확인(판단형) — PDR에서 규칙적으로 파생. 데이터·AI 0회, 점수 없음 ──
// 프로토타입 v2 "필요한 화용 조절점" 판단. 요청·완화 계열 기준(현행 DB 범위).
function deriveCtx(pdr: { d?: string; r?: string }) {
  const opts = [
    "친한 사이라 간결·직접적으로 말해도 괜찮다",
    "아직 친하지 않으니 상대가 선택할 여지를 남기는 완화가 필요하다",
    "겹겹의 격식과 존대를 최대한 갖춰야 한다",
  ];
  // 판정 규칙은 산출 안내(ProductionGuide)와 공유한다 — 두 화면이 어긋나면
  // 그 자체가 완화 편향을 만든다(0-r·106 3면 정렬).
  const right = { direct: 0, mitigated: 1, formal: 2 }[toneLeaning(pdr)];
  const okRight = [
    "친하고 부담이 낮아 간결·직접적인 표현이 자연스럽습니다. 완화를 겹겹이 쌓으면 오히려 어색합니다.",
    "아직 친하지 않고 상대가 결정할 여지가 있는 상황이라, 부담을 낮추는 완화와 선택권이 적절합니다. 과한 격식은 오히려 거리감을 줍니다.",
    "부담이 크고 관계가 먼 상황이라, 격식과 존대를 충분히 갖추는 편이 안전합니다.",
  ][right];
  const okWrong = [
    "이번 상대는 편한 사이입니다. 완화를 과하게 쌓기보다 간결·직접적인 표현이 더 자연스럽습니다.",
    "이번 상대는 아직 친하지 않습니다. 간결한 직접형은 부담스럽고 과한 격식은 거리감을 줍니다 — 거절할 여지를 남기는 완화가 이 관계에 맞습니다.",
    "이번 상대는 부담이 크고 먼 관계입니다. 간결한 직접형보다 격식을 갖추는 편이 적절합니다.",
  ][right];
  return { q: "이 상대·이 부담에 알맞은 요청 조절 수준", opts, right, okRight, okWrong };
}

// ── 페이지: 라우트 파라미터로 DB 조회, 없으면 샘플 ──────────────────────
const MissionRunV1 = () => {
  const { scenarioId } = useParams();
  const [searchParams] = useSearchParams();
  // 데모/검증 토글 — 샘플 경로에서만 통역 흐름을 켠다(실제 DB 미션에는 영향 없음).
  const forceInterp = !scenarioId && searchParams.get("mode") === "interpreting";
  // 수행 방식 전환(번역 ↔ 통역)으로 넘어온 경우 1부를 건너뛰고 2부부터 시작한다.
  // 같은 미션의 1부(판단 연습)를 방금 마쳤는데 또 시키면 중복이다.
  // ⚠️ 샘플 + 데모에서만 허용 — 실제 학습 세션에서 1부를 건너뛰면 "판단 → 적용"이라는
  //    미션 구인 자체가 깨진다(완료 조건 = 판단 N문항 → 산출 → 피드백 → 다듬기).
  const startAtPart2 = IS_DEMO && !scenarioId && searchParams.get("part") === "2";
  const [loaded, setLoaded] = useState<RunnableMission | null>(null);
  const [loading, setLoading] = useState<boolean>(!!scenarioId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetchMissionByScenario(scenarioId);
        if (!cancelled) setLoaded(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "미션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  if (scenarioId && loading) {
    return (
      <LearnerJourneyShell>
        <p className="py-10 text-center text-[13px] text-muted-foreground">미션을 불러오는 중…</p>
      </LearnerJourneyShell>
    );
  }
  if (scenarioId && error) {
    return (
      <LearnerJourneyShell>
        <div className="my-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">{error}</div>
      </LearnerJourneyShell>
    );
  }

  const baseMission = loaded?.mission ?? SAMPLE_MISSION_V2;
  const mission =
    forceInterp
      ? { ...baseMission, production_task: { ...baseMission.production_task, mode: "interpreting" as const } }
      : baseMission;
  const isSample = !loaded;
  const headerRight = loaded
    ? `${loaded.speech_act ? SPEECH_ACT_UI[loaded.speech_act] : ""} · ${loaded.learner_level ? LEVEL[loaded.learner_level] : ""}`
    // 큰 배너를 걷어내는 대신 헤더가 지위를 말한다 — "원어민 검토 전"은 헤더에 없던 정보다.
    : "샘플 · 예문 검토 전";

  return (
    <MissionRunner
      key={`${loaded?.scenario_id ?? "sample"}:${mission.production_task.mode}`}
      mission={mission}
      isSample={isSample}
      startAtPart2={startAtPart2}
      headerRight={headerRight}
      status={loaded?.mission_status ?? null}
      scenarioId={loaded?.scenario_id ?? null}
      speechAct={loaded?.speech_act ?? null}
      level={loaded?.learner_level ?? null}
    />
  );
};

// ── 러너 본체 ───────────────────────────────────────────────────────────
/**
 * 담화 슬롯 골격 — ko_zh(L2 산출) 전용 지원 (계약 0-q·97).
 * 빈 입력창 앞에서 학습자가 어휘·문법이 아니라 **담화 조직**에 주의를 쓰도록 돕는다.
 * 읽기 전용 안내이며 입력은 그대로 자유 텍스트 하나다 — 저장 형태·제출 조건 무변경.
 * ⚠️ 예문(완성 문장)을 넣지 않는다. 참고 표현은 제출 후 공개가 원칙.
 */
function ProductionGuide({
  slots,
  resources,
  tier,
  leaning,
}: {
  slots: DiscourseSlot[];
  resources: string[];
  tier: SupportTier;
  leaning: ToneLeaning;
}) {
  const [expanded, setExpanded] = useState(tier === "guided");
  // 고급(open)은 접혀 있을 때 슬롯도 감춘다 — 기본은 지금까지와 같은 자유 산출.
  const showSlotRow = tier !== "open" && !expanded;

  return (
    <div className="mb-3 rounded-lg border border-[#EAE4D2] bg-[#FBFAF6] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-[#5A6B7A]">
          {tier === "open" ? "필요할 때 참고" : "표현 구성 순서"}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded px-1.5 py-0.5 text-[11.5px] font-medium text-[#2B5B7A] hover:bg-[#EEF3F7]"
          aria-expanded={expanded}
        >
          {expanded ? "도움말 닫기 ▴" : "도움말 열기 ▾"}
        </button>
      </div>

      {/* 완화 편향 시정(0-r·106①) — 슬롯·힌트가 늘 완화 자원이라 "넣으면 된다"로
          오학습될 수 있다. 직접형이 자연스러운 상황에서는 먼저 그 사실을 말한다. */}
      {leaning === "direct" && (
        <p className="mt-1.5 rounded bg-[#F3F6EE] px-2 py-1 text-[12px] leading-[1.45] text-[#4A5A3E]">
          이 상황에서는 짧고 직접적인 표현이 더 자연스러울 수 있습니다 — <strong className="font-semibold">덜어내는 것도 조절입니다.</strong>
        </p>
      )}

      {showSlotRow && (
        <ol className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-[#3B4A57]">
          {slots.map((s, i) => (
            <li key={s.label}>
              {SLOT_NUMERALS[i]} {s.label}
            </li>
          ))}
        </ol>
      )}

      {expanded && (
        <>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-[#3B4A57]">
            {slots.map((s, i) => {
              const hint = hintForSlot(s, resources);
              return (
                <li key={s.label}>
                  <span className="font-medium">
                    {SLOT_NUMERALS[i]} {s.label}
                  </span>
                  {hint && <span className="text-muted-foreground"> — {hint}</span>}
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            ※ 범주만 참고합니다. 모두 사용할 필요는 없습니다 — 이 상대·이 부담에 맞는 만큼만 선택합니다.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * 피드백 주 문구 — 「먼저 살펴볼 점」 한 줄.
 * 어느 층을 볼지는 revision_scope가 이미 정해 두므로(코드 소관 도출, §4) 여기서
 * 새로 판단하지 않는다. 다듬기·완료 화면이 같은 문구를 이어받게 화면 밖에 둔다 —
 * 같은 원칙 문장을 세 화면에 반복하던 것이 피로의 큰 몫이었다.
 * scope='clear'(고칠 곳 없음)면 "고쳐야 한다"는 인상을 주지 않는 제목으로 바꾼다.
 */
function feedbackHeadline(fb: RuntimeFeedback): { title: string; body: string } {
  const scope = fb.revision_scope;
  const g = fb.blocks.grammar?.[0];
  const body =
    scope === "meaning"
      ? fb.blocks.meaning_ko
      : scope === "grammar"
        ? g?.explanation_ko ?? fb.blocks.meaning_ko
        : scope === "feature"
          ? fb.blocks.feature_ko
          : fb.blocks.feature_ko || "이 상황에 충분히 적절합니다.";
  return { title: scope === "clear" ? "지금 표현에서 잘 된 점" : "먼저 살펴볼 점", body };
}

/**
 * feedback-lite 3층 진단 화면 (계약 §4 / 0-r·103 주 카드 1개 원칙 / 0-r·108 4분기).
 * revision_scope가 가리키는 층만 펼치고 나머지 두 층은 칩으로 접는다.
 * ⚠️ 점수·등급을 표시하지 않는다(0-q·95). 화용층 문구는 모델이 비단정으로 쓴다(§4 백신4).
 */
function FeedbackPanel({
  fb,
  featureCode,
}: {
  fb: RuntimeFeedback;
  featureCode: string;
}) {
  const [open, setOpen] = useState(false);
  const scope = fb.revision_scope;
  const v = fb.verdicts;
  const g = fb.blocks.grammar?.[0];
  const alt = fb.blocks.alternatives?.[0];
  const alt2 = fb.blocks.alternatives?.[1];
  const head = feedbackHeadline(fb);

  const layers = [
    { key: "meaning", label: "뜻 전달", short: SEMANTIC_LABEL[v.semantic_fidelity], body: fb.blocks.meaning_ko },
    { key: "grammar", label: "이해를 막는 표현", short: GRAMMAR_LABEL[v.grammatical_accuracy], body: g?.explanation_ko ?? "" },
    {
      key: "feature",
      label: "상대에게 주는 인상",
      short: bandLabel(featureCode, v.pragmatic_appropriateness.band_code),
      body: fb.blocks.feature_ko,
    },
  ];
  const others = layers.filter((l) => l.key !== scope);

  return (
    <div className="space-y-3">
      {/* 주 카드 — 우선 살펴볼 층을 먼저 제시하되, 다른 층의 오류를 배제하지 않는다. */}
      <div className="rounded-xl border border-[#FAD338] bg-[#FFFBEA] p-4">
        <div className="text-[11.5px] font-bold text-[#6B5518]">{head.title}</div>
        <p className="mt-1.5 text-[14px] leading-relaxed">{head.body}</p>

        {scope === "grammar" && g?.suggested_correction && (
          <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[13.5px]">
            고친 형태 · {g.suggested_correction}
          </p>
        )}

        {alt && (
          <div className="mt-2.5 rounded-lg bg-white/70 px-3 py-2">
            <div className="text-[11.5px] font-semibold text-[#6B5518]">다듬은 표현 예시</div>
            <div className="mt-0.5 text-[14px]">{alt.text}</div>
            {alt.note_ko && <div className="mt-0.5 text-[12px] text-muted-foreground">{alt.note_ko}</div>}
          </div>
        )}
      </div>

      {/* 나머지 층 — 칩 */}
      <div className={card}>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
          {others.map((l) => (
            <li key={l.key}>
              <span className="text-muted-foreground">{l.label} · </span>
              <span className="font-medium">{l.short}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 rounded px-1.5 py-0.5 text-[11.5px] font-medium text-[#2B5B7A] hover:bg-[#EEF3F7]"
          aria-expanded={open}
        >
          {open ? "접기 ▴" : "자세히 ▾"}
        </button>
        {open && (
          <div className="mt-2 space-y-2 border-t border-[#EAE4D2] pt-2">
            {others
              .filter((l) => l.body)
              .map((l) => (
                <div key={l.key}>
                  <div className="text-[11.5px] font-semibold text-muted-foreground">{l.label}</div>
                  <p className="mt-0.5 text-[13px] leading-relaxed">{l.body}</p>
                </div>
              ))}
            {alt2 && (
              <div>
                <div className="text-[11.5px] font-semibold text-muted-foreground">다른 전략</div>
                <div className="mt-0.5 text-[13.5px]">{alt2.text}</div>
                {alt2.note_ko && <div className="text-[12px] text-muted-foreground">{alt2.note_ko}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="px-0.5 text-[11.5px] text-muted-foreground">
        AI 진단입니다 — 유일한 정답이 아니라, 이 상황에서 살펴볼 지점을 짚어 준 것입니다.
      </p>
    </div>
  );
}

function MissionRunner({
  mission,
  isSample,
  startAtPart2 = false,
  headerRight,
  status,
  scenarioId,
  speechAct,
  level,
}: {
  mission: MissionV2;
  isSample: boolean;
  /** 수행 방식 전환으로 넘어온 경우 1부(판단 연습)를 건너뛴다 — 샘플·데모 전용 */
  startAtPart2?: boolean;
  headerRight: string;
  status: string | null;
  scenarioId: string | null;
  speechAct: string | null;
  level: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(startAtPart2 ? "ctx" : "mpj");
  const [mpjIdx, setMpjIdx] = useState(0);
  const [ctxPick, setCtxPick] = useState<number | null>(null);
  const [ctxDone, setCtxDone] = useState(false);
  const [draft, setDraft] = useState("");
  const [revised, setRevised] = useState("");
  const [savedLater, setSavedLater] = useState(false);
  const [resume, setResume] = useState<{ phase: Phase; draft: string; revised: string; ctxPick: number | null; ctxDone: boolean } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "demo" | "error">("idle");
  // feedback-lite(계약 §4) — 제출 후 3층 진단. 실패하면 기존 정직 표기로 되돌아간다.
  const [fb, setFb] = useState<RuntimeFeedback | null>(null);
  const [fbState, setFbState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [fbRetryNonce, setFbRetryNonce] = useState(0);
  const fbReqRef = useRef<string | null>(null); // 진행 중인 피드백 요청의 답안 키
  // 이견 채널(0-r·104) — 완료 시 수행 로그의 context_judgment로 함께 저장한다.
  const [dissent, setDissent] = useState<LearnerDissent | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());

  const items = mission.mpj_items;
  const item = items[mpjIdx];
  const dir = mission.direction;
  const langs = DIRECTION_LANGS[dir];
  const tgtName = tgtLangName(dir);
  const srcName = srcLangName(dir);
  const pt = mission.production_task;
  const isInterp = pt.mode === "interpreting";
  const part = phase === "mpj" || phase === "handoff" ? 1 : 2;
  const stage = STAGE_OF[phase];
  // 데모 채우기 예시 답안(참고 표현 재사용 — 산출/다듬기가 다르게 보이도록 서로 다른 안)
  const demoDraft = pt.reference_alternatives[0]?.text ?? "";
  const demoRevised = pt.reference_alternatives[1]?.text ?? pt.reference_alternatives[0]?.text ?? "";

  // B2(계약 0-k): counter_rule 반례를 완료 화면에 노출 — "직접형=무조건 나쁨" 오학습 방지.
  const feat = getTargetFeature(mission.unit.target_feature);
  const counterRule =
    dir === "zh_ko" && feat?.counter_rule_note_zh_ko ? feat.counter_rule_note_zh_ko : feat?.counter_rule_note;

  // 다듬기 화면 지침 — 피드백이 있으면 방금 본 문구를 그대로 이어받는다.
  // 폴백 조건은 fbState('error')가 아니라 **fb 부재**다: 다듬기 단계부터 바로 재개하면
  // 상태는 'idle'인데 fb만 비어 있어, 지침 없는 빈 화면이 될 수 있다.
  const reviseHint = fb
    ? feedbackHeadline(fb)
    : { title: mission.unit.learner_label, body: mission.unit.closing_ko };

  // 담화 슬롯 골격(0-q·97) — **ko_zh 번역 산출에만**. 중→한은 모국어 산출이라
  // 어휘·문법 부하가 없어 지원 대상이 아니다(지원량 차등의 근거 = L2 산출 부하).
  const guideSlots = slotsForAct(feat?.speech_act);
  const guideResources = feat?.relevant_resources ?? [];
  const guideTier = supportTier(level);
  // 이 미션의 조절 방향 — 「상황 확인」과 같은 규칙(0-r·106).
  const guideLeaning = toneLeaning(pt.pdr);

  // 피드백 단계 진입 시 1회 호출. 실패해도 미션을 막지 않는다(정직 표기로 폴백).
  // ⚠️ cleanup으로 취소하지 않는다 — 이 이펙트가 setFbState를 부르므로 의존성이 바뀌어
  //    첫 요청이 곧바로 cleanup되고 결과가 버려진다(로딩에서 멈춤). 대신 ref에 요청 키
  //    (= 제출한 답안)를 두고, 응답이 최신 요청의 것일 때만 반영한다.
  useEffect(() => {
    if (phase !== "feedback" || !draft.trim()) return;
    const key = `${mission.unit.target_feature}\u0000${draft}\u0000${fbRetryNonce}`;
    if (fbReqRef.current === key) return; // 같은 답안은 다시 묻지 않는다
    fbReqRef.current = key;
    setFb(null);
    setFbState("loading");
    requestFeedback(mission, draft).then((r) => {
      if (fbReqRef.current !== key) return; // 더 최신 제출이 있으면 폐기
      if (r.ok && r.feedback) {
        setFb(r.feedback);
        setFbState("ready");
        if (r.issues?.length) console.warn("[feedback] 정리된 모순:", r.issues);
      } else {
        console.warn("[feedback] 실패:", r.error);
        setFbState("error");
      }
    });
  }, [phase, draft, mission, fbRetryNonce]);

  // 중단 후 재개(프로토타입 v2 ②) — 2부 진행분만 미션별 localStorage에 보존. 실패해도 흐름 무해.
  const storageKey = `pragma:mrun:${scenarioId ?? "sample"}`;
  useEffect(() => {
    // 수행 방식 전환으로 들어온 경우엔 재개 대상이 아니다 — 방금 끝낸 다른 방식의
    // 진행분(같은 sample 키를 쓴다)이 새어 들어와 착지 지점이 달라지면 안 된다.
    if (startAtPart2) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ phase: "ctx", draft: "", revised: "", ctxPick: null, ctxDone: false }),
        );
      } catch {
        /* 무시 */
      }
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s.phase === "string" && s.phase !== "mpj" && s.phase !== "handoff") setResume(s);
      }
    } catch {
      /* localStorage 미지원 — 재개 없이 정상 진행 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, startAtPart2]);
  useEffect(() => {
    if (part !== 2) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ phase, draft, revised, ctxPick, ctxDone }));
    } catch {
      /* 무시 */
    }
  }, [part, phase, draft, revised, ctxPick, ctxDone, storageKey]);
  const clearSaved = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* 무시 */
    }
  };
  const applyResume = () => {
    if (!resume) return;
    setDraft(resume.draft || "");
    setRevised(resume.revised || "");
    setCtxPick(resume.ctxPick ?? null);
    setCtxDone(!!resume.ctxDone);
    setPhase(resume.phase);
    setResume(null);
    window.scrollTo(0, 0);
  };

  // 미션 완료 = 수행 로그 저장(루프 마지막 노드). 데모 스텁은 저장 불가 → 안내만.
  const finish = async () => {
    setPhase("done");
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    const res = await saveMissionAttempt({
      mission,
      scenarioId,
      speechAct,
      level,
      firstResponse: draft,
      revisedResponse: revised || draft,
      ...(fb ? { feedback: fb } : {}),
      startedAtIso: startedAtRef.current,
      ...(dissent ? { contextJudgment: dissent } : {}),
    });
    if (res.ok) {
      setSaveState("saved");
      clearSaved();
    } else {
      setSaveState((res as { reason?: string }).reason === "no_auth" ? "demo" : "error");
      clearSaved();
    }
  };

  const nextMpj = () => {
    if (mpjIdx < items.length - 1) {
      setMpjIdx((i) => i + 1);
      // 문항 전환도 단계 전환과 같게 최상단으로 — 없으면 이전 문항의 스크롤 위치가
      // 남아 새 문항이 상황 카드 중간부터 보인다.
      window.scrollTo(0, 0);
    } else {
      setPhase("handoff");
      window.scrollTo(0, 0);
    }
  };

  const goto = (p: Phase) => {
    setPhase(p);
    window.scrollTo(0, 0);
  };

  const resetAll = () => {
    clearSaved();
    setPhase("mpj");
    setMpjIdx(0);
    setCtxPick(null);
    setCtxDone(false);
    setDraft("");
    setRevised("");
    setSavedLater(false);
    setResume(null);
    setSaveState("idle");
    startedAtRef.current = new Date().toISOString();
    window.scrollTo(0, 0);
  };

  return (
    <LearnerJourneyShell headerRight={<span className="text-[12px] text-[#8899A6]">{headerRight}</span>}>
      <div className="pb-24">
        {/* 샘플 배너는 헤더 라벨(「샘플 · 예문 검토 전」)로 옮겼다 — 첫 화면 자리를
            문항에 내준다. 미검수(generated) 경고는 성격이 달라 배너로 남긴다. */}
        {status === "generated" && (
          <div className="mb-3 rounded-lg border border-dashed border-[#C9A227] bg-[#FFFBEA] px-3.5 py-2.5 text-[12px] text-[#6B5518]">
            <b>검토 전(generated)</b> 미션입니다 · 개발 확인용. 학습자 배포는 검토 완료본만 됩니다.
          </div>
        )}

        {/* 중단 후 재개 배너 — 2부 진행분이 남아 있을 때만 */}
        {resume && phase === "mpj" && mpjIdx === 0 && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-[#FAD338] bg-[#FFF8DE] px-3.5 py-2.5 text-[12.5px] text-[#6B5518]">
            <span>이전에 진행하던 <b>미션</b>이 있습니다.</span>
            <button
              type="button"
              onClick={applyResume}
              className="shrink-0 rounded-md bg-[#15202B] px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              이어서 하기 →
            </button>
          </div>
        )}

        {/* ── 오늘 보는 감각 — 전 단계 공통 맥락 띠 ──
            상황은 문항마다 다르지만 보는 축은 하나다. 이 줄이 없으면 서로 다른 문제
            여섯 개로 읽힌다. 같은 라벨을 시작 카드·1부 배지에 중복 노출하던 것은 걷어냈다. */}
        <div className="mb-2 flex flex-wrap items-baseline gap-1.5 text-[11.5px]">
          <span className="text-[#A9B0BA]">오늘 보는 감각 ·</span>
          <b className="text-[12.5px] text-foreground">{mission.unit.learner_label}</b>
        </div>

        {/* ── 진행 3단계 (IS_DEMO면 클릭해 단계 이동 — 프로토타입 v2 devGo) ── */}
        <div className="mb-1.5 flex gap-2">
          {STAGE_TITLES.map((label, i) => {
            const done = stage > i;
            const active = stage === i;
            // devGo 착지점 — 3단계는 다듬기로 보낸다(피드백은 제출한 답이 있어야 뜬다).
            const target: Phase = i === 0 ? "mpj" : i === 1 ? "ctx" : "revise";
            const cls = [
              "flex-1 rounded-[10px] border px-3 py-2 text-left text-[12.5px]",
              done
                ? "border-[#FAD338] bg-[#FAD338] font-bold text-[#15202B]"
                : active
                ? "border-[#15202B] bg-[#15202B] font-bold text-white"
                : "border-[#EAE4D2] bg-white text-muted-foreground",
              IS_DEMO ? "cursor-pointer hover:opacity-90" : "",
            ].join(" ");
            const inner = (
              <>
                <div className="text-[11px] opacity-80">{i + 1}단계</div>
                {label} {done ? "✓" : ""}
              </>
            );
            return IS_DEMO ? (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (target === "mpj") setMpjIdx(0);
                  goto(target);
                }}
                className={cls}
              >
                {inner}
              </button>
            ) : (
              <div key={label} className={cls}>{inner}</div>
            );
          })}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#A9B0BA]">
          {stage === 0 ? (
            phase === "handoff" ? (
              <span className="font-bold text-foreground">예시 {items.length} / {items.length} 살펴봄</span>
            ) : (
              <span>예시 {mpjIdx + 1} / {items.length}</span>
            )
          ) : (
            stageSteps(stage, isInterp).map((s, i, arr) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={i === (STEP_INDEX[phase] ?? 0) ? "font-bold text-foreground" : ""}>{s}</span>
                {i < arr.length - 1 && <span className="text-[#E3E1D8]">›</span>}
              </span>
            ))
          )}
        </div>

        {/* ── 1부: 판단 연습(MPJ) ── */}
        {phase === "mpj" && (
          <div className="space-y-3">
            {/* 문항이 첫 화면을 차지한다 — 학생이 처음 봐야 할 것은 상황이지 완료 조건이 아니다.
                초점 라벨·문항 수는 위쪽 맥락 띠와 진행바가 이미 말한다(삼중 노출 제거). */}
            <MpjStage key={item.id} item={item} onDone={nextMpj} />
            {mpjIdx === 0 && <MissionBriefDrawer mission={mission} />}
          </div>
        )}

        {/* ── 1부 → 2부 인계 ── */}
        {phase === "handoff" && (
          <Handoff
            mission={mission}
            dir={dir}
            isInterp={isInterp}
            saved={savedLater}
            onContinue={() => goto("ctx")}
            onSaveLater={() => {
              try {
                localStorage.setItem(storageKey, JSON.stringify({ phase: "ctx", draft: "", revised: "", ctxPick: null, ctxDone: false }));
              } catch {
                /* 무시 */
              }
              setSavedLater(true);
            }}
          />
        )}

        {/* ── 2부 ①: 상황 확인(판단형) ── */}
        {phase === "ctx" && (
          <CtxStage
            pt={pt}
            isInterp={isInterp}
            pick={ctxPick}
            onPick={(i) => {
              setCtxPick(i);
              setCtxDone(true); // 재개 저장 형태는 그대로 둔다(기존 저장분 호환).
            }}
            onNext={() => goto("produce")}
          />
        )}

        {/* ── 2부 ②: 실전 산출 — 번역(입력) / 통역(오디오) ── */}
        {phase === "produce" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#15202B] p-4 text-white">
              <div className="text-[11px] font-bold text-[#FAD338]">감각 익히기에서 본 것</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed">
                이 상대·이 부담에 맞는 만큼만 선택합니다 — 표현을 많이 더한다고 더 나아지는 것은 아닙니다.
              </p>
            </div>
            {isInterp ? (
              <AudioFrame
                sourceText={pt.source_text}
                srcName={srcName}
                tgtName={tgtName}
                ttsLang={langs.tts}
                sttLang={langs.stt}
                situation={pt.situation_ko}
                relation={pt.relation_ko}
                demoText={demoDraft}
                onSubmit={(t) => {
                  setDraft(t);
                  goto("feedback");
                }}
              />
            ) : (
              <>
                <ChatScene situation={pt.situation_ko} relation={pt.relation_ko} eyebrow="직접 옮길 요청">
                  {pt.preceding_turn && <ChatBubble side="them">{pt.preceding_turn}</ChatBubble>}
                  <ChatCaption>내가 전할 말 ({srcName}) · {pt.source_text}</ChatCaption>
                  {dir === "ko_zh" && (
                    <ProductionGuide
                      slots={guideSlots}
                      resources={guideResources}
                      tier={guideTier}
                      leaning={guideLeaning}
                    />
                  )}
                  <div className="mb-3 flex items-end justify-end gap-2">
                    <Textarea
                      className="w-[78%] resize-y rounded-[19px] rounded-br-[6px] border border-[#7ED158] bg-gradient-to-b from-[#9EED7C] to-[#8CE768] px-3 py-2 text-[14.5px] leading-[1.46] text-[#0c3300] placeholder:text-[#4a7a4a]"
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`여기에 ${tgtName}로 답장 입력…`}
                    />
                    <ChatAvatar side="me" />
                  </div>
                </ChatScene>
                <p className="px-0.5 text-[12px] text-muted-foreground">
                  먼저 상대에게 답장하듯 직접 옮깁니다. 참고 표현은 제출한 뒤에 확인합니다.
                </p>
                <Button className="w-full bg-[#FAD338] text-[#15202B] hover:bg-[#F0C800]" disabled={!draft.trim()} onClick={() => goto("feedback")}>번역 제출 →</Button>
                {IS_DEMO && (
                  <button type="button" className={demoBtn} onClick={() => setDraft(demoDraft)}>데모 채우기 — 예시 답안 입력</button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 2부 ③: 피드백 ── */}
        {phase === "feedback" && (
          <div className="space-y-3">
            <div className={card}>
              <div className="text-[11.5px] font-semibold text-muted-foreground">{isInterp ? "내 통역(확인한 전사)" : "내 번역"}</div>
              <p className="mt-1 whitespace-pre-wrap text-[14.5px]">{draft}</p>
            </div>

            {fbState === "loading" && (
              <div className={card}>
                <p className="text-[13.5px] text-muted-foreground">답을 살펴보는 중…</p>
              </div>
            )}

            {fbState === "ready" && fb && (
              <FeedbackPanel fb={fb} featureCode={mission.unit.target_feature} />
            )}

            {/* 진단 실패 시 폴백 — 기존 정직 표기로 되돌아간다(미션은 계속 진행). */}
            {fbState === "error" && (
              <div className="rounded-lg border border-dashed border-[#B9C4CE] bg-[#F7F9FA] p-3 text-[11.5px] text-[#5B6B76]">
                <p>답변별 자동 진단을 불러오지 못했습니다. 다시 시도하거나, 참고 표현과 이번 초점을 바탕으로 계속 다듬을 수 있습니다.</p>
                <button
                  type="button"
                  className="mt-2 rounded-md border border-[#9EADB8] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#365B72] hover:bg-[#EEF3F7]"
                  onClick={() => setFbRetryNonce((n) => n + 1)}
                >
                  진단 다시 불러오기
                </button>
              </div>
            )}

            {/* 원칙 문장(closing_ko)은 완료 화면에서 한 번만 크게 정리한다 —
                피드백·다듬기·완료에 같은 문장이 세 번 연속 나오던 것이 피로의 큰 몫이었다.
                근거 서랍은 남긴다(접혀 있어 시각 무게가 없다). */}
            <div className={card}>
              <FeedbackReasonDrawer mission={mission} />
            </div>

            <details className={card}>
              <summary className="cursor-pointer text-[13px] font-semibold">참고 표현 보기</summary>
              <p className="mt-1 text-[12px] text-muted-foreground">정답이 아니라 비교용입니다. 상황에 따라 어울리는 범위가 달라집니다.</p>
              <ul className="mt-2.5 space-y-2">
                {mission.production_task.reference_alternatives.map((a) => (
                  <li key={a.text} className="rounded-lg bg-[#FAF8F2] px-3.5 py-2.5">
                    <div className="text-[14px]">{a.text}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{a.note_ko}</div>
                  </li>
                ))}
              </ul>
            </details>

            {/* 이견 채널 — 판정을 바꾸지 않는 별도 통로(0-r·104) */}
            <DissentPanel
              onSubmit={(d) =>
                setDissent({
                  kind: "learner_dissent",
                  at: "feedback",
                  conditions: d.conditions,
                  reason_ko: d.reason,
                  created_at: new Date().toISOString(),
                })
              }
            />

            {/* 「한 가지만 고치기」로 읽히지 않게 — 여러 곳을 함께 다듬어도 된다. */}
            <Button className="w-full" disabled={fbState === "loading"} onClick={() => goto("revise")}>피드백을 참고해 다듬기 →</Button>
          </div>
        )}

        {/* ── 2부 ④: 다듬기 ── */}
        {phase === "revise" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#FAD338] bg-[#FFF8DE] p-4">
              <div className="text-[12px] font-bold text-[#6B5518]">{reviseHint.title}</div>
              <p className="mt-1 text-[14px] leading-relaxed">{reviseHint.body}</p>
            </div>
            {/* 무엇을 고치는 중인지 보이도록 최초안을 옆에 둔다(PC 2열 · 좁은 화면 세로).
                최초안은 읽기 전용 — first_response는 피드백 전에 확정된 값이어야 한다. */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className={card}>
                <div className="text-[11.5px] font-semibold text-muted-foreground">처음 쓴 문장</div>
                <p className="mt-1 whitespace-pre-wrap text-[14px] text-[#5B6B76]">{draft}</p>
              </div>
              <div className={card}>
                <div className="text-[11.5px] font-semibold text-[#6B5518]">다듬은 문장</div>
                <Textarea
                  className="mt-1"
                  rows={5}
                  value={revised || draft}
                  onChange={(e) => setRevised(e.target.value)}
                />
              </div>
            </div>
            <Button className="w-full" onClick={finish}>마치기</Button>
            {IS_DEMO && (
              <button type="button" className={demoBtn} onClick={() => setRevised(demoRevised)}>데모 채우기 — 다듬은 안 적용</button>
            )}
          </div>
        )}

        {/* ── 완료 ── */}
        {phase === "done" && (
          <div className="space-y-3">
            {/* 완료 화면은 "문항 몇 개를 풀었다"가 아니라 "내 표현이 무엇 때문에
                달라졌다"로 기억되어야 한다 → 원리 1문장 → 최초·최종 → 인상 순으로 둔다.
                closing_ko는 카탈로그 정본(R14)이고, 이제 여기서만 크게 나온다. */}
            <div className="rounded-xl bg-[#15202B] p-5 text-white">
              <div className="text-[11.5px] font-bold text-[#FAD338]">오늘 익힌 원리</div>
              <p className="mt-1.5 text-[14.5px] leading-relaxed">{mission.unit.closing_ko}</p>
            </div>

            {/* 감량(0-r·103): 완료 화면에서 펼쳐 두는 것은 핵심 1줄과 최초→최종뿐이다.
                참고 표현 목록은 접는다 — 정답 카드처럼 읽히는 것을 막는 효과도 있다. */}
            <RevisionMap first={draft} final={revised || draft} featureLabel={mission.unit.learner_label} interp={isInterp} />

            {/* 상대에게 줄 수 있는 인상 — **새로 만들지 않는다**. 피드백에서 이미 본
                화용층 문구를 접힌 형태로 이월한다. 전체 문단을 다시 펼쳐 두어 완료 화면이
                피드백 화면처럼 보이던 반복은 줄이고, 필요할 때만 다시 확인할 수 있게 한다. */}
            {fb?.blocks.feature_ko && (
              <details className="rounded-lg border border-[#EAE4D2] bg-white px-3.5 py-2.5">
                <summary className="cursor-pointer text-[12.5px] font-semibold text-muted-foreground">
                  피드백에서 확인한 인상 다시 보기
                </summary>
                <p className="mt-2 text-[13.5px] leading-relaxed">{fb.blocks.feature_ko}</p>
              </details>
            )}

            {/* B2: 예외 반례 — "직접형=무조건 나쁨"이 아님을 완료 시 상기(counter_rule).
                오학습 방지 장치이므로 접지 않고 가볍게 펼쳐 둔다. */}
            {counterRule && (
              <div className="rounded-xl border border-dashed border-[#D8D0BC] bg-[#FFFDF4] px-4 py-3">
                <div className="text-[11.5px] font-bold text-[#6B5518]">예외 — 항상 적용되는 것은 아닙니다</div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#5B4A1E]">{counterRule}</p>
              </div>
            )}

            {/* 수행 로그 저장 상태 — 루프 마지막 노드(실행 → 저장) */}
            <div
              className={[
                "rounded-lg px-3.5 py-2.5 text-[12.5px]",
                saveState === "saved" ? "bg-[#F2FAF6] text-[#2E7D5B]" : "bg-[#F7F9FA] text-[#5B6B76]",
              ].join(" ")}
            >
              {saveState === "saving" && "수행 기록 저장 중…"}
              {saveState === "saved" && "✓ 수행 기록이 저장되었습니다 (기록 탭에서 확인)"}
              {saveState === "demo" && "데모 모드입니다 — 실제 로그인 시 수행 기록이 저장됩니다."}
              {saveState === "error" && "수행 기록 저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도하십시오."}
              {saveState === "idle" && "수행 기록을 준비 중입니다."}
            </div>
            <details className={card}>
              <summary className="cursor-pointer text-[13px] font-semibold">이번에 본 알맞은 표현들 다시 보기</summary>
              <ul className="mt-2 space-y-1.5">
                {items.map((it) => (
                  <li key={it.id} className="rounded-lg bg-[#FAF8F2] px-3.5 py-2 text-[13.5px]">
                    {it.recommended_example}
                  </li>
                ))}
              </ul>
            </details>

            {/* 보상·환기 구역 — 학습 코어와 물리적 분리. 생생 중국어(쇼츠 발췌)는 완료 후 보상 슬롯에만(UX 분리 원칙)
                ⚠️ 콘텐츠가 생길 때까지 렌더하지 않는다(LIVING_EXPRESSION_READY=false).
                빈 자리표시자인데도 완료 화면에서 시각 무게가 가장 컸고, 개발 메모
                ("레이아웃 예약 구역")가 학습자에게 그대로 노출되고 있었다. */}
            {LIVING_EXPRESSION_READY && (
            <div className="rounded-xl border border-[#EAE4D2] border-t-[3px] border-t-[#FAD338] bg-[#FFFDF4] p-4">
              <div className="text-[12px] font-extrabold tracking-wide text-[#6B5518]">🎬 오늘의 생생 표현 · 쉬어가기</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                실제 원어민이 이 상황에서 자주 쓰는 <b>생생한 표현</b>을 가볍게 살펴보는 자리입니다. 학습 과제가 아니라 <b>보상·환기용</b>입니다.{" "}
                <span className="text-[#A9B0BA]">(유튜브 쇼츠 발췌 — 후속 구현. 이 자리는 레이아웃 예약 구역)</span>
              </p>
              <div className="mt-3 rounded-[10px] border border-dashed border-[#A9B0BA] bg-white px-3 py-5 text-center text-[12.5px] text-[#A9B0BA]">
                생생 중국어 콘텐츠 배치 예정
              </div>
            </div>
            )}

            {/* 완료 화면의 마지막 행동 — 데모/샘플에서는 「처음부터 다시 보기」 자리를
                수행 방식 전환이 대신한다. "이어서"라는 말대로 번역을 끝까지 훑어본
                다음이 통역 차례이고, 위쪽에 두면 노란 카드가 뭉쳐 부담스럽다.
                실제 미션의 mode는 승격 시 정해지므로(계약 0-o) 여기서 바뀌는 것은
                **샘플 미리보기**뿐이고, 실 학습 세션(IS_DEMO 꺼짐)엔 노출되지 않는다.
                재개 상태가 남아 있으면 곧바로 완료 화면이 복원되므로 먼저 지운다. */}
            {IS_DEMO && isSample ? (
              <button
                type="button"
                onClick={() => {
                  // 방금 끝낸 방식의 진행분을 2부 시작 상태로 덮어쓴다. 단순 삭제만 하면
                  // 이동 직전 저장 이펙트가 현재 상태를 되써서 다음 화면이 산출 단계로
                  // 튈 수 있다(같은 sample 키를 공유).
                  try {
                    localStorage.setItem(
                      storageKey,
                      JSON.stringify({ phase: "ctx", draft: "", revised: "", ctxPick: null, ctxDone: false }),
                    );
                  } catch { /* ignore */ }
                  // part=2 — 1부(판단 연습)는 방금 마쳤으므로 건너뛰고 바로 2부로.
                  window.location.href = isInterp
                    ? "/learner/practice?part=2"
                    : "/learner/practice?mode=interpreting&part=2";
                }}
                className="w-full rounded-xl bg-[#FAD338] px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#F5C81F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
              >
                <div className="text-[11.5px] font-bold text-[#6B5518]">
                  수행 방식 2가지 중 1가지 완료 · 다음
                </div>
                <div className="mt-1 flex items-center gap-2 text-[16px] font-bold text-[#15202B]">
                  <span>{isInterp ? "✍️" : "🎙️"}</span>
                  <span>이어서 {isInterp ? "번역" : "통역"}으로 해보기 →</span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5B4A1E]">
                  {isInterp
                    ? "감각 익히기는 건너뛰고 곧바로 번역 산출부터 이어집니다."
                    : "감각 익히기는 건너뛰고 곧바로 통역 산출부터 이어집니다 — 원문 듣기 → 녹음 → 전사 확인."}
                </p>
              </button>
            ) : (
              <Button variant="outline" className="w-full" onClick={resetAll}>처음부터 다시 보기 ↺</Button>
            )}
          </div>
        )}
      </div>
    </LearnerJourneyShell>
  );
}

// ── 통역 오디오 프레임 — 듣기(≤2회) → 녹음 → STT 초안 → 전사 확인 → 제출 ──
// 실동작: 서버 TTS(고정 음원)·MediaRecorder(서버 STT 전송)·SpeechRecognition(실패 폴백).
// 음성 파일은 저장하지 않고 전사 후 폐기한다. 학습자가 확인한 전사만 제출·저장한다.
type BrowserSpeechRecognitionResultList = {
  length: number;
  [index: number]: {
    [index: number]: { transcript: string };
  };
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: BrowserSpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

function AudioFrame({
  sourceText,
  srcName,
  tgtName,
  ttsLang,
  sttLang,
  situation,
  relation,
  demoText,
  onSubmit,
}: {
  sourceText: string;
  srcName: string;
  tgtName: string;
  ttsLang: string;
  sttLang: string;
  situation: string;
  relation: string;
  demoText: string;
  onSubmit: (transcript: string) => void;
}) {
  const MAX_PLAYS = 2;
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const sttSupported = useMemo(
    () => {
      if (typeof window === "undefined") return false;
      const speechWindow = window as SpeechRecognitionWindow;
      return Boolean(speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition);
    },
    [],
  );
  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* 무시 */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const play = async () => {
    if (plays >= MAX_PLAYS || playing || ttsLoading) return;
    setNotice(null);

    try {
      let audio = audioRef.current;
      if (!audio) {
        setTtsLoading(true);
        const result = await requestTtsAudio({
          text: sourceText,
          lang: ttsLang.toLowerCase().startsWith("zh") ? "zh" : "ko",
          logPrefix: "[mission-tts]",
        });
        setTtsLoading(false);

        if (result.ok === false) {
          setNotice(`고품질 음성을 준비하지 못했습니다 — ${result.message}`);
          return;
        }

        const url = URL.createObjectURL(result.blob);
        audioUrlRef.current = url;
        audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.onerror = () => {
          setPlaying(false);
          setNotice("음성 재생에 실패했습니다. 다시 시도해 주세요.");
        };
      }

      audio.currentTime = 0;
      setPlaying(true);
      await audio.play();
      setPlays((count) => count + 1);
    } catch {
      setPlaying(false);
      setTtsLoading(false);
      setNotice("고품질 음성 재생에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const startRec = async () => {
    setNotice(null);
    setRecorded(false);
    setConfirmed(false);
    setTranscript("");
    setTranscribing(false);
    // ① STT 초안(가능하면)
    if (sttSupported) {
      try {
        const speechWindow = window as SpeechRecognitionWindow;
        const SR = speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;
        if (!SR) throw new Error("SpeechRecognition unavailable");
        const rec = new SR();
        rec.lang = sttLang;
        rec.interimResults = true;
        rec.continuous = true;
        rec.onresult = (event) => {
          let out = "";
          for (let i = 0; i < event.results.length; i++) {
            out += event.results[i][0].transcript;
          }
          setTranscript(out.trim());
        };
        rec.onerror = () => {};
        recRef.current = rec;
        rec.start();
      } catch {
        /* STT 실패 — 녹음/수동 입력으로 계속 */
      }
    }
    // ② 서버 전사용 임시 녹음 — 전사 요청 후 Blob 참조를 폐기한다.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const audio = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        mediaRef.current = null;
        setRecorded(true);

        if (!audio.size) {
          setNotice("녹음된 음성이 없습니다 — 통역 내용을 직접 입력해 주세요.");
          return;
        }

        setTranscribing(true);
        const result = await requestSttTranscript(
          audio,
          sttLang.toLowerCase().startsWith("ko") ? "ko" : "zh",
        );
        setTranscribing(false);

        if (result.ok === true) {
          setTranscript(result.text);
          setConfirmed(false);
          setNotice("고품질 자동 전사가 완료됐습니다. 실제로 말한 내용과 같은지 확인해 주세요.");
        } else {
          setNotice(`${result.message} 브라우저 전사 초안을 확인하거나 직접 입력해 주세요.`);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      if (!sttSupported) {
        setNotice("브라우저 실시간 전사는 지원되지 않지만, 녹음을 마치면 서버에서 자동 전사합니다.");
      }
    } catch {
      // 마이크 거부/미지원 — 수동 전사 경로로 진행(구인 유지)
      setRecording(true);
      setNotice("마이크를 사용할 수 없습니다 — 통역한 내용을 아래에 직접 입력해 확인·제출할 수 있습니다.");
    }
  };

  const stopRec = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* 무시 */
    }
    try {
      if (mediaRef.current?.state === "recording") {
        mediaRef.current.stop();
      } else {
        setRecorded(true);
      }
    } catch {
      /* 무시 */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
  };

  const canSubmit = !transcribing && confirmed && transcript.trim().length > 0;
  const dark = "rounded-xl bg-[#0F1B24] p-4 text-[#EAF0F4]";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-l-[3px] border-[#EAE4D2] border-l-[#15202B] bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">통역 — 듣고 옮기기</div>
        <p className="mt-1 text-[14.5px] font-semibold">{situation}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="font-normal">{relation}</Badge>
          <Badge variant="secondary" className="font-normal">음성 · 순차 통역</Badge>
        </div>
      </div>

      {/* ① 원문 듣기 */}
      <div className={dark}>
        <div className="text-[11px] font-bold text-[#FAD338]">① 원문 듣기 ({srcName}) · 최대 {MAX_PLAYS}회</div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={play}
            disabled={plays >= MAX_PLAYS || playing || ttsLoading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAD338] text-[18px] font-bold text-[#15202B] disabled:opacity-40"
          >
            {playing || ttsLoading ? "❚❚" : "▶"}
          </button>
          <div>
            <div className="text-[14px]">
              {ttsLoading ? "고품질 음성 준비 중…" : playing ? "재생 중…" : "원발화 재생"}
            </div>
            <div className="text-[12px] text-[#9FB0BC]">남은 재생 {Math.max(0, MAX_PLAYS - plays)}회 · 재생 {plays}회</div>
          </div>
        </div>

        {/* ② 통역 녹음 */}
        <div className="mt-4 text-[11px] font-bold text-[#9FB0BC]">② 통역 녹음 ({tgtName})</div>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={recording ? stopRec : startRec}
            disabled={transcribing}
            className={[
              "rounded-lg border px-4 py-2 text-[13px] font-bold disabled:cursor-wait disabled:opacity-60",
              recording ? "border-[#C4494A] bg-[#C4494A] text-white" : "border-[#C4494A] bg-transparent text-[#F0A3A4]",
            ].join(" ")}
          >
            {recording ? "■ 녹음 정지" : transcribing ? "전사 중…" : recorded ? "● 다시 녹음" : "● 녹음 시작"}
          </button>
          <span className="text-[12px] text-[#9FB0BC]">
            {recording
              ? "녹음 중…"
              : transcribing
                ? "고품질 자동 전사 중…"
                : recorded
                  ? "전사 완료 · 아래에서 확인"
                  : "버튼을 누른 뒤 통역 시작"}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#9FB0BC]">
          마이크 음성은 자동 전사를 위해 OpenAI 음성 인식 API로 전송됩니다.
          PRAGMA는 음성 파일을 저장하지 않으며, 확인한 전사만 제출·저장합니다.
        </p>

        {notice && <div className="mt-3 rounded-lg bg-[#16252F] px-3 py-2 text-[12px] leading-relaxed text-[#C6D2DB]">{notice}</div>}

        {/* ③ 전사 확인 */}
        {(recorded || notice || transcribing) && (
          <div className="mt-3 rounded-lg border border-[#2A3A45] bg-[#16252F] p-3">
            <div className="text-[11px] font-bold text-[#9FB0BC]">
              ③ 전사 확인 — 자동 전사를 실제로 말한 내용과 대조·수정합니다
            </div>
            <textarea
              rows={2}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setConfirmed(false);
              }}
              placeholder={`통역한 ${tgtName} 문장`}
              disabled={transcribing}
              className="mt-2 w-full rounded-md border border-[#2A3A45] bg-[#0F1B24] p-2.5 text-[14.5px] leading-relaxed text-[#EAF0F4] outline-none focus:border-[#FAD338]"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => transcript.trim() && setConfirmed(true)}
                disabled={transcribing}
                className={[
                  "rounded-md border px-3 py-1.5 text-[12px] font-semibold",
                  confirmed ? "border-[#2E7D5B] bg-[#12321F] text-[#8FE3B4]" : "border-[#2A3A45] bg-[#0F1B24] text-[#C6D2DB]",
                ].join(" ")}
              >
                {transcribing ? "전사 중…" : confirmed ? "✓ 확인됨" : "전사 확인"}
              </button>
              <span className="text-[11px] text-[#9FB0BC]">전사 확인은 통역 구인 타당성 장치입니다.</span>
            </div>
          </div>
        )}
      </div>

      <Button className="w-full" disabled={!canSubmit} onClick={() => onSubmit(transcript.trim())}>
        확인한 전사로 제출 →
      </Button>
      {IS_DEMO && (
        <button
          type="button"
          className={demoBtn}
          onClick={() => {
            setPlays(MAX_PLAYS);
            setRecorded(true);
            setRecording(false);
            setTranscript(demoText);
            setConfirmed(true);
          }}
        >
          데모 채우기 — 듣기·녹음·전사 자동
        </button>
      )}
    </div>
  );
}

// ── 1부 → 2부 인계(프로토타입 v2 ②) — "1부 완료 ≠ 미션 완료" ────────────
function Handoff({
  mission,
  dir,
  isInterp,
  saved,
  onContinue,
  onSaveLater,
}: {
  mission: MissionV2;
  dir: LanguageDirection;
  isInterp: boolean;
  saved: boolean;
  onContinue: () => void;
  onSaveLater: () => void;
}) {
  const feat = getTargetFeature(mission.unit.target_feature);
  const tools =
    (dir === "zh_ko" && feat?.relevant_resources_zh_ko?.length ? feat.relevant_resources_zh_ko : feat?.relevant_resources) ?? [];
  return (
    <div className="rounded-xl border border-[#FAD338] bg-white p-5">
      <div className="text-[11px] font-bold text-[#2E7D5B]">감각 익히기 완료</div>
      <h2 className="mt-0.5 text-[16px] font-bold">이제 직접 표현할 차례입니다</h2>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">방금 확인한 도구 — 문장 전체보다 <b>범주</b>에 주목합니다.</p>
      {tools.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <li key={t} className="rounded-md border border-[#EAE4D2] bg-[#F5F5F2] px-2.5 py-1 text-[12.5px]">{t}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12.5px] text-muted-foreground">
        이제 <b>새로운 상황</b>에서 직접 {isInterp ? "통역" : "옮겨"} 봅니다. 많이 얹을수록 좋은 것이 아니라, 이 상대·이 부담에 맞는 만큼만.
      </p>
      {saved ? (
        <div className="mt-3.5 rounded-lg bg-[#F2FAF6] px-3.5 py-2.5 text-[12.5px] text-[#2E7D5B]">
          저장했습니다 — 다음에 들어오면 2부부터 이어집니다.
          <button type="button" onClick={onContinue} className="ml-2 underline">지금 계속하기 →</button>
        </div>
      ) : (
        <div className="mt-3.5 flex gap-2.5">
          <Button className="flex-1 bg-[#FAD338] text-[#15202B] hover:bg-[#F0C800]" onClick={onContinue}>직접 표현하러 가기 →</Button>
          <Button variant="outline" className="flex-1" onClick={onSaveLater}>저장하고 나중에</Button>
        </div>
      )}
      {/* 「1부 완료 ≠ 미션 완료」 경고는 걷어냈다 — 남은 분량을 강조해 피로만 키웠다.
          남은 단계는 위 진행 3단계가 이미 보여 준다. */}
    </div>
  );
}

// ── 2부 상황 확인(판단형) — 산출 전 필요한 조절 수준 1문항. 점수 없음 ──
function CtxStage({
  pt,
  isInterp,
  pick,
  onPick,
  onNext,
}: {
  pt: MissionV2["production_task"];
  isInterp: boolean;
  pick: number | null;
  onPick: (i: number) => void;
  onNext: () => void;
}) {
  const ctx = useMemo(() => deriveCtx(pt.pdr), [pt.pdr]);
  const answered = pick !== null;
  const wrong = answered && pick !== ctx.right;
  return (
    <div className="space-y-3">
      <SituationCard situation={pt.situation_ko} relation={pt.relation_ko} />
      {/* 문제 카드가 아니라 상황 메모다 — 여섯 번째 문항처럼 보이면 안 된다.
          선택은 남긴다(2부에서 관계·부담을 스스로 읽는 유일한 지점이라, 자동 판단으로
          대체하면 "판단 → 산출"의 연결이 끊긴다). 다만 확인 버튼을 없애 한 번에 끝내고,
          결과를 본 뒤에도 다시 고를 수 있게 둔다 — 오터치가 그대로 잠기지 않도록. */}
      <div className="rounded-xl border border-dashed border-[#D8D0BC] bg-[#FBFAF5] p-4">
        <div className="text-[11px] font-bold text-[#6B5518]">새 상황에서 먼저 볼 것</div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          직접 {isInterp ? "통역하기" : "옮기기"} 전에 상대와 부담을 먼저 확인합니다.
        </p>
        <div className="mt-2.5 text-[13px] font-semibold">{ctx.q}</div>
        <div className="mt-2 flex flex-col gap-1.5">
          {ctx.opts.map((o, i) => (
            <Choice key={i} label={o} selected={pick === i} disabled={false} onClick={() => onPick(i)} />
          ))}
        </div>
        {answered && (
          <div className="mt-3 rounded-lg bg-[#F2FAF6] px-3.5 py-3">
            <div className="text-[12px] font-bold text-[#2E7D5B]">{wrong ? "다시 짚어 보면" : "상황 핵심"}</div>
            <p className="mt-1 text-[13px] leading-relaxed">{wrong ? ctx.okWrong : ctx.okRight}</p>
          </div>
        )}
      </div>
      <Button className="w-full" disabled={!answered} onClick={onNext}>
        {isInterp ? "통역하러" : "표현하러"} 가기 →
      </Button>
      {IS_DEMO && !answered && (
        <button type="button" className={demoBtn} onClick={() => onPick(ctx.right)}>데모 채우기</button>
      )}
    </div>
  );
}

// ── 평가 계약(0-i·65) + 판정 지위 고지(B1 · 0-g·44) — 첫 문항 아래 접기 하나로 ──
// 종전엔 이 둘이 첫 문항 **위**에서 약 200px을 차지해, 학생이 상황보다 완료 조건을
// 먼저 읽는 화면이 됐다. 고지 자체는 계약 사항이라 삭제하지 않고 위치만 내린다.
// ⚠️ 접힌 제목에 "다른 적절한 표현도 존재할 수 있습니다"를 남긴다 — 전부 감추면 B1
//    (판정=AI 제안이지 유일한 정답이 아님)의 고지 효과가 사라진다.
function MissionBriefDrawer({ mission }: { mission: MissionV2 }) {
  const feat = getTargetFeature(mission.unit.target_feature);
  const estMin = mission.production_task.mode === "interpreting" ? 15 : 12;
  const tgtName = tgtLangName(mission.direction);
  const isInterp = mission.production_task.mode === "interpreting";
  return (
    <details className="rounded-xl border border-[#EAE4D2] bg-[#FAF7EE] px-4 py-3 text-[12.5px]">
      <summary className="cursor-pointer text-[#6B5518]">
        판정 기준 보기 · <b>다른 적절한 표현도 존재할 수 있습니다</b>
      </summary>
      <div className="mt-2.5 space-y-1.5 text-muted-foreground">
        {/* 1부 문항마다 상황이 따로 있으므로, 여기 상황은 "2부에서 직접 할 일"임을 밝힌다. */}
        <p className="text-foreground">
          <span className="text-muted-foreground">마지막에 직접 {isInterp ? "통역할" : "옮길"} 상황 · </span>
          {mission.production_task.situation_ko}
          <span className="text-muted-foreground"> · 약 {estMin}분</span>
        </p>
        <p>{JUDGMENT_STATUS_CAPTION}</p>
        <p>
          완료 조건 — 판단 {mission.mpj_items.length}문항 → {isInterp ? `${tgtName}로 통역` : `${tgtName}로 옮기기`} 1회 → 피드백 확인 → 다듬기 1회.
          <b className="text-foreground"> 정답·참고 표현은 제출한 뒤에 공개됩니다.</b>
        </p>
        <p>확인하는 것 — ① 원문의 의미·의도가 유지됐는가 ② 의미를 방해하는 문법 오류가 있는가 ③ 이 관계·상황에서 「{mission.unit.learner_label}」이 적절한가</p>
        {feat && feat.excluded_confounds.length > 0 && (
          <p>확인하지 않는 것 — {feat.excluded_confounds.join(" · ")}</p>
        )}
      </div>
    </details>
  );
}

// ── 이견 채널(0-r·104 / 0-i·66) — 선택형 이견 기록 ────────────────────────
// 판정을 바꾸지 않는다. 목적 = ①공정성 통로 ②결함 문항 발견 ③채점키 캘리브레이션
// 보조 자료. 정규 MPJ 문항으로 만들지 않는다(구인 변경 금지) — 선택 입력이고,
// 이유 한 줄도 필수가 아니다(피로 원칙).
const DISSENT_CONDITIONS: { code: string; label: string }[] = [
  { code: "relationship", label: "관계·친밀도에 대한 다른 판단" },
  { code: "burden", label: "부탁의 부담 크기에 대한 다른 판단" },
  { code: "preceding", label: "앞선 대화 흐름을 더 고려함" },
  { code: "experience", label: "실제 사용 경험과 차이가 있음" },
];

function DissentPanel({ onSubmit }: { onSubmit: (d: { conditions: string[]; reason: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-lg bg-[#F2FAF6] px-3.5 py-2.5 text-[12.5px] text-[#2E7D5B]">
        ✓ 남겼습니다. 판정은 그대로지만, 이 기록은 문항을 다듬는 데 쓰입니다.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-[#B9C4CE] bg-white px-3.5 py-2.5 text-left text-[12.5px] text-[#3B4A57] hover:bg-[#F7F9FA]"
      >
        판정과 다르게 본 부분이 있다면 <b>의견 남기기 →</b>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#B9C4CE] bg-white px-3.5 py-3">
      <div className="text-[12.5px] font-semibold">판정과 다르게 본 부분</div>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        해당하는 항목만 선택합니다. 판정은 바뀌지 않으며, 담당 교수자가 문항을 다듬는 데 참고합니다.
      </p>
      <ul className="mt-2 space-y-1">
        {DISSENT_CONDITIONS.map((c) => {
          const on = picked.includes(c.code);
          return (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.code) : [...p, c.code]))}
                aria-pressed={on}
                className={[
                  "w-full rounded-md border px-3 py-1.5 text-left text-[12.5px]",
                  on ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#EAE4D2] bg-white text-[#3B4A57]",
                ].join(" ")}
              >
                {c.label}
              </button>
            </li>
          );
        })}
      </ul>
      <Textarea
        className="mt-2 text-[12.5px]"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="한 줄 이유 (선택)"
      />
      <div className="mt-2 flex gap-2">
        <Button
          className="flex-1"
          disabled={picked.length === 0 && !reason.trim()}
          onClick={() => {
            onSubmit({ conditions: picked, reason: reason.trim() });
            setSent(true);
          }}
        >
          남기기
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          닫기
        </Button>
      </div>
    </div>
  );
}

// ── 피드백 근거 서랍(의견4 ③) — 판정↔상황 조건 연결. 카탈로그·상황 데이터만(AI 0회) ──
function FeedbackReasonDrawer({ mission }: { mission: MissionV2 }) {
  const feat = getTargetFeature(mission.unit.target_feature);
  const pt = mission.production_task;
  return (
    <details className="mt-2.5 text-[12.5px]">
      <summary className="cursor-pointer text-[#6B5518]">이 초점을 판단한 근거</summary>
      <div className="mt-2 space-y-1.5">
        <div className="rounded-lg bg-[#FAF8F2] px-3 py-2 text-muted-foreground">
          <div>상황 · {pt.relation_ko}</div>
          <div className="mt-0.5">부담 · {PDR_R_LABEL[pt.pdr.r] ?? pt.pdr.r} / 관계 거리 · {PDR_D_LABEL[pt.pdr.d] ?? pt.pdr.d}</div>
        </div>
        {feat && <p className="text-foreground">{feat.operational_definition.split(".")[0]}.</p>}
      </div>
    </details>
  );
}

// ── 수정 지도(0-i) — 최초↔최종 + 수정 성격. 클라이언트만(AI·DB 0회) ──
function RevisionMap({ first, final, featureLabel, interp }: { first: string; final: string; featureLabel: string; interp: boolean }) {
  const changed = first.trim() !== final.trim();
  return (
    <div className={card}>
      <div className="text-[13px] font-semibold">내가 바꾼 부분</div>
      <div className="mt-2.5 space-y-2">
        <div className="rounded-lg bg-[#F5F5F2] px-3.5 py-2.5">
          <div className="text-[11.5px] font-semibold text-muted-foreground">최초</div>
          <p className="mt-0.5 whitespace-pre-wrap text-[14px]">{first}</p>
        </div>
        <div className="rounded-lg border border-[#FAD338] bg-[#FFF8DE] px-3.5 py-2.5">
          <div className="text-[11.5px] font-semibold text-[#6B5518]">최종</div>
          <p className="mt-0.5 whitespace-pre-wrap text-[14px]">{final}</p>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        {changed
          ? `이번에 조절한 초점 · ${featureLabel}. 문장의 길이보다 이 상황에 맞게 조절한 지점을 확인합니다.`
          : `이번에는 최초 ${interp ? "통역" : "번역"}을 그대로 두었습니다.`}
      </p>
    </div>
  );
}

// ── 상황 카드 ───────────────────────────────────────────────────────────
// channel 폐기(2026-07-25): 매체 배지 제거. 관계(P/D/R)만 노출한다 — 매체는 상황 자연어에 녹아 있을 뿐 축이 아니다.
function SituationCard({ situation, relation }: { situation: string; relation: string }) {
  return (
    <div className="rounded-xl border-l-[3px] border-[#EAE4D2] border-l-[#15202B] bg-white p-4">
      <p className="text-[14.5px] font-semibold">{situation}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="font-normal">{relation}</Badge>
      </div>
    </div>
  );
}

// ── MPJ 한 문항 ─────────────────────────────────────────────────────────
function MpjStage({ item, onDone }: { item: MpjItemV2; onDone: () => void }) {
  const [answered, setAnswered] = useState(false);
  const [scalePick, setScalePick] = useState<string | null>(null);
  const [bandPick, setBandPick] = useState<string | null>(null);
  const [reasonPicks, setReasonPicks] = useState<Set<string>>(new Set());
  const [confidence, setConfidence] = useState<string | null>(null);
  const [fixPicks, setFixPicks] = useState<Set<number>>(new Set());
  const [multiPicks, setMultiPicks] = useState<Record<number, string>>({});

  // 대화창 끝 지점이 헤더 위로 올라갔는지 — 올라갔을 때만 맥락 바를 띄운다.
  // IntersectionObserver 대신 스크롤 리스너를 쓴다: 같은 값이면 React가 리렌더를
  // 건너뛰므로 비용이 사실상 없고, 렌더 루프에 의존하지 않아 동작 확인이 쉽다.
  const sceneEndRef = useRef<HTMLDivElement>(null);
  const [showCtxBar, setShowCtxBar] = useState(false);
  useEffect(() => {
    const update = () => {
      const el = sceneEndRef.current;
      if (el) setShowCtxBar(el.getBoundingClientRect().top < HEADER_H);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const feature = item.axis_feature;
  const bands =
    item.type === "multi_judge"
      ? bandOptions(feature, item.candidates.flatMap((c) => c.accepted_band_codes))
      : bandOptions(feature, item.type === "judge3" || item.type === "fix_choice" || item.type === "reason_conf" ? item.accepted_band_codes : []);

  const canReveal = (() => {
    switch (item.type) {
      case "scale4":
        return !!scalePick;
      case "judge3":
        return !!bandPick;
      case "fix_choice":
        return !!bandPick && fixPicks.size > 0;
      case "reason_conf":
        return !!bandPick && reasonPicks.size > 0 && !!confidence;
      case "multi_judge":
        return Object.keys(multiPicks).length === item.candidates.length;
      default:
        return false;
    }
  })();

  const toggleReason = (id: string) =>
    setReasonPicks((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // 데모 채우기(프로토타입 v2) — 이 문항의 기준 정답으로 자동 응답 후 판정 공개.
  const demoFill = () => {
    switch (item.type) {
      case "scale4":
        setScalePick(item.accepted_scale_codes[0]);
        break;
      case "judge3":
        setBandPick(item.accepted_band_codes[0]);
        break;
      case "fix_choice":
        setBandPick(item.accepted_band_codes[0]);
        setFixPicks(new Set(item.corrections.map((c, i) => (c.is_valid ? i : -1)).filter((i) => i >= 0)));
        break;
      case "reason_conf":
        setBandPick(item.accepted_band_codes[0]);
        setReasonPicks(new Set(item.accepted_reason_ids));
        setConfidence("꽤 확신");
        break;
      case "multi_judge":
        setMultiPicks(Object.fromEntries(item.candidates.map((c, i) => [i, c.accepted_band_codes[0]])));
        break;
    }
    setAnswered(true);
  };

  return (
    <div className="space-y-3">
      {/* 대화 스킨 — 상황·선행발화 + AI 초안(내 미발송 초안 말풍선). 프로토타입 v2 */}
      <ChatScene situation={item.situation_ko} relation={item.relation_ko}>
        {item.preceding_turn && <ChatBubble side="them">{item.preceding_turn}</ChatBubble>}
        <ChatCaption>전하려는 뜻 · {item.source}</ChatCaption>
        {item.type !== "multi_judge" && (
          <>
            <ChatCaption tone="draft">↓ AI가 만든 초안 · 아직 안 보냄</ChatCaption>
            <ChatBubble side="me" variant="draft">
              {answered ? highlightZh(item.target, item.highlights) : item.target}
            </ChatBubble>
          </>
        )}
      </ChatScene>

      {/* 문항 맥락 고정 바 — 긴 문항(특히 multi_judge는 후보 5개 × 선택지 3개)에서
          스크롤하면 상대·원문이 화면 밖으로 나가 "무엇을 옮기는 중이었지"를 잊는다.
          ⚠️ sticky가 아니라 **대화창이 화면에서 사라졌을 때만** 뜨는 fixed 바다.
             sticky면 대화창 바로 아래에서 같은 내용을 반복해 자리만 먹는다.
          ⚠️ 관계는 화용 판단의 축이라 좁은 화면에서도 숨기지 않고 2줄로 접는다.
          ⚠️ multi_judge에도 대화창에서 원문을 먼저 보여 주며, 긴 후보 목록을 읽는 동안에는
             이 바가 같은 맥락을 유지한다. 후보(판단 대상)가 아니라 무엇을 옮기는 요청인지이므로
             정답 노출이 아니다. */}
      <div ref={sceneEndRef} aria-hidden className="h-px" />
      {showCtxBar && (
        <div className="fixed inset-x-0 top-[60px] z-30 border-b border-[#EAE4D2] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-6 py-1.5 text-[12px]">
            <span className="text-muted-foreground">
              상대 · <span className="text-foreground">{item.relation_ko}</span>
            </span>
            <span className="hidden text-[#E3E1D8] md:inline">|</span>
            <span className="text-muted-foreground">
              전하려는 뜻 · <span className="text-foreground">{item.source}</span>
            </span>
          </div>
        </div>
      )}

      {/* 단일 발화 문항(scale4/judge3/fix_choice/reason_conf) — 위 대화창 AI 초안에 대한 판정(0-i·59) */}
      {item.type !== "multi_judge" && (
        <div className={card}>
          {/* scale4 */}
          {item.type === "scale4" && (
            <>
              <div className="mt-3.5 text-[13px] font-semibold">이 상황에서의 번역안 적절성</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {SCALE4_CODES.map((code) => (
                  <Choice key={code} label={SCALE4_LABELS[code as Scale4Code]} selected={scalePick === code} disabled={answered} onClick={() => setScalePick(code)} />
                ))}
              </div>
            </>
          )}

          {/* judge3 / fix_choice / reason_conf 공통: band 판정 */}
          {item.type !== "scale4" && (
            <>
              <div className="mt-3.5 text-[13px] font-semibold">이 상황에서의 번역안 적절성</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {bands.map((b) => (
                  <Choice key={b.code} label={b.label} selected={bandPick === b.code} disabled={answered} onClick={() => setBandPick(b.code)} />
                ))}
              </div>
            </>
          )}

          {/* fix_choice: 교정 복수 선택 */}
          {item.type === "fix_choice" && (
            <>
              <div className="mt-4 text-[13px] font-semibold">알맞은 수정안 선택 <span className="font-normal">· 맞는 것을 모두 선택</span></div>
              <div className="mt-2 flex flex-col gap-1.5">
                {item.corrections.map((o, i) => (
                  <button
                    key={o.text}
                    type="button"
                    disabled={answered}
                    onClick={() =>
                      setFixPicks((prev) => {
                        const n = new Set(prev);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    className={[
                      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px]",
                      fixPicks.has(i) ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]" : "border-[#EAE4D2] bg-white",
                      answered && o.is_valid ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    <div>{o.text}</div>
                    {answered && <div className="mt-1 text-[12px] text-muted-foreground">{o.note_ko}</div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* reason_conf: 이유 + 확신도 */}
          {item.type === "reason_conf" && bandPick && (
            <>
              <div className="mt-4 text-[13px] font-semibold">판단 근거 선택 <span className="font-normal">· 맞는 것을 모두 선택</span></div>
              <div className="mt-2 flex flex-col gap-1.5">
                {item.reasons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={answered}
                    onClick={() => toggleReason(r.id)}
                    className={[
                      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px]",
                      reasonPicks.has(r.id) ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]" : "border-[#EAE4D2] bg-white",
                      answered && item.accepted_reason_ids.includes(r.id) ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    {r.text_ko}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-[13px] font-semibold">판단 확신도</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CONFIDENCE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={answered}
                    onClick={() => setConfidence(c)}
                    className={["rounded-md border px-3 py-1.5 text-[12.5px]", confidence === c ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold" : "border-[#EAE4D2] bg-white"].join(" ")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 정보 위계: "상대에게 어떻게 들릴 수 있는가"(explanation_ko — 상황 결부형 어조 해설)를
              먼저 보이고, "기준 판정" 라벨은 그 아래 보조 표기로 내린다. explanation_ko 재배치만
              — 새 필드·판정 로직·저장 로그는 그대로다. */}
          {answered && (
            <div className="mt-4 rounded-lg bg-[#F2FAF6] px-3.5 py-3">
              <p className="text-[13px] leading-relaxed">{item.explanation_ko}</p>
              <div className="mt-2 text-[11.5px] font-semibold text-[#2E7D5B]">
                기준 판정 · {(item.type === "scale4" ? item.accepted_scale_codes.map((c) => SCALE4_LABELS[c as Scale4Code] ?? c) : item.accepted_band_codes.map((c) => bandLabel(feature, c))).join(" / ")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* multi_judge: 한 상황 다중 발화 */}
      {item.type === "multi_judge" && (
        <div className={card}>
          <div className="text-[13px] font-semibold">AI가 만든 여러 번역 초안 · 각 초안의 적절성 판단</div>
          <ul className="mt-3 space-y-2.5">
            {item.candidates.map((c, i) => (
              <li key={c.text} className="rounded-lg border border-[#EAE4D2] px-3.5 py-3">
                <div className="text-[14.5px]">{c.text}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {bands.map((b) => (
                    <button
                      key={b.code}
                      type="button"
                      disabled={answered}
                      onClick={() => setMultiPicks((p) => ({ ...p, [i]: b.code }))}
                      className={[
                        "rounded-md border px-2.5 py-1 text-[12px]",
                        multiPicks[i] === b.code ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold" : "border-[#EAE4D2] bg-white text-muted-foreground",
                        answered && c.accepted_band_codes.includes(b.code) ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                      ].join(" ")}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                {answered && <div className="mt-2 text-[12.5px] text-muted-foreground">{c.note_ko}</div>}
              </li>
            ))}
          </ul>
          {answered && (
            <div className="mt-3 rounded-lg bg-[#F2FAF6] px-3.5 py-3">
              <p className="text-[13px] leading-relaxed">{item.explanation_ko}</p>
            </div>
          )}
        </div>
      )}

      {!answered ? (
        <>
          <Button className="w-full" disabled={!canReveal} onClick={() => setAnswered(true)}>확인하기</Button>
          {IS_DEMO && (
            <button type="button" className={demoBtn} onClick={demoFill}>데모 채우기 — 이 문항 자동 응답</button>
          )}
        </>
      ) : (
        <Button className="w-full" onClick={onDone}>다음 →</Button>
      )}
    </div>
  );
}

const Choice = ({ label, selected, disabled, onClick }: { label: string; selected: boolean; disabled: boolean; onClick: () => void }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={[
      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px] transition-colors",
      selected ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold" : "border-[#EAE4D2] bg-white hover:bg-[#FAFAF7]",
    ].join(" ")}
  >
    {label}
  </button>
);

export default MissionRunV1;
