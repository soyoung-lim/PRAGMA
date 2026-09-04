import { APPROVAL_STATUS, APP_ROLE, type Profile } from "@/lib/auth/constants";

/** 인증 뒤 학습 경로에 들어가기 위해 남은 관문을 반환한다. */
export function learnerAccessRedirect(
  profile: Pick<Profile, "role" | "profile_completed" | "approval_status"> | null,
): "/home" | "/pending-approval" | null {
  // 관리자는 운영 검수를 위해 학습자 커리큘럼과 미션 화면을 열람할 수 있다.
  // DB의 학습자 승인·연구 참여자 기록 경계는 별도로 유지한다.
  if (profile?.role === APP_ROLE.ADMIN) return null;
  if (!profile?.profile_completed) return "/home";
  if (profile.approval_status !== APPROVAL_STATUS.APPROVED) return "/pending-approval";
  return null;
}
