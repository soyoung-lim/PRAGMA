import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useProfile } from "@/lib/auth/useProfile";
import { HomeBrand } from "@/components/HomeBrand";
import { ProfileWizardForm } from "@/components/ProfileWizardForm";
import { cn } from "@/lib/utils";

// /home = 프로필 관문 전용 화면. 프로필을 마친 학습자는 아래에서 /learner/home으로
// 리디렉트되므로, 이 페이지 본문은 **미완료 학습자에게만** 보인다.
// ⚠️ 여기에 학습 여정을 설명하지 않는다 — 구 5단계 번역 워크플로우 안내가 그렇게
//    남아 있다가 실제 여정과 어긋난 채 모달 뒤에 비쳤다(2026-07-26 교체). 여정 설명은
//    /learner/home 한 곳에서만 관리한다.
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

  if (profile?.profile_completed) {
    return <Navigate to="/learner/home" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
        <section>
          <h1 className="text-[28px] font-bold tracking-tight sm:text-[32px]">
            학습자 프로필
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            학습을 시작하기 전에 간단한 배경 정보를 입력합니다. 2~3분이면 됩니다.
          </p>
        </section>

        <section className="mt-8">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-[#15202B] px-6 py-3 text-[15px] font-medium text-white shadow-sm",
              "transition-colors hover:bg-[#22303E]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2",
            )}
          >
            프로필 작성하기 →
          </button>
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
              <ProfileWizardForm
                onCompleted={() => {
                  setProfileOpen(false);
                  navigate("/learner/home", { replace: true });
                }}
              />

            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
};

export default Home;
