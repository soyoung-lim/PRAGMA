import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  ExternalLink,
} from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { HSK3_REFERENCE_SOURCE_ID } from "@/lib/pragma/hskReference";

const EXPECTED_VOCABULARY_ENTRIES = 11_000;
const EXPECTED_TOPIC_ROWS = 427;

type ReferenceStatus = {
  source_id: string | null;
  title: string | null;
  publisher: string | null;
  released_at: string | null;
  effective_at: string | null;
  official_url: string | null;
  sha256: string | null;
  manifest_version: string | null;
  extraction_version: string | null;
  vocabulary_entries: number | null;
  official_topic_rows: number | null;
  derived_topic_rows: number | null;
  researcher_mapping_rows: number | null;
};

type AuditStatus = "complete" | "not_applicable" | "unavailable";
type AuditSnapshot = {
  status: AuditStatus;
  direction: "ko_zh" | "zh_ko" | null;
  createdAt: string | null;
  referenceCeiling: number | null;
  distinctTokenCount: number | null;
  matchedTokenCount: number | null;
  candidates: string[];
};

type VocabularySample = {
  headword: string;
  pinyin: string;
};

type LevelId = "beginner" | "intermediate" | "advanced";
type ReferenceLevel = {
  id: LevelId;
  pragma: string;
  hsk: string;
  entries: number;
  samples: VocabularySample[];
  extendedSamples: VocabularySample[];
};

const REFERENCE_LEVELS: ReferenceLevel[] = [
  {
    id: "beginner",
    pragma: "입문",
    hsk: "HSK 1–4급 누적",
    entries: 2_000,
    samples: [
      { headword: "按时", pinyin: "ànshí" },
      { headword: "报名", pinyin: "bàomíng" },
      { headword: "乘客", pinyin: "chéngkè" },
      { headword: "申请", pinyin: "shēnqǐng" },
      { headword: "约会", pinyin: "yuēhuì" },
      { headword: "安排", pinyin: "ānpái" },
    ],
    extendedSamples: [
      { headword: "按照", pinyin: "ànzhào" },
      { headword: "参观", pinyin: "cānguān" },
      { headword: "出差", pinyin: "chūchāi" },
      { headword: "交流", pinyin: "jiāoliú" },
      { headword: "经验", pinyin: "jīngyàn" },
      { headword: "竞争", pinyin: "jìngzhēng" },
      { headword: "顺利", pinyin: "shùnlì" },
      { headword: "提醒", pinyin: "tíxǐng" },
      { headword: "讨论", pinyin: "tǎolùn" },
      { headword: "误会", pinyin: "wùhuì" },
      { headword: "责任", pinyin: "zérèn" },
      { headword: "保证", pinyin: "bǎozhèng" },
    ],
  },
  {
    id: "intermediate",
    pragma: "중급",
    hsk: "HSK 1–5급 누적",
    entries: 3_600,
    samples: [
      { headword: "承担", pinyin: "chéngdān" },
      { headword: "沟通", pinyin: "gōutōng" },
      { headword: "缓解", pinyin: "huǎnjiě" },
      { headword: "评价", pinyin: "píngjià" },
      { headword: "趋势", pinyin: "qūshì" },
      { headword: "资源", pinyin: "zīyuán" },
    ],
    extendedSamples: [
      { headword: "风险", pinyin: "fēngxiǎn" },
      { headword: "改善", pinyin: "gǎishàn" },
      { headword: "合作", pinyin: "hézuò" },
      { headword: "可靠", pinyin: "kěkào" },
      { headword: "面临", pinyin: "miànlín" },
      { headword: "效率", pinyin: "xiàolǜ" },
      { headword: "应对", pinyin: "yìngduì" },
      { headword: "预约", pinyin: "yùyuē" },
      { headword: "咨询", pinyin: "zīxún" },
      { headword: "避免", pinyin: "bìmiǎn" },
      { headword: "参与", pinyin: "cānyù" },
      { headword: "成果", pinyin: "chéngguǒ" },
    ],
  },
  {
    id: "advanced",
    pragma: "고급",
    hsk: "HSK 1–6급 누적",
    entries: 5_400,
    samples: [
      { headword: "机制", pinyin: "jīzhì" },
      { headword: "立场", pinyin: "lìchǎng" },
      { headword: "争议", pinyin: "zhēngyì" },
      { headword: "采纳", pinyin: "cǎinà" },
      { headword: "承诺", pinyin: "chéngnuò" },
      { headword: "保障", pinyin: "bǎozhàng" },
    ],
    extendedSamples: [
      { headword: "策略", pinyin: "cèlüè" },
      { headword: "规范", pinyin: "guīfàn" },
      { headword: "核心", pinyin: "héxīn" },
      { headword: "监督", pinyin: "jiāndū" },
      { headword: "维护", pinyin: "wéihù" },
      { headword: "协调", pinyin: "xiétiáo" },
      { headword: "政策", pinyin: "zhèngcè" },
      { headword: "质疑", pinyin: "zhìyí" },
      { headword: "差异", pinyin: "chāyì" },
      { headword: "策划", pinyin: "cèhuà" },
      { headword: "暴露", pinyin: "bàolù" },
      { headword: "层面", pinyin: "céngmiàn" },
    ],
  },
];

const TOPIC_EXAMPLES = [
  ["日常生活", "交往", "基本礼貌行为"],
  ["日常生活", "交通出行", "出行安排"],
  ["教育情况", "校园生活", "课后活动"],
  ["职场生活", "工作情况", "工作评价"],
  ["文化与传统", "饮食文化", "中餐"],
];

const LEVEL_INTRO_COUNTS = [
  ["1급", 300],
  ["2급", 200],
  ["3급", 500],
  ["4급", 1_000],
  ["5급", 1_600],
  ["6급", 1_800],
  ["7–9급", 5_600],
] as const;

function fmt(value: number) {
  return value.toLocaleString();
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function auditFromContent(content: unknown, createdAt: string | null): AuditSnapshot | null {
  const record = recordValue(content);
  const audit = recordValue(record?.hsk_lexical_audit);
  const status = audit?.status;
  if (status !== "complete" && status !== "not_applicable" && status !== "unavailable") {
    return null;
  }
  const direction = audit.direction === "ko_zh" || audit.direction === "zh_ko"
    ? audit.direction
    : null;
  return {
    status,
    direction,
    createdAt,
    referenceCeiling: typeof audit.reference_ceiling === "number" ? audit.reference_ceiling : null,
    distinctTokenCount: typeof audit.distinct_token_count === "number" ? audit.distinct_token_count : null,
    matchedTokenCount: typeof audit.matched_token_count === "number" ? audit.matched_token_count : null,
    candidates: Array.isArray(audit.out_of_reference_candidates)
      ? audit.out_of_reference_candidates.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function formatAuditDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pragmaLevelForCeiling(ceiling: number | null) {
  if (ceiling === 4) return "입문";
  if (ceiling === 5) return "중급";
  if (ceiling === 6) return "고급";
  return null;
}

const AdminCorpus = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReferenceStatus | null>(null);
  const [recentAudit, setRecentAudit] = useState<AuditSnapshot | null>(null);
  const [auditLookupFailed, setAuditLookupFailed] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Record<LevelId, boolean>>({
    beginner: false,
    intermediate: false,
    advanced: false,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      const [statusResult, recentResult] = await Promise.all([
        supabase
          .from("hsk3_reference_status")
          .select("*")
          .eq("source_id", HSK3_REFERENCE_SOURCE_ID)
          .maybeSingle(),
        supabase
          .from("scenarios")
          .select("created_at, core_content, mission_content")
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      if (cancelled) return;

      if (statusResult.error) {
        setStatus(null);
        setError(statusResult.error.message);
      } else {
        setStatus((statusResult.data as ReferenceStatus | null) ?? null);
      }

      if (recentResult.error) {
        setRecentAudit(null);
        setAuditLookupFailed(true);
      } else {
        const snapshots = (recentResult.data ?? [])
          .flatMap((row) => [
            auditFromContent(row.mission_content, row.created_at),
            auditFromContent(row.core_content, row.created_at),
          ])
          .filter((item): item is AuditSnapshot => Boolean(item));
        const latestComplete = snapshots.find((item) => item.status === "complete");
        setRecentAudit(latestComplete ?? snapshots[0] ?? null);
        setAuditLookupFailed(false);
      }

      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const referenceReady = Boolean(
    status &&
      Number(status.vocabulary_entries) === EXPECTED_VOCABULARY_ENTRIES &&
      Number(status.official_topic_rows) === EXPECTED_TOPIC_ROWS,
  );

  const toggleLevel = (id: LevelId) => {
    setExpandedLevels((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <AdminShell
      title="HSK 3.0 데이터셋 활용"
      description="PRAGMA가 생성한 중국어 콘텐츠의 어휘 난이도를 외부 기준으로 점검하고, 그 결과를 교수자 검수에 연결합니다."
    >
      <div className="mx-auto max-w-[1100px] space-y-6">
        <DatasetOverview loading={loading} ready={referenceReady} status={status} />

        {error && (
          <div
            className="-mt-5 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
            title={error}
          >
            운영 DB 상태를 확인하지 못했습니다. 공식 추출본의 대표 어휘는 계속 볼 수 있습니다.
          </div>
        )}

        <section>
          <SectionHeading
            eyebrow="중국어 어휘 기준"
            title="PRAGMA 수준별 자동 적용 범위"
            description="콘텐츠 생성 시 선택한 PRAGMA 수준에 따라 HSK 누적 어휘 범위가 자동으로 적용됩니다."
          />
          <div className="mt-4 overflow-hidden rounded-xl border border-[#D9D3C4] bg-white">
            <div className="grid lg:grid-cols-3">
              {REFERENCE_LEVELS.map((level, index) => (
                <LevelColumn
                  key={level.id}
                  level={level}
                  expanded={expandedLevels[level.id]}
                  onToggle={() => toggleLevel(level.id)}
                  divided={index > 0}
                />
              ))}
            </div>
          </div>
        </section>

        <OperationsSection
          loading={loading}
          audit={recentAudit}
          lookupFailed={auditLookupFailed}
          referenceReady={referenceReady}
        />

        <SourceAndStatus status={status} loading={loading} />

        <SupplementaryData status={status} />
      </div>
    </AdminShell>
  );
};

function DatasetOverview({
  loading,
  ready,
  status,
}: {
  loading: boolean;
  ready: boolean;
  status: ReferenceStatus | null;
}) {
  const vocabularyEntries = status?.vocabulary_entries == null
    ? "—"
    : fmt(Number(status.vocabulary_entries));
  const topicRows = status?.official_topic_rows == null
    ? "—"
    : fmt(Number(status.official_topic_rows));
  const vocabularySegments = [
    {
      hsk: "HSK 1–4급",
      measure: "합계",
      entries: 2_000,
      pragma: "PRAGMA 입문",
      cumulative: 2_000,
      detail: "1급 300 · 2급 200 · 3급 500 · 4급 1,000",
      active: true,
    },
    {
      hsk: "HSK 5급",
      measure: "신규",
      entries: 1_600,
      pragma: "PRAGMA 중급",
      cumulative: 3_600,
      detail: "1–5급 누적",
      active: true,
    },
    {
      hsk: "HSK 6급",
      measure: "신규",
      entries: 1_800,
      pragma: "PRAGMA 고급",
      cumulative: 5_400,
      detail: "1–6급 누적",
      active: true,
    },
    {
      hsk: "HSK 7–9급",
      measure: "신규",
      entries: 5_600,
      pragma: "현재 PRAGMA 미적용",
      cumulative: null,
      detail: "DB 참고 데이터로 보관",
      active: false,
    },
  ] as const;

  if (loading) {
    return <Skeleton className="h-[88px] w-full rounded-lg" />;
  }

  if (!ready) {
    return (
      <div className="flex min-h-[58px] items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
        <div>
          <p className="text-[12px] font-bold">운영 데이터셋 확인 필요</p>
          <p className="mt-0.5 text-[10.5px]">공식 추출본은 계속 표시되며, 운영 DB 연결 상태를 확인해야 합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#D9D3C4] bg-white" aria-label="운영 데이터셋 현황">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <p className="text-[11px] font-bold text-emerald-800">운영 DB 연결됨</p>
              <h2 className="text-[19px] font-bold tracking-[-0.02em] text-[#15202B]">HSK 3.0 어휘 DB <strong className="ml-1 tabular-nums">{vocabularyEntries}개 탑재</strong></h2>
            </div>
            <p className="mt-1 text-[11.5px] text-[#625D54]">PRAGMA 콘텐츠 점검에는 선택한 수준에 따라 최대 5,400개를 적용합니다.</p>
          </div>
        </div>
        <div className="shrink-0 border-t border-[#E8E2D6] pt-2.5 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <p className="text-[11px] font-semibold text-[#6F695F]">주제 {topicRows}개 <span className="ml-1 rounded-full bg-[#FFF8D9] px-2 py-0.5 text-[9.5px] font-bold text-[#75621B]">설계 참고자료</span></p>
          <p className="mt-0.5 text-[10px] text-[#898278]">현재 생성 조건에는 사용하지 않음</p>
        </div>
      </div>
      <div className="grid border-t border-[#E8E2D6] sm:grid-cols-2 lg:grid-cols-4">
        {vocabularySegments.map((segment, index) => (
          <div
            key={segment.hsk}
            className={`px-4 py-3 ${segment.active ? "bg-white" : "bg-[#F7F4EA]"} ${index === 1 ? "border-t border-[#E8E2D6] sm:border-l sm:border-t-0" : ""} ${index === 2 ? "border-t border-[#E8E2D6] sm:border-t lg:border-l lg:border-t-0" : ""} ${index === 3 ? "border-t border-[#E8E2D6] sm:border-l sm:border-t lg:border-t-0" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11.5px] font-bold text-[#514C43]">{segment.hsk} <span className="font-medium text-[#8A847A]">{segment.measure}</span></p>
              <p className="text-[17px] font-bold tabular-nums text-[#15202B]">{fmt(segment.entries)}<span className="ml-0.5 text-[9.5px] font-medium text-[#777168]">개</span></p>
            </div>
            <p className="mt-1 min-h-4 text-[9.5px] leading-4 text-[#898278]">{segment.detail}</p>
            <div className={`mt-2 border-l-2 pl-2 ${segment.active ? "border-[#FAD338]" : "border-[#CFC8B8]"}`}>
              <p className={`text-[11.5px] font-bold ${segment.active ? "text-[#15202B]" : "text-[#777168]"}`}>{segment.pragma}</p>
              {segment.cumulative != null && (
                <p className="mt-0.5 text-[10.5px] text-[#625D54]">누적 적용 <strong className="tabular-nums text-[#15202B]">{fmt(segment.cumulative)}개</strong></p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#8A7423]">{eyebrow}</p>
      <h2 className="mt-1 text-[21px] font-bold tracking-[-0.02em] text-[#15202B] sm:text-[23px]">{title}</h2>
      <p className="mt-1 max-w-[48rem] text-[12px] leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function LevelColumn({
  level,
  expanded,
  onToggle,
  divided,
}: {
  level: ReferenceLevel;
  expanded: boolean;
  onToggle: () => void;
  divided: boolean;
}) {
  return (
    <article className={`flex flex-col px-4 py-4 sm:px-5 ${divided ? "border-t border-[#E6E0D3] lg:border-l lg:border-t-0" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[22px] font-bold tracking-[-0.03em] text-[#15202B]">PRAGMA {level.pragma}</h3>
        <p className="whitespace-nowrap text-[12px] font-medium text-[#777168]">
          적용 어휘 <strong className="ml-1 text-[19px] font-semibold tabular-nums tracking-[-0.02em] text-[#15202B]">{fmt(level.entries)}</strong>개
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-l-2 border-[#FAD338] pl-2 text-[11.5px] text-[#625D54]">
        <span>HSK 참조 범위</span>
        <strong className="text-[#15202B]">{level.hsk.replace("HSK ", "")}</strong>
      </div>

      <div className="mt-3 border-t border-[#EAE5DA] pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground">대표 어휘 · 공식 HSK 자료</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {level.samples.map((sample) => (
            <VocabularyRow key={sample.headword} sample={sample} />
          ))}
          {expanded && level.extendedSamples.map((sample) => (
            <VocabularyRow key={sample.headword} sample={sample} />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="mt-3 inline-flex w-fit items-center gap-1 text-[12px] font-bold text-[#15202B] underline decoration-[#D6C65E] decoration-2 underline-offset-4 transition-colors hover:text-[#806D22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6B900] focus-visible:ring-offset-2"
      >
        {expanded ? "대표 어휘 접기" : "대표 어휘 더 보기"}
        <ArrowRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "-rotate-90" : "rotate-90"}`} aria-hidden />
      </button>
    </article>
  );
}

function VocabularyRow({ sample }: { sample: VocabularySample }) {
  return (
    <div className="min-w-0 rounded-md bg-[#F7F4EA] px-2 py-2">
      <span lang="zh" className="block truncate text-[14px] font-semibold leading-4 text-[#15202B]">{sample.headword}</span>
      <span className="mt-0.5 block truncate text-[10.5px] leading-3 text-[#837D73]">{sample.pinyin}</span>
    </div>
  );
}

function OperationsSection({
  loading,
  audit,
  lookupFailed,
  referenceReady,
}: {
  loading: boolean;
  audit: AuditSnapshot | null;
  lookupFailed: boolean;
  referenceReady: boolean;
}) {
  const steps = [
    ["중국어 생성", "한→중 예시·선택지·참고안, 중→한 원문"],
    ["HSK 참고 범위 대조", "해당 PRAGMA 수준의 누적 어휘 범위 적용"],
    ["목록 밖 후보 표시", "자동 오류가 아닌 교수자 확인 후보"],
    ["교수자 검수", "수업 맥락을 반영해 최종 판단"],
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[#D9D3C4] bg-white">
      <div className="bg-[#F7F4EA] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-1">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-[#8A7423]">생성 후 점검</p>
            <h2 className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-[#15202B]">점검 방식</h2>
          </div>
          <p className="text-[11.5px] text-[#625D54]">자동 기준은 후보를 보여 주고, 최종 판단은 교수자가 내립니다.</p>
        </div>
        <ol className="mt-3 grid gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, description], index) => (
            <li key={title} className={`flex gap-2.5 pr-4 ${index > 0 ? "sm:border-l sm:border-[#DED8CA] sm:pl-4" : ""} ${index === 2 ? "sm:border-l-0 sm:pl-0 lg:border-l lg:pl-4" : ""}`}>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#15202B] text-[9px] font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-[12.5px] font-bold leading-4 text-[#15202B]">{title}</h3>
                <p className="mt-1 text-[11px] leading-4 text-[#716B61]">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <AuditResultPanel
        loading={loading}
        audit={audit}
        lookupFailed={lookupFailed}
        referenceReady={referenceReady}
      />
    </section>
  );
}

function AuditResultPanel({
  loading,
  audit,
  lookupFailed,
  referenceReady,
}: {
  loading: boolean;
  audit: AuditSnapshot | null;
  lookupFailed: boolean;
  referenceReady: boolean;
}) {
  const complete = Boolean(
    audit?.status === "complete" &&
    audit.referenceCeiling != null &&
    audit.distinctTokenCount != null &&
    audit.matchedTokenCount != null,
  );
  const checkedAt = formatAuditDate(audit?.createdAt ?? null);
  const pragmaLevel = pragmaLevelForCeiling(audit?.referenceCeiling ?? null);
  const direction = audit?.direction === "ko_zh" ? "한→중" : audit?.direction === "zh_ko" ? "중→한" : null;
  const emptyTitle = lookupFailed || audit?.status === "unavailable"
    ? "최근 점검 기록을 확인할 수 없습니다."
    : audit?.status === "not_applicable"
      ? "최근 콘텐츠에는 점검할 중국어가 없습니다."
      : "최근 점검 없음";
  const emptyDescription = lookupFailed || audit?.status === "unavailable"
    ? "통합 검수 화면에서 상태를 다시 확인할 수 있습니다."
    : "다음 콘텐츠 생성부터 점검 수치와 확인 후보가 자동으로 기록됩니다.";

  if (!loading && !complete) {
    return (
      <div className="flex flex-col gap-3 border-t border-[#E4DED1] bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
        <div className="shrink-0 sm:w-[150px]">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-[#8A7423]">운영 결과</p>
          <h2 className="mt-0.5 text-[16px] font-bold text-[#15202B]">최근 어휘 점검</h2>
        </div>
        <div className="min-w-0 flex-1 border-t border-[#ECE6DA] pt-2.5 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-bold text-[#15202B]">{emptyTitle}</p>
            {referenceReady && (
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> 운영 DB 준비됨
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11.5px] text-[#716B61]">{emptyDescription}</p>
        </div>
        <Link
          to="/admin/review"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#FAD338] px-3 py-2 text-[11.5px] font-bold text-[#15202B] transition-colors hover:bg-[#F3C91D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6B900] focus-visible:ring-offset-2"
        >
          통합 검수에서 보기
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-[#E4DED1] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E9E3D7] px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A7423]">운영 결과</p>
          <h2 className="mt-1 text-[19px] font-bold tracking-[-0.02em] text-[#15202B]">최근 어휘 점검</h2>
        </div>
        <Link
          to="/admin/review"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#FAD338] px-3 py-2 text-[11px] font-bold text-[#15202B] transition-colors hover:bg-[#F3C91D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6B900] focus-visible:ring-offset-2"
        >
          통합 검수에서 보기
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-2.5 p-4 sm:grid-cols-3 sm:p-5">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : audit ? (
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[#514C43]">
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> 점검 완료
            </span>
            {pragmaLevel && <span>적용 수준 <strong>{pragmaLevel}</strong></span>}
            {direction && <span>언어 방향 <strong>{direction}</strong></span>}
            <span>적용 기준 <strong>HSK 1–{audit.referenceCeiling}급 누적</strong></span>
            {checkedAt && <span className="text-[#8A847A]">{checkedAt}</span>}
          </div>
          <div className="mt-4 grid border-y border-[#E8E2D6] sm:grid-cols-3">
            <AuditMetric label="점검 단어" value={audit.distinctTokenCount} />
            <AuditMetric label="기준 내 확인" value={audit.matchedTokenCount} divided />
            <AuditMetric label="교수자 확인 후보" value={audit.candidates.length} divided />
          </div>
          <div className="mt-4">
            <p className="text-[10.5px] font-semibold text-[#777168]">목록 밖 후보</p>
            {audit.candidates.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {audit.candidates.slice(0, 12).map((candidate) => (
                  <span key={candidate} lang="zh" className="rounded-sm border border-[#E2DCCF] bg-[#F7F4EA] px-2 py-1 text-[10.5px] text-[#15202B]">
                    {candidate}
                  </span>
                ))}
                {audit.candidates.length > 12 && (
                  <span className="px-1 py-1 text-[10px] text-[#777168]">외 {audit.candidates.length - 12}개</span>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-[#716B61]">별도로 확인할 후보가 없습니다.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AuditMetric({ label, value, divided = false }: { label: string; value: number | null; divided?: boolean }) {
  return (
    <div className={`py-3 sm:px-4 ${divided ? "border-t border-[#E8E2D6] sm:border-l sm:border-t-0" : ""}`}>
      <p className="text-[10px] text-[#777168]">{label}</p>
      <p className="mt-0.5 text-[23px] font-extrabold tabular-nums tracking-[-0.03em] text-[#15202B]">{value == null ? "—" : fmt(value)}<span className="ml-0.5 text-[10px] font-medium text-[#777168]">개</span></p>
    </div>
  );
}

function SourceAndStatus({ status, loading }: { status: ReferenceStatus | null; loading: boolean }) {
  const fallback = loading ? "불러오는 중" : "확인 필요";
  const release = status?.released_at || status?.effective_at
    ? `${status?.released_at ?? "—"} 발표 · ${status?.effective_at ?? "—"} 시행`
    : fallback;

  return (
    <section className="border-y border-[#D9D3C4] px-1">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="source" className="border-0">
          <AccordionTrigger className="px-4 py-3.5 hover:no-underline sm:px-5">
            <div className="flex min-w-0 items-center gap-3 text-left">
              <ExternalLink className="h-4 w-4 shrink-0 text-[#806D22]" aria-hidden />
              <div>
                <span className="text-[14px] font-bold">공식 출처와 데이터 해석</span>
                <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">공식 문서·버전과 이 데이터의 적용 원칙을 확인합니다.</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 sm:px-5">
            <div className="grid overflow-hidden rounded-lg border border-[#E2DCCF] lg:grid-cols-[7fr_5fr]">
              <div className="bg-white px-4 py-4 sm:px-5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-[#8A7423]">근거 자료</p>
                <h2 className="mt-1 text-[18px] font-bold text-[#15202B]">공식 출처와 버전</h2>
                <dl className="mt-3 grid gap-y-2 text-[11.5px] sm:grid-cols-[96px_1fr]">
                  <SourceRow label="자료" value={status?.title ?? fallback} />
                  <SourceRow label="발행기관" value={status?.publisher ?? fallback} />
                  <SourceRow label="발표·시행" value={release} />
                  <SourceRow label="데이터 명세 ID" value={status?.manifest_version ?? fallback} mono />
                  <SourceRow label="SHA-256" value={status?.sha256 ?? fallback} mono truncate />
                </dl>
                {status?.official_url && (
                  <a
                    href={status.official_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#15202B] underline decoration-[#D6C65E] decoration-2 underline-offset-4 hover:text-[#806D22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6B900] focus-visible:ring-offset-2"
                  >
                    공식 PDF 열기 <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="border-t border-[#E4DED1] bg-[#F7F4EA] px-4 py-4 sm:px-5 lg:border-l lg:border-t-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-[#8A7423]">해석 원칙</p>
                <h2 className="mt-1 text-[18px] font-bold text-[#15202B]">이 데이터의 현재 지위</h2>
                <ul className="mt-3 space-y-2 text-[11.5px] leading-5 text-[#5F5A50]">
                  <StatusPoint>PRAGMA 수준을 인증하는 기준은 아닙니다.</StatusPoint>
                  <StatusPoint>중국어 어휘 난이도 점검을 위한 외부 참고 기준입니다.</StatusPoint>
                  <StatusPoint>목록 밖 단어는 탈락시키지 않고, 고유명사·전문용어·분절 여부를 교수가 확인합니다.</StatusPoint>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function SourceRow({
  label,
  value,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd title={truncate ? value : undefined} className={`${mono ? "font-mono text-[10px]" : ""} ${truncate ? "max-w-[34rem] truncate" : ""} text-[#15202B]`}>{value}</dd>
    </>
  );
}

function StatusPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C0A929]" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function SupplementaryData({ status }: { status: ReferenceStatus | null }) {
  return (
    <section className="border-y border-[#D9D3C4] px-1">
      <Accordion type="multiple" className="w-full">
        <AccordionItem value="topics" className="border-[#E2DCCB]">
          <AccordionTrigger className="px-4 py-3.5 hover:no-underline sm:px-5">
            <div className="flex min-w-0 items-center gap-3 text-left">
              <BookOpen className="h-4 w-4 shrink-0 text-[#806D22]" aria-hidden />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-bold">HSK 주제 자료</span>
                  <Badge variant="outline" className="border-[#D4C78F] bg-[#FFF9DF] text-[10px] text-[#6F5E1F]">참고자료</Badge>
                </div>
                <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">현재는 콘텐츠 생성 조건으로 사용하지 않습니다.</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 sm:px-5">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="text-[12.5px] leading-6 text-[#5F5A50]">
                공식 HSK 주제 427개는 설계 참고자료로 보관합니다. 향후 PRAGMA가 생성한 시나리오의
                주제 범위를 외부 체계와 비교하는 보조 검증에 활용할 수 있습니다.
              </div>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {TOPIC_EXAMPLES.map((path) => (
                  <p key={path.join("/")} lang="zh" className="border-b border-[#E8E2D5] py-2 text-[11.5px] text-[#15202B]">
                    {path.join("  /  ")}
                  </p>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="structure" className="border-0">
          <AccordionTrigger className="px-4 py-3.5 hover:no-underline sm:px-5">
            <div className="flex min-w-0 items-center gap-3 text-left">
              <Database className="h-4 w-4 shrink-0 text-[#806D22]" aria-hidden />
              <div>
                <span className="text-[14px] font-bold">데이터 출처와 구성</span>
                <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">공식 자료와 후속 정리 데이터를 구분해 확인합니다.</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 sm:px-5">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
              <dl className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-[12px]">
                <DataCount label="공식 어휘 항목" value={status?.vocabulary_entries} />
                <DataCount label="공식 L3 주제" value={status?.official_topic_rows} />
                <DataCount label="규칙으로 정리한 주제 자료" value={status?.derived_topic_rows} />
                <DataCount label="연구자 검토용 연결 자료" value={status?.researcher_mapping_rows} />
              </dl>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">공식 어휘의 등급별 신규 항목</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {LEVEL_INTRO_COUNTS.map(([label, count]) => (
                    <span key={label} className="text-[11.5px] text-[#5F5A50]">
                      {label} <strong className="ml-1 tabular-nums text-[#15202B]">{fmt(count)}</strong>
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-[10.5px] leading-5 text-muted-foreground">
                  공식 전사 자료와 규칙 기반 정리, 연구자 검토 자료는 서로 다른 데이터 층으로 관리합니다.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function DataCount({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <>
      <dt className="text-[#5F5A50]">{label}</dt>
      <dd className="font-bold tabular-nums text-[#15202B]">{value == null ? "—" : fmt(Number(value))}</dd>
    </>
  );
}

export default AdminCorpus;
