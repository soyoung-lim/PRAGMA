import { ArrowRight, GitCompareArrows, Landmark, MessagesSquare } from "lucide-react";
import { Link } from "react-router-dom";

import { LoungeShell } from "@/components/learner/LoungeShell";
import { LOUNGE_MODULES, type LoungeModuleId } from "@/lib/lounge/loungeTypes";

const MODULE_ICON = {
  decode: MessagesSquare,
  culture: Landmark,
  literal: GitCompareArrows,
} satisfies Record<LoungeModuleId, typeof MessagesSquare>;

const LoungeHub = () => (
  <LoungeShell>
    <main className="mx-auto max-w-[820px] pb-[4.5rem] pt-4 sm:pt-5" aria-labelledby="lounge-title">
      <header className="mb-6">
        <div className="border-l-4 border-[#FAD338] pl-3">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#76538C]">PRAGMA LOUNGE</p>
          <h1
            id="lounge-title"
            className="mt-0.5 text-[26px] font-bold leading-9 tracking-[-0.04em] text-[#15202B]"
          >
            가볍게 둘러보기
          </h1>
        </div>
        <p className="mt-2 break-keep pl-4 text-[13px] leading-5 text-[#74808E]">
          수업과 기록에는 남지 않는 짧은 언어·문화 탐색
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="라운지 모듈">
        {LOUNGE_MODULES.map((module) => {
          const Icon = MODULE_ICON[module.id];
          return (
            <Link
              key={module.id}
              to={`/learner/lounge/${module.id}`}
              className="group flex min-h-44 flex-col rounded-2xl border border-[#E5E1D6] bg-white p-4 text-left shadow-[0_2px_8px_rgba(21,32,43,0.025)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#C7BB96] hover:shadow-[0_6px_20px_rgba(21,32,43,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: module.soft, color: module.accent }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none"
                  style={{ backgroundColor: module.soft, color: module.accent }}
                >
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </span>
              </div>
              <p className="mt-4 text-[11px] font-semibold" style={{ color: module.accent }}>
                {module.eyebrow}
              </p>
              <h2 className="mt-1 text-[19px] font-bold leading-7 tracking-[-0.035em] text-[#15202B]">
                {module.title}
              </h2>
              <p className="mt-2 break-keep text-[13px] leading-5 text-[#74808E]">{module.description}</p>
            </Link>
          );
        })}
      </section>
    </main>
  </LoungeShell>
);

export default LoungeHub;
