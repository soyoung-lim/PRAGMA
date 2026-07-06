import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, AlertTriangle, Lightbulb, BookOpen, Target, BarChart3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WorkflowPreview — 순수 정적 예시 페이지.
 * 어떤 supabase/edge/DB 호출도 하지 않는다. 모든 값은 하드코딩된 시연용 상수.
 * 실제 학습 5단계(/scenario 등) 코드/저장 로직과는 완전히 분리된 설명 화면.
 */

const STEPS = [
  "상황 + 미니학습",
  "적절성 판단",
  "화용 설명",
  "직접 산출",
  "수행 리포트",
];

const META = [
  "10주차 · 불만·불만 대응",
  "중급 · HSK5",
  "한→중",
  "업무 이메일 · 번역",
  "P 대등 · D 공적 · R 중간",
];

const MINI_CARDS = [
  {
    title: "오늘의 화용 포인트",
    body: "불만은 관계를 해치지 않으면서 문제의 심각성을 분명히 전달해야 한다.",
  },
  {
    title: "왜 어려운가",
    body: "너무 직접적이면 공격적이고, 너무 완곡하면 문제가 축소된다. 균형이 관건.",
  },
  {
    title: "한↔중 차이",
    body: "한국어 '~해 주셨으면 합니다'류 완곡 요청이 중국어에서는 종종 '希望…尽量…' 구조로 이동.",
  },
  {
    title: "맛보기 표현",
    body: "希望 / 尽量 / 难免会影响 — 완곡·양보·결과 시사를 결합해 무게를 조절.",
  },
];

const CANDIDATES = [
  { n: 1, directness: 1, verdict: "부적절", reason: "의미 이탈 — 문제의 심각성이 사라짐", text: "最近合作还算顺利，谢谢。" },
  { n: 2, directness: 2, verdict: null, text: "如果方便的话，希望以后能稍微注意一下配送时间。" },
  { n: 3, directness: 3, verdict: "적정 후보", text: "希望贵司尽量避免类似延误，否则难免会影响我们的排产。", highlight: ["希望", "尽量", "难免会影响"] },
  { n: 4, directness: 4, verdict: null, text: "这次延误已经影响到我们的生产计划，请务必改善。" },
  { n: 5, directness: 5, verdict: "부적절", reason: "과직접 — 관계 훼손 위험", text: "你们必须马上解决，不然我们就终止合作。", highlight: ["必须"] },
];

const EXPLAIN_ROWS = [
  { axis: "directness (직접성)", note: "3단계 — 요구는 분명히 하되 명령형은 피함." },
  { axis: "imposition (부담)", note: "'希望…尽量…'으로 상대에게 여지를 남겨 부담 완화." },
  { axis: "의미 보존", note: "지연이 배송·생산에 미치는 영향을 '难免会影响'으로 시사." },
  { axis: "한↔중 대조", note: "한국어 완곡 요청 → 중국어 希望+尽량+결과 시사 구조로 이동." },
];

const RUBRIC = [
  { label: "의미 보존", score: 82 },
  { label: "관계 적절성", score: 68 },
  { label: "목표어 실현도", score: 75 },
];

const Badge = ({ children, tone = "orange" }: { children: React.ReactNode; tone?: "orange" | "muted" | "green" | "red" }) => {
  const tones = {
    orange: "bg-[#FAD338]/25 text-foreground border-[#FAD338]/60",
    muted: "bg-muted text-muted-foreground border-border",
    green: "bg-emerald-500/10 text-emerald-700 border-emerald-500/40",
    red: "bg-destructive/10 text-destructive border-destructive/40",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-medium", tones[tone])}>
      {children}
    </span>
  );
};

const StepCard = ({ step, title, children }: { step: number; title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-border bg-card p-5">
    <div className="mb-3 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
        {step}
      </div>
      <h3 className="text-[17px] font-bold">{title}</h3>
    </div>
    <div className="space-y-3">{children}</div>
  </section>
);

const highlight = (text: string, terms?: string[]) => {
  if (!terms || terms.length === 0) return text;
  const parts: (string | JSX.Element)[] = [text];
  terms.forEach((t, ti) => {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (typeof p !== "string") continue;
      const idx = p.indexOf(t);
      if (idx === -1) continue;
      parts.splice(
        i,
        1,
        p.slice(0, idx),
        <mark key={`${ti}-${i}`} className="rounded bg-[#FAD338]/60 px-0.5 font-semibold text-foreground">{t}</mark>,
        p.slice(idx + t.length),
      );
    }
  });
  return parts;
};

const WorkflowPreview = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header — 학습자 화면과 동일한 다크 헤더 */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-6 w-1.5 rounded-sm bg-accent" aria-hidden />
            <div>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-left text-[20px] font-bold hover:underline sm:text-[22px]"
              >
                AI 기반 한중 통번역 학습 워크플로우
              </button>
              <p className="mt-1 text-[13px] text-primary-foreground/70">
                한 주차 학습이 실제로 어떻게 진행되는지 · 예시 미리보기
              </p>
            </div>
          </div>
          <div className="shrink-0 pt-1">
            <button
              type="button"
              onClick={() => navigate("/roadmap")}
              className="inline-flex items-center gap-1 rounded-lg border border-accent px-3 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 15주 학습 설계로
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-6">
        {/* Title */}
        <div className="mb-4">
          <h1 className="text-[26px] font-bold leading-tight sm:text-[28px]">학습은 이렇게 진행됩니다</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            15주 강의계획의 한 주차가 실제로 어떻게 흘러가는지, 예시 하나로 보여드립니다.
          </p>
        </div>

        {/* Badge + caution */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="orange">예시 미리보기 · 실제 과제는 배정된 시나리오에 따라 진행됩니다</Badge>
        </div>
        <p className="mb-4 text-[12px] text-muted-foreground">
          중국어 예시는 워크플로우 시연용이며 원어민 검수 전입니다.
        </p>

        {/* Meta chips */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {META.map((m) => <Badge key={m} tone="muted">{m}</Badge>)}
        </div>

        {/* Step bar */}
        <ol className="mb-6 grid grid-cols-5 gap-1.5 rounded-2xl border border-border bg-card p-3 text-center">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-col items-center gap-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
                {i + 1}
              </div>
              <div className="text-[11px] leading-tight text-foreground sm:text-[12px]">{label}</div>
            </li>
          ))}
        </ol>

        <div className="space-y-4">
          {/* Step 1 */}
          <StepCard step={1} title="상황 이해 + 미니학습">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-[12px] font-semibold text-muted-foreground">선행 발화 (거래처 배송 지연 통보)</div>
              <p className="mt-1 text-[15px]">很抱歉，这批货物因海关问题延误了 3 天，我们会尽快安排发货。</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-[12px] font-semibold text-muted-foreground">번역할 한국어 원문</div>
              <p className="mt-1 text-[15px]">
                이번 지연 때문에 저희 생산 일정에 차질이 생겼습니다. 앞으로는 이런 일이 반복되지 않았으면 합니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MINI_CARDS.map((c) => (
                <div key={c.title} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <BookOpen className="h-3.5 w-3.5 text-[#FAD338]" />{c.title}
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">{c.body}</p>
                </div>
              ))}
            </div>
          </StepCard>

          {/* Step 2 */}
          <StepCard step={2} title="적절성 판단 — 후보 5개">
            <p className="text-[13px] text-muted-foreground">
              directness 1(간접) ~ 5(직접). 5=과직접, 1=의미이탈은 부적절 표시. 3번이 적정 후보.
            </p>
            <div className="space-y-2">
              {CANDIDATES.map((c) => {
                const isBad = c.verdict === "부적절";
                const isBest = c.verdict === "적정 후보";
                return (
                  <div
                    key={c.n}
                    className={cn(
                      "rounded-xl border p-3",
                      isBad && "border-destructive/40 bg-destructive/5",
                      isBest && "border-emerald-500/50 bg-emerald-500/5",
                      !isBad && !isBest && "border-border bg-background",
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                      <Badge tone="muted">후보 {c.n}</Badge>
                      <Badge tone="muted">directness {c.directness}</Badge>
                      {isBad && <Badge tone="red"><X className="mr-0.5 h-3 w-3" />{c.verdict}</Badge>}
                      {isBest && <Badge tone="green"><Check className="mr-0.5 h-3 w-3" />{c.verdict}</Badge>}
                    </div>
                    <p className="text-[15px] text-foreground">{highlight(c.text, c.highlight)}</p>
                    {c.reason && <p className="mt-1 text-[12px] text-muted-foreground">— {c.reason}</p>}
                    {!isBad && !isBest && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {["부적절", "애매", "적절"].map((v) => (
                          <button
                            key={v}
                            type="button"
                            disabled
                            className="rounded-md border border-border bg-card px-2 py-1 text-[12px] text-muted-foreground"
                          >
                            {v}
                          </button>
                        ))}
                        <span className="text-[11px] text-muted-foreground">(예시 · 버튼은 비활성)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </StepCard>

          {/* Step 3 */}
          <StepCard step={3} title="화용 설명 — 왜 3번이 적정인가">
            <div className="divide-y divide-border rounded-xl border border-border bg-background">
              {EXPLAIN_ROWS.map((r) => (
                <div key={r.axis} className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-[160px_1fr] sm:gap-3">
                  <div className="text-[13px] font-semibold text-foreground">{r.axis}</div>
                  <div className="text-[13px] text-muted-foreground">{r.note}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-[13px]">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <Lightbulb className="h-3.5 w-3.5 text-[#FAD338]" /> 핵심 표현 요소
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["希望", "尽量", "难免会影响", "必须(과직접)"].map((k) => (
                  <span key={k} className="rounded bg-[#FAD338]/50 px-1.5 py-0.5 text-[13px] font-semibold">{k}</span>
                ))}
              </div>
            </div>
          </StepCard>

          {/* Step 4 */}
          <StepCard step={4} title="직접 산출 — 다른 상황, 스스로 번역">
            <div className="rounded-xl border-l-4 border-l-[#FAD338] border border-border bg-card p-3 text-[13px]">
              여기서는 <b>선택이 아니라 직접 번역</b>합니다. 학습한 화용 조절을 새로운 상황에 옮겨 적용해 보세요.
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-[12px] font-semibold text-muted-foreground">산출 과제 (청구서 오류 불만)</div>
              <p className="mt-1 text-[15px]">
                지난달 청구서에 반복적으로 오류가 있어 정산이 늦어지고 있습니다. 다음 청구부터는 확인 절차를 강화해 주시기 바랍니다.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="mb-1 text-[12px] font-semibold text-muted-foreground">내 번역 (예시 입력)</div>
              <div className="min-h-[72px] rounded-md border border-dashed border-border bg-muted/30 p-2 text-[14px]">
                最近的账单反复出现错误，希望贵司下次开票时能加强核对流程，尽量避免影响结算…
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button disabled className="rounded-md border border-border bg-card px-3 py-1.5 text-[12px] text-muted-foreground">
                  힌트 보기
                </button>
                <button disabled className="rounded-md bg-primary/80 px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">
                  제출
                </button>
                <span className="self-center text-[11px] text-muted-foreground">(예시 · 버튼 비활성)</span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
                <Check className="h-3.5 w-3.5" /> 제출 후 · 모범답안 대조
              </div>
              <p className="text-[14px]">
                最近的账单反复出现错误，导致我们结算延迟。<b>希望贵司下次开票时能加强核对流程，尽量避免类似问题，否则难免会影响双方合作。</b>
              </p>
            </div>
          </StepCard>

          {/* Step 5 */}
          <StepCard step={5} title="수행 리포트">
            <div className="space-y-2">
              {RUBRIC.map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-semibold">{r.label}</span>
                    <span className="text-muted-foreground">{r.score}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-[13px]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <div className="font-semibold text-destructive">약점 · failed_challenge: imposition</div>
                <p className="mt-0.5 text-muted-foreground">
                  요구의 부담(imposition) 조절이 부족합니다. '希望…尽量…' 구조를 더 자연스럽게 결합해 보세요.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-[13px]">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <BarChart3 className="h-3.5 w-3.5" /> 누적 추이
              </div>
              <p className="text-muted-foreground">
                의미보존은 3주 연속 상승, 관계적절성은 정체. 다음 주차에는 관계 축을 집중 훈련합니다.
              </p>
            </div>
            <button
              disabled
              className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-accent-foreground opacity-80"
            >
              <Target className="h-4 w-4" /> 다음 추천 학습 시작하기 <ChevronRight className="h-4 w-4" />
            </button>
          </StepCard>
        </div>

        {/* Divider note */}
        <div className="mt-6 rounded-xl border border-border border-l-4 border-l-[#FAD338] bg-card p-4 text-[13px] leading-relaxed">
          지금 학습 화면(고르고 다듬기)과 달리, 목표 워크플로우는 <b>먼저 배우고 → 판단 → 이유 → 직접 산출 → 약점 진단</b>.
          ④는 선택이 아니라 직접 번역이며, ①·②·④는 서로 다른 상황입니다.
        </div>

        {/* Footer note */}
        <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
          중국어 표현은 설계 시연용 · 원어민 검수 예정 / 수준은 후보 수·산출 형태·비계량만 조절, 흐름은 공통 /
          이론 용어(directness 등)는 설명용이며 실제 학습자 화면에는 자연어로 노출됩니다.
        </p>
      </main>
    </div>
  );
};

export default WorkflowPreview;
