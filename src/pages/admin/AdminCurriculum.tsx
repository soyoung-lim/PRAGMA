import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCurriculumOutlines } from "@/lib/curriculum/api";
import type { CurriculumOutlineRow } from "@/lib/curriculum/types";
import { LEVEL, type LearnerLevel } from "@/lib/pragma/enums";

// Read-only outline list (skeleton stage). Editing/saving/deleting and the
// Generator handoff come in later steps.
//
// Access: curriculum tables are admin-only via RLS (public.is_admin()).
// Like the other /admin/* pages there is no client-side guard here — a
// non-admin session simply gets an RLS error (surfaced in the error state)
// or an empty read. Authorization stays in the DB.

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  published: "게시",
  archived: "보관",
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground hover:bg-muted",
  published: "bg-emerald-600 text-white hover:bg-emerald-600",
  archived: "bg-[#EAE4D2] text-[#5B5446] hover:bg-[#EAE4D2]",
};

const AdminCurriculum = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outlines, setOutlines] = useState<CurriculumOutlineRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // API already sorts by updated_at desc — no re-sorting here.
        const rows = await listCurriculumOutlines();
        if (!cancelled) setOutlines(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "커리큘럼을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell
      title="15주 커리큘럼"
      description="학기 단위 화행·P·D·R 주차 배치 골격을 관리합니다"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3.5 text-[13px] leading-relaxed text-foreground">
          커리큘럼은 주차별 화행·채널·P·D·R 셀을 배치하는 매크로 골격입니다. 실제
          시나리오 생성·검수는 기존 생성기·아카이브 흐름을 그대로 사용합니다.
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
            커리큘럼 조회 실패: {error}
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : outlines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">아직 커리큘럼이 없습니다.</p>
            <p className="mt-1 text-[12px] text-muted-foreground/80">
              커리큘럼 생성 기능은 다음 단계에서 추가됩니다.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>제목</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>수준</TableHead>
                <TableHead>마지막 수정</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outlines.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE_CLASS[o.status] ?? ""}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{LEVEL[o.level as LearnerLevel] ?? o.level}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(o.updated_at).toLocaleString("ko-KR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminShell>
  );
};

export default AdminCurriculum;
