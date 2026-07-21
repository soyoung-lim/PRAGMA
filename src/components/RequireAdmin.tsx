import { Navigate } from "react-router-dom";
import { IS_DEV, useProfile } from "@/lib/auth/useProfile";
import { APP_ROLE } from "@/lib/auth/constants";

type Props = { children: React.ReactNode };

// D1 (2026-07-21): 공개 URL에서 /admin/* 스켈레톤 진입을 차단한다.
// - DEV 빌드: 통과 — localhost 프론트-우선 작업 흐름 유지 (import.meta.env.DEV는
//   빌드 타임에 false로 치환되므로 운영 번들에는 이 우회가 존재하지 않는다).
// - 운영 빌드: 실제 Supabase 세션 + profiles.role='admin'을 요구한다.
export const RequireAdmin = ({ children }: Props) => {
  const { loading, session, profile } = useProfile();

  if (IS_DEV) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }

  if (!session || profile?.role !== APP_ROLE.ADMIN) {
    return <Navigate to="/admin-login" replace />;
  }

  return <>{children}</>;
};

export default RequireAdmin;
