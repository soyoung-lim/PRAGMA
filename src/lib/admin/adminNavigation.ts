export type AdminNavItem = {
  to: string;
  label: string;
  pending?: boolean;
  activePaths?: readonly string[];
};

export type AdminNavGroup = {
  header: string;
  items: readonly AdminNavItem[];
};

export const ADMIN_DASHBOARD_ITEM: AdminNavItem = {
  to: "/admin/dashboard",
  label: "운영 대시보드",
};

// 관리자 메뉴·모바일 선택기·대시보드 바로가기가 함께 쓰는 단일 정본이다.
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    header: "학습 콘텐츠 설계",
    items: [
      { to: "/admin/corpus", label: "HSK 3.0 어휘 기준" },
      { to: "/admin/question-designer", label: "수준별 설계 기준" },
      { to: "/admin/prompt-harness", label: "생성 계약·프롬프트" },
    ],
  },
  {
    header: "학습 콘텐츠 제작",
    items: [
      {
        to: "/admin/generator",
        label: "AI 학습 콘텐츠 생성",
        activePaths: ["/admin/generator", "/admin/batch"],
      },
      { to: "/admin/library", label: "코어 라이브러리" },
      { to: "/admin/assembly", label: "학습 미션 조립" },
    ],
  },
  {
    header: "품질 검증·공개",
    items: [
      { to: "/admin/research-qa", label: "전체 현황" },
      { to: "/admin/research-qa/calibration", label: "1. 판정 기준 확정" },
      { to: "/admin/research-qa/gold-experts", label: "2. 외부 전문가 확인" },
      {
        to: "/admin/research-qa/final-review",
        label: "3. 전체 자동 점검",
        activePaths: ["/admin/research-qa/final-review", "/admin/review"],
      },
      { to: "/admin/research-qa/releases", label: "4. 교수자 검수·승인" },
    ],
  },
  {
    header: "수업 편성",
    items: [
      { to: "/admin/composer", label: "15주 교과목·학습 미션 편성" },
      { to: "/admin/package", label: "수업 자료 생성" },
    ],
  },
  {
    header: "학습자와 연구 자료",
    items: [
      { to: "/admin/learners", label: "학습자 관리" },
      { to: "/admin/decision-traces", label: "학습자 수행 기록" },
      { to: "/admin/analytics", label: "학습 분석", pending: true },
      { to: "/admin/research-qa/improvements", label: "학습 콘텐츠 개선" },
      { to: "/admin/export", label: "수행 기록 내려받기" },
    ],
  },
  {
    header: "기록과 보존",
    items: [
      { to: "/admin/archive", label: "시나리오 아카이브" },
      { to: "/admin/data-backup", label: "수업 데이터 백업·복원" },
    ],
  },
] as const;

const PRIORITY_LABELS = [
  "3. 전체 자동 점검",
  "시나리오 아카이브",
  "수업 자료 생성",
  "학습자 관리",
  "학습자 수행 기록",
  "학습 분석",
  "학습 콘텐츠 개선",
  "수행 기록 내려받기",
] as const;

const ALL_ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
export const ADMIN_PRIORITY_LINKS = PRIORITY_LABELS.map((label) => {
  const item = ALL_ADMIN_NAV_ITEMS.find((candidate) => candidate.label === label);
  if (!item) throw new Error(`Missing required admin navigation item: ${label}`);
  return item;
});

export function adminNavItemIsActive(item: AdminNavItem, pathname: string) {
  return item.to === pathname || item.activePaths?.includes(pathname) === true;
}

export function adminMobileNavValue(pathname: string) {
  const active = ADMIN_NAV_GROUPS.flatMap((group) => group.items)
    .find((item) => adminNavItemIsActive(item, pathname));
  if (active) return active.to;
  return pathname === ADMIN_DASHBOARD_ITEM.to ? ADMIN_DASHBOARD_ITEM.to : "";
}
