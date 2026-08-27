import { Link, useParams } from "react-router-dom";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { WeeklyMaterialDocument } from "@/components/curriculum/WeeklyMaterialDocument";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import { buildWeeklyCourseMaterial } from "@/lib/curriculum/weeklyMaterials";

// 기존 /note 주소를 유지한다. 예습·복습 공개 상태 및 수행 기록은 읽거나 수정하지 않는다.
const WeeklyLearningNote = (_props: { allowSample?: boolean }) => {
  const { courseId, weekNo: weekParam } = useParams();
  const { data: course, error, isPending } = useLearnerCourse(courseId);
  const week = course?.weeks.find((item) => item.week_no === Number(weekParam));
  const coursePath = course ? `/learner/course/${course.outline.id}` : "/learner/course";

  return (
    <LearnerJourneyShell headerRight={<span className="text-xs text-[#B9C4CE]">강의 유인물</span>}>
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link to={week ? `${coursePath}/week/${week.week_no}` : coursePath} className="text-sm">
          ← {week ? "주차로 돌아가기" : "교과목 선택"}
        </Link>
        {course && week && <button onClick={() => window.print()} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">
          인쇄·PDF
        </button>}
      </div>
      {isPending ? <p role="status">수업자료를 불러오는 중…</p>
        : error ? <p role="alert">수업자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        : !course || !week ? <p>이 주차의 수업자료를 찾을 수 없습니다.</p>
        : <>
          <WeeklyMaterialDocument material={buildWeeklyCourseMaterial(course.outline, week)} />
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            주차 계획과 현재 편성된 미션의 상황·기본 원문을 함께 사용합니다. 개인 답안과 피드백은 웹앱 수행 기록에서 확인합니다.
          </p>
        </>}
    </LearnerJourneyShell>
  );
};

export default WeeklyLearningNote;
