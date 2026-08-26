import { useNavigate } from "react-router-dom";

import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { COURSE_MODE_LABEL, type CourseMode } from "@/lib/curriculum/courseModePolicy";
import { useLearnerCourses } from "@/lib/curriculum/useLearnerCourse";
import {
  DIRECTION_LABEL,
  LEVEL,
  type LanguageDirection,
  type LearnerLevel,
} from "@/lib/pragma/enums";
import { THEME_LABEL, type ThemeCode } from "@/lib/pragma/scenarioTopics";

const LearnerCourseList = () => {
  const navigate = useNavigate();
  const { data: courses = [], error, isPending } = useLearnerCourses();

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">내 교과목</span>}
    >
      <div className="pb-24">
        <section className="mt-2">
          <p className="text-[11px] font-bold text-[#B8860B]">MY COURSES</p>
          <h1 className="mt-1 text-[22px] font-black text-[#15202B]">학습할 교과목을 선택하세요</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            교과목을 열면 15주 계획과 주차별 A·B 학습미션을 확인할 수 있습니다.
          </p>
        </section>

        {isPending ? (
          <p className="mt-8 text-[13px] text-muted-foreground">교과목을 불러오는 중…</p>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error instanceof Error ? error.message : "교과목을 불러오지 못했습니다."}
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#EAE4D2] bg-white px-6 py-10 text-center text-[13px] text-muted-foreground">
            아직 게시된 교과목이 없습니다.
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {courses.map((course) => {
              const themes = (course.composition_theme_codes ?? []) as ThemeCode[];
              const themeText = themes
                .map((theme) => THEME_LABEL[theme])
                .filter(Boolean)
                .slice(0, 2)
                .join(" · ");
              const targetActCount = course.target_speech_acts?.length ?? 0;
              return (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/learner/course/${course.id}`)}
                    className="flex h-full w-full flex-col rounded-xl border border-[#EAE4D2] bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#D5CEBB] hover:shadow-sm"
                  >
                    <span className="text-[11px] font-bold text-[#B8860B]">
                      {LEVEL[course.level as LearnerLevel] ?? course.level} ·{" "}
                      {COURSE_MODE_LABEL[course.course_mode as CourseMode] ?? course.course_mode}
                    </span>
                    <h2 className="mt-1.5 text-[18px] font-black leading-snug text-[#15202B]">
                      {course.title}
                    </h2>
                    <p className="mt-2 text-[12.5px] text-muted-foreground">
                      {DIRECTION_LABEL[course.language_direction as LanguageDirection] ?? course.language_direction}
                      {themeText ? ` · ${themeText}` : ""}
                    </p>
                    <div className="mt-5 flex w-full items-center justify-between gap-3 border-t border-[#EFEBDD] pt-3">
                      <span className="text-[12px] text-muted-foreground">
                        15주 강좌 · 실제 학습 12주
                        {targetActCount > 0 ? ` · ${targetActCount}개 화행` : ""}
                      </span>
                      <span className="shrink-0 text-[13px] font-bold text-[#15202B]">계획 보기 →</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerCourseList;
