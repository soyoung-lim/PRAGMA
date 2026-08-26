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
    header: "1. 학습 콘텐츠 설계",
    items: [
      { to: "/admin/corpus", label: "HSK 3.0 어휘 기준" },
      { to: "/admin/question-designer", label: "수준별 설계 기준" },
      { to: "/admin/research-qa/calibration", label: "화용적 판정 기준" },
      { to: "/admin/prompt-harness", label: "생성 계약·프롬프트" },
    ],
  },
  {
    header: "2. 학습 콘텐츠 제작",
    items: [
      {
        to: "/admin/generator",
        label: "AI 시나리오 생성",
        activePaths: ["/admin/generator", "/admin/batch"],
      },
      { to: "/admin/library", label: "시나리오 라이브러리" },
      { to: "/admin/assembly", label: "학습 미션 조립" },
    ],
  },
  {
    header: "3. 학습 콘텐츠 품질관리",
    items: [
      { to: "/admin/research-qa", label: "품질관리 현황" },
      {
        to: "/admin/research-qa/final-review",
        label: "자동 품질 점검",
        activePaths: ["/admin/research-qa/final-review", "/admin/review"],
      },
      { to: "/admin/research-qa/releases", label: "교수자 최종 검수·공개" },
    ],
  },
  {
    header: "4. 수업 운영",
    items: [
      { to: "/admin/composer", label: "주차별 수업 편성" },
      { to: "/admin/package", label: "수업자료 만들기" },
      { to: "/admin/learners", label: "학습자 승인·관리" },
      { to: "/admin/data-backup", label: "수업 데이터 백업·복원" },
    ],
  },
  {
    header: "5. 학습 결과·연구 자료",
    items: [
      { to: "/admin/decision-traces", label: "학습 수행 기록" },
      { to: "/admin/research-qa/improvements", label: "데이터 기반 콘텐츠 개선" },
      { to: "/admin/export", label: "연구 데이터 내보내기" },
    ],
  },
] as const;

const PRIORITY_LABELS = [
  "자동 품질 점검",
  "수업자료 만들기",
  "학습자 승인·관리",
  "학습 수행 기록",
  "데이터 기반 콘텐츠 개선",
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
