import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { HSK3_REFERENCE_SOURCE_ID } from "@/lib/pragma/hskReference";

const EXPECTED_VOCABULARY_ENTRIES = 11_000;
const EXPECTED_TOPIC_ROWS = 427;
const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;

type ReferenceStatus = {
  source_id: string;
  title: string;
  publisher: string;
  released_at: string | null;
  effective_at: string | null;
  official_url: string;
  sha256: string;
  manifest_version: string;
  extraction_version: string;
  vocabulary_entries: number;
  official_topic_rows: number;
  derived_topic_rows: number;
  researcher_mapping_rows: number;
};

const REFERENCE_LEVELS = [
  { pragma: "입문", ceiling: "HSK 1–4급 누적", entries: 2_000 },
  { pragma: "중급", ceiling: "HSK 1–5급 누적", entries: 3_600 },
  { pragma: "고급", ceiling: "HSK 1–6급 누적", entries: 5_400 },
];

function fmt(value: number) {
  return value.toLocaleString();
}

const AdminCorpus = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReferenceStatus | null>(null);
  const [levelCounts, setLevelCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const statusResult = await supabase
        .from("hsk3_reference_status")
        .select("*")
        .eq("source_id", HSK3_REFERENCE_SOURCE_ID)
        .maybeSingle();

      if (statusResult.error) {
        if (!cancelled) {
          setStatus(null);
          setError(statusResult.error.message);
          setLoading(false);
        }
        return;
      }

      const counts = await Promise.all(
        LEVELS.map((level) =>
          supabase
            .from("hsk3_vocab")
            .select("*", { count: "exact", head: true })
            .eq("source_id", HSK3_REFERENCE_SOURCE_ID)
            .eq("intro_level", level),
        ),
      );
      const countError = counts.find((result) => result.error)?.error;
      if (!cancelled) {
        setStatus((statusResult.data as ReferenceStatus | null) ?? null);
        setLevelCounts(
          Object.fromEntries(LEVELS.map((level, index) => [level, counts[index].count ?? 0])),
        );
        if (countError) setError(countError.message);
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fullyLoaded = Boolean(
    status &&
      Number(status.vocabulary_entries) === EXPECTED_VOCABULARY_ENTRIES &&
      Number(status.official_topic_rows) === EXPECTED_TOPIC_ROWS &&
      Number(status.derived_topic_rows) === EXPECTED_TOPIC_ROWS &&
      Number(status.researcher_mapping_rows) === EXPECTED_TOPIC_ROWS,
  );
  const partiallyLoaded = Boolean(status && !fullyLoaded);

  return (
    <AdminShell
      title="HSK 3.0 참고 데이터"
      description="공식 시험대강 기반 중국어 어휘·주제 자료의 출처와 실제 적재 상태"
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3.5 text-[13px] leading-relaxed text-foreground">
          이 자료는 PRAGMA 수준의 인증 기준이 아니라 중국어 생성물의 누적 어휘 참고 상한과
          비차단 사후감사에 사용합니다. 사전 밖 후보는 고유명사·전문용어·분절 단위일 수 있으므로
          자동 실패나 자동 수정 조건으로 쓰지 않습니다.
        </div>

        <Card className="border-[#EAE4D2] bg-[#FAF7EE]">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">공식 시험대강 기반 참고 데이터셋</CardTitle>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  공식 전사 · 결정론 파생 · 연구자 코딩을 분리해 관리
                </p>
              </div>
              {loading ? (
                <Skeleton className="h-6 w-28" />
              ) : fullyLoaded ? (
                <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">적재 검산 완료</Badge>
              ) : partiallyLoaded ? (
                <Badge variant="secondary">부분 적재</Badge>
              ) : (
                <Badge variant="outline">운영 DB 미적용</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                {error && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900">
                    운영 DB에서 신규 HSK reference schema를 확인하지 못했습니다. 로컬 구현과 실제
                    migration·seed 적용 상태를 구분합니다. 조회 메시지: {error}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="공식 어휘 항목" value={status ? Number(status.vocabulary_entries) : 0} expected={11_000} />
                  <Metric label="공식 L3 주제" value={status ? Number(status.official_topic_rows) : 0} expected={427} />
                  <Metric label="결정론 파생" value={status ? Number(status.derived_topic_rows) : 0} expected={427} />
                  <Metric label="연구자 mapping" value={status ? Number(status.researcher_mapping_rows) : 0} expected={427} />
                </div>

                <div className="rounded-md border border-[#EAE4D2] bg-background p-3 text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">생성 후 lexical audit</span>
                    <Badge variant="outline">생성 결과 provenance로 확인</Badge>
                  </div>
                  <p className="mt-1.5 text-muted-foreground">
                    코드 존재와 운영 활성 상태를 같은 것으로 표시하지 않습니다. 실제 생성 결과의
                    <code className="mx-1 rounded bg-muted px-1 py-0.5">hsk_lexical_audit.status</code>
                    가 complete인지 확인해야 합니다.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-[#EAE4D2] bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">공식 출처와 버전</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <InfoRow label="자료" value={status?.title ?? "新版HSK考试大纲"} />
              <InfoRow label="발행" value={status?.publisher ?? "中外语言交流合作中心"} />
              <InfoRow label="발행·시행" value={`${status?.released_at ?? "2025-11"} · ${status?.effective_at ?? "2026-07"}`} />
              <InfoRow label="manifest" value={status?.manifest_version ?? "hsk3_reference_manifest_v1"} />
              <div className="grid grid-cols-[92px_1fr] gap-2 border-t border-[#EAE4D2] pt-2">
                <span className="text-muted-foreground">SHA-256</span>
                <code className="break-all text-[11px]">{status?.sha256 ?? "EC74CE0439E837BBB15154BE13E747AE798903B2FD3A331629DF6C3B45504941"}</code>
              </div>
              <a
                href={status?.official_url ?? "https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#15202B] underline-offset-2 hover:underline"
              >
                공식 PDF 열기 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </CardContent>
          </Card>

          <Card className="border-[#EAE4D2] bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">PRAGMA 수준과의 관계</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PRAGMA</TableHead>
                    <TableHead>중국어 참고 상한</TableHead>
                    <TableHead className="text-right">항목</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REFERENCE_LEVELS.map((row) => (
                    <TableRow key={row.pragma}>
                      <TableCell className="font-medium">{row.pragma}</TableCell>
                      <TableCell>{row.ceiling}</TableCell>
                      <TableCell className="text-right">{fmt(row.entries)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-[12px] text-muted-foreground">숙달도 등가·급수 인증 관계가 아닙니다.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#EAE4D2] bg-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">등급별 신규 도입 어휘 항목</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {LEVELS.map((level) => (
                <div key={level} className="rounded-md border border-[#EAE4D2] px-2 py-2 text-center">
                  <div className="text-[12px] text-muted-foreground">{level === 7 ? "7–9" : level}급</div>
                  <div className="mt-0.5 font-semibold">{fmt(levelCounts[level] ?? 0)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
};

function Metric({ label, value, expected }: { label: string; value: number; expected: number }) {
  return (
    <div className="rounded-md border border-[#EAE4D2] bg-background px-3 py-2.5">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{fmt(value)}</div>
      <div className="text-[11px] text-muted-foreground">기대 {fmt(expected)}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default AdminCorpus;
