import { useEffect, useState } from "react";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";

type ActId = "request" | "refusal";
const ACT_STORAGE_KEY = "step1-speech-act";

const ACTS: { id: ActId; title: string; desc: string }[] = [
  { id: "request", title: "요청 상황", desc: "K-pop 온라인 팬 이벤트 페이지 일정 연장 요청" },
  { id: "refusal", title: "거절 상황", desc: "K-pop 디지털 캠페인 단가 인하 요청 거절" },
];

const SCENARIO_DETAIL: Record<ActId, string[]> = {
  request: [
    "당신은 한국의 엔터테인먼트 테크 스타트업에서 글로벌 프로젝트를 담당하고 있습니다. 귀사는 K-pop 아티스트의 온라인 팬 이벤트 페이지와 참여 기능을 개발하여 중국의 대형 콘텐츠 플랫폼에 제공하기로 했습니다.",
    "상대는 중국 대형 콘텐츠 플랫폼의 콘텐츠 제휴팀장입니다. 이 플랫폼은 중국 내 공개 일정과 프로모션 편성을 결정하는 쪽이며, 귀사와는 이번이 첫 공식 협업입니다. 지금까지는 공식 이메일과 화상회의로만 소통했습니다.",
    "원래 이번 주 금요일까지 최종 페이지 파일을 전달해야 하지만, 베타 테스트 과정에서 팬 인증 기능과 결제 연동 기능에 수정이 필요한 문제가 발견되었습니다. 최종 파일 전달을 10일 정도 연장해 달라고 요청해야 합니다.",
    "이미 중국 플랫폼 쪽에서는 사전 홍보 일정과 공개 일정을 잡아 둔 상태이므로, 이 요청은 상대에게 부담이 큽니다.",
  ],
  refusal: [
    "당신은 한국 엔터테인먼트 IP 회사의 글로벌 마케팅 담당자입니다. 귀사는 중국 현지 프로모션 에이전시와 함께 K-pop 아티스트의 디지털 캠페인을 준비하고 있습니다.",
    "상대는 중국 에이전시의 캠페인 운영 담당자입니다. 직급은 당신과 비슷하지만, 중국 현지 플랫폼 운영과 광고 집행을 조율하는 실무 파트너이기 때문에 향후 캠페인 진행에 영향력이 있습니다.",
    "양사는 지난 캠페인에서 한 차례 협업한 적이 있고, 이번 캠페인 준비 과정에서도 메신저와 이메일로 몇 차례 소통했습니다. 다만 오래된 거래처나 개인적으로 가까운 사이는 아니며, 기본적으로 업무상 예의를 지켜야 하는 관계입니다.",
    "상대가 다음 달 디지털 캠페인의 IP 사용료와 제작 지원비를 20% 낮춰 달라고 요청했습니다. 내부 검토 결과, 아티스트 IP 계약 기준과 제작 비용 구조상 이번 캠페인에는 단가 인하를 적용하기 어렵습니다.",
    "상대와의 협업 관계는 유지해야 하지만, 이번 요청은 분명하게 거절해야 합니다.",
  ],
};

const SOURCE_TEXT: Record<ActId, string> = {
  request:
    "안녕하십니까. 이번 온라인 팬 이벤트 페이지 개발 건과 관련하여 부득이하게 일정 조정을 요청드리고자 합니다. 베타 테스트 과정에서 팬 인증 기능과 결제 연동 기능에 추가 수정이 필요한 문제가 확인되어, 당초 이번 주 금요일로 예정된 최종 파일 전달 일정을 10일 정도 연장해 주실 수 있을지 검토 부탁드립니다. 귀사의 공개 일정과 사전 홍보에 부담을 드릴 수 있다는 점을 잘 알고 있으며, 수정 범위와 임시 대응 방안을 함께 공유드리겠습니다.",
  refusal:
    "안녕하세요. 보내주신 다음 달 디지털 캠페인 단가 조정 요청은 내부적으로 검토했습니다. 요청하신 20% 인하는 현재 아티스트 IP 계약 기준과 제작 비용 구조상 이번 캠페인에는 적용하기 어렵습니다. 다만 콘텐츠 제공 범위, 노출 기간, 결제 일정 등 단가 외의 조건은 조정 가능한지 함께 검토하고 싶습니다. 이번 건은 양해 부탁드리며, 이후 캠페인에서도 현실적인 협력 방안을 계속 논의하겠습니다.",
};

const QUESTIONS: { id: "q1" | "q2" | "q3"; label: string; options: string[] }[] = [
  {
    id: "q1",
    label: "1. 이 상황에서 상대방은 나와 비교해 어떤 위치에 있다고 느껴지나요?",
    options: [
      "상대가 나보다 더 큰 결정권이나 영향력을 가진다",
      "상대와 나는 비슷한 위치에 있다",
      "상대는 나보다 결정권이나 영향력이 작다",
    ],
  },
  {
    id: "q2",
    label: "2. 상대방과의 관계는 얼마나 가깝거나 멀다고 느껴지나요?",
    options: [
      "처음이거나 매우 격식 있는 관계이다",
      "업무상 몇 차례 소통했지만 친밀하지는 않다",
      "자주 소통하고 비교적 가까운 관계이다",
    ],
  },
  {
    id: "q3",
    label: "3. 이 요청 또는 거절은 상대방에게 어느 정도 부담이 된다고 느껴지나요?",
    options: [
      "상대의 일정, 비용, 계획에 큰 영향을 줄 수 있다",
      "어느 정도 조정이 필요하지만 감당 가능한 수준이다",
      "부담이 크지 않은 간단한 요청 또는 거절이다",
    ],
  },
];

type Answers = { q1: number | null; q2: number | null; q3: number | null };
const EMPTY: Answers = { q1: null, q2: null, q3: null };

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
    {children}
  </div>
);

const ScenarioSelect = () => {
  const [selected, setSelected] = useState<ActId | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY);

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/scenario" }, "/scenario");
    try {
      const saved = localStorage.getItem(ACT_STORAGE_KEY);
      if (saved === "request" || saved === "refusal") setSelected(saved);
    } catch { /* ignore */ }
  }, []);

  const handleSelect = (id: ActId) => {
    if (selected === id) return;
    logAction(selected ? "revision" : "selection", {
      field: "speechAct",
      ...(selected ? { oldValue: selected, newValue: id } : { value: id }),
    });
    setSelected(id);
    setAnswers(EMPTY);
    try { localStorage.setItem(ACT_STORAGE_KEY, id); } catch { /* ignore */ }
  };

  const setAnswer = (q: "q1" | "q2" | "q3", idx: number) => {
    setAnswers((prev) => ({ ...prev, [q]: idx }));
    logAction("selection", { field: q, value: idx });
  };

  const allAnswered = answers.q1 !== null && answers.q2 !== null && answers.q3 !== null;
  const canProceed = Boolean(selected) && allAnswered;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={1} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">상황 이해</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          오늘 연습할 상황을 고르고, 이 상황을 어떻게 느꼈는지 알려주세요.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ACTS.map((act) => {
            const isSel = selected === act.id;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => handleSelect(act.id)}
                aria-pressed={isSel}
                aria-expanded={isSel}
                className={[
                  "rounded-lg p-6 text-left transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  isSel
                    ? "border-2 border-[#E5C97A] bg-[#FAF1D7] text-[#1D2230] font-bold"
                    : "border border-foreground bg-background hover:-translate-y-0.5 hover:shadow-md",
                ].join(" ")}
              >
                <div className="text-xl font-bold">{act.title}</div>
                <div className="mt-2 text-sm text-foreground">{act.desc}</div>
              </button>
            );
          })}
        </div>

        {selected && (
          <section key={selected} className="fade-in mt-6 space-y-6">
            {/* Block 1: scenario detail */}
            <div className="rounded-lg border border-foreground/30 bg-[#FAF7EC] p-6">
              <SectionLabel>이 상황을 읽어주세요</SectionLabel>
              <div className="space-y-3 text-[15px] leading-relaxed text-foreground">
                {SCENARIO_DETAIL[selected].map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>

            {/* Block 2: source text — visually distinct */}
            <div className="rounded-lg border-2 border-foreground bg-background p-6 shadow-sm">
              <SectionLabel>번역해야 할 한국어 원문</SectionLabel>
              <p className="text-[16px] leading-relaxed text-foreground">
                {SOURCE_TEXT[selected]}
              </p>
            </div>

            {/* Block 3: situation judgment */}
            <div className="rounded-lg border border-foreground/30 bg-[#FAF7EC] p-6">
              <SectionLabel>상황을 읽고, 본인이 느낀 그대로 골라주세요</SectionLabel>

              <div className="mt-2 space-y-6">
                {QUESTIONS.map((q) => (
                  <fieldset key={q.id}>
                    <legend className="text-sm font-semibold text-foreground">{q.label}</legend>
                    <div className="mt-3 space-y-2">
                      {q.options.map((opt, idx) => {
                        const checked = answers[q.id] === idx;
                        return (
                          <label
                            key={idx}
                            className={[
                              "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors",
                              checked
                                ? "border-[#E5C97A] bg-[#FAF1D7]"
                                : "border-foreground/20 bg-background hover:bg-muted/40",
                            ].join(" ")}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              className="mt-0.5 accent-[#E8C547]"
                              checked={checked}
                              onChange={() => setAnswer(q.id, idx)}
                            />
                            <span className="leading-snug">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>

              <p className="mt-5 text-xs text-muted-foreground">
                정답이 있는 질문이 아닙니다. 본인이 상황을 어떻게 받아들였는지 그대로 골라주세요.
              </p>
            </div>
          </section>
        )}

        <div className="mt-12 flex justify-end border-t border-border pt-6">
          <button
            type="button"
            disabled={!canProceed}
            className={[
              "rounded-lg px-6 py-3 text-base font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              canProceed
                ? "bg-[#E8C547] text-[#1D2230] hover:brightness-95"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            ].join(" ")}
          >
            번역안 비교하기 →
          </button>
        </div>
      </main>
    </div>
  );
};

export default ScenarioSelect;
