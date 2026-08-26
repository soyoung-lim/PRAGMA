import { Link } from "react-router-dom";
import { ADMIN_COMPLETION_WORKFLOW } from "@/lib/admin/adminNavigation";

export function AdminCompletionWorkflow() {
  return (
    <section
      aria-labelledby="pragma-operation-structure"
      className="mb-6 rounded-lg border border-[#D8D3C6] bg-white px-3 py-2.5 print:hidden"
    >
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <p
          id="pragma-operation-structure"
          className="shrink-0 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.1em] text-[#486C65] xl:w-[145px]"
        >
          PRAGMA 운영 구조
        </p>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <ol className="grid min-w-[590px] grid-cols-5 gap-1">
            {ADMIN_COMPLETION_WORKFLOW.map((stage, index) => {
              return (
                <li key={stage.id}>
                  <Link
                    to={stage.to}
                    className="flex min-h-8 items-center gap-1.5 rounded-md border border-[#E2DED2] bg-[#FAF9F5] px-2 py-1.5 text-[11px] font-medium leading-tight text-[#46545C] transition-colors hover:border-[#D6BC40] hover:bg-[#FFF8D6] hover:text-[#15202B]"
                  >
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FAD338] text-[9px] font-bold text-[#15202B]">
                      {index + 1}
                    </span>
                    {stage.shortLabel}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default AdminCompletionWorkflow;
