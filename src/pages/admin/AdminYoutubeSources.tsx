import { useState } from "react";
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

const AdminYoutubeSources = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const extractTranscript = async () => {
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
      } else {
        setResult(data as TranscriptResult);
        if (data && (data as TranscriptResult).ok === false) {
          setErrorMsg(`Supadata 오류 (status ${(data as TranscriptResult).status ?? "?"})`);
        }
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
        ? rawContent.map((s: any) => s?.text ?? "").join(" ")
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
              <Button onClick={extractTranscript} disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                자막 추출
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
              <Badge variant="secondary">연동 예정</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button disabled>
                YouTube 링크 추가
                <Badge variant="secondary" className="ml-2">연동 예정</Badge>
              </Button>
              <Button disabled variant="outline">
                통역 시나리오로 변환
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
                    <TableHead>자막 추출 상태</TableHead>
                    <TableHead>시나리오 변환 상태</TableHead>
                    <TableHead>사용 주차</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-[13px] text-muted-foreground">
                      https://youtube.com/watch?v=example
                    </TableCell>
                    <TableCell className="text-[13px]">(예시) 비즈니스 회의 통역 클립</TableCell>
                    <TableCell className="text-[13px]">中→韓</TableCell>
                    <TableCell>
                      <Badge variant="secondary">대기</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">대기</Badge>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-md border border-dashed border-[#EAE4D2] bg-background p-3.5 text-center text-[13px] text-muted-foreground">
          저장·구간편집·TTS·시나리오 변환은 이번 범위가 아닙니다. 자막 추출만 실제 동작합니다.
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminYoutubeSources;
