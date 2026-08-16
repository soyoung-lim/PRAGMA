import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type TraceRow = Record<string, unknown> & {
  id: string;
  created_at: string;
  scenario_key: string | null;
  decision_trace_complete: boolean | null;
  auth_user_id: string | null;
  profile_id: string | null;
  session_id: string | null;
};

// Fixed meta columns for the summary table. Everything else is rendered
// generically in the detail panel so the screen stays valid as the
// per-step question schema evolves.
const META_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "submitted_at",
  "scenario_key",
  "decision_trace_complete",
  "auth_user_id",
  "profile_id",
  "session_id",
]);

const fmtKst = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
};

const shortId = (v: string | null | undefined) =>
  v ? `${v.slice(0, 8)}…` : "—";

const renderValue = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length ? v : "—";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

const DetailPanel = ({ row }: { row: TraceRow }) => {
  const entries = useMemo(
    () =>
      Object.entries(row)
        .filter(([k]) => !META_KEYS.has(k))
        .sort(([a], [b]) => a.localeCompare(b)),
    [row],
  );

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          표시할 학습 내용이 없습니다.
        </p>
      ) : (
        entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {k}
            </div>
            <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-background p-2 text-[13px] leading-relaxed text-foreground">
              {renderValue(v)}
            </pre>
          </div>
        ))
      )}
    </div>
  );
};

const Page = () => {
  const [rows, setRows] = useState<TraceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("decision_traces")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as TraceRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = rows === null;

  return (
    <AdminShell
      title="학습자 수행 기록"
      description="학습자별 화행 판단, 번역·통역, 피드백, 수정에 이르는 개별 수행 기록을 조회합니다."
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {loading
            ? "불러오는 중…"
            : error
              ? "조회 실패"
              : `총 ${rows?.length ?? 0}건`}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          decision_traces 조회 실패: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows && rows.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          아직 기록이 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[12px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">저장 시각 (KST)</th>
                <th className="px-3 py-2 font-medium">시나리오</th>
                <th className="px-3 py-2 font-medium">완료</th>
                <th className="px-3 py-2 font-medium">학습자</th>
                <th className="px-3 py-2 font-medium">세션</th>
                <th className="px-3 py-2 font-medium text-right">상세</th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((r) => {
                const open = !!expanded[r.id];
                return (
                  <>
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fmtKst(r.created_at)}
                      </td>
                      <td className="px-3 py-2">{r.scenario_key ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                            r.decision_trace_complete
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800",
                          ].join(" ")}
                        >
                          {r.decision_trace_complete ? "완료" : "미완"}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2 font-mono text-[12px]"
                        title={r.auth_user_id ?? undefined}
                      >
                        {shortId(r.auth_user_id)}
                      </td>
                      <td
                        className="px-3 py-2 font-mono text-[12px]"
                        title={r.session_id ?? undefined}
                      >
                        {shortId(r.session_id)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))
                          }
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-[12px] hover:bg-muted"
                          aria-expanded={open}
                        >
                          {open ? "접기 ▲" : "펼치기 ▼"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr key={`${r.id}-detail`} className="border-t border-border bg-background">
                        <td colSpan={6} className="px-3 py-3">
                          <DetailPanel row={r} />
                        </td>
                      </tr>
                    )}
                  </>
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
