import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  DOMAIN,
  INDUSTRY,
  type Domain,
  type IndustrySector,
} from "@/lib/pragma/enums";

// ─── Types ───────────────────────────────────────────────────────────────────
type LanguageDirection = "ko-zh" | "zh-ko";
type ScenarioMode = "translation" | "stt_interpreting";
type HskLevelMin = 3 | 4 | 5;
type ScenarioP = "higher" | "equal" | "lower";
type ScenarioD = "close" | "neutral" | "distant";
type ScenarioR = "high" | "mid" | "low";
type PragmaticChallenge =
  | "directness_control"
  | "formality_control"
  | "imposition_management";
type ChallengeIntensity = "low" | "mid" | "high";
type ReviewStatus =
  | "generated"
  | "needs_review"
  | "revise_required"
  | "revised"
  | "approved";
type UsageAssignment =
  | "archived_only"
  | "coursework_published"
  | "experiment_locked"
  | "excluded";
type SpeechActEnum = "request" | "refusal";

type FormStatus = "pending" | "approved" | "revision" | "rejected";

const MODE_LABEL: Record<ScenarioMode, string> = {
  translation: "번역",
  stt_interpreting: "STT 순차통역",
};
const isIndustrySector = (value: string | null): value is IndustrySector =>
  Boolean(value && value in INDUSTRY);
const industryLabel = (value: string) =>
  isIndustrySector(value) ? INDUSTRY[value] : `기존 분류 · ${value}`;
const PRAGMATIC_CHALLENGE_LABEL: Record<PragmaticChallenge, string> = {
  directness_control: "직접성 조절",
  formality_control: "격식 조절",
  imposition_management: "부담·체면 관리",
};
const INTENSITY_LABEL: Record<ChallengeIntensity, string> = {
  low: "강도 낮음",
  mid: "강도 보통",
  high: "강도 높음",
};
const STATUS_LABEL: Record<FormStatus, string> = {
  pending: "검수 대기",
  approved: "승인 완료",
  revision: "보완 필요",
  rejected: "폐기",
};
const STATUS_BADGE: Record<FormStatus, string> = {
  pending: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
  approved: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  revision: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  rejected: "bg-[#E5E7EB] text-[#374151] border-[#D1D5DB]",
};
const STATUS_ORDER: FormStatus[] = ["pending", "approved", "revision", "rejected"];

// ─── Status mapping between form ↔ DB ───────────────────────────────────────
// review_status enum does NOT contain 'excluded'; we encode "rejected" by
// setting usage_assignment='excluded' (and keeping review_status='revise_required').
function statusToDb(
  s: FormStatus,
): { review_status: ReviewStatus; usage_assignment: UsageAssignment } {
  switch (s) {
    case "pending":
      return { review_status: "needs_review", usage_assignment: "archived_only" };
    case "approved":
      return { review_status: "approved", usage_assignment: "archived_only" };
    case "revision":
      return { review_status: "revise_required", usage_assignment: "archived_only" };
    case "rejected":
      return { review_status: "revise_required", usage_assignment: "excluded" };
  }
}
function statusFromDb(
  review_status: ReviewStatus,
  usage_assignment: UsageAssignment,
): FormStatus {
  if (usage_assignment === "excluded") return "rejected";
  if (review_status === "approved") return "approved";
  if (review_status === "revise_required") return "revision";
  return "pending";
}

// ─── Row shape from DB (subset used here) ───────────────────────────────────
interface ScenarioRow {
  scenario_id: string;
  title: string;
  source_text: string | null;
  speech_act: SpeechActEnum;
  speech_act_text: string | null;
  review_status: ReviewStatus;
  usage_assignment: UsageAssignment;
  updated_at: string | null;
  week_no: number | null;
  language_direction: string | null;
  mode: string | null;
  scenario_p: string | null;
  scenario_d: string | null;
  scenario_r: string | null;
  pragmatic_challenge: string[] | null;
  challenge_intensity: string | null;
  hsk_level_min: number | null;
  domain: string | null;
  industry_sector: string | null;
}

interface FormState {
  title: string;
  week_no: number | null;
  language_direction: LanguageDirection | null;
  mode: ScenarioMode | null;
  speech_act_text: string;
  scenario_P: ScenarioP | null;
  scenario_D: ScenarioD | null;
  scenario_R: ScenarioR | null;
  pragmatic_challenge: PragmaticChallenge[];
  challenge_intensity: ChallengeIntensity | null;
  hsk_level_min: HskLevelMin | null;
  source_text: string;
  status: FormStatus;
  domain: Domain | null;
  industry_sector: IndustrySector | null;
}

function emptyForm(): FormState {
  return {
    title: "",
    week_no: null,
    language_direction: null,
    mode: null,
    speech_act_text: "",
    scenario_P: null,
    scenario_D: null,
    scenario_R: null,
    pragmatic_challenge: [],
    challenge_intensity: null,
    hsk_level_min: null,
    source_text: "",
    status: "pending",
    domain: null,
    industry_sector: null,
  };
}

const MetaTag = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
    {children}
  </span>
);

const Chip = ({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "neutral" | "amber" | "green" | "red" | "mustard";
}) => {
  const tones: Record<typeof tone, string> = {
    neutral: "bg-[#F1EFE8] text-[#3F3F46] border-[#E5E7EB]",
    amber: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
    green: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
    red: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
    mustard: "bg-[#FAD338]/30 text-[#7A5A0A] border-[#FAD338]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${tones[tone]}`}
    >
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </span>
  );
};

const AdminArchive = () => {
  const [rows, setRows] = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scenarios")
      .select(
        "scenario_id,title,source_text,speech_act,speech_act_text,review_status,usage_assignment,updated_at,week_no,language_direction,mode,scenario_p,scenario_d,scenario_r,pragmatic_challenge,challenge_intensity,hsk_level_min,domain,industry_sector",
      )
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "시나리오 불러오기 실패", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as unknown as ScenarioRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, []);

  const counts = useMemo(() => {
    const list = rows;
    return {
      total: list.length,
      pending: list.filter((r) => statusFromDb(r.review_status, r.usage_assignment) === "pending").length,
      approved: list.filter((r) => statusFromDb(r.review_status, r.usage_assignment) === "approved").length,
      revision: list.filter((r) => statusFromDb(r.review_status, r.usage_assignment) === "revision").length,
      rejected: list.filter((r) => statusFromDb(r.review_status, r.usage_assignment) === "rejected").length,
    };
  }, [rows]);

  // ── Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const editingLegacyIndustry = useMemo(() => {
    if (!editingId) return null;
    const value = rows.find((row) => row.scenario_id === editingId)?.industry_sector ?? null;
    return value && !isIndustrySector(value) ? value : null;
  }, [editingId, rows]);

  const openEdit = (r: ScenarioRow) => {
    setEditingId(r.scenario_id);
    setForm({
      title: r.title ?? "",
      week_no: r.week_no,
      language_direction: (r.language_direction as LanguageDirection | null) ?? null,
      mode: (r.mode as ScenarioMode | null) ?? null,
      speech_act_text: r.speech_act_text ?? "",
      scenario_P: (r.scenario_p as ScenarioP | null) ?? null,
      scenario_D: (r.scenario_d as ScenarioD | null) ?? null,
      scenario_R: (r.scenario_r as ScenarioR | null) ?? null,
      pragmatic_challenge: (r.pragmatic_challenge as PragmaticChallenge[] | null) ?? [],
      challenge_intensity: (r.challenge_intensity as ChallengeIntensity | null) ?? null,
      hsk_level_min: (r.hsk_level_min as HskLevelMin | null) ?? null,
      source_text: r.source_text ?? "",
      status: statusFromDb(r.review_status, r.usage_assignment),
      domain: (r.domain as Domain | null) ?? null,
      industry_sector: isIndustrySector(r.industry_sector) ? r.industry_sector : null,
    });
    setFormOpen(true);
  };

  const togglePragmatic = (v: PragmaticChallenge) => {
    setForm((f) => {
      const has = f.pragmatic_challenge.includes(v);
      return {
        ...f,
        pragmatic_challenge: has
          ? f.pragmatic_challenge.filter((x) => x !== v)
          : [...f.pragmatic_challenge, v],
      };
    });
  };

  const updateStatusInline = async (id: string, next: FormStatus) => {
    const { review_status, usage_assignment } = statusToDb(next);
    const { error } = await supabase
      .from("scenarios")
      .update({ review_status, usage_assignment })
      .eq("scenario_id", id);
    if (error) {
      toast({ title: "상태 변경 실패", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.scenario_id === id ? { ...r, review_status, usage_assignment } : r)),
    );
  };

  const saveForm = async () => {
    if (!form.title.trim()) {
      toast({ title: "제목을 입력해 주세요.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { review_status, usage_assignment } = statusToDb(form.status);
    const payload = {
      title: form.title.trim(),
      source_text: form.source_text || null,
      speech_act_text: form.speech_act_text || null,
      week_no: form.week_no,
      language_direction: form.language_direction,
      mode: form.mode,
      scenario_p: form.scenario_P,
      scenario_d: form.scenario_D,
      scenario_r: form.scenario_R,
      pragmatic_challenge:
        form.pragmatic_challenge.length > 0 ? form.pragmatic_challenge : null,
      challenge_intensity: form.challenge_intensity,
      hsk_level_min: form.hsk_level_min,
      domain: form.domain,
      industry_sector:
        form.domain === "work"
          ? form.industry_sector ?? editingLegacyIndustry
          : null,
      review_status,
      usage_assignment,
    };

    if (editingId) {
      const { error } = await supabase
        .from("scenarios")
        .update(payload)
        .eq("scenario_id", editingId);
      if (error) {
        toast({ title: "저장 실패", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("scenarios").insert({
        ...payload,
        speech_act: "request" as SpeechActEnum,
      });
      if (error) {
        toast({ title: "저장 실패", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setFormOpen(false);
    await loadRows();
    toast({ title: editingId ? "시나리오가 수정되었습니다." : "시나리오가 추가되었습니다." });
  };

  return (
    <AdminShell title="시나리오 아카이브" description="한·중 통번역 학습 시나리오 관리">
      <div className="rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-4 py-3">
        <p className="text-[11px] leading-relaxed text-[#5B5446]">
          시나리오는 검수 전 학생에게 공개되지 않습니다.
          <br />
          연구자 검수 후 승인된 자료만 수업/본실험에 활용할 수 있습니다.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체" count={counts.total} tone="neutral" />
          <Chip label="검수 대기" count={counts.pending} tone="amber" />
          <Chip label="승인 완료" count={counts.approved} tone="green" />
          <Chip label="보완 필요" count={counts.revision} tone="red" />
          <Chip label="폐기" count={counts.rejected} tone="mustard" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && (
          <div className="col-span-full rounded-md border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            불러오는 중…
          </div>
        )}
        {!loading &&
          rows.map((r) => {
            const status = statusFromDb(r.review_status, r.usage_assignment);
            const isRejected = status === "rejected";
            return (
              <article
                key={r.scenario_id}
                className={`flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm ${
                  isRejected ? "opacity-85" : ""
                }`}
              >
                <h3
                  className={`text-[14px] font-medium leading-snug text-foreground ${
                    isRejected ? "line-through" : ""
                  }`}
                >
                  {r.title}
                </h3>
                {r.source_text && (
                  <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
                    {r.source_text}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.speech_act_text && <MetaTag>{r.speech_act_text}</MetaTag>}
                  {r.domain && <MetaTag>{DOMAIN[r.domain as Domain]}</MetaTag>}
                  {r.industry_sector && (
                    <MetaTag>{industryLabel(r.industry_sector)}</MetaTag>
                  )}
                  {r.language_direction && (
                    <MetaTag>{r.language_direction === "ko-zh" ? "한→중" : "중→한"}</MetaTag>
                  )}
                  {r.mode && MODE_LABEL[r.mode as ScenarioMode] && (
                    <MetaTag>{MODE_LABEL[r.mode as ScenarioMode]}</MetaTag>
                  )}
                  {r.hsk_level_min != null && <MetaTag>HSK {r.hsk_level_min}+</MetaTag>}
                  {r.week_no != null && (
                    <span className="inline-flex items-center rounded-md border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-0.5 text-[11px] text-[#3730A3]">
                      {r.week_no}주차
                    </span>
                  )}
                  {r.scenario_p && (
                    <span className="inline-flex items-center rounded-md border border-[#FBCFE8] bg-[#FDF2F8] px-2 py-0.5 text-[11px] text-[#9D174D]">
                      P:{r.scenario_p}
                    </span>
                  )}
                  {r.scenario_d && (
                    <span className="inline-flex items-center rounded-md border border-[#FBCFE8] bg-[#FDF2F8] px-2 py-0.5 text-[11px] text-[#9D174D]">
                      D:{r.scenario_d}
                    </span>
                  )}
                  {r.scenario_r && (
                    <span className="inline-flex items-center rounded-md border border-[#FBCFE8] bg-[#FDF2F8] px-2 py-0.5 text-[11px] text-[#9D174D]">
                      R:{r.scenario_r}
                    </span>
                  )}
                  {r.pragmatic_challenge && r.pragmatic_challenge.length > 0 && (
                    <span className="inline-flex items-center rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[11px] text-[#92400E]">
                      화용:{" "}
                      {(r.pragmatic_challenge as PragmaticChallenge[])
                        .map((c) => PRAGMATIC_CHALLENGE_LABEL[c] ?? c)
                        .join(" · ")}
                    </span>
                  )}
                  {r.challenge_intensity && INTENSITY_LABEL[r.challenge_intensity as ChallengeIntensity] && (
                    <span className="inline-flex items-center rounded-md border border-[#BAE6FD] bg-[#F0F9FF] px-2 py-0.5 text-[11px] text-[#0369A1]">
                      {INTENSITY_LABEL[r.challenge_intensity as ChallengeIntensity]}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${STATUS_BADGE[status]}`}
                  >
                    상태: {STATUS_LABEL[status]}
                  </span>
                </div>

                <hr className="my-3 border-border" />

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {r.updated_at ? r.updated_at.slice(0, 10) : ""} 수정
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-8 border-[#D6D2C7] bg-transparent text-[12px] text-[#2c2c2a] hover:bg-muted"
                    onClick={() => openEdit(r)}
                  >
                    편집
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="h-8 bg-[#1d2336] text-[12px] text-white hover:bg-[#1d2336]/90">
                        검수하기 ▾
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                        상태 변경
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {STATUS_ORDER.map((opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onSelect={() => updateStatusInline(r.scenario_id, opt)}
                          className="text-[12px]"
                        >
                          <span className="flex w-full items-center justify-between">
                            <span>{STATUS_LABEL[opt]}</span>
                            {status === opt && (
                              <span className="text-[10px] text-muted-foreground">현재</span>
                            )}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            );
          })}
        {!loading && rows.length === 0 && (
          <div className="col-span-full rounded-md border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            등록된 시나리오가 없습니다.
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "시나리오 편집" : "시나리오 추가"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>도메인</Label>
                <Select
                  value={form.domain ?? ""}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      domain: v as Domain,
                      industry_sector: v === "work" ? form.industry_sector : null,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOMAIN).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>업무 분야 {form.domain !== "work" && <span className="text-[11px] text-muted-foreground">(도메인이 '직장'일 때만)</span>}</Label>
                <Select
                  value={form.industry_sector ?? ""}
                  onValueChange={(v) =>
                    setForm({ ...form, industry_sector: v as IndustrySector })
                  }
                  disabled={form.domain !== "work"}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDUSTRY).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingLegacyIndustry && form.domain === "work" && (
                  <p className="text-[11px] text-amber-700">
                    기존 분류값 `{editingLegacyIndustry}`이 저장되어 있습니다. 다른 내용을 수정해도 이 값은 보존되며,
                    업무 분야를 바꾸려면 위 7개 정본 분류 중 하나를 선택해 주세요.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>주차 (1~15)</Label>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={form.week_no ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, week_no: v === "" ? null : Number(v) });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>화행</Label>
                <Input
                  placeholder="예: 거절, 요청"
                  value={form.speech_act_text}
                  onChange={(e) => setForm({ ...form, speech_act_text: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>언어 방향</Label>
                <Select
                  value={form.language_direction ?? ""}
                  onValueChange={(v) =>
                    setForm({ ...form, language_direction: v as LanguageDirection })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ko-zh">ko-zh (한→중)</SelectItem>
                    <SelectItem value="zh-ko">zh-ko (중→한)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>학습 유형</Label>
                <Select
                  value={form.mode ?? ""}
                  onValueChange={(v) => setForm({ ...form, mode: v as ScenarioMode })}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="translation">번역</SelectItem>
                    <SelectItem value="stt_interpreting">STT 순차통역</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>P (권력)</Label>
                <Select
                  value={form.scenario_P ?? ""}
                  onValueChange={(v) => setForm({ ...form, scenario_P: v as ScenarioP })}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="higher">higher</SelectItem>
                    <SelectItem value="equal">equal</SelectItem>
                    <SelectItem value="lower">lower</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>D (거리)</Label>
                <Select
                  value={form.scenario_D ?? ""}
                  onValueChange={(v) => setForm({ ...form, scenario_D: v as ScenarioD })}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="close">close</SelectItem>
                    <SelectItem value="neutral">neutral</SelectItem>
                    <SelectItem value="distant">distant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>R (부담)</Label>
                <Select
                  value={form.scenario_R ?? ""}
                  onValueChange={(v) => setForm({ ...form, scenario_R: v as ScenarioR })}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">high</SelectItem>
                    <SelectItem value="mid">mid</SelectItem>
                    <SelectItem value="low">low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>화용 챌린지 (복수 선택)</Label>
              <div className="flex flex-wrap gap-3">
                {(["directness_control", "formality_control", "imposition_management"] as PragmaticChallenge[]).map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.pragmatic_challenge.includes(p)}
                      onCheckedChange={() => togglePragmatic(p)}
                    />
                    {PRAGMATIC_CHALLENGE_LABEL[p]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>챌린지 강도</Label>
                <Select
                  value={form.challenge_intensity ?? ""}
                  onValueChange={(v) =>
                    setForm({ ...form, challenge_intensity: v as ChallengeIntensity })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">low (강도 낮음)</SelectItem>
                    <SelectItem value="mid">mid (강도 보통)</SelectItem>
                    <SelectItem value="high">high (강도 높음)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>HSK 최소 레벨</Label>
                <Select
                  value={form.hsk_level_min != null ? String(form.hsk_level_min) : ""}
                  onValueChange={(v) =>
                    setForm({ ...form, hsk_level_min: Number(v) as HskLevelMin })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>원문 (source_text)</Label>
              <Textarea
                rows={6}
                value={form.source_text}
                onChange={(e) => setForm({ ...form, source_text: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>검수 상태</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as FormStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button
              onClick={saveForm}
              disabled={saving}
              className="bg-[#1d2336] text-white hover:bg-[#1d2336]/90"
            >
              {saving ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminArchive;
