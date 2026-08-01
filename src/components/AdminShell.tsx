import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";

/** pending = 라우트는 있으나 내용이 후속 단계. 메뉴에 「준비 중」 배지를 단다. */
type NavItem = { to?: string; label: string; pending?: boolean };
type NavGroup = {
  header: string;
  items: NavItem[];
};

const STANDALONE: NavItem = { to: "/admin/dashboard", label: "운영 대시보드" };

// 워크플로 정합 사이드바 (2026-07-26 재편) — "자원 준비 → 생성 → 조립 → 검수 →
// 편성 → 학습자·학습 분석 → 연구" 한 줄 논리.
//
// 2026-07-26에 고친 것:
// - 실제로 구현된 화면 2개(학습자 관리 458줄·의사결정 기록 229줄)가 메뉴에 없어
//   주소를 직접 쳐야 들어갈 수 있었다 → 노출
// - 「수업 운영·연구」 4개가 전부 빈 껍데기였다 → 실체 있는 것 위로, 나머지는
//   pending 배지. 교과목 운영은 9월 실증 사안이라 메뉴에서 제외(백로그),
//   학습자 개별 리포트는 학습자 관리 상세와 중복이라 흡수
// - 「콘텐츠 보관함」은 이름·헤드라인("시나리오 아카이브")·소속이 모두 어긋나 있었다
//   → 이름 통일 + 생성물이 쌓이는 곳이므로 파이프라인으로 이동
// - 파이프라인의 "1단계·1단계·2단계…" 번호는 1단계가 두 번 나와 헷갈려서 제거
//
// pending = 화면은 있으나 내용이 후속. 배지를 미리 보여 준다 — 눌러 봐야 비어 있는
// 것을 아는 것보다 정직하고, 시연 중 사고도 막는다.
const GROUPS: NavGroup[] = [
  {
    header: "0 · 자원 관리",
    items: [
      { to: "/admin/corpus", label: "소스 뱅크 (HSK 어휘)" },
      { to: "/admin/question-designer", label: "수준별 문항 설계" },
      // 생성 규칙은 화면이 무거워 맨 뒤로(자주 열지 않는다).
      { to: "/admin/prompt-harness", label: "생성 규칙·프롬프트" },
    ],
  },
  // 2026-07-30 IA 재편(사용자·Codex·Claude 수렴안): 생성 화면들의 산출물은 학습
  // 콘텐츠가 아니라 "미션 재료(코어)"다. 재료가 학습 콘텐츠(MPJ4+DCT1)가 되는
  // 결정적 변환 = 미션 조립이 라이브러리 행 안 버튼으로 숨어 있어, 제작(재료)과
  // 완성·관리(조립·검수)를 2층으로 분리하고 조립을 독립 화면으로 승격했다.
  {
    header: "1 · 콘텐츠 제작",
    items: [
      { to: "/admin/authentic", label: "원자료 분석" },
      { to: "/admin/generator", label: "미션 재료 생성 · 단일" },
      { to: "/admin/batch", label: "미션 재료 생성 · 대량" },
    ],
  },
  {
    header: "2 · 콘텐츠 완성·관리",
    items: [
      { to: "/admin/library", label: "미션 재료 라이브러리" },
      { to: "/admin/assembly", label: "학습 미션 조립" },
      { to: "/admin/review", label: "검수·승인" },
    ],
  },
  {
    header: "3 · 커리큘럼·수업 준비",
    // 둘 다 "15주"로 시작해 관계가 안 보였다(2026-07-26). ①은 빈 시간표를 만들고
    // ②는 그 칸을 채운다 — 번호로 순서를, 이름으로 무엇이 다른지 드러낸다.
    items: [
      { to: "/admin/curriculum", label: "커리큘럼 구조" },
      { to: "/admin/composer", label: "주차별 시나리오 편성" },
      { to: "/admin/package", label: "수업 자료 생성", pending: true },
    ],
  },
  {
    header: "4 · 학습자·학습 분석",
    items: [
      { to: "/admin/learners", label: "학습자 관리" },
      { to: "/admin/decision-traces", label: "수행·의사결정 기록" },
      { to: "/admin/analytics", label: "학습 분석", pending: true },
    ],
  },
  {
    header: "5 · 연구",
    items: [
      { to: "/admin/export", label: "연구 데이터 관리", pending: true },
    ],
  },
  {
    header: "설정",
    items: [
      { to: "/admin/users", label: "사용자·권한", pending: true },
    ],
  },
];

// 2026-08-01 — 「준비 중」 항목은 메뉴에서 감춘다. 빈 껍데기를 미리 보여 주는 것이
// 정직하다고 보았으나, 지도교수 점검에서는 완성 보고와 정면으로 경쟁했다. 라우트와
// pending 표기는 그대로 두어(주소로는 접근 가능), 내용이 차면 이 필터만 풀면 된다.
const VISIBLE_GROUPS: NavGroup[] = GROUPS.map((group) => ({
  ...group,
  items: group.items.filter((item) => !item.pending),
})).filter((group) => group.items.length > 0);

interface AdminShellProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export const AdminShell = ({ title, description, children }: AdminShellProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const visibleNavPaths = new Set([
    STANDALONE.to,
    ...GROUPS.flatMap((group) => group.items.map((item) => item.to)),
  ]);
  const mobileNavValue = visibleNavPaths.has(pathname) ? pathname : "";

  const standaloneClasses = (active: boolean) =>
    [
      "rounded-md px-3 py-[6px] text-[14px] whitespace-nowrap transition-colors mr-2",
      active
        ? "bg-[#FAD338] text-[#15202B] font-medium"
        : "text-foreground font-normal hover:bg-muted hover:text-foreground",
    ].join(" ");

  const itemClasses = (active: boolean) =>
    [
      "rounded-md px-3 py-[6px] text-[14px] whitespace-nowrap transition-colors mr-2",
      active
        ? "bg-[#FAD338] text-[#15202B] font-medium"
        : "text-foreground font-normal hover:bg-muted hover:text-foreground",
    ].join(" ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
          <Link
            to="/"
            className="text-sm text-[#8899A6] transition-colors hover:text-[#F1EFE8]"
          >
            ← 학습자 화면으로
          </Link>
        </div>
      </header>

      <div className="flex gap-6 pl-5 pr-8 py-6">
        <aside className="hidden w-[245px] shrink-0 md:block">
          <nav className="flex flex-col px-1">
            <Link
              to={STANDALONE.to}
              className={standaloneClasses(pathname === STANDALONE.to)}
            >
              {STANDALONE.label}
            </Link>

            {VISIBLE_GROUPS.map((group) => (
              <div key={group.header} className="flex flex-col">
                <span
                  className="mt-5 mb-1.5 px-3 text-[12px] font-medium uppercase tracking-[0.08em] text-[#8a857c] whitespace-nowrap cursor-default select-none"
                >
                  {group.header}
                </span>
                <div className="flex flex-col gap-[2px] border-l border-[#e5e1d8] pl-4">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to ?? "#"}
                      className={itemClasses(pathname === item.to)}
                    >
                      {item.label}
                      {item.pending && (
                        <span className="ml-1.5 rounded-full bg-[#EDE9DD] px-1.5 py-[1px] align-middle text-[10px] font-normal text-[#8a857c]">
                          준비 중
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-5 md:hidden">
            <label
              htmlFor="admin-mobile-navigation"
              className="mb-1.5 block text-[12px] font-medium text-muted-foreground"
            >
              관리자 메뉴
            </label>
            <select
              id="admin-mobile-navigation"
              value={mobileNavValue}
              onChange={(event) => {
                if (event.target.value) navigate(event.target.value);
              }}
              className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-[14px] text-foreground"
            >
              <option value="" disabled>
                이동할 화면 선택
              </option>
              <option value={STANDALONE.to}>{STANDALONE.label}</option>
              {VISIBLE_GROUPS.map((group) => (
                <optgroup key={group.header} label={group.header}>
                  {group.items.map((item) => (
                    <option key={item.to} value={item.to}>
                      {item.label}
                      {item.pending ? " · 준비 중" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex items-stretch gap-3">
            <span
              aria-hidden
              className="mt-1 w-[5px] shrink-0 self-stretch rounded-sm bg-[#FAD338]"
            />
            <div>
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export const AdminPlaceholder = ({
  title,
  description,
  note = "이 화면은 후속 단계에서 구현됩니다.",
}: {
  title: string;
  description?: string;
  note?: string;
}) => (
  <AdminShell title={title} description={description}>
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  </AdminShell>
);

export default AdminShell;
