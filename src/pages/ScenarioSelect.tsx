import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { isDemoMode } from "@/lib/demo";
import { toast } from "sonner";

type ActId = "request" | "refusal";
const ACT_STORAGE_KEY = "step1-speech-act";
const STEP1_ANSWERS_KEY = "step1-answers";
const BODY_OPEN_KEY = "step1-body-open";

type LibItem = {
  sector: string;
  title: string;
  desc: string;
  available: boolean;
};

const LIBRARY: Record<ActId, LibItem[]> = {
  request: [
    { sector: "엔터콘텐츠", title: "팬 이벤트 자료 전달 일정 연장", desc: "K-pop 팬 이벤트 자료 전달 일정을 늦춰 달라고 요청합니다.", available: true },
    { sector: "뷰티산업", title: "상세페이지 문구 재검토", desc: "중국어 제품 설명 문구를 한 번 더 검토해 달라고 요청합니다.", available: false },
    { sector: "게임산업", title: "이벤트 공지 일정 조정", desc: "중국 서버 이벤트 공지 공개 일정을 조정해 달라고 요청합니다.", available: false },
    { sector: "이커머스", title: "상품 이미지 추가 제공", desc: "중국 라이브커머스용 상품 이미지를 추가로 제공해 달라고 요청합니다.", available: false },
    { sector: "기업실무", title: "회의 자료 수정", desc: "중국 협력사와의 회의 자료 일부 수정을 요청합니다.", available: false },
    { sector: "테크산업", title: "앱 화면 문구 수정 요청", desc: "중국 사용자용 앱 화면에 들어갈 안내 문구 수정을 요청합니다.", available: false },
  ],
  refusal: [
    { sector: "엔터콘텐츠", title: "공동 프로모션 비용 인하 거절", desc: "공동 프로모션 비용 인하가 어렵다고 답합니다.", available: true },
    { sector: "뷰티산업", title: "샘플 물량 추가 제공 거절", desc: "신제품 샘플 물량 추가 제공이 어렵다고 답합니다.", available: false },
    { sector: "게임산업", title: "이벤트 보상 확대 거절", desc: "이벤트 보상 확대 요청을 수용하기 어렵다고 답합니다.", available: false },
    { sector: "이커머스", title: "배송 일정 앞당기기 거절", desc: "상품 배송 일정을 앞당기기 어렵다고 답합니다.", available: false },
    { sector: "기업실무", title: "회의 일정 앞당기기 거절", desc: "중국 협력사의 회의 일정 앞당기기 요청을 수용하기 어렵다고 답합니다.", available: false },
    { sector: "테크산업", title: "기능 추가 요청 거절", desc: "중국 파트너사의 앱 기능 추가 요청을 수용하기 어렵다고 답합니다.", available: false },
  ],
};

const ACTS: { id: ActId; title: string; desc: string }[] = [
  { id: "request", title: "요청 상황", desc: "K-pop 팬 이벤트 자료 전달 일정 연장 요청" },
  { id: "refusal", title: "거절 상황", desc: "K-pop 팬 이벤트 공동 프로모션 비용 인하 요청 거절" },
];

const SCENARIO_DETAIL: Record<ActId, string[]> = {
  request: [
    "당신은 한국 엔터테인먼트 기획사의 해외사업팀 직원입니다.",
    "중국 대형 콘텐츠 플랫폼에 K-pop 아티스트 온라인 팬 이벤트 페이지 자료를 이번 주 금요일까지 전달하기로 했지만, 아티스트 측 최종 확인이 늦어져 일정 연장이 필요합니다.",
    "상대는 처음 공식 협업하는 중국 플랫폼 담당자이며, 일정 연장은 상대의 공개 일정에 부담이 될 수 있습니다.",
  ],
  refusal: [
    "당신은 한국 엔터테인먼트 기획사의 해외사업팀 직원입니다.",
    "중국 콘텐츠 플랫폼 담당자가 K-pop 아티스트 온라인 팬 이벤트 공동 프로모션 비용을 낮춰 달라고 요청했습니다.",
    "상대와는 여러 번 연락해 온 실무 관계이지만, 내부 검토 결과 이번에는 비용 인하가 어렵다는 답변을 보내야 합니다.",
  ],
};

const KEY_INFO: Record<ActId, { label: string; value: string }[]> = {
  request: [
    { label: "나의 역할", value: "한국 엔터테인먼트 기획사 해외사업팀 직원" },
    { label: "상대", value: "중국 대형 콘텐츠 플랫폼 담당자" },
    { label: "관계", value: "첫 공식 협업, 격식 있는 관계" },
    { label: "해야 할 일", value: "K-pop 팬 이벤트 페이지 자료 전달 일정 연장 요청" },
    { label: "부담도", value: "상대의 공개 일정에 부담 있음" },
  ],
  refusal: [
    { label: "나의 역할", value: "한국 엔터테인먼트 기획사 해외사업팀 직원" },
    { label: "상대", value: "중국 콘텐츠 플랫폼 실무 담당자" },
    { label: "관계", value: "여러 번 연락해 온 실무 관계" },
    { label: "해야 할 일", value: "공동 프로모션 비용 인하 요청 거절" },
    { label: "부담도", value: "비용 문제라 민감함" },
  ],
};

const SOURCE_TEXT: Record<ActId, string> = {
  request: "이번 자료 전달 일정을 10일 정도 연장해 주실 수 있을지 검토 부탁드립니다.",
  refusal: "검토해 봤는데 이번에는 프로모션 비용 인하가 어려울 것 같습니다.",
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
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [selected, setSelected] = useState<ActId | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [bodyOpen, setBodyOpen] = useState<boolean>(false);

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/scenario" }, "/scenario");
    try {
      const saved = localStorage.getItem(ACT_STORAGE_KEY);
      if (saved === "request" || saved === "refusal") setSelected(saved);
      const a = localStorage.getItem(STEP1_ANSWERS_KEY);
      if (a) {
        const parsed = JSON.parse(a) as Partial<Answers>;
        setAnswers({
          q1: typeof parsed.q1 === "number" ? parsed.q1 : null,
          q2: typeof parsed.q2 === "number" ? parsed.q2 : null,
          q3: typeof parsed.q3 === "number" ? parsed.q3 : null,
        });
      }
      const b = localStorage.getItem(BODY_OPEN_KEY);
      if (b === "1") setBodyOpen(true);
    } catch { /* ignore */ }
  }, []);

  const handleSelect = (id: ActId) => {
    if (demo) return;
    if (selected === id) return;
    logAction(selected ? "revision" : "selection", {
      field: "speechAct",
      ...(selected ? { oldValue: selected, newValue: id } : { value: id }),
    });
    setSelected(id);
    setAnswers(EMPTY);
    setBodyOpen(false);
    try { localStorage.setItem(ACT_STORAGE_KEY, id); } catch { /* ignore */ }
    try { localStorage.setItem(STEP1_ANSWERS_KEY, JSON.stringify(EMPTY)); } catch { /* ignore */ }
    try { localStorage.setItem(BODY_OPEN_KEY, "0"); } catch { /* ignore */ }
  };

  const openBody = () => {
    setBodyOpen(true);
    try { localStorage.setItem(BODY_OPEN_KEY, "1"); } catch { /* ignore */ }
    logAction("selection", { field: "libraryScenario", value: "available" });
  };

  const handleLibraryClick = (item: LibItem) => {
    if (demo) {
      toast("데모 모드에서는 미리보기만 가능합니다. 시나리오를 직접 체험하려면 학습 모드로 진입해 주세요.");
      return;
    }
    if (item.available) {
      openBody();
    } else {
      toast("이 시나리오는 수업용 확장 버전에서 제공될 예정입니다.");
    }
  };

  const setAnswer = (q: "q1" | "q2" | "q3", idx: number) => {
    if (demo) return;
    setAnswers((prev) => {
      const next = { ...prev, [q]: idx };
      try { localStorage.setItem(STEP1_ANSWERS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    logAction("selection", { field: q, value: idx });
  };

  const allAnswered = answers.q1 !== null && answers.q2 !== null && answers.q3 !== null;
  const canProceed = demo || (Boolean(selected) && bodyOpen && allAnswered);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={1} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">상황 판단</h1>
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
                disabled={demo}
                className={[
                  "rounded-lg p-6 text-left transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  isSel
                    ? "border-2 border-[#15202B] bg-[#FFFFFF] text-[#15202B] font-bold"
                    : "border border-foreground bg-background hover:-translate-y-0.5 hover:shadow-md",
                  demo ? "cursor-default" : "",
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
            <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6">
                <SectionLabel>상황 설정 라이브러리</SectionLabel>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  현재 시연에서는 요청 1개와 거절 1개를 체험할 수 있습니다. 향후 수업용 버전에서는 다양한 산업과 업무 상황으로 확장할 수 있습니다.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {LIBRARY[selected].map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleLibraryClick(item)}
                      className={[
                        "flex flex-col gap-2 rounded-lg p-4 text-left transition-all duration-200",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                        item.available
                          ? "border-[1.5px] border-[#15202B] bg-[#FFFFFF] hover:-translate-y-0.5 hover:shadow-md"
                          : "border-[0.5px] border-[#D3D1C7] bg-[#F5F3EC] hover:bg-[#EFEDE5]",
                      ].join(" ")}
                    >
                      <span className="text-xs font-medium text-muted-foreground">{item.sector}</span>
                      <span className="text-[15px] font-semibold leading-snug text-[#15202B]">{item.title}</span>
                      <span className="text-xs leading-relaxed text-foreground/80">{item.desc}</span>
                      <span
                        className={[
                          "mt-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          item.available
                            ? "bg-[#FAD338] text-[#15202B]"
                            : "border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] text-[#5C6A7A]",
                        ].join(" ")}
                      >
                        {item.available ? "체험 가능" : "수업용 확장 예정"}
                      </span>
                    </button>
                  ))}
                </div>
            </div>

            {(demo || bodyOpen) && (<>
            {/* Block 1: scenario detail */}
            <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6">
              <SectionLabel>이 상황을 읽어주세요</SectionLabel>
              <div className="space-y-3 text-[15px] leading-relaxed text-foreground">
                {SCENARIO_DETAIL[selected].map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>

            {/* Key info */}
            <div className="rounded-lg border border-foreground/30 bg-background p-6">
              <SectionLabel>핵심 정보</SectionLabel>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {KEY_INFO[selected].map((item, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Block 2: source text — most visually prominent */}
            <div className="rounded-lg border-2 border-[#15202B] bg-[#FFFFFF] p-6 shadow-sm">
              <SectionLabel>번역해야 할 한국어 원문</SectionLabel>
              <p className="text-[18px] font-semibold leading-relaxed text-[#15202B]">
                {SOURCE_TEXT[selected]}
              </p>
            </div>

            {/* Block 3: situation judgment */}
            <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6">
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
                              "flex cursor-pointer items-start gap-3 rounded-md p-3 text-sm transition-colors text-[#15202B]",
                              checked
                                ? "border-[1.5px] border-[#15202B] bg-[#EEF2F7] font-medium"
                                : "border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] font-normal hover:bg-muted/30",
                            ].join(" ")}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              className="mt-0.5 h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-[#B4B2A9] bg-white checked:border-[#15202B] checked:bg-[radial-gradient(circle,_#FAD338_0_3.5px,_transparent_3.5px)]"
                              checked={checked}
                              disabled={demo}
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
            </>)}
          </section>
        )}

        <div className="mt-12 flex justify-end border-t border-border pt-6">
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => canProceed && navigate("/pdr")}
            className={[
              "rounded-lg px-6 py-3 text-base font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              canProceed
                ? "bg-[#FAD338] text-[#15202B] hover:bg-[#E8B91F]"
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
