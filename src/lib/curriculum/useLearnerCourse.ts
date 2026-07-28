import { useQuery } from "@tanstack/react-query";
import { getPublishedCourse } from "@/lib/curriculum/learnerCourse";

export const LEARNER_COURSE_QUERY_KEY = ["learner-course", "published"] as const;

/** 일반 학습자 화면이 공유하는 게시 강좌 단일 조회. */
export function useLearnerCourse() {
  return useQuery({
    queryKey: LEARNER_COURSE_QUERY_KEY,
    queryFn: getPublishedCourse,
    staleTime: 30_000,
  });
}
