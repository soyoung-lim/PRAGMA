import { Link, useLocation } from "react-router-dom";

type ResearchStep = "calibration" | "gold" | "missions" | "release" | "data";

const STEPS: Array<{
  id: ResearchStep;
  short: string;
  title: string;
  purpose: string;
  owner: string;
  done: string;
  adminPath: string;
  previewPath?: string;
}> = [
  {
    id: "calibration",
    short: "기준답안 작성",
    title: "품질검사 기준답안 30개 작성",
    purpose: "논문 저자가 대표 상황 30개에 대해 중국어 후보의 적절성, 유지해야 할 의미와 판단 근거를 기록합니다.",
    owner: "연구 책임자(논문 저자)",
    done: "품질검사에 사용할 기준답안 30개",
    adminPath: "/admin/research-qa/calibration",
    previewPath: "/prototype/research-qa-calibration",
  },
  {
    id: "gold",
    short: "기준답안 확인",
    title: "기준답안 30개 외부 전문가 확인",
    purpose: "외부 전문가 2명이 논문 저자의 답을 보지 않고 같은 30개를 판단하여 기준답안의 타당성을 확인합니다.",
    owner: "선정된 외부 전문가 2명",
    done: "외부 전문가가 확인한 기준답안 30개",
    adminPath: "/admin/research-qa/gold-experts",
    previewPath: "/prototype/gold-expert-ops",
  },
  {
    id: "missions",
    short: "AI 문항 확인",
    title: "AI 학습문항 외부 전문가 확인",
    purpose: "같은 외부 전문가 2명이 AI가 만든 수업용 문장의 중국어 자연성, 상황 적절성, 의미와 규칙 연결을 확인합니다.",
    owner: "선정된 외부 전문가 2명",
    done: "사용 가능 여부가 확인된 AI 학습문항",
    adminPath: "/admin/research-qa/expert-reviews",
    previewPath: "/prototype/expert-review-ops",
  },
  {
    id: "release",
    short: "학습자 공개",
    title: "통과한 학습문항을 학습자에게 공개",
    purpose: "외부 전문가 확인과 기준답안 자동 재시험을 모두 통과한 문항만 PRAGMA 수업 화면에서 학습자가 사용할 수 있게 합니다.",
    owner: "시스템 + 연구 책임자(논문 저자)",
    done: "PRAGMA 학습자 화면에서 사용할 확정 문항",
    adminPath: "/admin/research-qa/releases",
    previewPath: "/prototype/mission-release",
  },
  {
    id: "data",
    short: "수행기록 내려받기",
    title: "학습 수행기록 연구용 내려받기",
    purpose: "연구자료 사용에 동의한 학습자의 판단·수정·산출 기록만 연구용 번호로 바꾸어 내려받습니다.",
    owner: "연구 책임자(논문 저자)",
    done: "통계·질적 분석에 사용할 가명 처리 파일",
    adminPath: "/admin/export",
  },
];

export const ResearchWorkflowGuide = ({ current }: { current: ResearchStep | "overview" }) => {
  const { pathname } = useLocation();
  const preview = pathname.startsWith("/prototype/");
  const activeIndex = STEPS.findIndex((step) => step.id === current);
  const active = activeIndex >= 0 ? STEPS[activeIndex] : null;

  return (
    <section className="mb-6 rounded-xl border border-[#D9D4C8] bg-white p-5" aria-label="학습문항 품질관리 진행 순서">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#756F64]">학습문항 품질관리 5단계</p>
          <h2 className="mt-1 text-lg font-semibold">{active ? `현재 ${activeIndex + 1}단계 · ${active.title}` : "전체 진행 순서"}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {active?.purpose ?? "아래 다섯 단계를 순서대로 완료하면 품질을 확인한 학습자료를 학생에게 제공하고 수행기록을 연구에 활용할 수 있습니다."}
          </p>
        </div>
        {active && (
          <div className="grid gap-1 rounded-lg bg-[#F7F4EC] px-4 py-3 text-xs text-[#5E5A52] sm:min-w-[230px]">
            <p><strong>담당:</strong> {active.owner}</p>
            <p><strong>완료 결과:</strong> {active.done}</p>
          </div>
        )}
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {STEPS.map((step, index) => {
          const isActive = step.id === current;
          const path = preview && step.previewPath ? step.previewPath : step.adminPath;
          return (
            <li key={step.id}>
              <Link
                to={path}
                aria-current={isActive ? "step" : undefined}
                className={`flex h-full items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "border-[#D6AD00] bg-[#FFF6C7] font-semibold text-[#332A00]"
                    : "border-[#E5E1D8] bg-[#FCFBF8] text-[#625D54] hover:bg-[#F5F1E8]"
                }`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${isActive ? "bg-[#15202B] text-white" : "bg-[#EDE9DD]"}`}>
                  {index + 1}
                </span>
                <span>{step.short}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {current === "overview" && (
        <div className="mt-5 grid gap-3 border-t pt-4 text-sm leading-6 md:grid-cols-2">
          <p><strong>품질검사 기준답안:</strong> 시스템 판정이 맞는지 시험하기 위해 논문 저자와 외부 전문가가 정답·근거를 확정한 대표 문항 30개입니다.</p>
          <p><strong>연구 책임자:</strong> 이 박사논문을 수행하고 PRAGMA를 운영하는 논문 저자입니다.</p>
          <p><strong>외부 전문가:</strong> 중국어 화용과 한중 통번역을 판단할 자격·경력이 확인된 독립 검토자 2명입니다.</p>
          <p><strong>AI 학습문항:</strong> 확정한 규칙에 따라 AI가 생성하여 실제 PRAGMA 수업에서 사용할 후보 문항입니다.</p>
        </div>
      )}

      {(current === "gold" || current === "missions") && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
          <strong>전문가 인원:</strong> 4명이 필수는 아닙니다. 같은 전문가 2명이 2단계와 3단계를 각각 독립적으로 수행할 수 있습니다.
          두 단계의 검토 기록과 판정 회차는 서로 분리하여 저장됩니다.
        </div>
      )}
    </section>
  );
};

export default ResearchWorkflowGuide;
