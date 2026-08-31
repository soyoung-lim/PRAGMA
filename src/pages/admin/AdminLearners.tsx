import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { APPROVAL_STATUS, type ApprovalStatus } from "@/lib/auth/constants";
import {
  PRIMARY_LANGUAGE_OPTIONS,
  CHINESE_LEVEL_OPTIONS,
  exposureContextOptions,
  targetLanguageOf,
  TARGET_LANGUAGE_LABEL,
  TI_EXPERIENCE_OPTIONS,
  labelOf,
  labelsOf,
} from "@/lib/auth/profileOptions";

type LearnerRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  /** 마법사가 쓰는 컬럼. affiliation_or_status는 구 컬럼(둘 다 존재) */
  affiliation: string | null;
  affiliation_or_status: string | null;
  chinese_level: string | null;
  chinese_exposure_contexts: string[] | null;
  ti_experience_note: string | null;
  interpreting_experience: string | null;
  /** 동의도 마법사는 consent_* 에 쓴다. research_use_consent 등은 구 컬럼 */
  consent_data_use: boolean | null;
  consent_anonymous_analysis: boolean | null;
  consent_email_report: boolean | null;
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
  approved: "승인 완료",
  rejected: "반려 처리",
  inactive: "비활성",
};

const STATUS_TONE: Record<ApprovalStatus, string> = {
  pending_approval: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
};

type FilterValue = Exclude<ApprovalStatus, "inactive"> | "all";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "전체" },
  { value: APPROVAL_STATUS.PENDING, label: STATUS_LABEL.pending_approval },
  { value: APPROVAL_STATUS.APPROVED, label: STATUS_LABEL.approved },
  { value: APPROVAL_STATUS.REJECTED, label: STATUS_LABEL.rejected },
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

/** 소속/신분·동의는 신·구 컬럼이 공존한다 — 마법사가 쓰는 쪽을 우선하고 없으면 구 값. */
const firstOf = <T,>(...vals: (T | null | undefined)[]) =>
  vals.find((v) => v !== null && v !== undefined) ?? null;

/**
 * 수행 기록 화면의 학습자 검색어. 그 화면은 이름·이메일·가명 참여자 ID를
 * 부분 일치로 찾으므로, 가장 특정적인 값부터 고른다. 셋 다 없으면 링크를 걸지 않는다.
 */
const traceQueryFor = (row: { email: string | null; anonymous_participant_id: string | null; full_name: string | null }) =>
  firstOf(row.email, row.anonymous_participant_id, row.full_name);

/** 목록은 스캔용이므로 초 단위를 버리고 자리수를 고정한다. */
const fmtUpdated = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/** 준비 상태를 있음/없음 텍스트 대신 한눈에 대비되는 칩으로 보여 준다. */
const ReadyChip = ({ ready, on, off }: { ready: boolean; on: string; off: string }) => (
  <span
    className={[
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
      ready ? "bg-[#EDE9DD] text-[#5B5446]" : "border border-dashed border-border text-muted-foreground",
    ].join(" ")}
  >
    {ready ? on : off}
  </span>
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
  const [rows, setRows] = useState<LearnerRow[] | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [learnerQuery, setLearnerQuery] = useState("");
  const [affiliationQuery, setAffiliationQuery] = useState("");
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
    void fetchRows();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const learnerNeedle = learnerQuery.trim().toLocaleLowerCase("ko-KR");
    const affiliationNeedle = affiliationQuery.trim().toLocaleLowerCase("ko-KR");
    return rows.filter((r) => {
      if (filter !== "all" && r.approval_status !== filter) return false;
      const learnerText = [r.full_name, r.email, r.anonymous_participant_id]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR");
      const affiliationText = String(firstOf(r.affiliation, r.affiliation_or_status) ?? "")
        .toLocaleLowerCase("ko-KR");
      return learnerText.includes(learnerNeedle) && affiliationText.includes(affiliationNeedle);
    });
  }, [rows, filter, learnerQuery, affiliationQuery]);

  const selected = useMemo(
    () => (selectedId ? rows?.find((r) => r.id === selectedId) ?? null : null),
    [selectedId, rows],
  );

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
      title="학습자 승인·관리"
      description="학습자 프로필을 확인해 승인·반려·비활성을 처리하고, 각 학습자의 수행 기록으로 바로 이동합니다."
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(21,32,43,0.05)]">
        <div className="flex items-center justify-between border-b border-border bg-white px-5 py-3">
          <span className="text-sm font-semibold text-[#343B42]">학습자 목록</span>
          <span className="rounded-full bg-[#F3F0E4] px-3 py-1.5 text-sm font-semibold text-[#5B5446]">
            {rows === null
              ? "불러오는 중…"
              : filter === "all" && !learnerQuery.trim() && !affiliationQuery.trim()
                ? `학습자 ${rows.length}명`
                : `${filtered.length}명 표시 · 전체 ${rows.length}명`}
          </span>
        </div>
        <Table className="min-w-[860px] table-fixed">
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <TableHeader className="bg-[#F7F5EE]">
            <TableRow>
              <TableHead className="h-auto px-5 py-3 align-top text-xs font-bold text-[#5F625F]">
                <label className="block">
                  학습자
                  <input
                    aria-label="학습자 필터"
                    value={learnerQuery}
                    onChange={(event) => setLearnerQuery(event.target.value)}
                    placeholder="이름·이메일 검색"
                    className="mt-2 h-8 w-full rounded-md border border-border bg-white px-2.5 font-normal text-foreground outline-none focus:border-[#B69B2C]"
                  />
                </label>
              </TableHead>
              <TableHead className="h-auto px-3 py-3 align-top text-xs font-bold text-[#5F625F]">
                <label className="block">
                  소속/신분
                  <input
                    aria-label="소속 필터"
                    value={affiliationQuery}
                    onChange={(event) => setAffiliationQuery(event.target.value)}
                    placeholder="소속 검색"
                    className="mt-2 h-8 w-full rounded-md border border-border bg-white px-2.5 font-normal text-foreground outline-none focus:border-[#B69B2C]"
                  />
                </label>
              </TableHead>
              <TableHead className="h-auto px-3 py-3 align-top text-xs font-bold text-[#5F625F]">
                <label className="block">
                  상태
                  <select
                    aria-label="상태 필터"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as FilterValue)}
                    className="mt-2 h-8 w-full rounded-md border border-border bg-white px-2 font-normal text-foreground outline-none focus:border-[#B69B2C]"
                  >
                    {FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </TableHead>
              <TableHead className="h-auto px-3 py-3 align-top text-xs font-bold text-[#5F625F]">프로필 · 익명 ID</TableHead>
              <TableHead className="h-auto px-3 py-3 text-right align-top text-xs font-bold text-[#5F625F]">업데이트</TableHead>
              <TableHead className="h-auto px-5 py-3 text-right align-top text-xs font-bold text-[#5F625F]">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  불러오는 중…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  표시할 학습자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="h-[88px] hover:bg-[#FBFAF5]">
                  <TableCell className="px-5 py-4">
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-5 text-foreground">{r.full_name ?? "—"}</div>
                      <div className="mt-0.5 truncate text-xs leading-5 text-muted-foreground" title={r.email ?? undefined}>{r.email ?? "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-4 text-sm leading-5 text-[#343B42]">
                    {firstOf(r.affiliation, r.affiliation_or_status) ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Badge
                      variant="outline"
                      className={`min-w-[76px] justify-center whitespace-nowrap ${STATUS_TONE[r.approval_status]}`}
                    >
                      {STATUS_LABEL[r.approval_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <div className="flex min-h-7 flex-wrap items-center gap-1.5">
                      <ReadyChip ready={!!r.profile_completed} on="프로필 완료" off="프로필 미완료" />
                      <ReadyChip ready={!!r.anonymous_participant_id} on="익명 ID" off="익명 ID 없음" />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-4 text-right text-xs tabular-nums text-muted-foreground">
                    {fmtUpdated(r.updated_at ?? r.created_at)}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {traceQueryFor(r) && (
                        <Button
                          size="sm"
                          asChild
                          className="min-w-[108px] bg-[#15202B] text-white hover:bg-[#243447]"
                        >
                          <Link to={`/admin/decision-traces?q=${encodeURIComponent(traceQueryFor(r)!)}`}>
                            수행 기록 →
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="min-w-[58px]" onClick={() => setSelectedId(r.id)}>
                        상세
                      </Button>
                    </div>
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
                  <Field
                    label="소속/신분"
                    value={firstOf(selected.affiliation, selected.affiliation_or_status)}
                  />
                  <Field label="학년/과정" value={selected.academic_year_or_program} />
                  <Field label="역할" value={selected.role} />
                  <Field
                    label="승인 상태"
                    value={
                      <Badge variant="outline" className={STATUS_TONE[selected.approval_status]}>
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
                  <Field
                    label="주 사용 언어"
                    value={labelOf(PRIMARY_LANGUAGE_OPTIONS, selected.language_background)}
                  />
                  <Field
                    label="중국어 학습 수준"
                    value={labelOf(CHINESE_LEVEL_OPTIONS, selected.chinese_level)}
                  />
                  {/* 학습 대상 언어는 주 사용 언어에서 도출된다 — 중국어 모어
                      화자에게는 한국어 노출을 물었으므로 라벨도 그렇게 읽어야 한다. */}
                  <Field
                    label={`${
                      TARGET_LANGUAGE_LABEL[targetLanguageOf(selected.language_background)]
                    } 접촉·사용 상황`}
                    value={labelsOf(
                      exposureContextOptions(targetLanguageOf(selected.language_background)),
                      selected.chinese_exposure_contexts,
                    )}
                  />
                  <Field
                    label="한중 통번역 경험"
                    value={labelOf(TI_EXPERIENCE_OPTIONS, selected.ti_experience_level)}
                  />
                </Section>

                {/* 2026-07-26 문항 개편 이전에 수집된 값. 값이 있을 때만 보여준다 —
                    항상 "—"인 칸이 늘어나면 관리자가 화면을 신뢰하지 않게 된다. */}
                {(selected.business_chinese_experience ||
                  selected.interpreting_experience ||
                  selected.chinese_proficiency_self_report ||
                  selected.ti_experience_modes?.length ||
                  selected.genai_use_frequency ||
                  selected.ai_prompting_style_for_ti ||
                  selected.perceived_ai_ti_difficulty ||
                  selected.perceived_business_chinese_ti_risk) && (
                  <Section title="이전 프로필 (2026-07-26 개편 전 수집분)">
                    {selected.business_chinese_experience && (
                      <Field label="비즈니스 중국어 경험" value={selected.business_chinese_experience} />
                    )}
                    {selected.interpreting_experience && (
                      <Field label="통번역 경험(구)" value={selected.interpreting_experience} />
                    )}
                    {selected.chinese_proficiency_self_report && (
                      <Field label="중국어 자가평가" value={selected.chinese_proficiency_self_report} />
                    )}
                    {selected.ti_experience_modes?.length ? (
                      <Field label="통번역 경험 모드" value={selected.ti_experience_modes.join(", ")} />
                    ) : null}
                    {selected.genai_use_frequency && (
                      <Field label="GenAI 사용 빈도" value={selected.genai_use_frequency} />
                    )}
                    {selected.ai_prompting_style_for_ti && (
                      <Field label="AI 프롬프팅 스타일" value={selected.ai_prompting_style_for_ti} />
                    )}
                    {selected.perceived_ai_ti_difficulty && (
                      <Field label="AI 통번역 체감 난이도" value={selected.perceived_ai_ti_difficulty} />
                    )}
                    {selected.perceived_business_chinese_ti_risk && (
                      <Field
                        label="비즈니스 중국어 통번역 체감 리스크"
                        value={selected.perceived_business_chinese_ti_risk}
                      />
                    )}
                  </Section>
                )}

                <Section title="동의">
                  <Field
                    label="연구 활용 동의"
                    value={
                      firstOf(selected.consent_data_use, selected.research_use_consent)
                        ? "예"
                        : "아니오"
                    }
                  />
                  <Field
                    label="익명화 안내 확인"
                    value={
                      firstOf(
                        selected.consent_anonymous_analysis,
                        selected.anonymization_notice_confirmed,
                      )
                        ? "예"
                        : "아니오"
                    }
                  />
                  <Field
                    label="리포트 이메일 동의"
                    value={
                      firstOf(selected.consent_email_report, selected.report_email_consent)
                        ? "예"
                        : "아니오"
                    }
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
