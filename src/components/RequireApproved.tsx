import { Navigate } from "react-router-dom";
import { useProfile } from "@/lib/auth/useProfile";

type Props = { children: React.ReactNode };

// Gate semantics (Sprint 1B-1a): login + profile_completed only.
// approval_status is no longer checked here.
export const RequireApproved = ({ children }: Props) => {
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

  if (!profile || !profile.profile_completed) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
};

export default RequireApproved;