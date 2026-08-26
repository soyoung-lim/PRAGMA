import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ScanSearch } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { ResearchWorkflowGuide } from "@/components/research/ResearchWorkflowGuide";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type QualityCounts = {
  reviewRecords: number | null;
  professorApproved: number | null;
  error: string | null;
};

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};
type CountQuery = Promise<CountResult> & {
  eq: (column: string, value: string) => Promise<CountResult>;
};
const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string, options: { count: "exact"; head: true }) => CountQuery;
  };
};

const AdminQualityOverview = () => {
  const { pathname } = useLocation();
  const preview = pathname.startsWith("/prototype/");
  const [counts, setCounts] = useState<QualityCounts>({
    reviewRecords: null,
    professorApproved: null,
    error: null,
  });

  useEffect(() => {
    if (preview) {
      setCounts({ reviewRecords: 0, professorApproved: 0, error: null });
      return;
    }

    let active = true;
    void (async () => {
      const [reviews, approved] = await Promise.all([
        db.from("pragma_final_corpus_researcher_item_reviews").select("id", { count: "exact", head: true }),
        db.from("scenarios").select("scenario_id", { count: "exact", head: true }).eq("mission_status", "reviewed"),
      ]);
      if (!active) return;
      setCounts({
        reviewRecords: reviews.error ? null : reviews.count ?? 0,
        professorApproved: approved.error ? null : approved.count ?? 0,
        error: reviews.error?.message ?? approved.error?.message ?? null,
      });
    })();

    return () => { active = false; };
  }, [preview]);

  const autoPath = preview ? "/prototype/final-review" : "/admin/research-qa/final-review";
  const releasePath = preview ? "/prototype/mission-release" : "/admin/research-qa/releases";

  return (
    <AdminShell
      title="학습 콘텐츠 품질관리 현황"
      description="자동 품질 점검과 교수자 최종 검수·공개의 진행 상태를 한곳에서 확인합니다."
    >
      <ResearchWorkflowGuide current="overview" />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#D9D4C8] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#FFF4B3] text-[#5E4B00]">
              <ScanSearch className="h-5 w-5" aria-hidden />
            </span>
            <Badge variant="outline">1단계</Badge>
          </div>
          <h2 className="mt-4 text-lg font-semibold">자동 품질 점검</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            전체 학습 콘텐츠를 자동 점검하고, 경고가 있는 항목을 교수자가 먼저 확인합니다.
          </p>
          <p className="mt-4 text-sm font-medium">
            저장된 확인 기록 {counts.reviewRecords ?? "—"}건
          </p>
          <Link to={autoPath} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#15202B] hover:underline">
            점검 화면 열기 <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>

        <section className="rounded-xl border border-[#D9D4C8] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EAF2EE] text-[#355D4E]">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <Badge variant="outline">2단계</Badge>
          </div>
          <h2 className="mt-4 text-lg font-semibold">교수자 최종 검수·공개</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            자동 점검 결과와 콘텐츠를 확인한 교수자가 수업 사용과 학습자 공개를 최종 결정합니다.
          </p>
          <p className="mt-4 text-sm font-medium">
            교수자 최종 검수 완료 {counts.professorApproved ?? "—"}건
          </p>
          <Link to={releasePath} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#15202B] hover:underline">
            최종 검수 화면 열기 <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </div>

      {counts.error && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          운영 건수를 불러오지 못했습니다. 관리자 권한 또는 데이터 연결을 확인하세요.
        </p>
      )}
    </AdminShell>
  );
};

export default AdminQualityOverview;
