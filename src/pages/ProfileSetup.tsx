import { Navigate, useNavigate } from "react-router-dom";
import { useProfile } from "@/lib/auth/useProfile";
import { HomeBrand } from "@/components/HomeBrand";
import { ProfileWizardForm } from "@/components/ProfileWizardForm";

// Legacy standalone page. Onboarding now uses a modal on /home, but this route
// remains for direct navigation and as a fallback. It keeps the same gate semantics
// (login required; if profile already completed, bounce to /home).
const ProfileSetup = () => {
  const navigate = useNavigate();
  const { loading, session, profile, isDevStub } = useProfile();

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
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">프로필 설정</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          학습을 시작하기 전에 연구 배경 정보를 입력해 주세요. (3단계)
        </p>
        <div className="mt-8">
          <ProfileWizardForm onCompleted={() => navigate("/roadmap", { replace: true })} />
        </div>
      </main>
    </div>
  );
};

export default ProfileSetup;