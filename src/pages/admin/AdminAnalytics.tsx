import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";

const ExampleBadge = () => (
  <Badge
    variant="outline"
    className="whitespace-nowrap border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
  >
    예시 레이아웃 · 로그 축적 후 활성화
  </Badge>
);

const HBarSkeleton = ({ labels }: { labels: string[] }) => {
  const widths = [92, 78, 64, 50, 38];
  return (
    <div className="space-y-2.5">
      {labels.map((label, index) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-xs text-muted-foreground">{label}</div>
          <div className="h-4 flex-1 rounded bg-muted/50">
            <div
              className="h-full rounded bg-muted-foreground/25"
              style={{ width: `${widths[index] ?? 40}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const VBarSkeleton = ({ labels }: { labels: string[] }) => {
  const heights = [70, 55, 82, 40, 65, 48, 58, 72, 35];
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {labels.map((label, index) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-muted-foreground/25"
              style={{ height: `${heights[index % heights.length]}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {labels.map((label) => (
          <div key={label} className="flex-1 text-center text-[10px] text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

const DonutSkeleton = ({ items }: { items: string[] }) => {
  const values = [35, 25, 22, 18];
  const total = values.reduce((sum, value) => sum + value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const shades = ["#a3a3a3", "#bdbdbd", "#d4d4d4", "#e5e5e5"];
  let cumulative = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        {values.map((value, index) => {
          const dash = (value / total) * circumference;
          const offset = -cumulative;
          cumulative += dash;
          return (
            <circle
              key={index}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={shades[index]}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {items.map((item, index) => (
          <li key={item} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: shades[index] }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="mb-3 mt-8 flex items-center gap-3 first:mt-0">
    <h2 className="text-base font-semibold">{title}</h2>
    <ExampleBadge />
  </div>
);

const PlaceholderCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="text-[10px] text-orange-700">예시</span>
    </div>
    {children}
    <p className="mt-3 text-[11px] text-muted-foreground">
      막대 높이·도넛 비율은 예시이며 실제 수치·순위가 아닙니다.
    </p>
  </div>
);

const Page = () => {
  const speechActs = ["감사", "칭찬", "사과", "요청", "제안", "초대", "반대", "거절", "불만"];
  const errorTypes = [
    "직접성 조절 실패",
    "부담 완화 부족",
    "격식 오판",
    "의미·책임 추가",
    "관계 거리 오판",
  ];

  return (
    <AdminShell
      title="학습 분석"
      description="개별 수행 기록을 집단 단위로 종합하여, 수업에서 다룰 화행·상황 판단·수정 양상을 확인합니다."
    >
      <SectionHeader title="학습자 집단 종합 분석" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderCard title="고질적 오류 유형 Top 5">
          <HBarSkeleton labels={errorTypes} />
        </PlaceholderCard>
        <PlaceholderCard title="화행별 평균 판단 정확도">
          <VBarSkeleton labels={speechActs} />
        </PlaceholderCard>
      </div>

      <SectionHeader title="P/D/R · 화용 진단" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderCard title="P/D/R 판단 오류 분포">
          <DonutSkeleton items={["P 오판", "D 오판", "R 오판", "복합 오판"]} />
        </PlaceholderCard>
        <PlaceholderCard title="화용 판단 실패 요인">
          <VBarSkeleton labels={["직접성", "격식", "부담"]} />
        </PlaceholderCard>
      </div>
    </AdminShell>
  );
};

export default Page;
