import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ArchiveRow {
  scenario_id: string;
  title: string;
  speech_act: string;
  learner_level: string | null;
  language_direction: string | null;
  mode: string | null;
  review_status: string;
  mission_status: string | null;
  usage_assignment: "archived_only" | "excluded";
  source_text: string | null;
}

const SPEECH_ACT_LABEL: Record<string, string> = {
  request: "요청", refusal: "거절", apology: "사과", gratitude: "감사",
  suggestion: "제안", invitation: "초대", objection: "반대",
  compliment: "칭찬", complaint: "불만",
};

const LEVEL_LABEL: Record<string, string> = {
  beginner_intermediate: "입문", intermediate: "중급", advanced: "고급",
};

const AdminArchive = () => {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [filter, setFilter] = useState<"all" | "archived_only" | "excluded">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("scenarios")
      .select("scenario_id,title,speech_act,learner_level,language_direction,mode,review_status,mission_status,usage_assignment,source_text")
      .in("usage_assignment", ["archived_only", "excluded"])
      .order("updated_at", { ascending: false })
      .limit(500);

    if (loadError) {
      setRows([]);
      setError(loadError.message);
    } else {
      setRows((data ?? []) as ArchiveRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const visibleRows = useMemo(
    () => rows.filter((row) => filter === "all" || row.usage_assignment === filter),
    [filter, rows],
  );
  const archivedCount = rows.filter((row) => row.usage_assignment === "archived_only").length;
  const excludedCount = rows.length - archivedCount;

  return (
    <AdminShell
      title="시나리오 아카이브"
      description="학습자 공개 흐름에서 분리하여 보관하거나 제외한 시나리오와 그 상태를 조회합니다."
    >
      <div className="max-w-[1080px] space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#EAE4D2] bg-[#FCFBF8] p-4">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>전체 {rows.length}</Button>
          <Button size="sm" variant={filter === "archived_only" ? "default" : "outline"} onClick={() => setFilter("archived_only")}>보관 {archivedCount}</Button>
          <Button size="sm" variant={filter === "excluded" ? "default" : "outline"} onClick={() => setFilter("excluded")}>제외 {excludedCount}</Button>
          <Button className="ml-auto" size="sm" variant="ghost" onClick={() => void loadRows()}>새로고침</Button>
        </div>

        {loading && <p className="py-8 text-center text-sm text-muted-foreground">아카이브를 불러오는 중…</p>}
        {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">아카이브를 불러오지 못했습니다. {error}</div>}
        {!loading && !error && visibleRows.length === 0 && <div className="rounded-xl border border-dashed border-[#D9D3C5] px-6 py-10 text-center text-sm text-muted-foreground">이 조건에 해당하는 시나리오가 없습니다.</div>}
        {!loading && !error && visibleRows.length > 0 && (
          <ul className="divide-y divide-[#EAE4D2] overflow-hidden rounded-xl border border-[#EAE4D2] bg-[#FCFBF8]">
            {visibleRows.map((row) => (
              <li key={row.scenario_id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{SPEECH_ACT_LABEL[row.speech_act] ?? row.speech_act}</Badge>
                  <Badge variant="outline">{LEVEL_LABEL[row.learner_level ?? ""] ?? row.learner_level ?? "수준 미지정"}</Badge>
                  <Badge variant="outline">{row.mode === "stt_interpreting" ? "통역" : "번역"}</Badge>
                  <Badge variant="outline">{row.language_direction === "zh_ko" ? "중→한" : row.language_direction === "ko_zh" ? "한→중" : "방향 미지정"}</Badge>
                  <Badge className={row.usage_assignment === "excluded" ? "bg-[#E5E7EB] text-[#374151]" : "bg-[#FBEFD9] text-[#7A4A0A]"}>{row.usage_assignment === "excluded" ? "제외" : "보관"}</Badge>
                </div>
                <p className="mt-2 font-medium text-[#15202B]">{row.title || "제목 없음"}</p>
                {row.source_text && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.source_text}</p>}
                <p className="mt-2 break-all text-[11px] text-muted-foreground">검수 {row.review_status} · 미션 {row.mission_status ?? "없음"} · {row.scenario_id}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
};

export default AdminArchive;
