import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WorkflowPreview — 교수 시연용 정적 미리보기.
 * DB / edge / localStorage 접근 없음. 모든 값은 하드코딩된 예시.
 * 실제 학습 화면(/pdr, /finalize, /translate 등)과는 완전히 분리.
 */

// palette (첨부 디자인 톤 유지)
const C = {
  ink: "#1a2236",
  inkSoft: "#414b66",
  inkFaint: "#6b7590",
  paper: "#f3f1ec",
  card: "#fbfaf7",
  card2: "#f7f5ef",
  seal: "#b0392c",
  sealSoft: "#c66355",
  sealBg: "#f7ece9",
  ok: "#3f6f4a",
  okSoft: "#5a8a64",
  okBg: "#eaf1eb",
  amber: "#9a7b2e",
  amberBg: "#f6efdd",
  blue: "#3a5a86",
  blueBg: "#eaeff6",
  rule: "#d8d4c8",
  rule2: "#e6e3d9",
};

const serif = { fontFamily: "'Noto Serif KR', ui-serif, Georgia, serif" };

const STEP_MAP = [
  { n: 1, t: ["상황 +", "미니학습"] },
  { n: 2, t: ["부담 인식 +", "적절성 판단"] },
  { n: 3, t: ["화용", "설명"] },
  { n: 4, t: ["직접", "산출"] },
  { n: 5, t: ["수행", "리포트"] },
];

const MINI = [
  { t: "오늘의 화용 포인트", d: <>불만은 관계를 해치지 않으면서 문제의 심각성을 분명히 전달해야 한다.</> },
  { t: "왜 어려운가", d: <>너무 직접적이면 공격적이고, 너무 완곡하면 문제가 축소된다. <b style={{ color: C.amber }}>균형</b>이 관건.</> },
  { t: "한↔중 차이", d: <>한국어 '~않았으면 합니다'류 완곡 요청이 중국어에서는 종종 <b style={{ color: C.amber }}>希望…尽量…</b> 구조로 이동.</> },
  { t: "맛보기 표현", d: <><b style={{ color: C.amber }}>希望 / 尽量 / 难免会影响</b> — 완곡·양보·결과 시사를 결합해 무게 조절.</> },
];

const CANDIDATES = [
  { n: 1, text: "最近合作还算顺利，谢谢。", demo: 1 },
  { n: 3, text: "希望贵司尽量避免类似延误，否则难免会影响我们的排产。", demo: 5 },
  { n: 5, text: "你们必须马上解决，不然我们就终止合作。", demo: 1 },
];

const EXPLAIN = [
  { k: "직접성", v: "요구는 분명히 하되 명령형은 피합니다. (你们必须 → 希望…尽量…)" },
  { k: "부담 관리", v: "'希望…尽量…' 구조로 상대에게 여지를 남겨 부담을 완화합니다." },
  { k: "의미 보존", v: "지연이 생산에 미치는 영향을 '难免会影响'으로 분명히 시사합니다." },
  { k: "한↔중 대조", v: "한국어 완곡 요청 → 중국어 希望+尽량+결과 시사 구조로 이동합니다." },
];

const RUBRIC = [
  { k: "의미 보존", v: 82 },
  { k: "관계 적절성", v: 68 },
  { k: "목표어 실현도", v: 75 },
];

const StepHeader = ({ n, title, sub, theory, ok }: { n: number; title: string; sub?: string; theory: string; ok?: boolean }) => (
  <div className="flex items-center gap-3 border-b px-5 py-4" style={{ background: C.card2, borderColor: C.rule2 }}>
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white"
      style={{ background: ok ? C.ok : C.seal, ...serif }}
    >
      {n}
    </span>
    <span className="text-[16.5px] font-bold" style={{ ...serif, color: C.ink }}>
      {title}
      {sub && <small className="ml-1.5 text-[12px] font-normal" style={{ color: C.inkFaint, fontFamily: "'Noto Sans KR', sans-serif" }}>{sub}</small>}
    </span>
    <span className="ml-auto whitespace-nowrap rounded border border-dashed px-2 py-0.5 text-[10px]" style={{ color: C.inkFaint, borderColor: C.rule }}>
      {theory}
    </span>
  </div>
);

const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 overflow-hidden rounded-2xl border" style={{ background: C.card, borderColor: C.rule }}>{children}</div>
);

const SubHeading = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div className={cn("text-[12px] font-bold tracking-wide", first ? "mt-0 mb-2" : "mt-1 mb-2")} style={{ color: C.seal }}>
    {children}
  </div>
);

const WorkflowPreview = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-16" style={{ background: C.paper, color: C.ink, fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* Banner */}
      <div style={{ background: C.ink }} className="px-6 py-6 text-[#eef0f5]">
        <div className="mx-auto max-w-[760px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span
              className="inline-block border-l-[3px] pl-2.5 text-[11px] font-bold tracking-wider"
              style={{ borderColor: C.amber, color: C.amberBg }}
            >
              학습 워크플로우 · 전체 미리보기
            </span>
            <button
              type="button"
              onClick={() => navigate("/roadmap")}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold text-[#eef0f5] hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,.25)" }}
            >
              <ArrowLeft className="h-3 w-3" /> 15주 학습 설계로
            </button>
          </div>
          <h1 className="text-[24px] font-black tracking-tight" style={serif}>한 주차 학습은 이렇게 진행됩니다</h1>
          <div className="mt-2 text-[12.5px]" style={{ color: "#aab2ca" }}>
            AI를 보기 전에 스스로 판단하고 산출하는, 화행 기반 통번역 훈련
          </div>
          <div
            className="mt-3.5 rounded-r-md border-l-[3px] px-4 py-2.5 text-[12px] leading-relaxed"
            style={{ background: "rgba(176,57,44,.16)", borderColor: C.sealSoft, color: "#e8d5d1" }}
          >
            <span className="font-bold" style={{ color: C.sealSoft }}>연구 질문</span> · AI 번역안에 노출되기 <b className="text-white">전</b> 학습자의 화용 판단은, 노출 <b className="text-white">후</b>와 어떻게 다른가? 이 설계는 그 차이를 데이터로 포착하기 위한 것입니다.
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[760px] px-3.5">
        {/* Preview flag */}
        <div
          className="my-4 rounded-lg border px-3.5 py-2.5 text-[11.5px] leading-relaxed"
          style={{ background: C.amberBg, borderColor: "#e3d3a4", color: "#6b5518" }}
        >
          📌 <b style={{ color: C.amber }}>예시 미리보기입니다.</b> 실제 과제는 배정된 시나리오와 주차에 따라 달라지며, 화면의 중국어·점수는 시연용 예시(원어민 검수 전)입니다. 현재 실제 구현은 <b style={{ color: C.amber }}>/pdr · /finalize</b> 화면에 단계적으로 반영 중입니다.
        </div>

        {/* Tags */}
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {[
            <>10주차 · <b style={{ color: C.seal }}>불만·불만 대응</b></>,
            <>중급 · HSK5</>,
            <>한→중 · 번역</>,
            <>업무 이메일</>,
            <>P 대등 · D 거리있음 · R 중간</>,
          ].map((t, i) => (
            <span
              key={i}
              className="rounded-full border px-3 py-1 text-[11px]"
              style={{ background: C.card, borderColor: C.rule, color: C.inkSoft }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mb-4 text-[11px]" style={{ color: C.inkFaint }}>예시 시나리오 · 실제 배정 과제와 다를 수 있음</div>

        {/* Step map */}
        <div
          className="mb-5 flex flex-wrap items-start justify-between gap-1 rounded-xl border p-4"
          style={{ background: C.card, borderColor: C.rule }}
        >
          {STEP_MAP.map((s, i) => (
            <div key={s.n} className="relative flex-1 min-w-[80px] text-center">
              <div
                className="mx-auto mb-1.5 flex h-[30px] w-[30px] items-center justify-center rounded-full text-[14px] font-bold text-white"
                style={{ background: C.ink, ...serif }}
              >
                {s.n}
              </div>
              <div className="text-[11px] font-medium leading-tight" style={{ color: C.inkSoft }}>
                {s.t.map((l, j) => <div key={j}>{l}</div>)}
              </div>
              {i < STEP_MAP.length - 1 && (
                <span className="pointer-events-none absolute right-[-2px] top-3 hidden text-[16px] sm:inline" style={{ color: C.rule }}>›</span>
              )}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        <Section>
          <StepHeader n={1} title="상황 이해 + 미니학습" theory="오리엔테이션 · 귀납 노출" />
          <div className="px-5 py-5">
            <SubHeading first>상황</SubHeading>
            <div className="mb-3 rounded-lg px-4 py-3" style={{ background: C.blueBg, border: `1px solid #c5d2e4` }}>
              <div className="text-[14px] leading-relaxed">
                당신은 국내 제조사의 구매 담당자입니다. 거래처(중국 공급업체)와는 격식을 갖춘 사이로, 최근 <b>납품 청구서에 반복적으로 오류</b>가 생겨 정산이 지연되고 있습니다. 관계를 해치지 않으면서 개선을 요구하는 메일을 보내려 합니다.
              </div>
            </div>

            <SubHeading>상대가 먼저 보낸 메일 <small className="font-normal" style={{ color: C.inkFaint }}>— second-pair 선행 발화 (중국어)</small></SubHeading>
            <div className="mb-3 rounded-lg border-l-[3px] px-4 py-3" style={{ background: C.card2, borderLeftColor: C.amber }}>
              <div className="text-[14px] leading-relaxed">很抱歉，这批货物因海关问题延误了3天，我们会尽快安排发货。</div>
              <div className="mt-1.5 text-[10.5px]" style={{ color: C.inkFaint }}>— 거래처 담당자 (배송 지연 통보)</div>
            </div>

            <SubHeading>번역할 원문 (한국어)</SubHeading>
            <div className="mb-3 rounded-lg border bg-white px-4 py-3" style={{ borderColor: C.rule2 }}>
              <div className="text-[14px] leading-relaxed">이번 지연 때문에 저희 생산 일정에 차질이 생겼습니다. 앞으로는 이런 일이 반복되지 않았으면 합니다.</div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {MINI.map((m) => (
                <div key={m.t} className="rounded-lg border px-3 py-2.5" style={{ background: C.card2, borderColor: C.rule2 }}>
                  <div className="mb-1 flex items-baseline gap-1.5 text-[12px] font-bold" style={{ ...serif, color: C.ink }}>
                    <span style={{ color: C.seal, fontSize: 9 }}>▪</span>{m.t}
                  </div>
                  <div className="text-[11.5px] leading-relaxed" style={{ color: C.inkSoft }}>{m.d}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md px-3 py-2 text-[11px] leading-relaxed" style={{ background: C.blueBg, color: C.inkFaint }}>
              💡 <b style={{ color: C.blue }}>핵심 표현 전체는 3단계에서 공개됩니다.</b> 여기서 다 알려주면 판단·산출이 '답 보고 고르기'가 되므로, 지금은 방향만 익힙니다.
            </div>
          </div>
        </Section>

        {/* STEP 2 */}
        <Section>
          <StepHeader n={2} title="부담 인식 + 적절성 판단" theory="해석형 P/D/R · rating MPJ" />
          <div className="px-5 py-5">
            <SubHeading first>먼저 — 이 상황, 얼마나 조심스러운가? <small className="font-normal" style={{ color: C.inkFaint }}>(정답 없음 · 해석형)</small></SubHeading>
            <div>
              {[
                { q: "나와 상대의 관계는?", opts: ["내가 위", "대등", "상대가 위"], demo: 1 },
                { q: "심리적 거리는?", opts: ["가까움", "거리 있음"], demo: 1 },
                { q: "이 불만, 얼마나 조심스러운가?", opts: ["부담 적음", "부담 큼"], demo: 1 },
              ].map((row, i) => (
                <div key={i} className="mb-2.5">
                  <div className="mb-1.5 text-[12px] font-medium" style={{ color: C.inkSoft }}>{row.q}</div>
                  <div className="flex gap-1.5">
                    {row.opts.map((o, j) => {
                      const on = j === row.demo;
                      return (
                        <span
                          key={o}
                          className="flex-1 rounded-md border px-1.5 py-2 text-center text-[12px]"
                          style={{
                            background: on ? C.seal : C.card2,
                            borderColor: on ? C.seal : C.rule,
                            color: on ? "#fff" : C.inkSoft,
                            fontWeight: on ? 700 : 400,
                          }}
                        >
                          {o}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-3 rounded-md border px-4 py-3 text-[12px] leading-relaxed" style={{ background: C.blueBg, borderColor: "#c5d2e4", color: C.inkSoft }}>
                <div className="mb-1.5 text-[11.5px] font-bold" style={{ color: C.blue }}>당신의 감 · 그리고 이 과제의 설계 관점</div>
                당신은 <b>대등 · 거리 있음 · 부담 큼</b>으로 보았습니다. 이 과제도 같은 관점을 기준으로 설계되었습니다.
                <div className="mt-1.5 text-[11px]" style={{ color: C.inkFaint }}>
                  둘이 달라도 괜찮습니다. 서로 다른 화용적 판단이 모두 타당할 수 있으며, 이 판단은 뒤에서 볼 표현들이 '왜 그렇게 쓰였는지' 이해하는 기준이 됩니다.
                </div>
              </div>
            </div>

            <SubHeading>다음 — AI 번역안을 5점으로 평가 <small className="font-normal" style={{ color: C.inkFaint }}>(직접 산출을 마친 뒤 공개됨)</small></SubHeading>
            <div className="mb-3 rounded-md px-3 py-2 text-[11.5px] leading-relaxed" style={{ background: C.card2, color: C.inkFaint }}>
              후보들은 <b style={{ color: C.inkSoft }}>모두 원문의 핵심(지연의 영향 · 개선 요구)을 담고 있습니다.</b> 다른 것은 정보가 아니라 <b style={{ color: C.inkSoft }}>말투(직접성·완곡함)</b>입니다. 이 관계에 얼마나 어울리는지 평가하세요.
            </div>

            {CANDIDATES.map((c) => (
              <div key={c.n} className="mb-2.5 rounded-lg border px-4 py-3" style={{ background: C.card2, borderColor: C.rule }}>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded px-2 py-0.5 text-[10.5px] font-semibold text-white" style={{ background: C.ink }}>후보 {c.n}</span>
                </div>
                <div className="text-[13.5px] leading-relaxed">{c.text}</div>
                <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: C.rule2 }}>
                  <div className="mb-1.5 text-[10.5px]" style={{ color: C.inkFaint }}>이 관계에 얼마나 적절한가?</div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const on = n === c.demo;
                      const label = n === 1 ? "매우\n부적절" : n === 5 ? "매우\n적절" : "";
                      return (
                        <span
                          key={n}
                          className="flex-1 rounded-md border bg-white px-0.5 py-1.5 text-center"
                          style={{
                            borderColor: on ? C.seal : C.rule,
                            background: on ? C.seal : "#fff",
                          }}
                        >
                          <span className="block text-[13px] font-bold" style={{ ...serif, color: on ? "#fff" : C.inkSoft }}>{n}</span>
                          {label && (
                            <span className="mt-0.5 block whitespace-pre-line text-[8.5px] leading-tight" style={{ color: on ? "#fff" : C.inkFaint }}>{label}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-md px-3 py-2 text-[11.5px] leading-relaxed" style={{ background: C.card2, color: C.inkFaint }}>
              후보는 실제로 5개가 제시됩니다. 여기서는 대표 3개만 표시. <b style={{ color: C.inkSoft }}>어느 후보가 적절한지, directness 수치나 평가 라벨은 학습자 판단 단계에서 일절 노출하지 않습니다</b> — 정답을 미리 흘리면 '판단'이 '답 보고 고르기'가 되기 때문입니다. 후보의 적절성은 3단계(화용 설명)에서야 밝혀집니다.
            </div>
          </div>
        </Section>

        {/* STEP 3 */}
        <Section>
          <StepHeader n={3} title="화용 설명" sub="— 왜 이 표현이 참고가 되는가" theory="메타화용 설명 · 오판 교정" />
          <div className="px-5 py-5">
            <div className="mb-3.5 rounded-md px-3.5 py-2.5 text-[11.5px] leading-relaxed" style={{ background: C.sealBg, color: C.inkFaint }}>
              ↩ <b style={{ color: C.seal }}>당신의 판단 되돌아보기:</b> 2단계에서 <b>후보5</b>를 비교적 높게 평가했다면 — 이 관계에서 '你们必须'는 과도하게 직접적일 수 있습니다. 반대로 <b>후보1</b>을 높게 봤다면, 문제의 심각성이 사라졌을 수 있습니다. 아래 설명으로 그 이유를 확인하세요.
            </div>
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {EXPLAIN.map((r, i) => (
                  <tr key={r.k} style={{ borderBottom: i < EXPLAIN.length - 1 ? `1px solid ${C.rule2}` : "none" }}>
                    <td className="w-[32%] whitespace-nowrap px-3 py-2.5 align-top font-bold" style={{ ...serif, color: C.ink }}>{r.k}</td>
                    <td className="px-3 py-2.5 align-top leading-relaxed" style={{ color: C.inkSoft }}>{r.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap gap-1.5 rounded-lg px-3.5 py-3" style={{ background: C.amberBg }}>
              <span className="mb-0.5 w-full text-[10.5px] font-bold" style={{ color: C.amber }}>핵심 표현 요소</span>
              {["希望", "尽量", "难免会影响", "必须 (과직접)"].map((e) => (
                <span key={e} className="rounded border bg-white px-2.5 py-1 text-[12px] font-semibold" style={{ borderColor: "#e3d3a4", color: C.ink }}>{e}</span>
              ))}
            </div>
          </div>
        </Section>

        {/* STEP 4 */}
        <Section>
          <StepHeader n={4} ok title="직접 산출" sub="— 다른 상황에, 스스로 번역" theory="산출 연습 · 복제 차단" />
          <div className="px-5 py-5">
            <div className="mb-3 rounded-r-lg border-l-[3px] px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: C.amberBg, borderLeftColor: C.amber, color: C.inkSoft }}>
              여기서는 <b style={{ color: C.amber }}>선택이 아니라 직접 번역</b>합니다. 그리고 앞과 <b style={{ color: C.amber }}>다른 상황</b>이 주어집니다 — 앞 화면을 베껴 답할 수 없도록, 배운 화용 조절을 <b style={{ color: C.amber }}>새 상황에 옮겨 적용</b>하는 것이 핵심입니다.
            </div>
            <div className="mb-3 rounded-lg border px-4 py-3" style={{ background: C.card2, borderColor: C.rule2 }}>
              <div className="mb-1 text-[10.5px] font-bold" style={{ color: C.inkFaint }}>산출 과제 (청구서 오류 불만)</div>
              <div className="text-[13.5px] leading-relaxed">지난달 청구서에 반복적으로 오류가 있어 정산이 늦어지고 있습니다. 다음 청구부터는 확인 절차를 강화해 주시기 바랍니다.</div>
            </div>
            <div className="rounded-lg border border-dashed bg-white px-4 py-3 text-[13px] leading-relaxed" style={{ borderColor: C.rule, color: C.inkFaint }}>
              <div className="mb-1.5 text-[10.5px] font-bold" style={{ color: C.inkFaint }}>✎ 내 번역 (학습자가 직접 입력)</div>
              最近的账单反复出现错误，希望贵司下次开票时能加强核对流程，尽量避免影响结算…
            </div>
            <div className="mt-3 rounded-lg border px-4 py-3" style={{ background: C.okBg, borderColor: "#c3dcc8" }}>
              <div className="mb-1.5 text-[10.5px] font-bold" style={{ color: C.okSoft }}>✓ 제출 후 · 참고 표현과 대조</div>
              <div className="text-[13.5px] leading-relaxed">最近的账单反复出现错误，导致我们结算延迟。希望贵司下次开票时能加强核对流程，尽量避免类似问题，否则难免会影响双方合作。</div>
              <div className="mt-1.5 text-[11px]" style={{ color: C.inkFaint }}>참고 표현은 유일한 정답이 아닙니다. 내 번역이 관계·부담을 잘 다뤘다면 달라도 타당합니다.</div>
            </div>
          </div>
        </Section>

        {/* STEP 5 */}
        <Section>
          <StepHeader n={5} ok title="수행 리포트" theory="성찰 · 재학습 루프" />
          <div className="px-5 py-5">
            {RUBRIC.map((r) => (
              <div key={r.k} className="mb-3">
                <div className="mb-1.5 flex justify-between text-[12.5px]">
                  <span className="font-medium" style={{ color: C.inkSoft }}>{r.k}</span>
                  <span className="font-bold" style={{ ...serif, color: C.ink }}>{r.v}</span>
                </div>
                <div className="h-[9px] overflow-hidden rounded-md" style={{ background: C.rule2 }}>
                  <div className="h-full rounded-md" style={{ width: `${r.v}%`, background: C.ink }} />
                </div>
              </div>
            ))}
            <div className="my-3.5 rounded-lg border px-4 py-3" style={{ background: C.sealBg, borderColor: "#e2c4bf" }}>
              <div className="mb-1 text-[12px] font-bold" style={{ color: C.seal }}>⚠ 약점 · 부담 조절 (imposition)</div>
              <div className="text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>요구의 부담 조절이 부족합니다. '希望…尽量…' 구조를 더 자연스럽게 결합해 보세요.</div>
            </div>
            <div className="rounded-lg border px-4 py-3 text-[12px] leading-relaxed" style={{ background: C.card2, borderColor: C.rule2, color: C.inkSoft }}>
              <div className="mb-1 text-[11.5px] font-bold" style={{ color: C.ink }}>📈 누적 추이</div>
              의미 보존은 3주 연속 상승, 관계 적절성은 정체. 다음 주차에는 관계 축을 집중 훈련합니다.
            </div>
            <div className="mt-3 rounded-md px-3 py-2 text-[11.5px] leading-relaxed" style={{ background: C.card2, color: C.inkFaint }}>
              점수는 시연용 예시입니다. 실제로는 rubric 3축과 누적 failed_challenge로 산출됩니다.
            </div>
          </div>
        </Section>

        {/* Closing */}
        <div className="mt-6 rounded-xl px-6 py-5 text-[#eef0f5]" style={{ background: C.ink }}>
          <div className="text-[15px] font-semibold leading-relaxed" style={serif}>
            지금 학습 화면(고르고 다듬기)과 달리, 이 워크플로우는 <em className="not-italic font-bold" style={{ color: C.sealSoft }}>먼저 배우고 → 판단 → 이유 → 직접 산출 → 약점 진단</em>으로 흐릅니다.
          </div>
          <div className="mt-3 text-[12px] leading-relaxed" style={{ color: "#aab2ca" }}>
            2·4단계는 선택이 아니라 직접 산출이며, 1·2·4단계는 서로 다른 상황을 써서 앞 화면 복제를 차단합니다. 학습자의 주체성은 과제 선택이 아니라 판단·교정·산출 결정에서 발휘됩니다.
          </div>
          <div className="mt-2.5 border-t pt-2.5 text-[12px] leading-relaxed" style={{ borderColor: "rgba(255,255,255,.12)", color: "#aab2ca" }}>
            본 예시는 <b style={{ color: "#c9cfe0" }}>번역 과제</b>입니다. <b style={{ color: "#c9cfe0" }}>통역(음성 산출) 트랙</b>은 동일한 워크플로우 위에서 4단계 산출을 텍스트 입력 대신 음성 녹음으로 확장하며, 판단·산출·대조의 구조는 그대로 유지됩니다.
          </div>
        </div>

        <div className="mt-4 px-5 text-center text-[10.5px] leading-relaxed" style={{ color: C.inkFaint }}>
          전체 워크플로우 미리보기 · 오늘 확정본(직접산출 우선 · 해석형 P/D/R · 리커트 · 참고표현 대조) 반영<br />
          설계 근거: Roever(2022) 화용 수업 6단계를 5개 화면으로 조작화 — 오리엔테이션·귀납제시=1단계, 인식제고·수용연습=2단계, 메타화용설명=3단계, 산출연습=4단계, 성찰=5단계 · item_design(second-pair · 정보량 보존 distractor · 복제 차단) · 신규 DB 컬럼 0
        </div>
      </div>
    </div>
  );
};

export default WorkflowPreview;
