import { APPROVAL_STATUS, APP_ROLE, type Profile } from "@/lib/auth/constants";

/** 인증 뒤 학습 경로에 들어가기 위해 남은 관문을 반환한다. */
export function learnerAccessRedirect(
  profile: Pick<Profile, "role" | "profile_completed" | "approval_status"> | null,
): "/admin/dashboard" | "/home" | "/pending-approval" | null {
  if (profile?.role === APP_ROLE.ADMIN) return "/admin/dashboard";
  if (!profile?.profile_completed) return "/home";
  if (profile.approval_status !== APPROVAL_STATUS.APPROVED) return "/pending-approval";
  return null;
}
