import { Fragment, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MissionLog = Database["public"]["Tables"]["learner_mission_logs"]["Row"];
type ProfileSummary = {
  full_name: string | null;
  email: string | null;
  anonymous_participant_id: string | null;
};
type MissionLogRow = MissionLog & { profiles: ProfileSummary | null };

const DETAIL_FIELDS: Array<{ key: keyof MissionLog; label: string }> = [
  { key: "source_text", label: "출발어 원문·전사" },
  { key: "first_response", label: "최초 응답" },
  { key: "context_judgment", label: "화행 판단·피드백 기록" },
  { key: "revision_target_selected", label: "선택한 수정 지점" },
  { key: "revision_target_source", label: "수정 지점 출처" },
  { key: "revised_response", label: "수정 응답" },
  { key: "transfer_response", label: "전이 응답" },
  { key: "target_feature_observed", label: "목표 특징 관찰" },
  { key: "semantic_fidelity_status", label: "의미 충실도" },
  { key: "self_confidence_rating", label: "자신감" },
  { key: "content_ver", label: "콘텐츠 버전" },
  { key: "policy_ver", label: "정책 버전" },
];

const fmtKst = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
};

const learnerLabel = (row: MissionLogRow) =>
  row.profiles?.full_name ?? row.profiles?.anonymous_participant_id ?? `${row.profile_id.slice(0, 8)}…`;

const DetailPanel = ({ row }: { row: MissionLogRow }) => {
  const fields = DETAIL_FIELDS.filter(({ key }) => {
    const value = row[key];
    return value !== null && value !== undefined && value !== "";
  });

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-2">
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">표시할 수행 내용이 없습니다.</p>
      ) : (
        fields.map(({ key, label }) => (
          <div key={key} className="min-w-0">
            <div className="text-xs font-semibold text-muted-foreground">{label}</div>
            <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-background p-2 text-[13px] leading-relaxed text-foreground">
              {renderValue(row[key])}
            </pre>
          </div>
        ))
      )}
    </div>
  );
};

const Page = () => {
  const [rows, setRows] = useState<MissionLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("learner_mission_logs")
        .select(
          "*, profiles!learner_mission_logs_profile_id_fkey(full_name,email,anonymous_participant_id)",
        )
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as MissionLogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completedCount = useMemo(
    () => rows?.filter((row) => row.mission_completed).length ?? 0,
    [rows],
  );
  const loading = rows === null;

  return (
    <AdminShell
      title="학습 수행 기록"
      description="현행 학습미션의 판단, 최초 산출, 피드백 후 수정과 완료 상태를 학습자별로 확인합니다."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{loading ? "불러오는 중…" : error ? "조회 실패" : `총 ${rows.length}건`}</span>
        {!loading && !error && <span>완료 {completedCount}건</span>}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          학습 수행 기록 조회 실패: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          아직 학습미션 수행 기록이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">최근 저장</th>
                <th className="px-3 py-2 font-medium">학습자</th>
                <th className="px-3 py-2 font-medium">화행</th>
                <th className="px-3 py-2 font-medium">미션</th>
                <th className="px-3 py-2 font-medium">과업</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 text-right font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = !!expanded[row.id];
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2">{fmtKst(row.updated_at)}</td>
                      <td className="px-3 py-2" title={row.profiles?.email ?? undefined}>
                        {learnerLabel(row)}
                      </td>
                      <td className="px-3 py-2">{row.speech_act ?? "—"}</td>
                      <td className="max-w-56 truncate px-3 py-2 font-mono text-xs" title={row.mission_id}>
                        {row.mission_id}
                      </td>
                      <td className="px-3 py-2">
                        {[row.task_type, row.mode].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            row.mission_completed
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800",
                          ].join(" ")}
                        >
                          {row.mission_completed ? "완료" : "진행 중"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setExpanded((current) => ({ ...current, [row.id]: !open }))}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                          aria-expanded={open}
                        >
                          {open ? "접기" : "보기"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-border bg-background">
                        <td colSpan={7} className="px-3 py-3">
                          <DetailPanel row={row} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
};

export default Page;
