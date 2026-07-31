import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";

// 학습자 홈 — 메뉴판이 아니라 '다음 행동'을 알려주는 화면.
// 게시·편성된 실제 강좌만 현재 상태로 제시한다.

const LearnerHome = () => {
  const navigate = useNavigate();
  const {
    data: course = null,
    error,
    isFetching,
    isPending,
    refetch,
  } = useLearnerCourse();
  const assignedTotal =
    course?.weeks.reduce((total, week) => total + week.scenarios.length, 0) ?? 0;

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">강의 연계</span>}
    >
      <div className="pb-20">
        {/* 홈의 유일한 주 행동 — DB 편성 강좌로 이동 */}
        <section className="rounded-xl bg-[#15202B] px-5 py-5 text-white">
          <div className="text-[11.5px] font-bold text-[#FAD338]">내 강좌</div>

          {isPending ? (
            <p className="mt-2 text-[13px] text-[#B9C4CE]">게시된 강좌를 확인하는 중…</p>
          ) : error ? (
            <>
              <h2 className="mt-1.5 text-[19px] font-bold leading-snug">
                강좌를 불러오지 못했습니다
              </h2>
              <p className="mt-2 text-[12.5px] text-[#B9C4CE]">
                {error instanceof Error ? error.message : "잠시 후 다시 확인해 주세요."}
              </p>
              <Button
                className="mt-4 bg-[#FAD338] text-[#15202B] hover:bg-[#F6C200]"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {isFetching ? "다시 확인 중…" : "다시 확인하기"}
              </Button>
            </>
          ) : !course ? (
            <>
              <h2 className="mt-1.5 text-[19px] font-bold leading-snug">
                아직 게시된 강좌가 없습니다
              </h2>
              <p className="mt-2 text-[12.5px] text-[#B9C4CE]">
                담당 교강사가 강좌를 게시하면 이곳에 수업 일정과 과제가 표시됩니다.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-1.5 text-[19px] font-bold leading-snug">
                {course.outline.title}
              </h2>
              <p className="mt-1 text-[13px] text-[#B9C4CE]">
                {course.weeks.length}주 과정 · 검토 완료 과제 {assignedTotal}개
              </p>
              <div className="mt-3 inline-flex items-baseline gap-2 rounded-lg bg-white/[0.08] px-3 py-2">
                <span className="text-[11px] font-medium text-[#8899A6]">현재 상태</span>
                <span className="text-[13.5px] font-semibold text-white">
                  {assignedTotal > 0 ? "배정된 과제 있음" : "과제 배정 전"}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] text-[#B9C4CE]">
                {assignedTotal > 0
                  ? "강좌에서 주차별 과제를 확인하고 시작할 수 있습니다."
                  : "학습 노트는 볼 수 있으며, 검토 완료 과제가 배정되면 미션이 열립니다."}
              </p>
              <Button
                className="mt-4 bg-[#FAD338] text-[#15202B] hover:bg-[#F6C200]"
                onClick={() => navigate("/learner/course")}
              >
                {assignedTotal > 0 ? "배정 과제 보기 →" : "강좌 구조 보기 →"}
              </Button>
            </>
          )}
        </section>

        <Link
          to="/learner/course"
          className="mt-4 flex items-center justify-between rounded-[10px] border border-[#EAE4D2] bg-white px-4 py-3.5 hover:bg-[#FAFAF7]"
        >
          <div>
            <div className="text-[11.5px] font-semibold text-muted-foreground">
              수업
            </div>
            <div className="mt-1 text-[14.5px]">
              게시된 강좌와 주차별 학습 노트 보기
            </div>
          </div>
          <span aria-hidden className="shrink-0 text-muted-foreground">→</span>
        </Link>

        <Link
          to="/learner/records"
          className="mt-2.5 flex items-center justify-between rounded-[10px] border border-[#EAE4D2] bg-white px-4 py-3.5 hover:bg-[#FFFDF4]"
        >
          <div>
            <div className="text-[11.5px] font-semibold text-muted-foreground">학습 기록</div>
            <div className="mt-1 text-[14.5px]">완료한 미션과 쌓인 기록 확인하기</div>
          </div>
          <span aria-hidden className="shrink-0 text-[#8899A6]">
            →
          </span>
        </Link>
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerHome;
