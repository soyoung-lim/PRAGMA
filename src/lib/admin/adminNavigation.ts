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
    header: "1. 학습 콘텐츠 설계 기준",
    items: [
      { to: "/admin/corpus", label: "HSK 3.0 콘텐츠 감사 기준" },
      { to: "/admin/question-designer", label: "수준별 설계 기준" },
      { to: "/admin/prompt-harness", label: "생성 계약·프롬프트" },
    ],
  },
  {
    header: "2. 학습 콘텐츠 제작",
    items: [
      { to: "/admin/generator", label: "시나리오 개별 생성" },
      { to: "/admin/batch", label: "시나리오 배치 생성" },
      { to: "/admin/library", label: "시나리오 라이브러리" },
      { to: "/admin/assembly", label: "학습 미션 조립" },
      {
        to: "/admin/review",
        label: "콘텐츠 검수·확정",
        activePaths: ["/admin/research-qa/final-review", "/admin/research-qa/releases", "/admin/cross-vendor"],
      },
    ],
  },
  {
    header: "3. 수업 운영",
    items: [
      { to: "/admin/composer", label: "15주 수업 편성·강의계획서" },
      { to: "/admin/package", label: "수업자료·교실 화면" },
      { to: "/admin/learners", label: "학습자 승인·관리" },
      { to: "/admin/data-backup", label: "수업 데이터 백업·복원" },
    ],
  },
  {
    header: "4. 학습 결과·연구 자료",
    items: [
      { to: "/admin/decision-traces", label: "학습 수행 기록" },
      { to: "/admin/research-qa/improvements", label: "콘텐츠 개선 후보" },
      { to: "/admin/export", label: "연구 데이터 내보내기" },
      { to: "/admin/research-qa/calibration", label: "연구용 예시 검토 — 파일럿" },
    ],
  },
] as const;

const PRIORITY_LABELS = [
  "콘텐츠 검수·확정",
  "수업자료·교실 화면",
  "학습자 승인·관리",
  "학습 수행 기록",
  "콘텐츠 개선 후보",
  "연구 데이터 내보내기",
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
