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
      className="mb-5 rounded-lg border border-[#D8D3C6] bg-white px-3 py-2.5 print:hidden"
    >
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="flex shrink-0 items-center justify-between gap-3 xl:w-[190px] xl:justify-start">
          <p className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.1em] text-[#486C65]">
            PRAGMA 통합 운영 흐름
          </p>
          <span className="rounded-full bg-[#F2F0E8] px-2 py-0.5 text-[10.5px] font-semibold text-[#59656D]">
            {currentIndex + 1}/5
          </span>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <ol className="grid min-w-[590px] grid-cols-5 gap-1">
            {ADMIN_COMPLETION_WORKFLOW.map((stage, index) => {
              const active = stage.id === current.id;
              const complete = index < currentIndex;
              return (
                <li key={stage.id}>
                  <Link
                    to={stage.to}
                    aria-current={active ? "step" : undefined}
                    className={[
                      "flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] leading-tight transition-colors",
                      active
                        ? "border-[#15202B] bg-[#15202B] font-semibold text-white"
                        : complete
                          ? "border-[#B8CEC5] bg-[#F1F8F5] text-[#285D51] hover:bg-[#E8F3EE]"
                          : "border-[#E2DED2] bg-[#FAF9F5] text-[#59656D] hover:bg-[#F2F0E8]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
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
        </div>
        {current.next && (
          <Link
            to={current.next.to}
            className="shrink-0 self-end whitespace-nowrap px-1 py-1 text-[11.5px] font-semibold text-[#365F58] transition-colors hover:text-[#15202B] xl:self-auto"
          >
            {current.next.label} →
          </Link>
        )}
      </div>
    </section>
  );
}

export default AdminCompletionWorkflow;
