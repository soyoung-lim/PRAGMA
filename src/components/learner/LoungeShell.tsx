import type { ReactNode } from "react";

import { HomeBrand } from "@/components/HomeBrand";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";

export const LoungeShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-svh bg-background text-foreground lg:h-svh lg:overflow-hidden">
    <header className="sticky top-0 z-40 bg-[#15202B] print:hidden">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
        <HomeBrand />
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-6 py-3">{children}</div>
    <LearnerBottomNav />
  </div>
);
