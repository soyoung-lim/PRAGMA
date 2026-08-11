import { useMemo, useState } from "react";
import { Check, ChevronLeft, Clock3, FlaskConical, MessageSquareText } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type PilotStep = "intro" | "profile" | "mission" | "survey" | "done";
type ExitMode = "completed" | "stopped";

const STEP_ORDER: PilotStep[] = ["intro", "profile", "mission", "survey", "done"];
const FLOW_STEPS = [
  { id: "profile", label: "프로필" },
  { id: "mission", label: "학습 미션" },
  { id: "survey", label: "마무리 설문" },
] as const;

const LEVEL_OPTIONS = [
  { value: "beginner", label: "입문", detail: "간단한 중국어 문장을 이해할 수 있어요." },
  { value: "intermediate", label: "중급", detail: "일상적인 대화와 글을 대체로 이해해요." },
  { value: "advanced", label: "고급", detail: "복잡한 표현도 비교적 자연스럽게 이해해요." },
];

const EXPERIENCE_OPTIONS = [
  { value: "none", label: "거의 없음" },
  { value: "some", label: "수업이나 과제로 해 본 적 있음" },
  { value: "frequent", label: "정기적으로 학습하거나 수행함" },
];

const SURVEY_ITEMS = [
  { id: "clarity", label: "안내가 명확했다." },
  { id: "navigation", label: "단계 이동과 조작이 쉬웠다." },
  { id: "feedback", label: "AI 피드백을 이해할 수 있었다." },
  { id: "length", label: "미션 길이가 적절했다." },
  { id: "reuse", label: "이와 같은 미션을 다시 사용해 보고 싶다." },
] as const;

const SCALE_LABELS = ["전혀 아니다", "아니다", "보통이다", "그렇다", "매우 그렇다"];
const FRICTION_OPTIONS = ["프로필 입력", "표현 판단", "번역문 작성", "AI 피드백 확인", "답안 다듬기", "어려움 없음"];

const surface = "rounded-2xl border border-[#DED8C8] bg-white shadow-[0_18px_50px_rgba(21,32,43,0.06)]";

function PilotProgress({ step, exitMode }: { step: PilotStep; exitMode: ExitMode }) {
  const activeId = step === "intro" ? "profile" : step === "done" ? "survey" : step;
  const activeIndex = FLOW_STEPS.findIndex((item) => item.id === activeId);

  return (
    <div aria-label="파일럿 진행 단계" className="grid grid-cols-3 gap-2">
      {FLOW_STEPS.map((item, index) => {
        const done =
          (step === "done" || index < activeIndex) &&
          !(exitMode === "stopped" && item.id === "mission");
        const active = index === activeIndex && step !== "done";
        return (
          <div key={item.id} className="min-w-0">
            <div className={`h-1.5 rounded-full ${done || active ? "bg-[#15202B]" : "bg-[#DED8C8]"}`} />
            <p className={`mt-2 truncate text-xs ${active ? "font-bold text-foreground" : "text-muted-foreground"}`}>
              {done && <span aria-hidden="true">✓ </span>}
              {item.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  label,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  detail?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
        checked ? "border-[#15202B] bg-[#F7F4E9]" : "border-[#DED8C8] bg-white hover:bg-[#FAF8F2]"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4 accent-[#15202B]"
      />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {detail && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>}
      </span>
    </label>
  );
}

const PilotShellPreview = () => {
  const [step, setStep] = useState<PilotStep>("intro");
  const [level, setLevel] = useState("");
  const [experience, setExperience] = useState("");
  const [exitMode, setExitMode] = useState<ExitMode>("completed");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [friction, setFriction] = useState("");
  const [comment, setComment] = useState("");

  const currentIndex = STEP_ORDER.indexOf(step);
  const profileComplete = Boolean(level && experience);
  const surveyComplete =
    (exitMode === "stopped" || SURVEY_ITEMS.every((item) => ratings[item.id])) &&
    Boolean(friction);
  const canGoBack = step !== "intro" && step !== "done";

  const elapsedLabel = useMemo(() => {
    if (step === "intro") return "약 15분";
    if (step === "profile") return "시작 단계";
    if (step === "mission") return "학습 미션";
    if (step === "survey") return "마지막 단계";
    return "완료";
  }, [step]);

  const goBack = () => {
    if (!canGoBack) return;
    setStep(STEP_ORDER[Math.max(0, currentIndex - 1)]);
  };

  const openSurvey = (mode: ExitMode) => {
    setExitMode(mode);
    setStep("survey");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F2] text-foreground">
      <header className="border-b border-white/10 bg-[#15202B] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <HomeBrand />
          <div className="flex items-center gap-2">
            <Badge className="hidden border-white/20 bg-white/10 text-white hover:bg-white/10 sm:inline-flex">
              정적 화면 검토본
            </Badge>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/85">
              <Clock3 className="h-3.5 w-3.5" />
              {elapsedLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6 sm:py-8">
        {step !== "done" && <PilotProgress step={step} exitMode={exitMode} />}

        <section className={`${surface} mt-6 overflow-hidden`}>
          {step === "intro" && (
            <div className="p-6 sm:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAD338] text-[#15202B]">
                <FlaskConical className="h-5 w-5" />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#6C5F2B]">PRAGMA PILOT</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">15분 학습 미션을 시작해 볼까요?</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                짧은 프로필을 입력한 뒤, 실제 요청 표현 미션 하나를 수행합니다. 마지막에는 방금 경험한
                미션에 관한 짧은 의견을 남겨 주세요.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  ["1–2분", "간소 프로필"],
                  ["약 10분", "학습 미션"],
                  ["2–3분", "마무리 설문"],
                ].map(([time, label]) => (
                  <div key={label} className="rounded-xl border border-[#E6E0D1] bg-[#FAF8F2] px-4 py-3">
                    <p className="text-lg font-black">{time}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 rounded-xl border-l-4 border-l-[#FAD338] bg-[#FFF9DD] px-4 py-3 text-sm leading-6">
                정답 점수를 매기는 시험이 아닙니다. 어렵거나 불편했던 부분도 중요한 의견입니다.
              </div>

              <Button className="mt-8 h-11 w-full sm:w-auto sm:min-w-40" onClick={() => setStep("profile")}>
                시작하기
              </Button>
            </div>
          )}

          {step === "profile" && (
            <div className="p-6 sm:p-8">
              <p className="text-xs font-bold text-[#6C5F2B]">1 / 3</p>
              <h1 className="mt-2 text-2xl font-bold">간단한 학습 배경</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                미션 난이도를 해석하는 데 필요한 두 가지만 묻습니다. 이 응답으로 미션을 다르게 배정하지 않습니다.
              </p>

              <div className="mt-7 space-y-7">
                <fieldset>
                  <legend className="text-sm font-bold">현재 중국어 학습 수준</legend>
                  <div className="mt-3 grid gap-2">
                    {LEVEL_OPTIONS.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        name="pilot-level"
                        value={option.value}
                        checked={level === option.value}
                        onChange={setLevel}
                        label={option.label}
                        detail={option.detail}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-bold">한중 번역 학습·수행 경험</legend>
                  <div className="mt-3 grid gap-2">
                    {EXPERIENCE_OPTIONS.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        name="pilot-experience"
                        value={option.value}
                        checked={experience === option.value}
                        onChange={setExperience}
                        label={option.label}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button variant="outline" onClick={goBack}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> 이전
                </Button>
                <Button disabled={!profileComplete} onClick={() => setStep("mission")}>
                  학습 미션으로
                </Button>
              </div>
            </div>
          )}

          {step === "mission" && (
            <div>
              <div className="border-b border-[#E6E0D1] bg-[#FFFDF7] px-6 py-5 sm:px-8">
                <p className="text-xs font-bold text-[#6C5F2B]">2 / 3 · 학습 미션</p>
                <h1 className="mt-1 text-xl font-bold">요청 표현 · 한국어에서 중국어로</h1>
                <p className="mt-1 text-xs text-muted-foreground">모든 참여자가 동일한 MPJ4 + DCT1 미션을 수행합니다.</p>
              </div>

              <div className="p-6 sm:p-8">
                <div className="rounded-2xl border-2 border-dashed border-[#CFC8B8] bg-[#FAF8F2] px-5 py-10 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
                    <MessageSquareText className="h-5 w-5 text-[#15202B]" />
                  </div>
                  <h2 className="mt-4 text-lg font-bold">기존 MissionRunner 연결 영역</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    실제 구현에서는 현재 정본 미션의 표현 판단 → 번역문 작성 → AI 피드백 → 답안 다듬기 흐름이
                    이 단계에서 그대로 실행됩니다.
                  </p>
                  <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2 text-xs">
                    {["표현 판단 4문항", "번역문 작성 1문항", "AI 피드백", "선택적 수정"].map((label) => (
                      <span key={label} className="rounded-full border border-[#DED8C8] bg-white px-3 py-1.5 font-semibold">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => openSurvey("stopped")}
                    className="text-sm font-semibold text-muted-foreground underline decoration-[#CFC8B8] underline-offset-4 hover:text-foreground"
                  >
                    여기서 중단하고 문제 남기기
                  </button>
                  <Button onClick={() => openSurvey("completed")}>미션 완료 상태로 보기</Button>
                </div>
              </div>
            </div>
          )}

          {step === "survey" && (
            <div className="p-6 sm:p-8">
              <p className="text-xs font-bold text-[#6C5F2B]">3 / 3</p>
              <h1 className="mt-2 text-2xl font-bold">
                {exitMode === "stopped" ? "어디에서 어려움을 겪었나요?" : "방금 미션은 어땠나요?"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                웹앱 전체가 아니라 방금 수행한 학습 미션에 대해서만 응답해 주세요.
              </p>

              <div className="mt-7 space-y-6">
                {exitMode === "completed" && SURVEY_ITEMS.map((item, itemIndex) => (
                  <fieldset key={item.id} className="rounded-xl border border-[#E6E0D1] p-4">
                    <legend className="px-1 text-sm font-bold">
                      {itemIndex + 1}. {item.label}
                    </legend>
                    <div className="mt-3 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={item.label}>
                      {SCALE_LABELS.map((label, index) => {
                        const score = index + 1;
                        const selected = ratings[item.id] === score;
                        return (
                          <label key={label} className="cursor-pointer text-center">
                            <input
                              type="radio"
                              name={`rating-${item.id}`}
                              value={score}
                              checked={selected}
                              onChange={() => setRatings((current) => ({ ...current, [item.id]: score }))}
                              className="sr-only"
                            />
                            <span
                              className={`flex h-10 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                                selected
                                  ? "border-[#15202B] bg-[#15202B] text-white"
                                  : "border-[#DED8C8] bg-white hover:bg-[#FAF8F2]"
                              }`}
                            >
                              {score}
                            </span>
                            <span className="mt-1 hidden text-[10px] leading-tight text-muted-foreground sm:block">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-[10px] text-muted-foreground sm:hidden">1 전혀 아니다 · 5 매우 그렇다</p>
                  </fieldset>
                ))}

                <fieldset>
                  <legend className="text-sm font-bold">
                    {exitMode === "stopped" ? "중단하게 된 단계" : "가장 어렵거나 불편했던 단계"}
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {FRICTION_OPTIONS.map((option) => (
                      <ChoiceCard
                        key={option}
                        name="pilot-friction"
                        value={option}
                        checked={friction === option}
                        onChange={setFriction}
                        label={option}
                      />
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="pilot-comment" className="text-sm font-bold">
                    더 알려주고 싶은 점 <span className="font-normal text-muted-foreground">(선택)</span>
                  </label>
                  <Textarea
                    id="pilot-comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={500}
                    className="mt-3 min-h-28 bg-white"
                    placeholder="막혔던 부분이나 바꾸면 좋을 점을 자유롭게 적어 주세요."
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length} / 500</p>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button variant="outline" onClick={goBack}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> 이전
                </Button>
                <Button disabled={!surveyComplete} onClick={() => setStep("done")}>
                  의견 제출하기
                </Button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="px-6 py-12 text-center sm:px-8 sm:py-16">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAD338] text-[#15202B]">
                <Check className="h-7 w-7" strokeWidth={3} />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#6C5F2B]">COMPLETE</p>
              <h1 className="mt-2 text-2xl font-bold">참여가 완료되었습니다</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                남겨 주신 응답은 PRAGMA 학습 워크플로우의 사용성과 실행가능성을 개선하는 데 활용됩니다.
              </p>
              <Button
                variant="outline"
                className="mt-8"
                onClick={() => {
                  setStep("intro");
                  setExitMode("completed");
                  setRatings({});
                  setFriction("");
                  setComment("");
                }}
              >
                정적 화면 다시 보기
              </Button>
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">
          이 경로는 UI 검토용 skeleton입니다. 현재 답변·프로필·설문 데이터는 저장되지 않습니다.
        </p>
      </main>
    </div>
  );
};

export default PilotShellPreview;
