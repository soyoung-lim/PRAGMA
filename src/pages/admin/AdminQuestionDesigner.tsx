import { AdminShell } from "@/components/AdminShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MISSION_LEVEL_ORDER, MISSION_LEVEL_POLICIES } from "@/lib/pragma/levelPolicy";
import { MPJ_TYPE_ORDER_V4 } from "@/lib/pragma/missionSchema";
import { DEFAULT_FEATURE_BY_ACT, getTargetFeature } from "@/lib/pragma/targetFeatures";
import { Info } from "lucide-react";

const MPJ_LABELS: Record<(typeof MPJ_TYPE_ORDER_V4)[number], { title: string; desc: string }> = {
  scale4: { title: "전체 적절성 평가", desc: "표현 전체가 상황에 얼마나 알맞은지 4단계로 판단" },
  fix_choice: { title: "수정안 선택", desc: "문제가 있는 표현을 더 알맞게 고친 안 선택" },
  reason: { title: "판단 근거 확인", desc: "판단의 주된 이유를 확인" },
  multi_judge: { title: "복수 표현 점검", desc: "여러 표현을 같은 상황 기준으로 함께 판정" },
};

const ACTIVE_FEATURES = ["request", "refusal", "thanks"]
  .map((speechAct) => DEFAULT_FEATURE_BY_ACT[speechAct as keyof typeof DEFAULT_FEATURE_BY_ACT])
  .filter((code): code is string => Boolean(code))
  .map((code) => getTargetFeature(code))
  .filter((feature): feature is NonNullable<ReturnType<typeof getTargetFeature>> => Boolean(feature));

const Page = () => (
  <AdminShell
    title="수준별 문항 정책"
    description="같은 학습 구조 안에서 문장 복잡도·표현 자원·원문 길이를 수준별로 조절합니다."
  >
    <Alert className="mb-6 border-accent/50 bg-accent/10">
      <Info className="h-4 w-4 text-accent-foreground" />
      <AlertTitle className="text-foreground">실제 생성 규칙과 연결된 화면</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        아래 수준 정책은 AI 미션 생성에 전달되는 정책과 같은 코드에서 불러옵니다. 과거의 권장 비율이나 수준별 후보 수는 현행 생성 규칙이 아니므로 표시하지 않습니다.
      </AlertDescription>
    </Alert>

    <section className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">1. 모든 수준에 공통인 한 미션의 구조</h2>
      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="bg-accent text-accent-foreground hover:bg-accent">감각 익히기</Badge>
            <strong>적절성 판단 문항 4개</strong>
            <span className="text-muted-foreground">+</span>
            <Badge variant="outline">직접 표현하기</Badge>
            <strong>번역 또는 통역 산출 1개</strong>
          </div>
          <p className="text-sm text-muted-foreground">
            입문·중급·고급 모두 같은 학습 순서를 사용합니다. 수준 차이는 문항 개수나 임의 비율이 아니라 언어 복잡도와 제공 자원의 양으로 만듭니다.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-4">
        {MPJ_TYPE_ORDER_V4.map((type, index) => (
          <Card key={type}>
            <CardHeader className="pb-2 pt-4">
              <Badge variant="secondary" className="w-fit">판단 {index + 1}</Badge>
              <CardTitle className="text-sm">{MPJ_LABELS[type].title}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 text-xs leading-relaxed text-muted-foreground">
              {MPJ_LABELS[type].desc}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>

    <section className="mt-8 space-y-4">
      <h2 className="text-lg font-bold text-foreground">2. 실제 생성에 적용되는 수준별 조절</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {MISSION_LEVEL_ORDER.map((level) => {
          const policy = MISSION_LEVEL_POLICIES[level];
          return (
            <Card key={level}>
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{policy.label}</CardTitle>
                  <Badge variant="outline">{policy.hsk}</Badge>
                </div>
                <CardDescription>{policy.sentenceProfile}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pb-5 text-sm">
                <p><strong>표현 자원</strong> · {policy.resourceProfile}</p>
                <p><strong>원문 길이</strong> · {policy.sourceLength}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>

    <section className="mt-8 space-y-4">
      <h2 className="text-lg font-bold text-foreground">3. 후보 생성과 적절성 판정은 서로 다른 층입니다</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-base">후보 생성</CardTitle>
            <CardDescription>같은 상황·의미를 유지하면서 목표 화용 요소의 실현 정도를 달리함</CardDescription>
          </CardHeader>
          <CardContent className="pb-5 text-sm text-muted-foreground">
            요청의 선택권, 거절의 완충, 감사의 강도처럼 화행별 목표 요소를 기준으로 서로 비교 가능한 표현을 만듭니다. 모든 화행을 ‘직접성 1~5’라는 단일 축으로 생성하지 않습니다.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-base">적절성 판정</CardTitle>
            <CardDescription>각 목표 요소에 맞는 과소·적정·과잉의 세 대역으로 판정</CardDescription>
          </CardHeader>
          <CardContent className="pb-5 text-sm text-muted-foreground">
            표현이 단순히 강한지 약한지가 아니라, 주어진 관계와 부담 상황에서 부족한지·알맞은지·지나친지를 판단합니다.
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {ACTIVE_FEATURES.map((feature) => (
          <Card key={feature.code}>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">{feature.learner_label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              {feature.band_schema.map((band) => (
                <div key={band.code} className="rounded-md border border-border px-3 py-2 text-xs text-foreground">
                  {band.label_ko}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>

    <section className="mt-8 space-y-4">
      <h2 className="text-lg font-bold text-foreground">4. 기준답안 A·B·C와 실제 학습 미션의 구분</h2>
      <Card>
        <CardContent className="space-y-3 py-5 text-sm">
          <p>
            <strong>기준답안 문항</strong>은 시스템 판정 장치가 제대로 작동하는지 확인하는 교정용 사례이며, A·B·C 세 후보가 목표 대역을 한 번씩 대표합니다.
          </p>
          <p className="text-muted-foreground">
            A·B·C의 위치는 사례마다 고정된 ‘정답 자리’가 아닙니다. 실제 학습 미션은 네 가지 판단 형식과 산출 과제로 구성되므로, 기준답안의 후보 3개를 수준별 후보 수 정책으로 해석해서는 안 됩니다.
          </p>
        </CardContent>
      </Card>
    </section>
  </AdminShell>
);

export default Page;
