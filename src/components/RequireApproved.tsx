import { Navigate, useLocation } from "react-router-dom";
import { IS_DEV, useProfile } from "@/lib/auth/useProfile";
import { loginPathFor } from "@/lib/auth/loginReturn";

type Props = {
  children: React.ReactNode;
  /** 로그인 상태와 무관하게 명시적인 DEV mission_v4/v5 검토 링크만 연다. */
  allowDevMissionPreview?: boolean;
};

// Gate semantics (Sprint 1B-1a): login + profile_completed only.
// approval_status is no longer checked here.
export const RequireApproved = ({ children, allowDevMissionPreview = false }: Props) => {
  const location = useLocation();
  const { loading, session, profile, isDevStub } = useProfile();
  const previewVersion = new URLSearchParams(location.search).get("preview");
  const isDevMissionPreview =
    IS_DEV &&
    allowDevMissionPreview &&
    location.pathname === "/learner/practice" &&
    (previewVersion === "v4" || previewVersion === "v5");

  // 검토 URL은 새 탭에서 열리므로 sessionStorage 기반 DEV stub을 공유하지 못한다.
  // 실제 시나리오 경로와 production에는 적용하지 않고, 명시적 v4/v5 preview만 우회한다.
  if (isDevMissionPreview) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }

  if (!session && !isDevStub) {
    return <Navigate to={loginPathFor(`${location.pathname}${location.search}${location.hash}`)} replace />;
  }

  if (!profile || !profile.profile_completed) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

export default RequireApproved;
