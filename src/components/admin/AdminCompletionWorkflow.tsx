import { Link } from "react-router-dom";
import {
  ADMIN_COMPLETION_WORKFLOW,
  adminCompletionWorkflowStage,
} from "@/lib/admin/adminNavigation";

export function AdminCompletionWorkflow({ pathname }: { pathname: string }) {
  const current = adminCompletionWorkflowStage(pathname);
  if (!current) return null;

  const currentIndex = ADMIN_COMPLETION_WORKFLOW.findIndex((stage) => stage.id === current.id);

  return (
    <section
      aria-label="PRAGMA 5단계 완성 흐름"
      className="mt-4 rounded-xl border border-[#D8D3C6] bg-white p-3 shadow-[0_4px_14px_rgba(21,32,43,0.04)] print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#486C65]">
            PRAGMA 수업 운영 흐름
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            현재 {currentIndex + 1}/5 · {current.label}
          </p>
        </div>
        {current.next && (
          <Link
            to={current.next.to}
            className="rounded-md bg-[#15202B] px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#263744]"
          >
            {current.next.label} →
          </Link>
        )}
      </div>

      <ol className="mt-3 grid gap-1.5 sm:grid-cols-5">
        {ADMIN_COMPLETION_WORKFLOW.map((stage, index) => {
          const active = stage.id === current.id;
          const complete = index < currentIndex;
          return (
            <li key={stage.id}>
              <Link
                to={stage.to}
                aria-current={active ? "step" : undefined}
                className={[
                  "flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-[11.5px] leading-tight transition-colors",
                  active
                    ? "border-[#15202B] bg-[#15202B] font-semibold text-white"
                    : complete
                      ? "border-[#B8CEC5] bg-[#F1F8F5] text-[#285D51] hover:bg-[#E8F3EE]"
                      : "border-[#E2DED2] bg-[#FAF9F5] text-[#59656D] hover:bg-[#F2F0E8]",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    active
                      ? "bg-[#FAD338] text-[#15202B]"
                      : complete
                        ? "bg-[#B8CEC5] text-[#204E44]"
                        : "bg-[#E4E1D8] text-[#59656D]",
                  ].join(" ")}
                >
                  {complete ? "✓" : index + 1}
                </span>
                {stage.shortLabel}
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#ECE7DA] pt-2.5">
        <span className="mr-1 text-[11px] font-semibold text-[#65756F]">현재 단계 바로가기</span>
        {current.actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="rounded-full border border-[#D6D2C7] bg-white px-2.5 py-1 text-[11.5px] text-[#365F58] hover:bg-[#F5F7F4]"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default AdminCompletionWorkflow;
