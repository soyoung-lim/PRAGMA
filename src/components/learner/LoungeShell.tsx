import type { ReactNode } from "react";

import { HomeBrand } from "@/components/HomeBrand";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";

export const LoungeShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-svh bg-[#F3F0F6] text-[#292533] lg:h-svh lg:overflow-hidden">
    <header className="sticky top-0 z-40 h-14 bg-[#15202B] print:hidden">
      <div className="mx-auto flex h-full max-w-5xl items-center px-4 sm:px-6">
        <HomeBrand />
      </div>
    </header>
    <div className="mx-auto max-w-5xl px-4 sm:px-6">{children}</div>
    <LearnerBottomNav tone="lounge" />
  </div>
);
