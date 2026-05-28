import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col px-6 py-16">
        <div className="flex items-stretch gap-3">
          <span aria-hidden className="mt-1 w-[5px] shrink-0 self-stretch rounded-sm bg-[#FAD338]" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">관리자 로그인</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              관리자 비밀번호를 입력하세요. 실제 인증은 후속 단계에서 연결됩니다.
            </p>
          </div>
        </div>
        <form
          className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            navigate("/admin/dashboard");
          }}
        >
          <label className="text-sm font-medium">비밀번호</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="••••••••"
          />
          <button
            type="submit"
            className="mt-2 rounded-md bg-[#FAD338] px-4 py-2 text-sm font-medium text-[#15202B] hover:brightness-95"
          >
            입장 (placeholder)
          </button>
          <p className="text-[11px] text-muted-foreground">
            ※ 이 화면은 스켈레톤입니다. 어떤 비밀번호든 대시보드로 이동합니다.
          </p>
        </form>
      </main>
    </div>
  );
};

export default AdminLogin;