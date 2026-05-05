import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { Rollback } from "@/components/Rollback";
import { ensureSession, logAction } from "@/lib/tracking";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

const NO_REVISION: RevisionReason = "수정 사항 없음";

interface RevisionCase {
  aiResult: string;
  myRevision: string;
  reason: RevisionReason | "";
  explanation: string;
}

type FinalDecision = "그대로 확정" | "수정 후 확정" | "";

interface FinalizeData {
  finalTranslation: string;
  revisionCase: RevisionCase;
  personaFeedbackReceived: boolean;
  finalDecision: FinalDecision;
  finalDecisionReason: string;
}

const EMPTY: FinalizeData = {
  finalTranslation: "",
  revisionCase: { aiResult: "", myRevision: "", reason: "", explanation: "" },
  personaFeedbackReceived: false,
  finalDecision: "",
  finalDecisionReason: "",
};

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
    name: "중국 비즈니스 상대방",
    role: "이 이메일을 받은 중국인 거래처의 시점",
    feedback:
      "전반적으로 정중한 어조로 잘 작성되었습니다. 다만 '请您理解' 표현은 다소 형식적으로 느껴질 수 있습니다. 중국 비즈니스 관계에서는 '希望我们能继续保持良好的合作关系'와 같이 관계 지속에 대한 명시적 표현이 신뢰를 더 쌓을 수 있습니다. 첫 거래 관계임을 고려할 때, 다음 미팅 가능성을 언급하면 더욱 좋습니다.",
    strength: "정중한 거절 어조 유지",
    concern: "관계 지속 표현이 약함",
    suggestion: "구체적 후속 제안 추가",
  },
  {
    number: 2,
    name: "한국 발신자(나) 입장",
    role: "내가 의도한 메시지가 잘 전달되는지의 시점",
    feedback:
      "원문의 거절 의도는 명확히 전달되었습니다. 다만 '我们暂时无法接受' 표현은 원문의 '검토 후 어렵다고 판단'보다 강한 거절로 들릴 수 있습니다. 본인이 의도한 '여지를 남기는 거절'에 가까운 표현으로는 '目前阶段不太适合'와 같은 완곡 표현이 더 적합할 수 있습니다.",
    strength: "의도 명확 전달",
    concern: "거절 강도가 원문보다 강함",
    suggestion: "완곡 표현으로 조정",
  },
  {
    number: 3,
    name: "통번역 교수자",
    role: "교육적 관점에서 번역 기법을 분석",
    feedback:
      "본 번역은 화행 전략 '대안 제시 거절형'에 적절히 부합합니다. 어휘 선택은 비즈니스 격식체로 일관되게 유지되었고, 문장 구조도 중국어 자연스러움에 맞게 재구성되었습니다. 다만 P·D·R 분석에서 '거리: 멂'으로 설정한 점을 고려하면, 호칭 표현에 '贵公司' 사용이 더 적절합니다.",
    strength: "화행 전략 부합도 높음",
    concern: "호칭 표현 미세 조정 필요",
    suggestion: "공식 호칭 강화",
  },
  {
    number: 4,
    name: "비즈니스 리스크 관리자",
    role: "이 이메일이 가져올 잠재적 위험 분석",
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
    update("finalTranslation", txt);
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

  // 검증
  const noRevision = data.revisionCase.reason === NO_REVISION;
  const finalTranslationDone = data.finalTranslation.trim().length > 0;
  const revisionDone =
    data.revisionCase.aiResult.trim().length > 0 &&
    data.revisionCase.reason !== "" &&
    (noRevision || data.revisionCase.myRevision.trim().length > 0);
  const decisionDone = data.finalDecision !== "";
  const allDone =
    finalTranslationDone &&
    revisionDone &&
    data.personaFeedbackReceived &&
    decisionDone;

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
            두 번역을 참고해 최종 중국어 번역을 작성하고, 4개 관점의 피드백을 받습니다
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
                  {data.finalTranslation.length}자
                </span>
              </div>
              <Textarea
                value={data.finalTranslation}
                onChange={(e) => update("finalTranslation", e.target.value)}
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
            <h3 className="text-xl font-bold">2. 핵심 수정 사례 작성</h3>
            <Dot on={revisionDone} />
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            AI 번역에서 가장 중요하게 수정한 부분 1개를 기록합니다
          </p>

          <div className="rounded-lg border border-border p-6">
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">AI 번역 결과</span>
                  <span className="text-xs text-muted-foreground">
                    {data.revisionCase.aiResult.length}/100
                  </span>
                </div>
                <Textarea
                  value={data.revisionCase.aiResult}
                  onChange={(e) =>
                    updateRevision("aiResult", e.target.value.slice(0, 100))
                  }
                  placeholder="AI 번역에서 수정한 부분을 발췌"
                  className="min-h-[80px] text-base"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">내가 수정한 부분</span>
                  <span className="text-xs text-muted-foreground">
                    {data.revisionCase.myRevision.length}/100
                  </span>
                </div>
                <Textarea
                  value={data.revisionCase.myRevision}
                  onChange={(e) =>
                    updateRevision("myRevision", e.target.value.slice(0, 100))
                  }
                  disabled={noRevision}
                  placeholder={
                    noRevision
                      ? "AI 번역 2를 그대로 채택"
                      : "내가 어떻게 수정했는지"
                  }
                  className={[
                    "min-h-[80px] text-base",
                    noRevision ? "bg-muted text-muted-foreground" : "",
                  ].join(" ")}
                />
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold">수정 이유</div>
                <select
                  value={data.revisionCase.reason}
                  onChange={(e) =>
                    updateRevision("reason", e.target.value as RevisionReason)
                  }
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-base"
                >
                  <option value="">선택하세요</option>
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
                    추가 설명 <span className="text-muted-foreground">(선택)</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {data.revisionCase.explanation.length}/200
                  </span>
                </div>
                <Textarea
                  value={data.revisionCase.explanation}
                  onChange={(e) =>
                    updateRevision("explanation", e.target.value.slice(0, 200))
                  }
                  disabled={noRevision}
                  placeholder={
                    noRevision
                      ? "AI 번역 2를 그대로 채택"
                      : "필요하면 더 자세히 설명해주세요"
                  }
                  className={[
                    "min-h-[80px] text-base",
                    noRevision ? "bg-muted text-muted-foreground" : "",
                  ].join(" ")}
                />
              </div>
            </div>
          </div>
        </section>

        {/* D. 섹션 3 — 멀티-페르소나 피드백 */}
        <section className="mb-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold">
              3. 4명의 가상 평가자가 본인의 최종안을 평가합니다
            </h3>
            <Dot on={data.personaFeedbackReceived} />
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            각 평가자는 다른 관점에서 본인의 번역을 분석합니다
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
                : "멀티-페르소나 피드백 받기"}
            </Button>
            {data.personaFeedbackReceived && (
              <Button variant="outline" size="sm" onClick={resetPersonaFeedback}>
                다시 받기
              </Button>
            )}
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
              위 버튼을 클릭하면 4명의 가상 평가자가 본인의 번역을 분석합니다
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {PERSONAS.map((p, i) =>
                i < revealedPersonas ? (
                  <article
                    key={p.number}
                    className="fade-in rounded-lg border border-border bg-secondary p-6"
                  >
                    <header className="mb-3 border-b border-border/40 pb-3">
                      <div className="text-xs font-semibold text-muted-foreground">
                        페르소나 {p.number}
                      </div>
                      <div className="mt-1 text-base font-bold">{p.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.role}
                      </div>
                    </header>
                    <p className="mb-4 text-sm leading-relaxed">{p.feedback}</p>
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
                  </article>
                ) : (
                  <div
                    key={p.number}
                    className="min-h-[260px] rounded-lg border border-dashed border-border/60 bg-background"
                  />
                ),
              )}
            </div>
          )}
        </section>

        {/* E. 섹션 4 — 최종 확정 */}
        <section className="mb-12">
          <div className="mb-4 flex items-center">
            <h3 className="text-xl font-bold">4. 피드백을 반영해 최종안을 확정합니다</h3>
            <Dot on={decisionDone} />
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            필요 시 위 최종안 텍스트 영역을 수정하거나 그대로 확정합니다
          </p>

          <div className="space-y-3">
            {(["그대로 확정", "수정 후 확정"] as const).map((opt) => {
              const active = data.finalDecision === opt;
              return (
                <label
                  key={opt}
                  className={[
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                    active
                      ? "border-foreground bg-accent/10"
                      : "border-border hover:bg-secondary",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="finalDecision"
                    className="mt-1 h-4 w-4 accent-foreground"
                    checked={active}
                    onChange={() => {
                      logAction("final_decision", {
                        decision: opt,
                        revisionReason: data.revisionCase.reason,
                      });
                      update("finalDecision", opt);
                    }}
                  />
                  <div>
                    <div className="text-base font-semibold">{opt}</div>
                    <div className="text-sm text-muted-foreground">
                      {opt === "그대로 확정"
                        ? "피드백을 받았지만 최종안을 그대로 유지합니다"
                        : "위 최종 번역 텍스트 영역을 수정한 후 확정합니다"}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">유지/수정 이유</span>
              <span className="text-xs text-muted-foreground">
                {data.finalDecisionReason.length}/200
              </span>
            </div>
            <Textarea
              value={data.finalDecisionReason}
              onChange={(e) =>
                update("finalDecisionReason", e.target.value.slice(0, 200))
              }
              placeholder="왜 그대로 확정 / 수정했는지 간단히 설명"
              className="min-h-[80px] text-base"
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
