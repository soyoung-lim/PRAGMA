import { useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { useDraftScenarios } from "@/lib/scenarioDrafts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type SpeechAct = "request" | "refusal";
type Genre = "business_email" | "business_messenger" | "meeting_speech";
type LearnerLevel = "beginner_intermediate" | "intermediate" | "advanced";
type InteractionContext = "coordination" | "negotiation" | "follow_up";
type AutoCheck = "pass" | "warning" | "fail";

type IndustrySector =
  | "trade_distribution"
  | "IT_platform"
  | "manufacturing"
  | "tourism_hospitality"
  | "education_research"
  | "public_international_affairs"
  | "culture_content_media";

type BusinessFunction =
  | "overseas_sales"
  | "marketing_pr"
  | "customer_partner_support"
  | "SCM_logistics"
  | "contract_terms"
  | "project_coordination"
  | "research_admin"
  | "localization_translation"
  | "event_operations"
  | "international_collaboration";

interface Scenario {
  id: string;
  title: string;
  source_text: string;
  speech_act: SpeechAct;
  genre: Genre;
  learner_level: LearnerLevel;
  industry_sector: IndustrySector;
  business_function: BusinessFunction;
  interaction_context: InteractionContext;
  review_status: ReviewStatus;
  usage_assignment: UsageAssignment;
  auto_check_result: AutoCheck;
  updated_at: string;
}

const SPEECH_ACT_LABEL: Record<SpeechAct, string> = {
  request: "요청",
  refusal: "거절",
};

const GENRE_LABEL: Record<Genre, string> = {
  business_email: "업무 이메일",
  business_messenger: "업무 메신저",
  meeting_speech: "업무 회의",
};

const LEVEL_LABEL: Record<LearnerLevel, string> = {
  beginner_intermediate: "중급 · HSK 4급",
  intermediate: "상급 · HSK 5급",
  advanced: "고급 · HSK 6급",
};

const CONTEXT_LABEL: Record<InteractionContext, string> = {
  coordination: "일정 조정",
  negotiation: "조건 협의",
  follow_up: "후속 확인",
};

const INDUSTRY_LABEL: Record<IndustrySector, string> = {
  trade_distribution: "무역·유통",
  IT_platform: "IT·플랫폼",
  manufacturing: "제조·소비재",
  tourism_hospitality: "관광·서비스",
  education_research: "교육·연구",
  public_international_affairs: "공공·국제교류",
  culture_content_media: "문화·콘텐츠",
};

// 7 primary labels shown to users. Orphan enums map to a consolidated label.
const FUNCTION_LABEL: Record<BusinessFunction, string> = {
  overseas_sales: "해외영업·거래",
  marketing_pr: "마케팅·홍보",
  customer_partner_support: "고객·파트너 응대",
  SCM_logistics: "구매·물류",
  contract_terms: "해외영업·거래",
  project_coordination: "프로젝트 운영",
  research_admin: "대외협력·제휴",
  localization_translation: "번역·로컬라이제이션",
  event_operations: "프로젝트 운영",
  international_collaboration: "대외협력·제휴",
};

// Only the 7 primary enum values are exposed in the business-function filter.
const FUNCTION_FILTER_KEYS: BusinessFunction[] = [
  "overseas_sales",
  "marketing_pr",
  "customer_partner_support",
  "SCM_logistics",
  "project_coordination",
  "localization_translation",
  "international_collaboration",
];

const REVIEW_BADGE: Record<ReviewStatus, string> = {
  generated: "bg-[#E5E7EB] text-[#374151] border-[#D1D5DB]",
  needs_review: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
  revise_required: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  revised: "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  approved: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
};

const USAGE_BADGE: Record<UsageAssignment, string> = {
  archived_only: "bg-[#E5E7EB] text-[#374151] border-[#D1D5DB]",
  coursework_published: "bg-[#CFFAFE] text-[#155E75] border-[#67E8F9]",
  experiment_locked: "bg-[#FEF3C7] text-[#854D0E] border-[#FCD34D]",
  excluded: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
};

const AUTO_CHECK_LABEL: Record<AutoCheck, string> = {
  pass: "pass",
  warning: "warning",
  fail: "fail",
};

const AUTO_CHECK_COLOR: Record<AutoCheck, string> = {
  pass: "text-[#15803D]",
  warning: "text-[#B45309]",
  fail: "text-[#B91C1C]",
};

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  generated: "생성됨",
  needs_review: "검수 대기",
  revise_required: "보완 필요",
  revised: "재검수 대기",
  approved: "승인 완료",
};

const USAGE_LABEL: Record<UsageAssignment, string> = {
  archived_only: "아카이브 전용",
  coursework_published: "수업용 공개",
  experiment_locked: "본실험 locked",
  excluded: "제외",
};

const MOCK: Scenario[] = [
  {
    id: "s1",
    title: "납기 단축 요청 — 광저우 가구 공급사",
    source_text:
      "안녕하세요, 저희 측 매장 오픈 일정이 앞당겨져 다음 컨테이너 출고를 2주 앞당겨 주실 수 있을지 확인 부탁드립니다. 가능하시다면 추가 비용 산정 기준도 함께 공유해 주세요.",
    speech_act: "request",
    genre: "business_email",
    learner_level: "intermediate",
    industry_sector: "trade_distribution",
    business_function: "overseas_sales",
    interaction_context: "coordination",
    review_status: "needs_review",
    usage_assignment: "archived_only",
    auto_check_result: "warning",
    updated_at: "2026-05-22",
  },
  {
    id: "s2",
    title: "신규 SaaS 파트너십 제안 — 상하이 커머스 플랫폼",
    source_text:
      "귀사의 B2B 셀러 도구와 연동을 검토 중입니다. 다음 주 화상회의에서 API 연동 범위와 데이터 처리 정책을 함께 논의하고 싶습니다.",
    speech_act: "request",
    genre: "business_messenger",
    learner_level: "advanced",
    industry_sector: "IT_platform",
    business_function: "project_coordination",
    interaction_context: "negotiation",
    review_status: "approved",
    usage_assignment: "coursework_published",
    auto_check_result: "pass",
    updated_at: "2026-05-20",
  },
  {
    id: "s3",
    title: "본실험 — 광고 단가 인상 통보 거절",
    source_text:
      "이번 분기 캠페인 예산이 확정되어 제안 주신 단가 인상은 수용이 어렵습니다. 기존 단가 유지가 가능한 범위에서 노출 비중을 조정하는 방향을 검토 부탁드립니다.",
    speech_act: "refusal",
    genre: "meeting_speech",
    learner_level: "advanced",
    industry_sector: "culture_content_media",
    business_function: "marketing_pr",
    interaction_context: "negotiation",
    review_status: "approved",
    usage_assignment: "experiment_locked",
    auto_check_result: "pass",
    updated_at: "2026-05-18",
  },
  {
    id: "s4",
    title: "호텔 단체 예약 변경 요청 — 칭다오 인센티브 투어",
    source_text:
      "3월 단체 투숙 일정이 조정되어 객실 타입과 체크인 날짜 변경을 요청드립니다. 변경에 따른 추가 비용이 있다면 사전에 안내 부탁드립니다.",
    speech_act: "request",
    genre: "business_email",
    learner_level: "beginner_intermediate",
    industry_sector: "tourism_hospitality",
    business_function: "customer_partner_support",
    interaction_context: "follow_up",
    review_status: "revise_required",
    usage_assignment: "archived_only",
    auto_check_result: "fail",
    updated_at: "2026-05-15",
  },
  {
    id: "s5",
    title: "공동 연구 일정 재조정 — 베이징 대학 연구실",
    source_text:
      "내부 검토 일정이 지연되어 다음 주 공동 워크숍 일정을 한 주 미루는 방안을 제안드립니다. 가능하신 시간대를 회신 부탁드립니다.",
    speech_act: "request",
    genre: "business_messenger",
    learner_level: "intermediate",
    industry_sector: "education_research",
    business_function: "international_collaboration",
    interaction_context: "coordination",
    review_status: "revised",
    usage_assignment: "archived_only",
    auto_check_result: "warning",
    updated_at: "2026-05-12",
  },
  {
    id: "s6",
    title: "MOU 체결 연기 요청 거절 — 공공 국제교류",
    source_text:
      "양측 일정 합의가 이미 공표되어 체결식 자체의 연기는 어렵습니다. 다만 부대 행사 일부는 별도 일정으로 분리 진행이 가능합니다.",
    speech_act: "refusal",
    genre: "meeting_speech",
    learner_level: "advanced",
    industry_sector: "public_international_affairs",
    business_function: "international_collaboration",
    interaction_context: "negotiation",
    review_status: "approved",
    usage_assignment: "excluded",
    auto_check_result: "pass",
    updated_at: "2026-05-10",
  },
];

const ALL = "__all__";

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

const MetaTag = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
    {children}
  </span>
);

const FilterSelect = ({
  value,
  onChange,
  category,
  options,
  width = "w-[140px]",
}: {
  value: string;
  onChange: (v: string) => void;
  category: string;
  options: { value: string; label: string }[];
  width?: string;
}) => {
  const selected = options.find((o) => o.value === value);
  const display = `${category}: ${selected ? selected.label : "전체"}`;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`${width} h-9 text-[12px]`}>
        <span className="truncate">{display}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>전체</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const AdminArchive = () => {
  const [fReview, setFReview] = useState(ALL);
  const [fUsage, setFUsage] = useState(ALL);
  const [fSpeech, setFSpeech] = useState(ALL);
  const [fGenre, setFGenre] = useState(ALL);
  const [fLevel, setFLevel] = useState(ALL);
  const [fIndustry, setFIndustry] = useState(ALL);
  const [fFunction, setFFunction] = useState(ALL);

  const drafts = useDraftScenarios();
  const visible = useMemo(() => {
    const draftsAsScenario: Scenario[] = drafts.map((d) => ({
      id: d.id,
      title: d.title,
      source_text: d.source_text,
      speech_act: d.speech_act,
      genre: d.genre,
      learner_level: d.learner_level,
      industry_sector: d.industry_sector,
      business_function: d.business_function,
      interaction_context: d.interaction_context,
      review_status: "needs_review",
      usage_assignment: "archived_only",
      auto_check_result: d.auto_check_result,
      updated_at: d.updated_at,
    }));
    return [
      ...draftsAsScenario,
      ...MOCK.filter((s) => s.review_status !== "generated"),
    ];
  }, [drafts]);

  const filtered = useMemo(() => {
    return visible.filter((s) => {
      if (fReview !== ALL && s.review_status !== fReview) return false;
      if (fUsage !== ALL && s.usage_assignment !== fUsage) return false;
      if (fSpeech !== ALL && s.speech_act !== fSpeech) return false;
      if (fGenre !== ALL && s.genre !== fGenre) return false;
      if (fLevel !== ALL && s.learner_level !== fLevel) return false;
      if (fIndustry !== ALL && s.industry_sector !== fIndustry) return false;
      if (fFunction !== ALL && s.business_function !== fFunction) return false;
      return true;
    });
  }, [visible, fReview, fUsage, fSpeech, fGenre, fLevel, fIndustry, fFunction]);

  const counts = useMemo(() => {
    const base = filtered;
    return {
      total: base.length,
      needsReview: base.filter((s) => s.review_status === "needs_review").length,
      approved: base.filter((s) => s.review_status === "approved").length,
      reviseRequired: base.filter((s) => s.review_status === "revise_required")
        .length,
      experimentLocked: base.filter(
        (s) =>
          s.review_status === "approved" &&
          s.usage_assignment === "experiment_locked",
      ).length,
    };
  }, [filtered]);

  return (
    <AdminShell
      title="시나리오 아카이브"
      description="AI 생성 한·중 통번역 학습 시나리오 관리"
    >
      {/* Helper note */}
      <div className="rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-4 py-3">
        <p className="text-[11px] leading-relaxed text-[#5B5446]">
          AI 생성 시나리오는 검수 전 학생에게 공개되지 않습니다.
          <br />
          연구자 검수 후 승인된 자료만 수업용 공개 또는 본실험 locked로 지정할 수 있습니다.
          <br />
          자동 점검 결과는 참고용이며, 최종 공개 여부는 연구자 검수와 용도 지정에 따라 결정됩니다.
        </p>
      </div>

      {/* Count chips + actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체" count={counts.total} tone="neutral" />
          <Chip label="검수 대기" count={counts.needsReview} tone="amber" />
          <Chip label="승인 완료" count={counts.approved} tone="green" />
          <Chip label="보완 필요" count={counts.reviseRequired} tone="red" />
          <Chip
            label="본실험 locked"
            count={counts.experimentLocked}
            tone="mustard"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="h-9 bg-[#1d2336] text-white hover:bg-[#1d2336]/90"
            onClick={() => {}}
          >
            + 시나리오 추가
          </Button>
          <Button
            variant="outline"
            className="h-9 border-[#D6D2C7] bg-transparent text-[#2c2c2a] hover:bg-muted"
            onClick={() => {}}
          >
            ↓ 데이터 내보내기
          </Button>
        </div>
      </div>

      {/* Filters — row 1: 운영 게이팅 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          value={fReview}
          onChange={setFReview}
          category="검수 상태"
          options={(Object.keys(REVIEW_LABEL) as ReviewStatus[])
            .filter((k) => k !== "generated")
            .map((k) => ({ value: k, label: REVIEW_LABEL[k] }))}
          width="w-[180px]"
        />
        <FilterSelect
          value={fUsage}
          onChange={setFUsage}
          category="용도 배정"
          options={(Object.keys(USAGE_LABEL) as UsageAssignment[]).map((k) => ({
            value: k,
            label: USAGE_LABEL[k],
          }))}
          width="w-[200px]"
        />
        <FilterSelect
          value={fSpeech}
          onChange={setFSpeech}
          category="화행"
          options={[
            { value: "request", label: "요청" },
            { value: "refusal", label: "거절" },
          ]}
          width="w-[140px]"
        />
        <FilterSelect
          value={fGenre}
          onChange={setFGenre}
          category="장르"
          options={(Object.keys(GENRE_LABEL) as Genre[]).map((k) => ({
            value: k,
            label: GENRE_LABEL[k],
          }))}
          width="w-[180px]"
        />
      </div>
      {/* Filters — row 2: 큐레이션 검색 */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <FilterSelect
          value={fLevel}
          onChange={setFLevel}
          category="학습자 수준"
          options={(Object.keys(LEVEL_LABEL) as LearnerLevel[]).map((k) => ({
            value: k,
            label: LEVEL_LABEL[k],
          }))}
          width="w-[180px]"
        />
        <FilterSelect
          value={fIndustry}
          onChange={setFIndustry}
          category="산업 분야"
          options={(Object.keys(INDUSTRY_LABEL) as IndustrySector[]).map(
            (k) => ({ value: k, label: INDUSTRY_LABEL[k] }),
          )}
          width="w-[240px]"
        />
        <FilterSelect
          value={fFunction}
          onChange={setFFunction}
          category="업무 기능"
          options={FUNCTION_FILTER_KEYS.map((k) => ({
            value: k,
            label: FUNCTION_LABEL[k],
          }))}
          width="w-[240px]"
        />
      </div>

      {/* Cards grid */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => {
          const isExcluded = s.usage_assignment === "excluded";
          return (
            <article
              key={s.id}
              className={`flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm ${
                isExcluded ? "opacity-85" : ""
              }`}
            >
              <h3
                className={`text-[14px] font-medium leading-snug text-foreground ${
                  isExcluded ? "line-through" : ""
                }`}
              >
                {s.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
                {s.source_text}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <MetaTag>{SPEECH_ACT_LABEL[s.speech_act]}</MetaTag>
                <MetaTag>{GENRE_LABEL[s.genre]}</MetaTag>
                <MetaTag>{LEVEL_LABEL[s.learner_level]}</MetaTag>
                <MetaTag>{INDUSTRY_LABEL[s.industry_sector]}</MetaTag>
                <MetaTag>{FUNCTION_LABEL[s.business_function]}</MetaTag>
                <MetaTag>{CONTEXT_LABEL[s.interaction_context]}</MetaTag>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${REVIEW_BADGE[s.review_status]} ${
                    isExcluded ? "line-through" : ""
                  }`}
                >
                  검수: {s.review_status}
                </span>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${USAGE_BADGE[s.usage_assignment]} ${
                    isExcluded ? "line-through" : ""
                  }`}
                >
                  용도: {s.usage_assignment}
                </span>
              </div>

              <hr className="my-3 border-border" />

              <div className="flex items-center justify-between text-[11px]">
                <span className={AUTO_CHECK_COLOR[s.auto_check_result]}>
                  자동 점검: {AUTO_CHECK_LABEL[s.auto_check_result]}
                </span>
                <span className="text-muted-foreground">
                  {s.updated_at} 수정
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-8 border-[#D6D2C7] bg-transparent text-[12px] text-[#2c2c2a] hover:bg-muted"
                  onClick={() => {}}
                >
                  상세 보기
                </Button>
                <Button
                  className="h-8 bg-[#1d2336] text-[12px] text-white hover:bg-[#1d2336]/90"
                  onClick={() => {}}
                >
                  검수하기
                </Button>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-md border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            조건에 해당하는 시나리오가 없습니다.
          </div>
        )}
      </div>
    </AdminShell>
  );
};

export default AdminArchive;
