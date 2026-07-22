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
    header: "Source Bank",
    items: [
      { to: "/admin/corpus", label: "HSK 코퍼스" },
      { to: "/admin/youtube-sources", label: "YouTube 영상·음성 소스" },
      { to: "/admin/prompt-harness", label: "프롬프트 관리" },
    ],
  },
  {
    header: "시나리오·문항 설계",
    items: [
      { to: "/admin/curriculum", label: "15주 커리큘럼" },
      { to: "/admin/generator", label: "AI 시나리오 생성" },
      { to: "/admin/batch", label: "배치 생성" },
      { to: "/admin/review", label: "시나리오 검수" },
      { to: "/admin/archive", label: "시나리오 아카이브" },
      { to: "/admin/question-designer", label: "수준별 문항 설계" },
    ],
  },
  {
    header: "학습자 수행 관리",
    items: [
      { to: "/admin/learners", label: "학습자 관리" },
      { to: "/admin/decision-traces", label: "의사결정 기록" },
      { to: "/admin/reports", label: "개인화 리포트" },
    ],
  },
  {
    header: "연구 분석·보내기",
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
                      to={item.to}
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
