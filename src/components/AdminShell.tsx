import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";
import { AdminCompletionWorkflow } from "@/components/admin/AdminCompletionWorkflow";
import {
  ADMIN_DASHBOARD_ITEM,
  ADMIN_NAV_GROUPS,
  adminMobileNavValue,
  adminNavItemIsActive,
} from "@/lib/admin/adminNavigation";

interface AdminShellProps {
  title: string;
  description?: string;
  children?: ReactNode;
  compact?: boolean;
}

export const AdminShell = ({ title, description, children, compact = false }: AdminShellProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mobileNavValue = adminMobileNavValue(pathname);

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
      <header className="sticky top-0 z-40 bg-[#15202B] print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
          <Link
            to="/"
            className="text-sm text-[#8899A6] transition-colors hover:text-[#F1EFE8]"
          >
            학습자 수업 열기 ↗
          </Link>
        </div>
      </header>

      <div className={`flex gap-6 pl-5 pr-8 print:block print:p-0 ${compact ? "py-5" : "py-6"}`}>
        <aside className="hidden w-[285px] shrink-0 md:block print:hidden">
          <nav className="flex flex-col px-1">
            <Link
              to={ADMIN_DASHBOARD_ITEM.to}
              className={standaloneClasses(pathname === ADMIN_DASHBOARD_ITEM.to)}
            >
              {ADMIN_DASHBOARD_ITEM.label}
            </Link>

            {ADMIN_NAV_GROUPS.map((group) => (
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
                      className={itemClasses(adminNavItemIsActive(item, pathname))}
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

        <main className="min-w-0 flex-1 print:w-full">
          <div className="mb-5 print:hidden md:hidden">
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
              <option value="" disabled>이동할 화면 선택</option>
              <option value={ADMIN_DASHBOARD_ITEM.to}>{ADMIN_DASHBOARD_ITEM.label}</option>
              {ADMIN_NAV_GROUPS.map((group) => (
                <optgroup key={group.header} label={group.header}>
                  {group.items.map((item) => (
                    <option key={item.to} value={item.to}>
                      {item.label}{item.pending ? " · 준비 중" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex items-stretch gap-3 print:hidden">
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
          <AdminCompletionWorkflow pathname={pathname} />
          <div className="mt-6 print:mt-0">{children}</div>
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
