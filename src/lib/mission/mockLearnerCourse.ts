// 15주 과정 목록 mock — CourseOverview 표시용. 실제 콘텐츠는 추후 지시 예정.
// 요청 주차(2주)만 진입 가능; 나머지는 잠금/예정 표시.

export interface CourseWeekRow {
  weekNo: number;
  title: string;
  stageLabel: string;
  status: "done" | "current" | "locked";
}

export const COURSE_WEEKS: CourseWeekRow[] = [
  { weekNo: 1, title: "화용 감각과 진단", stageLabel: "시작", status: "done" },
  { weekNo: 2, title: "요청", stageLabel: "지시 화행", status: "current" },
  { weekNo: 3, title: "감사·칭찬", stageLabel: "표현 화행", status: "locked" },
  { weekNo: 4, title: "초대", stageLabel: "지시 화행", status: "locked" },
  { weekNo: 5, title: "저부담 화행 통합", stageLabel: "통합", status: "locked" },
  { weekNo: 6, title: "거절", stageLabel: "응답 화행", status: "locked" },
  { weekNo: 7, title: "사과", stageLabel: "표현 화행", status: "locked" },
  { weekNo: 8, title: "중간 점검", stageLabel: "점검", status: "locked" },
  { weekNo: 9, title: "제안", stageLabel: "지시 화행", status: "locked" },
  { weekNo: 10, title: "불만·불만 대응", stageLabel: "평가 화행", status: "locked" },
  { weekNo: 11, title: "반대·의견 정당화", stageLabel: "응답 화행", status: "locked" },
  { weekNo: 12, title: "고부담 거절", stageLabel: "응답 화행", status: "locked" },
  { weekNo: 13, title: "고부담 요청", stageLabel: "지시 화행", status: "locked" },
  { weekNo: 14, title: "입장 조율·조건 협상", stageLabel: "복합 담화", status: "locked" },
  { weekNo: 15, title: "통합 점검", stageLabel: "기말", status: "locked" },
];
