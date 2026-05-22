import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  downloadSessions,
  formatExportFilename,
  getSessions,
  LearningSession,
  MATERIAL_CATALOG,
  serializeSessions,
} from "@/lib/learningSessions";

type Scope = "all" | "material" | "range";
type Format = "json" | "jsonl";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MATERIAL_OPTIONS = Object.values(MATERIAL_CATALOG).map((m) => ({
  id: m.material_id,
  label: `${m.material_id} · ${m.title}`,
}));

function formatSummaryDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExportSessionsDialog({ open, onOpenChange }: Props) {
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [materialId, setMaterialId] = useState<string>(
    MATERIAL_OPTIONS[0]?.id ?? "",
  );
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [format, setFormat] = useState<Format>("json");

  useEffect(() => {
    if (open) setSessions(getSessions());
  }, [open]);

  const latestIso = useMemo(() => {
    if (sessions.length === 0) return null;
    return sessions
      .map((s) => s.timestamp)
      .sort()
      .slice(-1)[0];
  }, [sessions]);

  const filtered = useMemo(() => {
    let list = sessions;
    if (scope === "material" && materialId) {
      list = list.filter((s) => s.material_id === materialId);
    } else if (scope === "range") {
      const fromMs = from ? new Date(from + "T00:00:00").getTime() : null;
      const toMs = to ? new Date(to + "T23:59:59").getTime() : null;
      list = list.filter((s) => {
        const t = new Date(s.timestamp).getTime();
        if (fromMs !== null && t < fromMs) return false;
        if (toMs !== null && t > toMs) return false;
        return true;
      });
    }
    return list;
  }, [sessions, scope, materialId, from, to]);

  const previewText = useMemo(() => {
    if (filtered.length === 0) return "";
    return serializeSessions([filtered[0]], format);
  }, [filtered, format]);

  const handleDownload = () => {
    if (filtered.length === 0) return;
    downloadSessions(filtered, format);
  };

  const filename = formatExportFilename(format);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>학습 데이터 내보내기</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-5">
            <section className="rounded-md border border-border bg-card px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">현재 저장된 학습 세션</span>
                <span className="font-semibold text-foreground">총 {sessions.length}건</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-muted-foreground">가장 최근 세션</span>
                <span className="font-medium text-foreground">
                  {latestIso ? formatSummaryDate(latestIso) : "—"}
                </span>
              </div>
            </section>

            <section>
              <Label className="text-sm font-semibold text-foreground">내보내기 범위</Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as Scope)}
                className="mt-2 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="font-normal">전체 세션</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="material" id="scope-mat" />
                  <Label htmlFor="scope-mat" className="font-normal">자료별 선택</Label>
                </div>
                {scope === "material" && (
                  <div className="ml-6">
                    <Select value={materialId} onValueChange={setMaterialId}>
                      <SelectTrigger>
                        <SelectValue placeholder="자료 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAL_OPTIONS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="range" id="scope-range" />
                  <Label htmlFor="scope-range" className="font-normal">기간 지정</Label>
                </div>
                {scope === "range" && (
                  <div className="ml-6 grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="from" className="text-xs text-muted-foreground">
                        시작일
                      </Label>
                      <Input
                        id="from"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="to" className="text-xs text-muted-foreground">
                        종료일
                      </Label>
                      <Input
                        id="to"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </RadioGroup>
            </section>

            <section>
              <Label className="text-sm font-semibold text-foreground">형식</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as Format)}
                className="mt-2 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="json" id="fmt-json" />
                  <Label htmlFor="fmt-json" className="font-normal">
                    JSON · 단일 파일(배열)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="jsonl" id="fmt-jsonl" />
                  <Label htmlFor="fmt-jsonl" className="font-normal">
                    JSONL · 한 줄당 1세션
                  </Label>
                </div>
              </RadioGroup>
              <p className="mt-2 text-xs text-muted-foreground">파일명 · {filename}</p>
            </section>
          </div>

          <div className="flex flex-col">
            <Label className="text-sm font-semibold text-foreground">미리보기</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              필터 결과 {filtered.length}건 중 첫 1건의 구조
            </p>
            <div className="mt-2 flex-1 overflow-auto rounded-md border border-border bg-[#0f172a] p-3 text-[11px] leading-relaxed text-[#e2e8f0]">
              {filtered.length === 0 ? (
                <p className="text-[#94a3b8]">
                  {sessions.length === 0
                    ? "저장된 학습 세션이 없습니다. 학습자가 5단계까지 완료한 세션만 집계됩니다."
                    : "선택한 조건에 해당하는 세션이 없습니다."}
                </p>
              ) : (
                <pre className="whitespace-pre-wrap break-all font-mono">{previewText}</pre>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={handleDownload}
            disabled={filtered.length === 0}
            className="bg-[#FAD338] text-[#15202B] hover:bg-[#f0c722]"
          >
            ↓ 다운로드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}