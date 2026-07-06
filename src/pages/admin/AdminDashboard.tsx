import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SkeletonCard = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-3 text-2xl font-semibold text-muted-foreground/40">—</p>
    <p className="mt-2 text-[11px] text-muted-foreground/60">후속 단계(1A-2)에서 실데이터 연결</p>
  </div>
);

const AdminDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("is_admin");
      setIsAdmin(Boolean(data));
    })();
  }, []);

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }
      // Safety: WHERE user_id = auth.uid() — only my own row.
      const { data, error } = await supabase
        .from("profiles")
        .update({ profile_completed: false })
        .eq("user_id", uid)
        .select("user_id, profile_completed");
      if (error) throw error;
      console.log("[reset-profile] updated rows:", data);
      toast.success("초기화됨. 로그아웃 후 다시 로그인하면 프로필 설정부터 시작합니다.");
      window.dispatchEvent(new Event("profile-changed"));
    } catch (e) {
      console.error("[reset-profile] failed:", e);
      toast.error("초기화 실패: " + (e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <AdminShell
      title="대시보드"
      description="운영 현황 요약 — 카운트와 차트는 후속 단계에서 연결됩니다."
    >
      {isAdmin && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <div className="text-sm">
            <p className="font-medium">개발/테스트 도구</p>
            <p className="text-xs text-muted-foreground">
              내 프로필을 미완료 상태로 되돌려 신규 온보딩 플로우를 재현합니다.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={resetting}>
                내 프로필 초기화 (테스트용)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>내 프로필을 초기화하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  내 프로필을 미완료 상태로 되돌립니다. 다음 로그인 때 프로필 설정 화면부터 다시
                  시작합니다. 계속할까요?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>계속</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard label="생성된 시나리오" />
        <SkeletonCard label="검수 대기" />
        <SkeletonCard label="승인 완료" />
        <SkeletonCard label="강의 공개" />
      </div>
    </AdminShell>
  );
};

export default AdminDashboard;
