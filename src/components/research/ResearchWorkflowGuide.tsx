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
    short: "연구자 판정",
    title: "품질검사 기준답안 30개 연구자 판정",
    purpose: "연구 책임자가 대표 상황 30개에 대해 중국어 후보의 적절성, 유지해야 할 의미와 판단 근거를 기록합니다.",
    owner: "연구 책임자",
    done: "연구자 판정을 마친 기준답안 30개",
    adminPath: "/admin/research-qa/calibration",
    previewPath: "/prototype/research-qa-calibration",
  },
  {
    id: "gold",
    short: "외부 표본 확인",
    title: "9화행 층화표본 18개 외부 전문가 확인",
    purpose: "외부 전문가 2명이 연구 책임자의 판정을 보지 않고 9개 화행에서 2개씩 뽑은 18개를 독립적으로 판단합니다.",
    owner: "선정된 외부 전문가 2명",
    done: "화행별 2개씩 외부 확인을 마친 기준답안 18개",
    adminPath: "/admin/research-qa/gold-experts",
    previewPath: "/prototype/gold-expert-ops",
  },
  {
    id: "missions",
    short: "정식 문항 검토",
    title: "정식 AI 학습문항 504개 자동 점검·연구자 검토",
    purpose: "시스템이 504개 전체를 먼저 점검하고, 연구 책임자가 전 항목을 빠르게 선별한 뒤 경고 문항을 집중 검토합니다.",
    owner: "연구 책임자 · 시스템(전체 자동 점검)",
    done: "연구자 승인을 마친 정식 학습문항 504개",
    adminPath: "/admin/research-qa/final-review",
    previewPath: "/prototype/final-review",
  },
  {
    id: "release",
    short: "학습자 공개",
    title: "통과한 학습문항을 학습자에게 공개",
    purpose: "연구자 전수 검토, 외부 전문가 층화표본 확인과 품질 점검 자동화를 모두 통과한 문항을 교수자가 PRAGMA 수업 화면에 공개합니다.",
    owner: "교수자(공개 결정) · 시스템(통과 조건 확인)",
    done: "PRAGMA 학습자 화면에서 사용할 확정 문항",
    adminPath: "/admin/research-qa/releases",
    previewPath: "/prototype/mission-release",
  },
  {
    id: "data",
    short: "수행기록 내려받기",
    title: "학습 수행기록 연구용 내려받기",
    purpose: "연구자료 사용에 동의한 학습자의 판단·수정·산출 기록만 연구용 번호로 바꾸어 내려받습니다.",
    owner: "연구 책임자",
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
          <p><strong>품질검사 기준답안:</strong> 연구 책임자가 판정한 대표 문항 30개입니다. 외부 전문가는 이 가운데 9화행별 2개씩 총 18개만 확인합니다.</p>
          <p><strong>연구 책임자:</strong> 이 박사논문을 수행하고 PRAGMA를 운영하며 연구 절차를 책임지는 사람입니다.</p>
          <p><strong>외부 전문가:</strong> 중국어 화용과 한중 통번역을 판단할 자격·경력이 확인된 독립 검토자 2명입니다.</p>
          <p><strong>AI 학습문항:</strong> 확정한 규칙에 따라 AI가 생성하여 실제 PRAGMA 수업에서 사용할 후보 문항입니다.</p>
        </div>
      )}

      {current === "gold" && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
          <strong>전문가 부담 상한:</strong> 같은 전문가 2명이 각자 18개를 독립적으로 확인합니다. 목표 시간은 평균 45분, 최대 60분이며 504개 전수 검토는 요구하지 않습니다.
        </div>
      )}
    </section>
  );
};

export default ResearchWorkflowGuide;
