import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const SOURCE_TYPES = [
  {
    key: "hsk3_corpus",
    label: "HSK 3.0 공식 어휘 자료",
    description:
      "HSK 3.0 공식 등급별 시험요강 기반 어휘. AI 시나리오 어휘 난이도 조절에 사용.",
    badge: { label: "적재 완료", variant: "default" as BadgeVariant, className: "bg-emerald-600 text-white hover:bg-emerald-600" },
  },
  {
    key: "hsk2_corpus",
    label: "HSK 2.0 참고 자료",
    description: "rollback·비교용",
    badge: { label: "보관", variant: "secondary" as BadgeVariant },
  },
  {
    key: "learner_corpus",
    label: "학습자 오류 자료",
    description: "HSK Dynamic Composition Corpus 등 학습자 오류 참고",
    badge: { label: "후보", variant: "secondary" as BadgeVariant },
  },
  {
    key: "parallel_corpus",
    label: "한중/중한 병렬 자료",
    description: "공식문서·자막·수업 번역 자료",
    badge: { label: "후보", variant: "secondary" as BadgeVariant },
  },
  {
    key: "official_text",
    label: "영상·음성 자료",
    description:
      "YouTube/Supadata 기반 통역 시나리오 seed (드라마 등 영상은 연구·수업용 가공 seed로만 활용)",
    badge: { label: "연동 예정", variant: "secondary" as BadgeVariant },
    href: "/admin/youtube-sources",
  },
  {
    key: "classroom_pilot_data",
    label: "수업 기반 산출 자료",
    description: "토론·기말보고서·decision_traces 누적",
    badge: { label: "누적 예정", variant: "secondary" as BadgeVariant },
  },
];

const FlowItem = ({ label, isLast = false }: { label: string; isLast?: boolean }) => (
  <div className="flex items-center gap-2">
    <div className="rounded-md bg-[#15202B] px-3 py-1.5 text-[13px] font-medium text-[#F1EFE8]">
      {label}
    </div>
    {!isLast && (
      <span className="text-[#8a857c]" aria-hidden>
        →
      </span>
    )}
  </div>
);

type SampleRow = { word: string; pinyin: string | null; pos: string | null };

const LEVELS = [3, 4, 5, 6];

const AdminCorpus = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [levelCounts, setLevelCounts] = useState<{ level: number; count: number }[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [samples, setSamples] = useState<Record<number, SampleRow[]>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const totalRes = await supabase
          .from("hsk_vocab")
          .select("*", { count: "exact", head: true });
        if (totalRes.error) throw totalRes.error;

        const perLevel = await Promise.all(
          LEVELS.map((lv) =>
            supabase
              .from("hsk_vocab")
              .select("*", { count: "exact", head: true })
              .eq("hsk_level", lv),
          ),
        );
        for (const r of perLevel) if (r.error) throw r.error;

        const sourceRes = await supabase.from("hsk_vocab").select("source").limit(5000);
        if (sourceRes.error) throw sourceRes.error;
        const uniqueSources = Array.from(
          new Set((sourceRes.data ?? []).map((r: any) => r.source).filter(Boolean)),
        );

        const sampleResults = await Promise.all(
          LEVELS.map((lv) =>
            supabase
              .from("hsk_vocab")
              .select("word,pinyin,pos")
              .eq("hsk_level", lv)
              .limit(60),
          ),
        );
        const sampleMap: Record<number, SampleRow[]> = {};
        LEVELS.forEach((lv, idx) => {
          const res = sampleResults[idx];
          if (res.error) throw res.error;
          const rows = (res.data ?? []) as SampleRow[];
          const shuffled = [...rows].sort(() => Math.random() - 0.5).slice(0, 6);
          sampleMap[lv] = shuffled;
        });

        if (cancelled) return;
        setTotal(totalRes.count ?? 0);
        setLevelCounts(
          LEVELS.map((lv, idx) => ({ level: lv, count: perLevel[idx].count ?? 0 })),
        );
        setSources(uniqueSources);
        setSamples(sampleMap);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (n: number) => n.toLocaleString();

  return (
    <AdminShell
      title="Source Bank"
      description="AI 시나리오 생성을 위한 언어·담화 자료 저장소"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3.5 text-[13px] leading-relaxed text-foreground">
          Source Bank는 AI 시나리오 생성의 근거 자료를 관리하는 영역입니다. HSK 어휘, 학습자 오류,
          공식 문서, 영상·음성 자료, 수업 산출물을 연결하여 AI 생성물이 임의로 만들어지지 않도록
          통제합니다.
        </div>

        <div className="rounded-md border-l-4 border-[#FAD338] bg-[#FAD338]/10 p-2.5 text-[13px] font-medium text-foreground">
          코퍼스는 본 연구의 분석 대상이 아니라, AI 생성 시나리오의 근거 자료이자 통제 장치입니다.
        </div>

        {/* HSK 3.0 요약 카드 */}
        <Card className="border-[#EAE4D2] bg-[#FAF7EE]">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">HSK 3.0 공식 어휘 코퍼스</CardTitle>
              <Badge className="bg-[#15202B] text-[#F1EFE8] hover:bg-[#15202B]">
                적재 완료 · generator 연동 예정
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
                코퍼스 조회 실패: {error}
              </div>
            ) : loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <div className="text-[15px] font-semibold text-foreground">
                  총 {fmt(total)}개 어휘 적재 완료
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {levelCounts.map((lc) => (
                    <div
                      key={lc.level}
                      className="rounded-md border border-[#EAE4D2] bg-background px-3 py-2 text-center"
                    >
                      <div className="text-[12px] text-muted-foreground">{lc.level}급</div>
                      <div className="text-lg font-semibold text-foreground">
                        {fmt(lc.count)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  출처:{" "}
                  {sources.length === 0
                    ? "—"
                    : sources.join(", ")}{" "}
                  · HSK 3.0 공식 등급별 시험요강 (2026-07 시행)
                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                  {LEVELS.map((lv) => (
                    <div
                      key={lv}
                      className="rounded-md border border-[#EAE4D2] bg-background p-2"
                    >
                      <div className="mb-2 px-1 text-[13px] font-medium text-foreground">
                        {lv}급 샘플
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 px-3 text-[12px]">汉字</TableHead>
                            <TableHead className="h-8 px-3 text-[12px]">pinyin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(samples[lv] ?? []).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="px-3 py-1.5 text-[15px] font-medium">
                                {row.word}
                              </TableCell>
                              <TableCell className="px-3 py-1.5 text-[13px] text-muted-foreground">
                                {row.pinyin ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>

                <div className="text-[13px] text-foreground">
                  학습자 수준별 AI 시나리오 생성 시 어휘 난이도 조절을 위한 Source Bank로 사용됩니다.
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 6개 카드 */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCE_TYPES.map((st) => {
            const href = (st as any).href as string | undefined;
            const inner = (
              <Card
                className={`h-full border-[#EAE4D2] bg-[#FAF7EE] ${
                  href ? "transition-colors hover:bg-[#F5EFD9] cursor-pointer" : ""
                }`}
              >
                <CardHeader className="pb-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{st.label}</CardTitle>
                    {st.badge && (
                      <Badge variant={st.badge.variant} className={st.badge.className}>
                        {st.badge.label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[13px] text-muted-foreground">{st.description}</p>
                  {href && (
                    <p className="mt-2 text-[12px] font-medium text-[#15202B]">
                      영상·음성 소스 관리로 이동 →
                    </p>
                  )}
                </CardContent>
              </Card>
            );
            return href ? (
              <Link key={st.key} to={href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={st.key}>{inner}</div>
            );
          })}
        </div>

        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3.5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">자료 흐름</h3>
          <div className="flex flex-wrap items-center gap-2">
            <FlowItem label="코퍼스 (Source Bank)" />
            <FlowItem label="AI 시나리오 생성" />
            <FlowItem label="프롬프트 관리" />
            <FlowItem label="시나리오 검수" />
            <FlowItem label="시나리오 아카이브" />
            <FlowItem label="학습자 decision_trace" isLast />
          </div>
        </div>

        <div className="rounded-md border border-dashed border-[#EAE4D2] bg-background p-3.5 text-center text-[13px] text-muted-foreground">
          현재는 source bank 구조를 보여주는 skeleton 단계입니다. 실제 RAG 검색, corpus query, AI-Hub
          연동은 후속 구현으로 분리합니다.
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminCorpus;
