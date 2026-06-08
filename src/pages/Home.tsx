import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useProfile } from "@/lib/auth/useProfile";
import { HomeBrand } from "@/components/HomeBrand";
import { WORKFLOW_STEPS } from "@/lib/workflowSteps";
import { ProfileWizardForm } from "@/components/ProfileWizardForm";
import { cn } from "@/lib/utils";

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "주어진 발화 상황과 맥락을 파악합니다.",
  2: "복수의 AI 번역안을 비교·검토합니다.",
  3: "AI 피드백을 확인하고 근거를 짚어봅니다.",
  4: "근거에 따라 최종 번역안을 확정합니다.",
  5: "의사결정 과정을 리포트로 정리합니다.",
};

const Home = () => {
  const navigate = useNavigate();
  const { loading, session, profile, isDevStub } = useProfile();

  const [profileOpen, setProfileOpen] = useState(false);

  const needsProfile = !profile?.profile_completed;

  useEffect(() => {
    if (needsProfile) {
      const timer = setTimeout(() => setProfileOpen(true), 600);
      return () => clearTimeout(timer);
    }
    setProfileOpen(false);
  }, [needsProfile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }

  if (!session && !isDevStub) {
    return <Navigate to="/student-login" replace />;
  }

  const stepEntries = Object.entries(WORKFLOW_STEPS)
    .map(([k, v]) => ({ n: Number(k), ...v }))
    .sort((a, b) => a.n - b.n);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-12">
        <section>
          <h1 className="text-[28px] font-bold tracking-tight sm:text-[32px]">
            학습 워크플로우 안내
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            아래 5단계로 진행됩니다. 각 단계에서 AI 번역안과 피드백을 검토하며
            나만의 최종안을 만들고, 마지막에 의사결정 과정을 리포트로 정리합니다.
          </p>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stepEntries.map((s) => (
            <div
              key={s.n}
              className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#15202B] text-sm font-semibold text-white">
                {s.n}
              </div>
              <div className="mt-3 text-[15px] font-semibold">{s.full}</div>
              <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {STEP_DESCRIPTIONS[s.n]}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <button
            type="button"
            onClick={() => navigate("/scenario")}
            disabled={needsProfile}
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-[#15202B] px-6 py-3 text-[15px] font-medium text-white shadow-sm",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            학습 시작하기 →
          </button>
          {needsProfile && (
            <p className="mt-3 text-xs text-muted-foreground">
              학습을 시작하기 전에 프로필 작성이 필요합니다.
            </p>
          )}
        </section>
      </main>

      {/* Profile modal — opens gently after a short delay so the home page is visible first */}
      <DialogPrimitive.Root open={profileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
              "duration-300",
            )}
          />
          <DialogPrimitive.Content
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            className={cn(
              "fixed left-[50%] top-[50%] z-50 grid w-[95vw] max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg",
              "duration-300",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            )}
          >
            <DialogPrimitive.Title className="text-xl font-bold tracking-tight">
              학습을 시작하기 전에
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              아래 정보는 연구 배경 분석에만 익명으로 활용되며, 2~3분이면 입력할
              수 있어요.
            </DialogPrimitive.Description>
            <div className="-mx-2 mt-2 max-h-[65vh] overflow-y-auto px-2">
              <ProfileWizardForm onCompleted={() => setProfileOpen(false)} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
};

export default Home;
