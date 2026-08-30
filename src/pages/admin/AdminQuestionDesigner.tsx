import { AdminShell } from "@/components/AdminShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MPJ_TYPE_ORDER_V5 } from "@/lib/pragma/missionSchema";
import { ArrowDown, Info } from "lucide-react";

type MjtType = (typeof MPJ_TYPE_ORDER_V5)[number];

const MJT_DESIGN: Record<MjtType, { title: string; task: string; result: string }> = {
  scale4: {
    title: "첫인상 판단",
    task: "하나의 표현이 현재 상황에 얼마나 적절한지 4단계로 판단합니다.",
    result: "적절성의 방향과 정도를 먼저 확인",
  },
  judge3: {
    title: "맥락 대비 판단",
    task: "다른 사건의 표현을 과소·적정·과잉 대역으로 판단합니다.",
    result: "같은 화행도 맥락에 따라 달라짐을 확인",
  },
  fix_choice: {
    title: "판단하고 고쳐보기",
    task: "판단을 먼저 확정한 뒤 수정안 3개 중 권장안 1개를 고릅니다.",
    result: "판단을 실제 표현 조정으로 연결",
  },
  reason: {
    title: "이유 찾기",
    task: "판단을 확정한 뒤 이유 3개 중 가장 중요한 이유 1개를 고릅니다.",
    result: "표현과 맥락을 연결한 근거 확인",
  },
  multi_judge: {
    title: "여러 초안 비교",
    task: "초안 4개를 함께 보고 BEST 1개와 WORST 1개를 고릅니다.",
    result: "복수의 가능한 표현과 경계 사례 비교",
  },
};

const DESIGN_PRINCIPLES = [
  {
    title: "한 미션으로 연결",
    body: "MJT와 DCT는 같은 미션·수행 기록에 속합니다. MJT만 끝내서는 미션이 완료되지 않습니다.",
  },
  {
    title: "비점수 판단",
    body: "MJT 응답은 능력 점수로 합산하지 않습니다. 참고 판정과 비교하고 수업 토론에 활용합니다.",
  },
  {
    title: "맥락 의존성",
    body: "표현의 길이나 공손 표지 수가 아니라 관계·거리·부담에 비추어 과소·적정·과잉을 판단합니다.",
  },
  {
    title: "독립 산출",
    body: "DCT는 MJT에서 본 문장을 복사하는 문제가 아니라 같은 화행의 새로운 사건에서 직접 산출하는 과제입니다.",
  },
];

const FEEDBACK_LAYERS = [
  { title: "의미 충실성", body: "원문의 명제와 화행 목적을 유지했는지 확인" },
  { title: "문법 정확성", body: "형태·어휘·문장 구성의 명확한 문제를 확인" },
  { title: "화용 적절성", body: "현재 관계와 부담에 맞게 표현을 조절했는지 확인" },
];

const Page = () => (
  <AdminShell
    title="판단·산출 과제 설계"
    description="MJT 5개로 맥락별 판단을 연습하고, DCT 1개로 직접 산출하는 학습 구조입니다."
  >
    <div className="mx-auto max-w-[1060px] space-y-8">
      <Alert className="border-accent/50 bg-accent/10">
        <Info className="h-4 w-4 text-accent-foreground" />
        <AlertTitle className="text-foreground">이 화면에서 사용하는 용어</AlertTitle>
        <AlertDescription className="mt-1 space-y-1 text-muted-foreground">
          <p><strong className="text-foreground">MJT</strong> · Metapragmatic Judgement Task · 메타화용 판단 과제</p>
          <p><strong className="text-foreground">DCT</strong> · Discourse Completion Task · 담화완성 과제</p>
        </AlertDescription>
      </Alert>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">1. 한 미션의 고정 구조</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            다섯 번의 판단 연습에서 기준을 세운 뒤, 새로운 상황에서 한 번 직접 산출합니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {MPJ_TYPE_ORDER_V5.map((type, index) => {
            const design = MJT_DESIGN[type];
            return (
              <Card key={type} className="h-full">
                <CardHeader className="space-y-2 pb-2 pt-4">
                  <Badge variant="secondary" className="w-fit">MJT {index + 1}</Badge>
                  <CardTitle className="text-sm">{design.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-4 text-xs leading-relaxed">
                  <p className="text-muted-foreground">{design.task}</p>
                  <p className="border-t border-border pt-3 font-medium text-foreground">{design.result}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 py-1 text-xs font-semibold text-muted-foreground">
          <span>MJT 5개 완료</span>
          <ArrowDown className="h-4 w-4" aria-hidden />
        </div>

        <Card className="border-[#15202B]/30 bg-[#15202B] text-[#F1EFE8]">
          <CardHeader className="pb-3 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-accent text-accent-foreground hover:bg-accent">DCT 1</Badge>
              <CardTitle className="text-base text-[#F1EFE8]">직접 산출</CardTitle>
            </div>
            <CardDescription className="text-[#C9D0D6]">
              MJT와 다른 사건에서 번역 또는 통역으로 자신의 표현을 완성합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pb-5 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-white/15 px-3 py-3">새로운 독립 상황</div>
            <div className="rounded-md border border-white/15 px-3 py-3">번역 또는 통역 산출</div>
            <div className="rounded-md border border-white/15 px-3 py-3">3층 피드백과 다듬기</div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">2. 판단과 산출을 묶는 설계 원칙</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {DESIGN_PRINCIPLES.map((principle) => (
            <Card key={principle.title}>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm">{principle.title}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                {principle.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">3. DCT 이후 피드백과 다듬기</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            피드백은 DCT와 별개의 추가 과제가 아니라, 최초 산출을 검토하고 자신의 표현으로 다듬는 후속 단계입니다.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {FEEDBACK_LAYERS.map((layer, index) => (
            <Card key={layer.title}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{index + 1}</Badge>
                  <CardTitle className="text-sm">{layer.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pb-4 text-sm text-muted-foreground">{layer.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">4. 수준이 달라도 유지되는 구조</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">바뀌지 않는 것</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4 text-sm text-muted-foreground">
              <p>MJT 5개 + DCT 1개의 과제 수와 순서</p>
              <p>맥락에 따른 판단 축과 비점수 원칙</p>
              <p>의미·문법·화용의 피드백 구조</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">수준에 따라 조절하는 것</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4 text-sm text-muted-foreground">
              <p>상황과 언어 표현의 복잡도</p>
              <p>내용 어휘와 산출 지원의 양</p>
              <p>판단해야 하는 경계 사례의 미묘함</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  </AdminShell>
);

export default Page;
