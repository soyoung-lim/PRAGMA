import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { useLearnerCourses } from "@/lib/curriculum/useLearnerCourse";
import {
  DIRECTION_LABEL,
  LEVEL,
  type LanguageDirection,
  type LearnerLevel,
} from "@/lib/pragma/enums";
import { COURSE_PRESETS } from "@/lib/pragma/scenarioTopics";

// 교과목 선택을 돕는 소개 문구. 실제 편성·주제·수행모드 데이터는 바꾸지 않는다.
const COURSE_INTRO: Record<string, string> = {
  ko_zh_pragmatic_translation_interpreting:
    "상황과 관계를 읽고, 의도와 말투를 살려 중국어로 옮깁니다.",
  ko_zh_business_communication:
    "회의·협업·고객 응대에 필요한 중국어 표현과 전달 방식을 익힙니다.",
  zh_ko_practical_translation:
    "중국어의 의도와 뉘앙스를 자연스러운 한국어로 옮깁니다.",
};

const LearnerCourseList = () => {
  const { data: courses = [], error, isPending } = useLearnerCourses();

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">내 교과목</span>}
    >
      <main className="pb-24 pt-3 sm:pt-5" aria-labelledby="course-list-title">
        <section>
          <p className="flex items-center gap-2.5 text-[10px] font-bold tracking-[0.18em] text-[#8A6A16]">
            <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-[#FAD338]" />
            MY COURSES
          </p>
          <h1 id="course-list-title" className="mt-3 text-[28px] font-bold tracking-[-0.04em] text-[#15202B] sm:text-[32px]">
            내 교과목
          </h1>
          <p className="mt-3 break-keep text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">
            교과목을 선택해 주차별 학습계획과 미션을 확인하세요.
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
          <ul className="mt-7 space-y-3.5 sm:mt-8" aria-label="교과목 목록">
            {courses.map((course, index) => {
              const preset = COURSE_PRESETS.find((item) => item.outline_id === course.id);
              const intro = preset ? COURSE_INTRO[preset.preset_code] : undefined;
              const titleId = `course-title-${course.id}`;
              const introId = `course-intro-${course.id}`;
              return (
                <li key={course.id}>
                  <Link
                    to={`/learner/course/${course.id}`}
                    aria-labelledby={titleId}
                    aria-describedby={intro ? introId : undefined}
                    className="group block rounded-[20px] border border-[#E5E1D6] bg-white px-5 py-5 text-left shadow-[0_2px_8px_rgba(21,32,43,0.025)] transition-[border-color,box-shadow,background-color] duration-200 hover:border-[#C7BB96] hover:bg-[#FFFDF7] hover:shadow-[0_6px_20px_rgba(21,32,43,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transition-none sm:px-7"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-[12px] font-semibold">
                        <span className="rounded-md bg-[#F6F2E5] px-2 py-0.5 text-[#786022]">
                          {LEVEL[course.level as LearnerLevel] ?? course.level}
                        </span>
                        <span className="text-[#5C6A7A]">
                          {DIRECTION_LABEL[course.language_direction as LanguageDirection] ?? course.language_direction}
                        </span>
                      </div>
                      <span aria-hidden="true" className="text-[12px] font-medium tabular-nums tracking-[0.12em] text-[#87919A]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h2 id={titleId} className="mt-2.5 break-keep text-[20px] font-bold leading-snug tracking-[-0.035em] text-[#15202B] sm:whitespace-nowrap sm:text-[23px]">
                      {course.title}
                    </h2>
                    {intro && (
                      <p id={introId} className="mt-1.5 break-keep text-[13px] leading-relaxed text-[#5C6A7A] sm:text-[14px]">
                        {intro}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-4">
                      <span aria-hidden="true" className="h-px flex-1 bg-[#EFECE3]" />
                      <span className="inline-flex shrink-0 items-center gap-2.5 text-[12px] font-semibold text-[#15202B] sm:text-[13px]">
                        주차별 학습계획 보기
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F6F4EC] transition-colors duration-200 group-hover:bg-[#FAD338] group-focus-visible:bg-[#FAD338] motion-reduce:transition-none">
                          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerCourseList;
