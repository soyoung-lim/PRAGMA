import { useQuery } from "@tanstack/react-query";
import {
  getPublishedCourse,
  listPublishedCourseOutlines,
} from "@/lib/curriculum/learnerCourse";

export const LEARNER_COURSE_QUERY_KEY = ["learner-course", "published"] as const;
export const LEARNER_COURSES_QUERY_KEY = ["learner-courses", "published"] as const;

/** 학습자가 선택할 수 있는 게시 교과목 목록. */
export function useLearnerCourses() {
  return useQuery({
    queryKey: LEARNER_COURSES_QUERY_KEY,
    queryFn: listPublishedCourseOutlines,
    staleTime: 30_000,
  });
}

/** 선택한 게시 강좌 조회. courseId 생략은 구 주소·개발 목업 호환용이다. */
export function useLearnerCourse(courseId?: string) {
  return useQuery({
    queryKey: [...LEARNER_COURSE_QUERY_KEY, courseId ?? "latest"],
    queryFn: () => getPublishedCourse(courseId),
    staleTime: 30_000,
  });
}
