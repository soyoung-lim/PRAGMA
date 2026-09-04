import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, IS_DEV, devStubApproveCurrent, devStubSignOut } from "@/lib/auth/useProfile";
import { APPROVAL_STATUS, APP_ROLE } from "@/lib/auth/constants";
import { HomeBrand } from "@/components/HomeBrand";

const PendingApproval = () => {
  const navigate = useNavigate();
  const { loading, session, profile, isDevStub, refresh } = useProfile();

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

  if (profile?.role === APP_ROLE.ADMIN) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (profile?.approval_status === APPROVAL_STATUS.APPROVED) {
    return <Navigate to="/learner/course" replace />;
  }

  const handleSignOut = async () => {
    if (isDevStub) devStubSignOut();
    else await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  const handleDevApprove = async () => {
    if (!IS_DEV) return;
    if (isDevStub) {
      devStubApproveCurrent();
      return;
    }
    if (!profile) return;
    await supabase
      .from("profiles")
      .update({ approval_status: APPROVAL_STATUS.APPROVED })
      .eq("user_id", profile.user_id);
    await refresh();
  };

  const statusLabel =
    profile?.approval_status === APPROVAL_STATUS.REJECTED
      ? "참여 신청이 반려되었습니다."
      : profile?.approval_status === APPROVAL_STATUS.INACTIVE
      ? "계정이 비활성 상태입니다."
      : "학습 참여 신청이 완료되었습니다. 교수자 승인 후 학습을 시작할 수 있습니다.";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          승인 대기
        </div>
        <h1 className="text-2xl font-bold tracking-tight">참여 신청 완료</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{statusLabel}</p>
        {profile?.email && (
          <p className="mt-2 text-xs text-muted-foreground">{profile.email}</p>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-8 rounded-md border border-[#15202B] bg-transparent px-5 py-2 text-sm text-[#15202B] transition-colors hover:bg-[#15202B]/[0.04]"
        >
          로그아웃
        </button>
        {IS_DEV && (
          <button
            type="button"
            onClick={handleDevApprove}
            className="mt-3 rounded-md border border-dashed border-muted-foreground/40 bg-transparent px-4 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted/40"
          >
            [DEV] 현재 사용자 즉시 승인 (mock)
          </button>
        )}
      </main>
    </div>
  );
};

export default PendingApproval;
