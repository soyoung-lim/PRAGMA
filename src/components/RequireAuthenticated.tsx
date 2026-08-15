import { Navigate, useLocation } from "react-router-dom";

import { useProfile } from "@/lib/auth/useProfile";

const RequireAuthenticated = ({ children }: { children: React.ReactNode }) => {
  const { loading, session } = useProfile();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">불러오는 중…</div>;
  }
  if (!session) {
    return <Navigate to="/expert-login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
};

export default RequireAuthenticated;

