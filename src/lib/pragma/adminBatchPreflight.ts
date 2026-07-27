import { supabase } from "@/integrations/supabase/client";

type PreflightError = { message: string } | null;

export type AdminBatchPreflightClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: PreflightError;
    }>;
  };
  rpc: (fn: "is_admin") => Promise<{
    data: boolean | null;
    error: PreflightError;
  }>;
};

export type AdminBatchPreflightResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * AI 호출 전에 유효한 관리자 세션인지 확인한다.
 *
 * 이것은 비용 낭비를 막는 클라이언트 선행 검사이며 권한 경계가 아니다.
 * 실제 저장 권한은 계속 DB의 RLS와 관리자 전용 RPC가 판정한다.
 */
export async function preflightAdminBatch(
  client: AdminBatchPreflightClient = supabase as unknown as AdminBatchPreflightClient,
): Promise<AdminBatchPreflightResult> {
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError || !authData.user) {
    return {
      ok: false,
      message: "관리자 세션이 없습니다. 다시 로그인한 뒤 실행해 주세요.",
    };
  }

  const { data: isAdmin, error: adminError } = await client.rpc("is_admin");
  if (adminError || isAdmin !== true) {
    return {
      ok: false,
      message: "관리자 권한을 확인할 수 없습니다. 관리자 계정으로 다시 로그인해 주세요.",
    };
  }

  return { ok: true };
}
