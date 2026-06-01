import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";

type NavItem = { to: string; label: string };
type NavGroup = {
  header: string;
  items: NavItem[];
};

const STANDALONE: NavItem = { to: "/admin/dashboard", label: "대시보드" };

const GROUPS: NavGroup[] = [
  {
    header: "시나리오 운영",
    items: [
      { to: "/admin/archive", label: "시나리오 아카이브" },
      { to: "/admin/generator", label: "AI 시나리오 생성" },
      { to: "/admin/prompt-harness", label: "프롬프트 관리" },
      { to: "/admin/review", label: "시나리오 검수" },
    ],
  },
  {
    header: "학습자 운영",
    items: [
      { to: "/admin/learners", label: "학습자 관리" },
      { to: "/admin/decision-traces", label: "의사결정 기록" },
      { to: "/admin/reports", label: "개인화 리포트" },
    ],
  },
  {
    header: "분석·보내기",
    items: [
      { to: "/admin/analytics", label: "관리자 종합 분석" },
      { to: "/admin/export", label: "데이터보내기" },
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
      "rounded-md px-3 py-2 text-base font-medium transition-colors",
      active
        ? "bg-[#FAD338] text-[#15202B]"
        : "text-foreground hover:bg-muted hover:text-foreground",
    ].join(" ");

  const itemClasses = (active: boolean) =>
    [
      "rounded-md pl-4 pr-3 py-2 text-base font-medium transition-colors",
      active
        ? "bg-[#FAD338] text-[#15202B]"
        : "text-foreground hover:bg-muted hover:text-foreground",
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

      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="flex flex-col">
            <Link
              to={STANDALONE.to}
              className={standaloneClasses(pathname === STANDALONE.to)}
            >
              {STANDALONE.label}
            </Link>

            {GROUPS.map((group) => (
              <div key={group.header} className="mt-6 mb-2 flex flex-col gap-1">
                <span className="px-3 text-[13px] font-bold tracking-[0.02em] text-muted-foreground/80">
                  {group.header}
                </span>
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={itemClasses(pathname === item.to)}
                  >
                    {item.label}
                  </Link>
                ))}
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
