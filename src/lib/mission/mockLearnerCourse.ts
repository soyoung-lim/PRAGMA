// 15주 과정 목록 — 시나리오 매트릭스 설계확정(2026-07-18)의 15주 강의 배치 이식.
// 8주 중간·15주 기말은 학사 일정상 고정. 배치 원리: ①대응쌍→FTA ②인접쌍 묶음
// (요청·초대→거절) ③단일 화행→연쇄 복잡도 상승 (부담도 단조 상승 아님).
// 요청 주차(2주)만 진입 가능; 나머지는 잠금/예정 표시 (콘텐츠는 추후).

export type CourseWeekType =
  | "ot" // 오리엔테이션·진단
  | "speech_act" // 단일 화행 주차 (도입 아크→연습→전이→점검)
  | "integration" // 순환 통합 (도메인 전환 체크포인트)
  | "chain" // 화행 연쇄 = 협상
  | "industry" // 산업 맥락화층
  | "project" // 종합 프로젝트·화용 지문 리포트
  | "assessment"; // 중간·기말 (학사 일정 고정)

export interface CourseWeekRow {
  weekNo: number;
  title: string;
  stageLabel: string;
  weekType: CourseWeekType;
  status: "done" | "current" | "locked";
}

export const COURSE_WEEKS: CourseWeekRow[] = [
  { weekNo: 1, title: "오리엔테이션 · 진단", stageLabel: "시작", weekType: "ot", status: "done" },
  { weekNo: 2, title: "요청", stageLabel: "1순환 · 저부담", weekType: "speech_act", status: "current" },
  { weekNo: 3, title: "감사·칭찬과 대응", stageLabel: "1순환 · 저부담", weekType: "speech_act", status: "locked" },
  { weekNo: 4, title: "초대·공동행동 권유", stageLabel: "1순환 · 저부담", weekType: "speech_act", status: "locked" },
  { weekNo: 5, title: "저부담 화행 도메인 전환", stageLabel: "1순환 통합", weekType: "integration", status: "locked" },
  { weekNo: 6, title: "거절", stageLabel: "2순환 · 고부담", weekType: "speech_act", status: "locked" },
  { weekNo: 7, title: "사과", stageLabel: "2순환 · 고부담", weekType: "speech_act", status: "locked" },
  { weekNo: 8, title: "중간 점검 — 화행 6종 수행평가", stageLabel: "중간 평가", weekType: "assessment", status: "locked" },
  { weekNo: 9, title: "불만 제기", stageLabel: "2순환 · 고부담", weekType: "speech_act", status: "locked" },
  { weekNo: 10, title: "제안·조언", stageLabel: "2순환 · 고부담", weekType: "speech_act", status: "locked" },
  { weekNo: 11, title: "반대·이견 제시", stageLabel: "3순환 · 최고난도", weekType: "speech_act", status: "locked" },
  { weekNo: 12, title: "화행 연쇄 — 협상", stageLabel: "종합", weekType: "chain", status: "locked" },
  { weekNo: 13, title: "산업 맥락화", stageLabel: "맥락화", weekType: "industry", status: "locked" },
  { weekNo: 14, title: "종합 프로젝트 · 화용 지문 리포트", stageLabel: "프로젝트", weekType: "project", status: "locked" },
  { weekNo: 15, title: "기말 — 통합 시뮬레이션 평가", stageLabel: "기말 평가", weekType: "assessment", status: "locked" },
];
