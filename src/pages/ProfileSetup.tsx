import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, IS_DEV, devStubCompleteProfile } from "@/lib/auth/useProfile";
import { HomeBrand } from "@/components/HomeBrand";
import { toast } from "sonner";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { loading, session, profile, isDevStub, refresh } = useProfile();

  const [fullName, setFullName] = useState("");
  const [researchConsent, setResearchConsent] = useState(false);
  const [anonConfirmed, setAnonConfirmed] = useState(false);
  const [reportConsent, setReportConsent] = useState(false);
  const [busy, setBusy] = useState(false);

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

  if (profile?.profile_completed) {
    return <Navigate to="/scenario" replace />;
  }

  const trimmedName = fullName.trim();
  const canSubmit = trimmedName.length > 0 && researchConsent && anonConfirmed && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isDevStub) {
        devStubCompleteProfile(trimmedName);
      } else if (profile) {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: trimmedName,
            research_use_consent: researchConsent,
            anonymization_notice_confirmed: anonConfirmed,
            report_email_consent: reportConsent,
            profile_completed: true,
          })
          .eq("user_id", profile.user_id);
        if (error) throw error;
      }
      await refresh();
      navigate("/scenario", { replace: true });
    } catch {
      toast.error("프로필 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">프로필 설정</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          학습을 시작하기 전에 간단한 정보를 입력해 주세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium">
              이름 <span className="text-destructive">*</span>
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              required
              className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="실명을 입력해 주세요"
            />
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
            식별정보(이름·이메일)는 운영 목적으로만 사용되며, 연구 분석은 익명 식별자로만 수행됩니다.
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={researchConsent}
                onChange={(e) => setResearchConsent(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="font-medium">[필수]</span> 연구 목적의 학습 데이터 활용에 동의합니다.
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={anonConfirmed}
                onChange={(e) => setAnonConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="font-medium">[필수]</span> 연구 분석은 익명 식별자로만 수행됨을 확인했습니다.
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={reportConsent}
                onChange={(e) => setReportConsent(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="text-muted-foreground">[선택]</span> 학습 리포트 이메일 수신에 동의합니다.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-md bg-[#15202B] px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#15202B]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "저장 중…" : "학습 시작하기"}
          </button>
        </form>
      </main>
    </div>
  );
};

export default ProfileSetup;