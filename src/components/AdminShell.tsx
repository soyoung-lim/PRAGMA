import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";

type NavItem = { to?: string; label: string; disabled?: boolean };
type NavGroup = {
  header: string;
  items: NavItem[];
};

const STANDALONE: NavItem = { to: "/admin/dashboard", label: "대시보드" };

// 워크플로 정합 사이드바 (2026-07-25) — "자원 준비 → 코어 → 미션 조립 → 수업 패키지 →
// 검수 → 배포 → 분석" 한 줄 논리. 미구현 화면은 disabled(준비중)로 골격만 노출.
const GROUPS: NavGroup[] = [
  {
    header: "0 · 자원 관리",
    items: [
      { to: "/admin/corpus", label: "소스 뱅크 (HSK 어휘)" },
      { to: "/admin/prompt-harness", label: "생성 규칙·프롬프트" },
      { to: "/admin/question-designer", label: "수준별 문항 설계" },
    ],
  },
  {
    header: "1 · 콘텐츠 파이프라인",
    items: [
      { to: "/admin/generator", label: "1단계 · 개별 생성" },
      { to: "/admin/batch", label: "1단계 · 대량 생성" },
      { to: "/admin/browser", label: "2단계 · 학습 미션 조립" },
      { to: "/admin/package", label: "3단계 · 수업 패키지 생성" },
      { to: "/admin/review", label: "4단계 · 통합 검수·승인" },
    ],
  },
  {
    header: "2 · 커리큘럼·배포",
    items: [
      { to: "/admin/curriculum", label: "15주 커리큘럼" },
      { to: "/admin/composer", label: "15주 편성기" },
      { to: "/admin/archive", label: "콘텐츠 보관함" },
    ],
  },
  {
    header: "3 · 수업 운영·연구",
    items: [
      { to: "/admin/course-ops", label: "교과목 운영" },
      { to: "/admin/analytics", label: "통합 학습 대시보드" },
      { to: "/admin/reports", label: "학습자 개별 리포트" },
      { to: "/admin/export", label: "연구 데이터 추출" },
    ],
  },
  {
    header: "설정",
    items: [
      { to: "/admin/users", label: "사용자·권한" },
    ],
  },
];

interface AdminShellProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export const AdminShell = ({ title, description, children }: AdminShellProps) => {
  const { pathname } = useLocation();

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
      <header className="bg-[#15202B]">
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

            {GROUPS.map((group) => (
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
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
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
