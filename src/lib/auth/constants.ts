// Single source of truth for role + approval_status enum values.
// Mirrors Postgres enums public.app_role and public.approval_status.

export const APPROVAL_STATUS = {
  PENDING: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  INACTIVE: "inactive",
} as const;

export type ApprovalStatus = (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

export const APP_ROLE = {
  LEARNER: "learner",
  ADMIN: "admin",
} as const;

export type AppRole = (typeof APP_ROLE)[keyof typeof APP_ROLE];

export type Profile = {
  id: string;
  user_id: string;
  role: AppRole;
  approval_status: ApprovalStatus;
  profile_completed: boolean;
  email: string | null;
  anonymous_participant_id: string | null;
};

// Routes that require an approved learner profile.
export const APPROVED_ONLY_ROUTES = [
  "/scenario",
  "/translate",
  "/pdr",
  "/finalize",
  "/dashboard",
] as const;