import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DIRECTION_LABEL,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type GenMode,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";

const PAGE_SIZE = 100;
type ArchiveFilter = "all" | "archived_only" | "excluded";

interface ArchiveRow {
  scenario_id: string;
  title: string;
  speech_act: SpeechActUI;
  learner_level: LearnerLevel | null;
  language_direction: LanguageDirection | null;
  mode: GenMode | null;
  review_status: string;
  mission_status: string | null;
  usage_assignment: "archived_only" | "excluded";
  source_text: string | null;
}

const AdminArchive = () => {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [page, setPage] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const first = page * PAGE_SIZE;
    const baseQuery = supabase
      .from("scenarios")
      .select(
        "scenario_id,title,speech_act,learner_level,language_direction,mode,review_status,mission_status,usage_assignment,source_text",
        { count: "exact" },
      );
    const filteredQuery = filter === "all"
      ? baseQuery.in("usage_assignment", ["archived_only", "excluded"])
      : baseQuery.eq("usage_assignment", filter);
    const [rowsResult, archivedResult, excludedResult] = await Promise.all([
      filteredQuery
        .order("updated_at", { ascending: false })
        .range(first, first + PAGE_SIZE - 1),
      supabase
        .from("scenarios")
        .select("scenario_id", { count: "exact", head: true })
        .eq("usage_assignment", "archived_only"),
      supabase
        .from("scenarios")
        .select("scenario_id", { count: "exact", head: true })
        .eq("usage_assignment", "excluded"),
    ]);
    const loadError = rowsResult.error ?? archivedResult.error ?? excludedResult.error;

    if (loadError) {
      setRows([]);
      setError(loadError.message);
    } else {
      setRows((rowsResult.data ?? []) as ArchiveRow[]);
      setMatchedCount(rowsResult.count ?? 0);
      setArchivedCount(archivedResult.count ?? 0);
      setExcludedCount(excludedResult.count ?? 0);
    }
    setLoading(false);
  }, [filter, page]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const selectFilter = (nextFilter: ArchiveFilter) => {
    setFilter(nextFilter);
    setPage(0);
  };
  const pageStart = rows.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = page * PAGE_SIZE + rows.length;

  return (
    <AdminShell
      title="시나리오 아카이브"
      description="학습자 공개 흐름에서 분리하여 보관하거나 제외한 시나리오와 그 상태를 조회합니다."
    >
      <div className="max-w-[1080px] space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#EAE4D2] bg-[#FCFBF8] p-4">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => selectFilter("all")}>전체 {archivedCount + excludedCount}</Button>
          <Button size="sm" variant={filter === "archived_only" ? "default" : "outline"} onClick={() => selectFilter("archived_only")}>보관 {archivedCount}</Button>
          <Button size="sm" variant={filter === "excluded" ? "default" : "outline"} onClick={() => selectFilter("excluded")}>제외 {excludedCount}</Button>
          <Button className="ml-auto" size="sm" variant="ghost" onClick={() => void loadRows()}>새로고침</Button>
        </div>

        {loading && <p className="py-8 text-center text-sm text-muted-foreground">아카이브를 불러오는 중…</p>}
        {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">아카이브를 불러오지 못했습니다. {error}</div>}
        {!loading && !error && rows.length === 0 && <div className="rounded-xl border border-dashed border-[#D9D3C5] px-6 py-10 text-center text-sm text-muted-foreground">이 조건에 해당하는 시나리오가 없습니다.</div>}
        {!loading && !error && rows.length > 0 && (
          <ul className="divide-y divide-[#EAE4D2] overflow-hidden rounded-xl border border-[#EAE4D2] bg-[#FCFBF8]">
            {rows.map((row) => (
              <li key={row.scenario_id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{SPEECH_ACT_UI[row.speech_act]}</Badge>
                  <Badge variant="outline">{row.learner_level ? LEVEL[row.learner_level] : "수준 미지정"}</Badge>
                  <Badge variant="outline">{row.mode ? MODE_LABEL[row.mode] : "방식 미지정"}</Badge>
                  <Badge variant="outline">{row.language_direction ? DIRECTION_LABEL[row.language_direction] : "방향 미지정"}</Badge>
                  <Badge className={row.usage_assignment === "excluded" ? "bg-[#E5E7EB] text-[#374151]" : "bg-[#FBEFD9] text-[#7A4A0A]"}>{row.usage_assignment === "excluded" ? "제외" : "보관"}</Badge>
                </div>
                <p className="mt-2 font-medium text-[#15202B]">{row.title || "제목 없음"}</p>
                {row.source_text && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.source_text}</p>}
                <p className="mt-2 break-all text-[11px] text-muted-foreground">검수 {row.review_status} · 미션 {row.mission_status ?? "없음"} · {row.scenario_id}</p>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && matchedCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{matchedCount}건 중 {pageStart}–{pageEnd}건</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>이전</Button>
              <Button size="sm" variant="outline" disabled={pageEnd >= matchedCount} onClick={() => setPage((current) => current + 1)}>다음</Button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
};

export default AdminArchive;

