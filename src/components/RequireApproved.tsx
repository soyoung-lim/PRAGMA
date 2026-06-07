import { Navigate } from "react-router-dom";
import { useProfile } from "@/lib/auth/useProfile";
import { APPROVAL_STATUS } from "@/lib/auth/constants";

type Props = { children: React.ReactNode };

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

  if (!profile || profile.approval_status !== APPROVAL_STATUS.APPROVED) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};

export default RequireApproved;