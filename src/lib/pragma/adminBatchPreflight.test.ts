import { describe, expect, it, vi } from "vitest";

import {
  preflightAdminBatch,
  type AdminBatchPreflightClient,
} from "@/lib/pragma/adminBatchPreflight";

function clientWith(
  user: { id: string } | null,
  isAdmin: boolean | null,
  authError: { message: string } | null = null,
  adminError: { message: string } | null = null,
): AdminBatchPreflightClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: isAdmin,
      error: adminError,
    }),
  };
}

describe("preflightAdminBatch", () => {
  it("유효한 관리자 세션만 통과시킨다", async () => {
    const result = await preflightAdminBatch(clientWith({ id: "admin-1" }, true));

    expect(result).toEqual({ ok: true });
  });

  it("사용자가 없으면 관리자 RPC를 호출하지 않고 차단한다", async () => {
    const client = clientWith(null, true);

    const result = await preflightAdminBatch(client);

    expect(result).toEqual({
      ok: false,
      message: "관리자 세션이 없습니다. 다시 로그인한 뒤 실행해 주세요.",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("인증 조회가 실패하면 차단한다", async () => {
    const client = clientWith(null, true, { message: "expired token" });

    const result = await preflightAdminBatch(client);

    expect(result.ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("로그인했어도 관리자가 아니면 차단한다", async () => {
    const result = await preflightAdminBatch(clientWith({ id: "learner-1" }, false));

    expect(result).toEqual({
      ok: false,
      message: "관리자 권한을 확인할 수 없습니다. 관리자 계정으로 다시 로그인해 주세요.",
    });
  });

  it("관리자 판정 RPC가 실패하면 차단한다", async () => {
    const result = await preflightAdminBatch(
      clientWith({ id: "admin-1" }, null, null, { message: "permission denied" }),
    );

    expect(result.ok).toBe(false);
  });
});
