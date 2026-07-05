import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Wand2 } from "lucide-react";

const ITEM_TYPES = [
  {
    key: "mpj",
    badge: "MVP",
    title: "MPJ (적절성 판단)",
    desc: "후보 통번역안 중 적절한 것을 판단합니다. Multiple-Choice 기반 + 후보 비교.",
    tag: "수용",
  },
  {
    key: "correction",
    badge: "MVP",
    title: "Correction (수정)",
    desc: "부적절한 표현을 고칩니다. 수용에서 생산으로 이동하는 완충 유형입니다.",
    tag: "수용 → 생산",
  },
  {
    key: "written-dct",
    badge: "MVP",
    title: "Written DCT (직접 산출)",
    desc: "직접 번역·답장을 작성합니다. 텍스트 기반 생산형 과제입니다.",
    tag: "생산 · 번역",
  },
  {
    key: "oral-dct",
    badge: "MVP",
    title: "단일 턴 Oral DCT (통역)",
    desc: "녹음 → 전사 → 단일 턴 순차통역 수행입니다.",
    tag: "생산 · 통역",
  },
];

const V2_TYPES = [
  "MC 전면화",
  "Role Play(상호작용)",
  "자유대화",
];

const LEVEL_DISTRIBUTION = [
  {
    level: "입문",
    bars: [
      { label: "MPJ", value: 80, color: "bg-accent" },
      { label: "수정", value: 20, color: "bg-foreground/70" },
    ],
    caption: "화용 함정을 알아차리는 데 집중",
  },
  {
    level: "중급",
    bars: [
      { label: "MPJ", value: 30, color: "bg-accent" },
      { label: "수정", value: 30, color: "bg-foreground/70" },
      { label: "Written DCT", value: 40, color: "bg-foreground/40" },
    ],
    caption: "판단에서 산출로 무게 이동",
  },
  {
    level: "고급",
    bars: [
      { label: "판단", value: 10, color: "bg-accent" },
      { label: "DCT", value: 50, color: "bg-foreground/70" },
      { label: "Oral DCT", value: 40, color: "bg-foreground/40" },
    ],
    caption: "실제 통번역 수행에 가까운 비중",
  },
];

const CHALLENGE_AXIS = [
  { key: "directness_control", label: "직접성 조절" },
  { key: "formality_control", label: "격식 조절" },
  { key: "imposition_management", label: "부담·체면 관리" },
];

const RUBRIC_AXIS = [
  "의미·의도 보존",
  "관계·상황 적절성",
  "목표어 실현도",
];

const Page = () => (
  <AdminShell
    title="수준별 문항 설계"
    description="같은 시나리오의 수행 부담을 수준별로 조절 — 수용(판단)에서 생산(산출)으로 무게 이동"
  >
    <Alert className="mb-8 border-accent/50 bg-accent/10">
      <Info className="h-4 w-4 text-accent-foreground" />
      <AlertTitle className="text-foreground">설계 안내</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        문항 유형은 시나리오에 저장되지 않고, 수준×mode에서 런타임 파생됩니다. (다음 단계 연동 예정)
      </AlertDescription>
    </Alert>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">1. 문항 유형 4종 (MVP)</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEM_TYPES.map((item) => (
          <Card key={item.key} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className="bg-accent text-accent-foreground hover:bg-accent"
                >
                  {item.badge}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {item.tag}
                </Badge>
              </div>
              <CardTitle className="mt-3 text-base font-semibold">
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {item.desc}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed border-border bg-card">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Badge variant="secondary" className="text-muted-foreground">
            v2
          </Badge>
          <span className="text-sm text-muted-foreground">
            {V2_TYPES.join(" · ")} —{" "}
            <span className="text-foreground">v2 확장 예정</span>
          </span>
        </CardContent>
      </Card>
    </section>

    <section className="mt-10 space-y-4">
      <h2 className="text-xl font-bold text-foreground">
        2. 수준별 출제 비중 (권장)
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {LEVEL_DISTRIBUTION.map((level) => (
          <Card key={level.level}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {level.level}
              </CardTitle>
              <CardDescription>{level.caption}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {level.bars.map((bar) => (
                <div key={bar.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{bar.label}</span>
                    <span className="font-medium text-foreground">
                      {bar.value}%
                    </span>
                  </div>
                  <Progress
                    value={bar.value}
                    className="h-2 bg-muted"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        비율은 권장 출제 비중이며 고정 배점이 아님. 수준·화행·challenge
        intensity로 조정.
      </p>
    </section>

    <section className="mt-10 space-y-4">
      <h2 className="text-xl font-bold text-foreground">
        3. 후보 설계 (directness 단일축)
      </h2>
      <Card>
        <CardContent className="space-y-4 py-5">
          <p className="text-foreground">
            후보 번역안은{" "}
            <span className="font-semibold">directness(직접성) 1~5 단일축</span>
            으로 생성합니다. 후보 개수는 수준 변수:
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "입문", count: 3 },
              { label: "중급", count: 5 },
              { label: "고급", count: 7 },
            ].map((opt) => (
              <div
                key={opt.label}
                className="rounded-lg border border-border bg-muted/50 px-4 py-2 text-center"
              >
                <div className="text-xs text-muted-foreground">{opt.label}</div>
                <div className="text-lg font-bold text-foreground">
                  {opt.count}개
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">distractor 안내:</span>{" "}
              distractor는 문법 오류가 아니라 의도적으로 심은 화용 실패입니다.
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
              <li>A = 특정 challenge 실패</li>
              <li>B = 다른 challenge 실패</li>
              <li>C = 적절안</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>

    <section className="mt-10 space-y-4">
      <h2 className="text-xl font-bold text-foreground">
        4. 진단·채점 축
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              pragmatic_challenge (진단 3축)
            </CardTitle>
            <CardDescription>
              학습자의 화용적 어려움을 진단하는 단위
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {CHALLENGE_AXIS.map((axis) => (
                <li
                  key={axis.key}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="text-foreground">{axis.label}</span>
                  <code className="text-xs text-muted-foreground">
                    {axis.key}
                  </code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              rubric (채점 3축)
            </CardTitle>
            <CardDescription>
              산출물을 평가하는 채점 단위
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {RUBRIC_AXIS.map((axis) => (
                <li
                  key={axis}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
                >
                  {axis}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">
        challenge=진단 단위, rubric=채점 단위. 1:1 대칭이 아님은 의도된
        설계입니다.
      </p>
    </section>

    <section className="mt-10 flex items-center justify-between border-t border-border pt-6">
      <p className="text-sm text-muted-foreground">
        문항 생성·시나리오 연동은 다음 단계에서 구현됩니다.
      </p>
      <Button disabled className="gap-2">
        <Wand2 className="h-4 w-4" />
        연동 예정
      </Button>
    </section>
  </AdminShell>
);

export default Page;
