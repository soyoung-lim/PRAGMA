import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth/useProfile";
import { APPROVAL_STATUS, APP_ROLE, type ApprovalStatus } from "@/lib/auth/constants";

type LearnerRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  affiliation_or_status: string | null;
  academic_year_or_program: string | null;
  profile_completed: boolean;
  approval_status: ApprovalStatus;
  anonymous_participant_id: string | null;
  updated_at: string | null;
  created_at: string | null;
  role: "learner" | "admin";
  language_background: string | null;
  chinese_proficiency_self_report: string | null;
  business_chinese_experience: string | null;
  ti_experience_level: string | null;
  ti_experience_modes: string[] | null;
  genai_use_frequency: string | null;
  ai_prompting_style_for_ti: string | null;
  perceived_ai_ti_difficulty: string | null;
  perceived_business_chinese_ti_risk: string | null;
  research_use_consent: boolean;
  anonymization_notice_confirmed: boolean;
  report_email_consent: boolean | null;
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending_approval: "승인 대기",
  approved: "승인됨",
  rejected: "반려",
  inactive: "비활성",
};

const STATUS_VARIANT: Record<
  ApprovalStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_approval: "secondary",
  approved: "default",
  rejected: "destructive",
  inactive: "outline",
};

type FilterValue = ApprovalStatus | "all";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "전체" },
  { value: APPROVAL_STATUS.PENDING, label: STATUS_LABEL.pending_approval },
  { value: APPROVAL_STATUS.APPROVED, label: STATUS_LABEL.approved },
  { value: APPROVAL_STATUS.REJECTED, label: STATUS_LABEL.rejected },
  { value: APPROVAL_STATUS.INACTIVE, label: STATUS_LABEL.inactive },
];

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
  </div>
);

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm text-foreground break-words">
      {value === null || value === undefined || value === "" ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        value
      )}
    </dd>
  </div>
);

const Page = () => {
  const { loading: authLoading, profile } = useProfile();
  const [rows, setRows] = useState<LearnerRow[] | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchRows = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "learner")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "목록 로드 실패", description: error.message, variant: "destructive" });
      setRows([]);
      return;
    }
    setRows((data ?? []) as LearnerRow[]);
  };

  useEffect(() => {
    if (profile?.role === APP_ROLE.ADMIN) {
      void fetchRows();
    }
  }, [profile?.role]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    return rows.filter((r) => r.approval_status === filter);
  }, [rows, filter]);

  const selected = useMemo(
    () => (selectedId ? rows?.find((r) => r.id === selectedId) ?? null : null),
    [selectedId, rows],
  );

  if (authLoading) {
    return (
      <AdminShell title="학습자 관리">
        <div className="text-sm text-muted-foreground">불러오는 중…</div>
      </AdminShell>
    );
  }

  if (!profile || profile.role !== APP_ROLE.ADMIN) {
    return <Navigate to="/" replace />;
  }

  const updateStatus = async (
    row: LearnerRow,
    next: ApprovalStatus,
  ) => {
    setBusy(true);
    const patch: {
      approval_status: ApprovalStatus;
      anonymous_participant_id?: string;
    } = { approval_status: next };
    if (next === APPROVAL_STATUS.APPROVED && !row.anonymous_participant_id) {
      patch.anonymous_participant_id = `anon_${crypto.randomUUID()}`;
    }
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      toast({ title: "변경 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "변경됨", description: `${row.full_name ?? row.email ?? "학습자"} → ${STATUS_LABEL[next]}` });
    await fetchRows();
  };

  return (
    <AdminShell
      title="학습자 관리"
      description="학습자 프로필 조회와 승인/반려/비활성 처리를 합니다."
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">상태 필터</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {rows ? `${filtered.length} / ${rows.length}` : "—"}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>소속/신분</TableHead>
              <TableHead className="text-center">프로필</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-center">익명 ID</TableHead>
              <TableHead>업데이트</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  불러오는 중…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  표시할 학습자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                  <TableCell>{r.email ?? "—"}</TableCell>
                  <TableCell>{r.affiliation_or_status ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    {r.profile_completed ? "✓" : "✗"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.approval_status]}>
                      {STATUS_LABEL[r.approval_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {r.anonymous_participant_id ? "있음" : "없음"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(r.updated_at ?? r.created_at) ?
                      new Date(r.updated_at ?? r.created_at!).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(r.id)}>
                      상세
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.full_name ?? selected.email ?? "학습자 상세"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <Section title="운영 정보">
                  <Field label="이름" value={selected.full_name} />
                  <Field label="이메일" value={selected.email} />
                  <Field label="소속/신분" value={selected.affiliation_or_status} />
                  <Field label="학년/과정" value={selected.academic_year_or_program} />
                  <Field label="역할" value={selected.role} />
                  <Field
                    label="승인 상태"
                    value={
                      <Badge variant={STATUS_VARIANT[selected.approval_status]}>
                        {STATUS_LABEL[selected.approval_status]}
                      </Badge>
                    }
                  />
                  <Field
                    label="프로필 완료"
                    value={selected.profile_completed ? "완료" : "미완료"}
                  />
                </Section>

                <Section title="연구 배경">
                  <Field label="언어 배경" value={selected.language_background} />
                  <Field label="중국어 자가평가" value={selected.chinese_proficiency_self_report} />
                  <Field label="비즈니스 중국어 경험" value={selected.business_chinese_experience} />
                  <Field label="통번역 경험 수준" value={selected.ti_experience_level} />
                  <Field
                    label="통번역 경험 모드"
                    value={selected.ti_experience_modes?.join(", ")}
                  />
                  <Field label="GenAI 사용 빈도" value={selected.genai_use_frequency} />
                  <Field label="AI 프롬프팅 스타일" value={selected.ai_prompting_style_for_ti} />
                  <Field label="AI 통번역 체감 난이도" value={selected.perceived_ai_ti_difficulty} />
                  <Field
                    label="비즈니스 중국어 통번역 체감 리스크"
                    value={selected.perceived_business_chinese_ti_risk}
                  />
                </Section>

                <Section title="동의">
                  <Field
                    label="연구 활용 동의"
                    value={selected.research_use_consent ? "예" : "아니오"}
                  />
                  <Field
                    label="익명화 안내 확인"
                    value={selected.anonymization_notice_confirmed ? "예" : "아니오"}
                  />
                  <Field
                    label="리포트 이메일 동의"
                    value={selected.report_email_consent ? "예" : "아니오"}
                  />
                </Section>

                <Section title="연구 분석 식별">
                  <Field
                    label="anonymous_participant_id"
                    value={
                      selected.anonymous_participant_id ? (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {selected.anonymous_participant_id}
                        </code>
                      ) : null
                    }
                  />
                </Section>
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  승인 시 익명 식별자가 없으면 자동 생성됩니다(있으면 유지).
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || selected.approval_status === APPROVAL_STATUS.INACTIVE}
                    onClick={() => updateStatus(selected, APPROVAL_STATUS.INACTIVE)}
                  >
                    비활성화
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy || selected.approval_status === APPROVAL_STATUS.REJECTED}
                    onClick={() => updateStatus(selected, APPROVAL_STATUS.REJECTED)}
                  >
                    반려
                  </Button>
                  <Button
                    disabled={busy || selected.approval_status === APPROVAL_STATUS.APPROVED}
                    onClick={() => updateStatus(selected, APPROVAL_STATUS.APPROVED)}
                  >
                    승인
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default Page;