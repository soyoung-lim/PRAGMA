import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Info, Lock } from "lucide-react";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { Rollback } from "@/components/Rollback";
import { ensureSession, logAction } from "@/lib/tracking";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  SCENARIOS,
  SPEECH_ACTS,
  STORAGE_KEY,
  type SpeechAct,
  type WorkflowSelection,
} from "@/lib/scenarios";
import { PDR_STORAGE_KEY, STRATEGIES, type PdrData } from "@/lib/strategies";
import { TRANSLATE_STORAGE_KEY } from "./Translate";

const FINALIZE_STORAGE_KEY = "translation-workflow-finalize";

type RevisionReason =
  | "화용 재현성 부족"
  | "관계 적합성 문제"
  | "리스크 관리 필요"
  | "복합 (2가지 이상)"
  | "수정 사항 없음";

const REASON_OPTIONS: RevisionReason[] = [
  "화용 재현성 부족",
  "관계 적합성 문제",
  "리스크 관리 필요",
  "복합 (2가지 이상)",
  "수정 사항 없음",
];

interface RevisionCase {
  aiResult: string;
  myRevision: string;
  reason: RevisionReason | "";
  explanation: string;
}

type FinalDecision = "as-is" | "partial" | "full-revision" | "";

interface PersonaInfluence {
  persona1: boolean;
  persona2: boolean;
  persona3: boolean;
}

interface FinalizeData {
  finalTranslation: string;
  revisionCase: RevisionCase;
  personaFeedbackReceived: boolean;
  preFeedbackTranslation: string;
  postFeedbackDecision: FinalDecision;
  personaInfluence: PersonaInfluence;
  postFeedbackTranslation: string;
  finalDecisionReason: string;
}

const EMPTY_INFLUENCE: PersonaInfluence = {
  persona1: false,
  persona2: false,
  persona3: false,
};

const EMPTY: FinalizeData = {
  finalTranslation: "",
  revisionCase: { aiResult: "", myRevision: "", reason: "", explanation: "" },
  personaFeedbackReceived: false,
  preFeedbackTranslation: "",
  postFeedbackDecision: "",
  personaInfluence: { ...EMPTY_INFLUENCE },
  postFeedbackTranslation: "",
  finalDecisionReason: "",
};

const DECISION_OPTIONS: { value: Exclude<FinalDecision, "">; label: string; sub: string }[] = [
  { value: "as-is", label: "그대로 확정", sub: "피드백을 검토했으나 변경 없이 위 번역을 최종안으로 확정합니다" },
  { value: "partial", label: "부분 반영", sub: "일부 페르소나의 일부 지적만 수용해 수정합니다" },
  { value: "full-revision", label: "전면 수정", sub: "피드백 기반으로 번역을 재작성합니다" },
];

const FINAL_TRANSLATION_MAX = 200;
const DECISION_REASON_MAX = 200;

const PERSONA_COLORS = ["#C8392E", "#C99A24", "#1F2A5C"];

interface Persona {
  number: number;
  name: string;
  role: string;
  feedback: string;
  strength: string;
  concern: string;
  suggestion: string;
}

const PERSONAS: Persona[] = [
  {
    number: 1,
    name: "이메일 수신자",
    role: "이 이메일을 받은 중국 거래처의 시점",
    feedback:
      "전반적으로 정중한 어조로 잘 작성되었습니다. 다만 '请您理解' 표현은 다소 형식적으로 느껴질 수 있습니다. 중국 비즈니스 관계에서는 '希望我们能继续保持良好的合作关系'와 같이 관계 지속에 대한 명시적 표현이 신뢰를 더 쌓을 수 있습니다. 첫 거래 관계임을 고려할 때, 다음 미팅 가능성을 언급하면 더욱 좋습니다.",
    strength: "정중한 거절 어조 유지",
    concern: "관계 지속 표현이 약함",
    suggestion: "구체적 후속 제안 추가",
  },
  {
    number: 2,
    name: "통번역 교수자",
    role: "교육적 관점에서 번역 기법을 분석",
    feedback:
      "본 번역은 화행 전략 '대안 제시 거절형'에 적절히 부합합니다. 어휘 선택은 비즈니스 격식체로 일관되게 유지되었고, 문장 구조도 중국어 자연스러움에 맞게 재구성되었습니다. 다만 P·D·R 분석에서 '거리: 멂'으로 설정한 점을 고려하면, 호칭 표현에 '贵公司' 사용이 더 적절합니다.",
    strength: "화행 전략 부합도 높음",
    concern: "호칭 표현 미세 조정 필요",
    suggestion: "공식 호칭 강화",
  },
  {
    number: 3,
    name: "리스크 관리자",
    role: "비즈니스 관계와 사후 리스크 관점에서 검토",
    feedback:
      "본 번역은 비즈니스 관계 손상 위험이 낮은 수준입니다. 거절 사유를 외부 요인에 귀속시킨 점이 책임 회피 인상을 주지 않으면서도 자사 입장을 보호합니다. 다만 '不可抗力'와 같은 법률적 어휘 사용은 신중해야 하며, 본 상황에서는 '业务方向调整'와 같은 비즈니스 어휘가 더 적합합니다.",
    strength: "관계 손상 위험 낮음",
    concern: "법률 어휘 사용 주의",
    suggestion: "비즈니스 어휘로 대체",
  },
];

function Dot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "ml-2 inline-block h-2 w-2 rounded-full",
        on ? "bg-accent" : "bg-transparent",
      ].join(" ")}
    />
  );
}

export default function Finalize() {
  const navigate = useNavigate();

  // 이전 단계 데이터
  const selection = useMemo<WorkflowSelection | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as WorkflowSelection) : null;
    } catch {
      return null;
    }
  }, []);
  const pdr = useMemo<PdrData | null>(() => {
    try {
      const raw = localStorage.getItem(PDR_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PdrData) : null;
    } catch {
      return null;
    }
  }, []);
  const translate = useMemo(() => {
    try {
      const raw = localStorage.getItem(TRANSLATE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const speechAct = (selection?.speechAct ?? null) as SpeechAct | null;
  const speechActLabel =
    SPEECH_ACTS.find((a) => a.id === speechAct)?.label ?? "-";
  const scenario =
    speechAct && selection?.scenarioId
      ? SCENARIOS[speechAct].find((s) => s.id === selection.scenarioId) ?? null
      : null;
  const scenarioLabel = scenario
    ? `시나리오 ${scenario.number} — ${scenario.title}`
    : selection?.customScenario
      ? "직접 작성"
      : "-";
  const strategyLabel = useMemo(() => {
    if (!speechAct || !pdr?.speechStrategy) return "-";
    const s = STRATEGIES[speechAct].find((x) => x.id === pdr.speechStrategy);
    return s?.title ?? "-";
  }, [speechAct, pdr]);

  const aiTranslation1: string = translate?.aiTranslation1 ?? "";
  const aiTranslation2: string = translate?.aiTranslation2 ?? "";
  const koreanEmail: string = pdr?.koreanEmail ?? "";

  // 본 페이지 상태
  const [data, setData] = useState<FinalizeData>(EMPTY);
  const [contextOpen, setContextOpen] = useState(false);
  const [revealedPersonas, setRevealedPersonas] = useState(0);
  const [expandedPersonas, setExpandedPersonas] = useState<Record<number, boolean>>({});

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/finalize" }, "/finalize");
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FINALIZE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FinalizeData;
        setData({ ...EMPTY, ...parsed, revisionCase: { ...EMPTY.revisionCase, ...parsed.revisionCase } });
        if (parsed.personaFeedbackReceived) setRevealedPersonas(4);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FINALIZE_STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const update = <K extends keyof FinalizeData>(k: K, v: FinalizeData[K]) =>
    setData((d) => ({ ...d, [k]: v }));
  const updateRevision = <K extends keyof RevisionCase>(
    k: K,
    v: RevisionCase[K],
  ) =>
    setData((d) => ({ ...d, revisionCase: { ...d.revisionCase, [k]: v } }));

  const copyAi = (n: 1 | 2) => {
    const txt = n === 1 ? aiTranslation1 : aiTranslation2;
    if (!txt.trim()) {
      toast.error(`AI 번역 ${n}이(가) 비어 있습니다`);
      return;
    }
    update("finalTranslation", txt.slice(0, FINAL_TRANSLATION_MAX));
    toast.success(`AI 번역 ${n}을(를) 최종 번역에 복사했습니다`);
  };

  const requestPersonaFeedback = () => {
    if (data.finalTranslation.trim().length < 30) {
      toast.error("최종 번역을 30자 이상 작성해주세요");
      return;
    }
    logAction("persona_feedback_request", {
      finalTranslationLength: data.finalTranslation.length,
    });
    update("personaFeedbackReceived", true);
    setRevealedPersonas(0);
    PERSONAS.forEach((_, i) => {
      setTimeout(() => setRevealedPersonas((n) => Math.max(n, i + 1)), i * 300);
    });
  };

  const resetPersonaFeedback = () => {
    setRevealedPersonas(0);
    setTimeout(() => {
      PERSONAS.forEach((_, i) => {
        setTimeout(() => setRevealedPersonas((n) => Math.max(n, i + 1)), i * 300);
      });
    }, 50);
  };

  // 피드백 받은 시점에 피드백 전 최종안 자동 보존
  useEffect(() => {
    if (
      data.personaFeedbackReceived &&
      !data.preFeedbackTranslation &&
      data.finalTranslation.trim().length > 0
    ) {
      setData((d) => ({
        ...d,
        preFeedbackTranslation: d.finalTranslation,
        postFeedbackTranslation: d.postFeedbackTranslation || d.finalTranslation,
      }));
    }
  }, [data.personaFeedbackReceived, data.preFeedbackTranslation, data.finalTranslation]);

  // 검증
  const finalTranslationDone = data.finalTranslation.trim().length > 0;
  const noRevision = data.revisionCase.reason === "수정 사항 없음";
  const revisionDone =
    data.revisionCase.reason !== "" &&
    (noRevision
      ? data.revisionCase.explanation.trim().length > 0
      : data.revisionCase.aiResult.trim().length > 0 &&
        data.revisionCase.myRevision.trim().length > 0);
  const needsRevisionFields =
    data.postFeedbackDecision === "partial" || data.postFeedbackDecision === "full-revision";
  const influenceCount = Object.values(data.personaInfluence).filter(Boolean).length;
  const decisionDone =
    data.postFeedbackDecision !== "" &&
    (!needsRevisionFields ||
      (influenceCount >= 1 && data.postFeedbackTranslation.trim().length > 0)) &&
    data.finalDecisionReason.trim().length > 0;
  const allDone =
    finalTranslationDone &&
    revisionDone &&
    data.personaFeedbackReceived &&
    decisionDone;

  const reasonHelper =
    data.postFeedbackDecision === "as-is"
      ? "왜 피드백을 반영하지 않았는지 설명해주세요"
      : data.postFeedbackDecision === "partial"
        ? "어떤 지적을 어떻게 반영했는지 설명해주세요"
        : data.postFeedbackDecision === "full-revision"
          ? "어떤 방향으로 재작성했는지 설명해주세요"
          : "결정 후 이유를 작성해주세요";

  return (
    <div className="min-h-screen bg-background">
      <WorkflowHeader currentStep={4} />
      

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* 페이지 제목 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold sm:text-3xl">
            최종안 작성 및 멀티-페르소나 피드백
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            두 번역을 참고해 최종 중국어 번역을 작성하고, 세 가지 관점의 피드백을 받습니다
          </p>
        </div>

        {/* A. 컨텍스트 요약 */}
        <section className="mb-10 rounded-lg bg-secondary p-6">
          <button
            type="button"
            onClick={() => setContextOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-sm font-bold">컨텍스트 요약</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {contextOpen ? "접기" : "펼치기"}
              {contextOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          </button>

          {contextOpen && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="font-semibold">화행 / 시나리오: </span>
                  [{speechActLabel}] / {scenarioLabel}
                </div>
                <div>
                  <span className="font-semibold">화행 전략: </span>
                  {strategyLabel}
                </div>
                <div>
                  <span className="font-semibold">P·D·R: </span>
                  권력(P) = {pdr?.powerLevel ?? "-"} / 거리(D) = {pdr?.distanceLevel ?? "-"} / 부담도(R) = {pdr?.burdenLevel ?? "-"}
                </div>
                <div>
                  <span className="font-semibold">의도: </span>
                  {pdr?.intent || "-"}
                </div>
              </div>

              <div>
                <div className="mb-1 font-semibold">한국어 이메일</div>
                <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
                  {koreanEmail || "(없음)"}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 font-semibold">AI 번역 1</div>
                  <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
                    {aiTranslation1 || "(없음)"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 font-semibold">AI 번역 2</div>
                  <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
                    {aiTranslation2 || "(없음)"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* B. 섹션 1 — 최종 번역 작성 */}
        <section className="mb-12">
          <div className="mb-4 flex items-center">
            <h3 className="text-xl font-bold">1. 최종 중국어 번역을 작성하세요</h3>
            <Dot on={finalTranslationDone} />
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            두 AI 번역을 참고해 본인이 판단한 최종 번역을 작성합니다
          </p>

          <div className="grid gap-5 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="mb-2 text-sm font-semibold">한국어 원문</div>
              <div className="min-h-[200px] whitespace-pre-wrap rounded-md border border-border bg-secondary p-4 text-sm">
                {koreanEmail || "(이전 단계에서 작성한 한국어 이메일이 여기에 표시됩니다)"}
              </div>
            </div>
            <div className="md:col-span-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold">최종 중국어 번역</span>
                <span className="text-xs text-muted-foreground">
                  현재 글자수 {data.finalTranslation.length} / {FINAL_TRANSLATION_MAX}
                </span>
              </div>
              <Textarea
                value={data.finalTranslation}
                onChange={(e) =>
                  update("finalTranslation", e.target.value.slice(0, FINAL_TRANSLATION_MAX))
                }
                maxLength={FINAL_TRANSLATION_MAX}
                placeholder="두 AI 번역에서 좋은 부분을 골라 조합하거나, 본인이 직접 수정·재작성하세요"
                className="min-h-[200px] resize-y text-base"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => copyAi(1)}>
                  AI 번역 1 복사하기
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyAi(2)}>
                  AI 번역 2 복사하기
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* C. 섹션 2 — 핵심 수정 사례 */}
        <section className="mb-12">
          <div className="mb-4 flex items-center">
            <h3 className="text-xl font-bold">2. 내가 고친 핵심 표현</h3>
            <Dot on={revisionDone} />
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            AI 번역에서 가장 중요하게 바꾼 표현 1개를 기록하세요. 전체 번역을 다시 설명하지 말고, 핵심 표현 하나만 선택합니다.
          </p>

          <div className="rounded-lg border border-border p-6">
            <div className="space-y-5">
              {!noRevision && (
                <div className="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold">AI 번역 표현</span>
                      <span className="text-xs text-muted-foreground">
                        {data.revisionCase.aiResult.length}/100
                      </span>
                    </div>
                    <Textarea
                      value={data.revisionCase.aiResult}
                      onChange={(e) =>
                        updateRevision("aiResult", e.target.value.slice(0, 100))
                      }
                      placeholder="예: 请您理解"
                      className="min-h-[72px] text-base"
                    />
                  </div>
                  <div
                    aria-hidden
                    className="hidden self-center pt-7 text-xl text-muted-foreground md:block"
                  >
                    →
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold">내가 수정한 표현</span>
                      <span className="text-xs text-muted-foreground">
                        {data.revisionCase.myRevision.length}/100
                      </span>
                    </div>
                    <Textarea
                      value={data.revisionCase.myRevision}
                      onChange={(e) =>
                        updateRevision("myRevision", e.target.value.slice(0, 100))
                      }
                      placeholder="예: 希望我们能继续保持良好的合作关系"
                      className="min-h-[72px] text-base"
                    />
                  </div>
                </div>
              )}
              <div>
                <div className="mb-2 text-sm font-semibold">수정 이유</div>
                <select
                  value={data.revisionCase.reason}
                  onChange={(e) =>
                    updateRevision("reason", e.target.value as RevisionReason)
                  }
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-base"
                >
                  <option value="">수정 이유를 선택하세요</option>
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    {noRevision ? (
                      <>수정하지 않은 이유 <span className="text-muted-foreground">(한 줄)</span></>
                    ) : (
                      <>한 줄 설명 <span className="text-muted-foreground">(선택)</span></>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {data.revisionCase.explanation.length}/200
                  </span>
                </div>
                <Input
                  value={data.revisionCase.explanation}
                  onChange={(e) =>
                    updateRevision("explanation", e.target.value.slice(0, 200))
                  }
                  maxLength={200}
                  placeholder={
                    noRevision
                      ? "예: AI 번역이 화용 전략에 적절히 부합한다고 판단함"
                      : "예: 직접적 거절 표현을 더 완곡하게 조정"
                  }
                  className="text-base"
                />
              </div>
            </div>
          </div>
        </section>

        {/* D. 섹션 3 — 멀티-페르소나 피드백 */}
        <section className="mb-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold">
              3. 세 가지 관점의 멀티 AI 페르소나가 최종안을 검토합니다
            </h3>
            <Dot on={data.personaFeedbackReceived} />
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            각 페르소나는 수신자·교수자·리스크 관점에서 최종 번역을 검토합니다
          </p>

          <div className="mb-5 flex items-start gap-2 rounded-md border border-border bg-secondary p-3 text-[13px]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="leading-relaxed">
              <div className="font-medium">v1 데모 모드 — 사전 작성된 피드백입니다.</div>
              <div className="text-muted-foreground">
                v2에서는 Claude API 연동으로 학습자 입력 기반 실시간 피드백이 생성됩니다.
              </div>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={requestPersonaFeedback}
              disabled={
                data.personaFeedbackReceived ||
                data.finalTranslation.trim().length < 30
              }
              className="h-12 px-6 text-base"
            >
              {data.personaFeedbackReceived
                ? "피드백 받음"
                : "세 가지 관점의 멀티 AI 페르소나 피드백 받기"}
            </Button>
          </div>
          {!data.personaFeedbackReceived &&
            data.finalTranslation.trim().length < 30 && (
              <p className="mb-6 text-xs text-muted-foreground">
                최종 번역을 30자 이상 작성해주세요
              </p>
            )}
          {(data.personaFeedbackReceived ||
            data.finalTranslation.trim().length >= 30) && (
            <div className="mb-6" />
          )}

          {!data.personaFeedbackReceived ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-secondary p-8 text-sm text-muted-foreground">
              위 버튼을 클릭하면 세 가지 관점의 멀티 AI 페르소나가 최종안을 검토합니다
            </div>
          ) : (
            <div className="space-y-5">
              {PERSONAS.map((p, i) =>
                i < revealedPersonas ? (
                  <article
                    key={p.number}
                    className="fade-in rounded-lg border border-border border-t-[3px] bg-secondary p-6"
                    style={{ borderTopColor: PERSONA_COLORS[i] }}
                  >
                    <header className="mb-3 border-b border-border/40 pb-3">
                      <div className="text-[11px] font-medium text-muted-foreground/60">
                        페르소나 {p.number}
                      </div>
                      <div className="mt-1 text-lg font-bold" style={{ color: PERSONA_COLORS[i] }}>{p.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.role}
                      </div>
                    </header>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex gap-2">
                        <dt className="w-12 shrink-0 font-semibold">강점</dt>
                        <dd>{p.strength}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-12 shrink-0 font-semibold">우려</dt>
                        <dd>{p.concern}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-12 shrink-0 font-semibold">제안</dt>
                        <dd>{p.suggestion}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPersonas((s) => ({ ...s, [p.number]: !s[p.number] }))
                      }
                      className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {expandedPersonas[p.number] ? "상세 보기 접기 ▲" : "상세 보기 ▼"}
                    </button>
                    {expandedPersonas[p.number] && (
                      <p className="mt-3 text-sm leading-relaxed">{p.feedback}</p>
                    )}
                  </article>
                ) : (
                  <div
                    key={p.number}
                    className="min-h-[200px] rounded-lg border border-dashed border-border/60 bg-background"
                  />
                ),
              )}
            </div>
          )}
        </section>

        {/* E. 섹션 4 — 피드백 후 의사결정 */}
        <section className="mb-12">
          <div className="mb-4 flex items-center">
            <h3 className="text-xl font-bold">4. 피드백을 반영해 최종안을 확정합니다</h3>
            <Dot on={decisionDone} />
          </div>

          {/* 블록 1: 피드백 전 최종안 (잠금) */}
          <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4">
            <div className="mb-1 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">피드백 전 최종안 (자동 보존됨)</div>
                <div className="text-xs text-muted-foreground">
                  섹션 1에서 작성한 번역이 자동으로 저장되었습니다
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden /> 보존됨
              </span>
            </div>
            <Textarea
              value={data.preFeedbackTranslation || data.finalTranslation}
              readOnly
              className="mt-2 min-h-[120px] resize-none bg-background text-sm text-muted-foreground"
            />
          </div>

          {/* 블록 2: 의사결정 라디오 */}
          <div className="mb-6">
            <div className="mb-3 text-sm font-semibold">
              피드백을 검토하고 어떻게 결정하시겠습니까?
            </div>
            <div className="space-y-3">
              {DECISION_OPTIONS.map((opt) => {
                const active = data.postFeedbackDecision === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                      active
                        ? "border-foreground bg-accent/10"
                        : "border-border hover:bg-secondary",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="postFeedbackDecision"
                      className="mt-1 h-4 w-4 accent-foreground"
                      checked={active}
                      onChange={() => {
                        logAction("final_decision", {
                          decision: opt.value,
                          revisionReason: data.revisionCase.reason,
                        });
                        update("postFeedbackDecision", opt.value);
                      }}
                    />
                    <div>
                      <div className="text-base font-semibold">{opt.label}</div>
                      <div className="text-sm text-muted-foreground">{opt.sub}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 블록 3 + 4: 조건부 표시 */}
          {needsRevisionFields && (
            <>
              <div className="mb-6">
                <div className="mb-1 text-sm font-semibold">
                  어느 페르소나의 지적을 반영하시겠습니까? (복수 선택 가능)
                </div>
                <div className="mb-3 text-xs text-muted-foreground">
                  선택한 페르소나의 지적이 수정에 반영되었음을 기록합니다
                </div>
                <div className="space-y-2">
                  {PERSONAS.map((p) => {
                    const key = `persona${p.number}` as keyof PersonaInfluence;
                    const checked = data.personaInfluence[key];
                    return (
                      <label
                        key={p.number}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-secondary"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-foreground"
                          checked={checked}
                          onChange={(e) =>
                            update("personaInfluence", {
                              ...data.personaInfluence,
                              [key]: e.target.checked,
                            })
                          }
                        />
                        <span className="text-sm">
                          페르소나 {p.number} — {p.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">피드백 후 수정안</span>
                  <span className="text-xs text-muted-foreground">
                    현재 글자수 {data.postFeedbackTranslation.length} / {FINAL_TRANSLATION_MAX}
                  </span>
                </div>
                <Textarea
                  value={data.postFeedbackTranslation}
                  onChange={(e) =>
                    update(
                      "postFeedbackTranslation",
                      e.target.value.slice(0, FINAL_TRANSLATION_MAX),
                    )
                  }
                  maxLength={FINAL_TRANSLATION_MAX}
                  placeholder="피드백을 반영해 수정한 번역을 입력하세요"
                  className="min-h-[140px] resize-y text-base"
                />
              </div>
            </>
          )}

          {/* 블록 5: 유지/수정 이유 */}
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">유지/수정 이유</span>
              <span className="text-xs text-muted-foreground">
                현재 글자수 {data.finalDecisionReason.length} / {DECISION_REASON_MAX}
              </span>
            </div>
            <div className="mb-2 text-xs text-muted-foreground">{reasonHelper}</div>
            <Textarea
              value={data.finalDecisionReason}
              onChange={(e) =>
                update("finalDecisionReason", e.target.value.slice(0, DECISION_REASON_MAX))
              }
              maxLength={DECISION_REASON_MAX}
              placeholder="결정의 이유를 200자 이내로 설명해주세요"
              className="min-h-[100px] text-base"
            />
          </div>
        </section>

        {/* F. 하단 */}
        <div className="border-t border-border pt-8">
          {!allDone && (
            <p className="mb-3 text-right text-xs text-muted-foreground">
              최종 번역 · 수정 사례 · 페르소나 피드백 · 최종 확정 선택을 모두 완료하면 다음 단계로 이동할 수 있습니다
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Rollback currentStep={4} />
            <Button
              size="lg"
              disabled={!allDone}
              onClick={() => navigate("/dashboard")}
              className="h-12 px-8 text-base"
            >
              의사결정 리포트 보기 →
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
