import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

type TranscriptResult = {
  ok?: boolean;
  status?: number;
  lang?: string;
  availableLangs?: string[];
  segmentCount?: number | null;
  textPreview?: string | null;
  raw?: unknown;
  error?: unknown;
};

type YoutubeSourceRow = {
  id: string;
  url: string;
  video_title: string | null;
  lang: string | null;
  available_langs: string[] | null;
  transcript: string | null;
  extract_status: string | null;
  created_at: string;
};

const AdminYoutubeSources = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sources, setSources] = useState<YoutubeSourceRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadSources = async () => {
    setListLoading(true);
    const { data, error } = await supabase
      .from("youtube_sources" as any)
      .select("id, url, video_title, lang, available_langs, transcript, extract_status, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setSources(data as unknown as YoutubeSourceRow[]);
    setListLoading(false);
  };

  useEffect(() => {
    loadSources();
  }, []);

  const extractAndSave = async () => {
    if (!url.trim()) {
      setErrorMsg("YouTube 링크를 입력하세요.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-transcript", {
        body: { url: url.trim(), mode: "auto", text: true },
      });
      if (error) {
        setErrorMsg(`호출 실패: ${error.message}`);
        setResult((data as TranscriptResult) ?? null);
        return;
      }
      const res = data as TranscriptResult;
      setResult(res);
      if (res && res.ok === false) {
        setErrorMsg(`Supadata 오류 (status ${res.status ?? "?"})`);
        return;
      }

      // Save to DB
      const raw = res?.raw as Record<string, unknown> | undefined;
      const rawContent = raw?.content;
      const fullText =
        typeof rawContent === "string"
          ? rawContent
          : Array.isArray(rawContent)
            ? (rawContent as any[]).map((s) => s?.text ?? "").join(" ")
            : res?.textPreview ?? "";
      const videoTitle = (raw?.title as string | undefined) ?? null;

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const { error: insertError } = await supabase.from("youtube_sources" as any).insert({
        url: url.trim(),
        video_title: videoTitle,
        lang: res?.lang ?? null,
        available_langs: res?.availableLangs ?? null,
        transcript: fullText || null,
        extract_status: "extracted",
        created_by: uid,
      } as any);

      if (insertError) {
        setErrorMsg(`저장 실패: ${insertError.message}`);
      } else {
        await loadSources();
      }
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const raw = result?.raw as Record<string, unknown> | undefined;
  const rawContent = raw?.content;
  const fullText =
    typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent)
        ? (rawContent as any[]).map((s) => s?.text ?? "").join(" ")
        : result?.textPreview ?? "";

  return (
    <AdminShell
      title="영상·음성 소스"
      description="YouTube/Supadata 기반 통역 시나리오 자료 관리"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3.5 text-[13px] leading-relaxed text-foreground">
          YouTube 링크와 자막 데이터를 통역 시나리오 seed로 활용하기 위한 영역입니다. (다음 단계 연동 예정)
        </div>

        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3.5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">자료 흐름</h3>
          <div className="flex flex-wrap items-center gap-2">
            <FlowItem label="YouTube 링크" />
            <FlowItem label="Supadata 자막 추출" />
            <FlowItem label="통역 시나리오 seed" />
            <FlowItem label="TTS 음성화" isLast />
          </div>
        </div>

        <Card className="border-[#EAE4D2] bg-[#FAF7EE]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">자막 추출 (Supadata)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="https://youtu.be/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
              <Button onClick={extractAndSave} disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                자막 추출 & 저장
              </Button>
            </div>

            {errorMsg && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[13px] text-destructive">
                {errorMsg}
              </div>
            )}

            {result && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 text-[12px]">
                  {result.lang && <Badge variant="secondary">lang: {result.lang}</Badge>}
                  {result.availableLangs && (
                    <Badge variant="secondary">
                      availableLangs: {result.availableLangs.join(", ")}
                    </Badge>
                  )}
                  {typeof result.segmentCount === "number" && (
                    <Badge variant="secondary">segments: {result.segmentCount}</Badge>
                  )}
                  {typeof result.status === "number" && (
                    <Badge variant="secondary">status: {result.status}</Badge>
                  )}
                </div>

                {fullText && (
                  <div className="rounded-md border border-[#EAE4D2] bg-background p-3 max-h-96 overflow-auto whitespace-pre-wrap text-[13px] leading-relaxed">
                    {fullText}
                  </div>
                )}

                {result.error !== undefined && (
                  <pre className="rounded-md border border-[#EAE4D2] bg-background p-3 max-h-64 overflow-auto text-[12px]">
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#EAE4D2] bg-[#FAF7EE]">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">등록된 영상·음성 소스</CardTitle>
              <Badge variant="secondary">{sources.length}건</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button disabled variant="outline">
                통역 시나리오로 변환
                <Badge variant="secondary" className="ml-2">연동 예정</Badge>
              </Button>
              <Button disabled variant="outline">
                구간 편집 / TTS
                <Badge variant="secondary" className="ml-2">연동 예정</Badge>
              </Button>
            </div>

            <div className="rounded-md border border-[#EAE4D2] bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>영상 제목</TableHead>
                    <TableHead>언어</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>자막</TableHead>
                    <TableHead>저장 시각</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-[13px] text-muted-foreground">
                        불러오는 중...
                      </TableCell>
                    </TableRow>
                  )}
                  {!listLoading && sources.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-[13px] text-muted-foreground">
                        아직 등록된 소스가 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                  {!listLoading &&
                    sources.map((s) => {
                      const t = s.transcript ?? "";
                      const preview = t.slice(0, 150);
                      const isOpen = expandedId === s.id;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-[12px] text-muted-foreground max-w-[220px] truncate">
                            <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                              {s.url}
                            </a>
                          </TableCell>
                          <TableCell className="text-[13px]">{s.video_title ?? "—"}</TableCell>
                          <TableCell className="text-[13px]">{s.lang ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{s.extract_status ?? "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-[12px] max-w-[360px]">
                            <div className="text-muted-foreground mb-1">{t.length.toLocaleString()}자</div>
                            {isOpen ? (
                              <div className="whitespace-pre-wrap max-h-64 overflow-auto rounded border border-[#EAE4D2] bg-[#FAF7EE] p-2">
                                {t}
                              </div>
                            ) : (
                              <div className="truncate">{preview}{t.length > 150 ? "…" : ""}</div>
                            )}
                            {t.length > 150 && (
                              <button
                                type="button"
                                onClick={() => setExpandedId(isOpen ? null : s.id)}
                                className="mt-1 text-[12px] text-primary hover:underline"
                              >
                                {isOpen ? "접기" : "펼치기"}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                            {new Date(s.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-md border border-dashed border-[#EAE4D2] bg-background p-3.5 text-center text-[13px] text-muted-foreground">
          구간편집·TTS·시나리오 변환은 이번 범위가 아닙니다. 추출·저장·목록만 실제 동작합니다.
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminYoutubeSources;
