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
    <main className="flex min-h-[calc(100svh-3.5rem)] items-center pb-16">
      <div className="mx-auto w-full max-w-4xl py-6 sm:py-8">
        <header className="mx-auto max-w-xl text-center">
          <p className="text-[11px] font-black tracking-[0.2em] text-[#76538C]">PRAGMA LOUNGE</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#292533] sm:text-4xl">가볍게 둘러보기</h1>
          <p className="mt-2 break-keep text-sm leading-6 text-[#756D7D]">
            수업과 기록에는 남지 않는 짧은 언어·문화 탐색
          </p>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="라운지 모듈">
          {LOUNGE_MODULES.map((module) => {
            const Icon = MODULE_ICON[module.id];
            return (
              <Link
                key={module.id}
                to={`/learner/lounge/${module.id}`}
                className="group flex min-h-44 flex-col rounded-[1.5rem] border border-[#DCD5E4] p-4 shadow-[0_8px_24px_rgba(64,56,79,0.06)] transition hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(64,56,79,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#76538C]"
                style={{ backgroundColor: module.soft }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/75"
                    style={{ color: module.accent }}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <ArrowRight
                    className="mt-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                    style={{ color: module.accent }}
                    aria-hidden
                  />
                </div>
                <p className="mt-4 text-[11px] font-black" style={{ color: module.accent }}>
                  {module.eyebrow}
                </p>
                <h2 className="mt-1 text-xl font-black text-[#292533]">{module.title}</h2>
                <p className="mt-2 break-keep text-sm leading-6 text-[#6E6676]">{module.description}</p>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  </LoungeShell>
);

export default LoungeHub;
