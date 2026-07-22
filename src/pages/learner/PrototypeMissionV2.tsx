import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  CLOSING_LINE,
  JUDGMENT_LABEL,
  MOCK_FEEDBACK,
  MPJ_ITEMS,
  PRODUCTION_TASK,
  REVISION_SCOPE,
  VARIANT_LABEL,
  type Judgment,
  type MpjItem,
  type MpjMulti,
  type MpjSingle,
} from "@/lib/mission/protoMissionV2";

// 프로토타입 미션 v2 — 흐름 검증 전용. 기존 /scenario는 건드리지 않는다.
//
//   ① 감각 쌓기(MPJ 여러 개) → ② 적용(새 상황 산출 1회) → ③ 피드백 → ④ 수정
//
// 이 화면은 **MPJ 변형 6종을 모두 태워 보는 쇼케이스**다. 실제 미션은 3~4문항이면
// 충분하다(Roever: 문항이 많으면 학습자가 시나리오를 대충 읽는다).
// 어느 변형이 쓸 만한지 직접 눌러보고 고르기 위한 것이다.

const STEPS = ["감각 쌓기", "적용", "피드백", "수정"] as const;
const SCALE5 = ["완전히 적절", "대체로 적절", "다소 적절", "대체로 부적절", "완전히 부적절"];
const POLITENESS5 = ["너무 과함", "조금 과함", "딱 맞음", "조금 무례", "너무 무례"];
const CONFIDENCE = ["매우 확신", "꽤 확신", "확신 없음"];

const card = "rounded-xl border border-[#EAE4D2] bg-white p-4";
const srcBox =
  "rounded-lg border-l-[3px] border-[#EAE4D2] border-l-[#FAD338] bg-[#F5F5F2] p-3";

const PrototypeMissionV2 = () => {
  const [stepIdx, setStepIdx] = useState(0);
  const [mpjIdx, setMpjIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [revised, setRevised] = useState("");
  const [scopeKey, setScopeKey] = useState<keyof typeof REVISION_SCOPE>("featureGap");
  const [done, setDone] = useState(false);

  // 단계별 소요 시간 — 프로토타입 전용. 6~8분 안에 끝나는지 실제로 재기 위한 장치.
  const startedAt = useRef(Date.now());
  const [marks, setMarks] = useState<{ step: string; sec: number }[]>([]);
  const stepStart = useRef(Date.now());
  const markStep = (label: string) => {
    const sec = Math.round((Date.now() - stepStart.current) / 1000);
    setMarks((m) => [...m, { step: label, sec }]);
    stepStart.current = Date.now();
  };

  const item = MPJ_ITEMS[mpjIdx];
  const step = STEPS[stepIdx];

  const nextMpj = () => {
    if (mpjIdx < MPJ_ITEMS.length - 1) setMpjIdx((i) => i + 1);
    else {
      markStep("감각 쌓기");
      setStepIdx(1);
    }
  };

  const goStep = (to: number, label: string) => {
    markStep(label);
    setStepIdx(to);
  };

  const totalSec = Math.round((Date.now() - startedAt.current) / 1000);

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">요청 · 중급 HSK5</span>}
    >
      <div className="pb-24">
        {/* 프로토타입 경고 — 이게 최종물이 아님을 화면에 명시 */}
        <div className="mb-3 rounded-lg border border-dashed border-[#C9A227] bg-[#FFFBEA] px-3.5 py-2.5 text-[12px] text-[#6B5518]">
          <b>프로토타입</b> · 흐름 확인용입니다. 중국어 예문은 <b>원어민 검토 전</b> 초안이고,
          피드백은 학습자 답과 무관한 <b>고정 예시</b>입니다.
        </div>

        {/* 진행바 */}
        <ol className="mb-4 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-1.5">
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  i < stepIdx
                    ? "bg-[#15202B] text-white"
                    : i === stepIdx
                      ? "bg-[#FAD338] text-[#15202B]"
                      : "bg-[#EAE4D2] text-[#8A8272]",
                ].join(" ")}
              >
                {i + 1}
              </span>
              <span
                className={[
                  "text-[12px]",
                  i === stepIdx ? "font-semibold text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {s}
              </span>
            </li>
          ))}
        </ol>

        {/* ── ① 감각 쌓기 ── */}
        {step === "감각 쌓기" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className="font-normal">
                {VARIANT_LABEL[item.variant]}
              </Badge>
              <span className="text-[12px] text-muted-foreground">
                {mpjIdx + 1} / {MPJ_ITEMS.length}
                {item.borderline && " · 경계 사례"}
              </span>
            </div>
            <MpjBlock key={item.id} item={item} onDone={nextMpj} />
          </div>
        )}

        {/* ── ② 적용 ── */}
        {step === "적용" && (
          <div className="space-y-3">
            <SituationCard s={PRODUCTION_TASK.situation} />
            <div className={card}>
              <div className="text-[13px] font-semibold">중국어로 옮겨 보세요</div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                방금 판단해 본 감각을 <b>새로운 상황</b>에 적용하는 단계입니다. 참고 표현은
                제출한 뒤에 함께 봅니다.
              </p>
              <div className={`mt-3 ${srcBox}`}>
                <div className="text-[11.5px] font-semibold text-muted-foreground">한국어 원문</div>
                <p className="mt-1 text-[14.5px]">{PRODUCTION_TASK.sourceText}</p>
              </div>
              <Textarea
                className="mt-3"
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="여기에 중국어로 입력…"
              />
            </div>
            <Button
              className="w-full"
              disabled={!draft.trim()}
              onClick={() => goStep(2, "적용")}
            >
              적용하기 →
            </Button>
          </div>
        )}

        {/* ── ③ 피드백 — 세 영역만 ── */}
        {step === "피드백" && (
          <div className="space-y-3">
            <div className={card}>
              <div className="text-[11.5px] font-semibold text-muted-foreground">내 번역</div>
              <p className="mt-1 whitespace-pre-wrap text-[14.5px]">{draft}</p>
            </div>

            <FeedbackBlock
              n="1"
              title="의미와 의도"
              body={MOCK_FEEDBACK.meaning.text}
              tone="ok"
            />
            <FeedbackBlock
              n="2"
              title="이번 화용 요소 — 직접성과 완화"
              body={MOCK_FEEDBACK.feature.text}
            />
            <div className={card}>
              <div className="text-[13px] font-semibold">
                <span className="mr-1.5 text-[#8899A6]">3</span>다른 표현 가능성
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                정답이 아니라 비교용입니다. 상황에 따라 어울리는 범위가 달라집니다.
              </p>
              <ul className="mt-2.5 space-y-2">
                {MOCK_FEEDBACK.alternatives.map((a) => (
                  <li key={a.zh} className="rounded-lg bg-[#FAF8F2] px-3.5 py-2.5">
                    <div className="text-[14px]">{a.zh}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{a.note}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 설계 확인용 — 실제 화면에는 없다. 수정 범위가 피드백 결과에 따라 달라지는 것을 보여준다 */}
            <div className="rounded-lg border border-dashed border-[#B9C4CE] bg-[#F7F9FA] p-3">
              <div className="text-[11.5px] font-semibold text-[#5B6B76]">
                [설계 확인] 수정 범위 정책 — 실제로는 피드백 결과가 자동으로 고른다
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(REVISION_SCOPE) as (keyof typeof REVISION_SCOPE)[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setScopeKey(k)}
                    className={[
                      "rounded-md border px-2.5 py-1 text-[11.5px]",
                      scopeKey === k
                        ? "border-[#15202B] bg-white font-semibold"
                        : "border-[#D8DEE3] bg-white/60 text-muted-foreground",
                    ].join(" ")}
                  >
                    {REVISION_SCOPE[k].label}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={() => goStep(3, "피드백")}>
              고치러 가기 →
            </Button>
          </div>
        )}

        {/* ── ④ 수정 ── */}
        {step === "수정" && !done && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#FAD338] bg-[#FFF8DE] p-4">
              <div className="text-[12px] font-bold text-[#6B5518]">
                {REVISION_SCOPE[scopeKey].label}
              </div>
              <p className="mt-1 text-[14px]">{REVISION_SCOPE[scopeKey].guide}</p>
            </div>
            <Textarea
              rows={5}
              value={revised || draft}
              onChange={(e) => setRevised(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => {
                markStep("수정");
                setDone(true);
              }}
            >
              마치기
            </Button>
          </div>
        )}

        {/* ── 완료 ── */}
        {done && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#15202B] p-5 text-white">
              <div className="text-[11.5px] font-bold text-[#FAD338]">이번 미션의 핵심</div>
              <p className="mt-1.5 text-[14.5px] leading-relaxed">{CLOSING_LINE}</p>
            </div>

            {/* 프로토타입 전용 — 실제로 몇 분 걸렸는지 */}
            <div className={card}>
              <div className="text-[13px] font-semibold">[프로토타입] 단계별 소요 시간</div>
              <ul className="mt-2 space-y-1">
                {marks.map((m, i) => (
                  <li key={i} className="flex justify-between text-[12.5px]">
                    <span className="text-muted-foreground">{m.step}</span>
                    <span className="font-semibold">
                      {Math.floor(m.sec / 60)}분 {m.sec % 60}초
                    </span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-[#EAE4D2] pt-1 text-[12.5px]">
                  <span className="font-semibold">합계</span>
                  <span className="font-bold">
                    {Math.floor(totalSec / 60)}분 {totalSec % 60}초
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                목표는 6~8분입니다. MPJ 6문항은 쇼케이스용이고 실제 미션은 3~4문항입니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </LearnerJourneyShell>
  );
};

// ── 상황 카드 ────────────────────────────────────────────────
const SituationCard = ({ s }: { s: { headline: string; relation: string; channel: string; internalPdr: string } }) => (
  <div className="rounded-xl border-l-[3px] border-[#EAE4D2] border-l-[#15202B] bg-white p-4">
    <p className="text-[14.5px] font-semibold">{s.headline}</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="font-normal">
        {s.relation}
      </Badge>
      <Badge variant="secondary" className="font-normal">
        {s.channel}
      </Badge>
    </div>
    <div className="mt-2 text-[11px] text-[#A8A294]">[설계 확인] {s.internalPdr}</div>
  </div>
);

const FeedbackBlock = ({
  n,
  title,
  body,
  tone,
}: {
  n: string;
  title: string;
  body: string;
  tone?: "ok";
}) => (
  <div className={card}>
    <div className="text-[13px] font-semibold">
      <span className="mr-1.5 text-[#8899A6]">{n}</span>
      {title}
      {tone === "ok" && (
        <span className="ml-2 rounded bg-[#E7F5EE] px-1.5 py-0.5 text-[11px] font-semibold text-[#2E7D5B]">
          유지됨
        </span>
      )}
    </div>
    <p className="mt-1.5 text-[13.5px] leading-relaxed">{body}</p>
  </div>
);

// ── MPJ 블록 — 변형별 렌더 ───────────────────────────────────
const MpjBlock = ({ item, onDone }: { item: MpjItem; onDone: () => void }) => {
  const [answered, setAnswered] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [fixPicks, setFixPicks] = useState<Set<number>>(new Set());
  const [freeFix, setFreeFix] = useState("");
  const [multiPicks, setMultiPicks] = useState<Record<number, Judgment>>({});

  const multi = item.variant === "multiUtterance" ? (item as MpjMulti) : null;
  const single = multi ? null : (item as MpjSingle);

  const multiAllPicked = useMemo(
    () => (multi ? Object.keys(multiPicks).length === multi.candidates.length : false),
    [multi, multiPicks],
  );

  // 변형마다 '다음으로' 가능 조건이 다르다
  const canReveal = (() => {
    if (multi) return multiAllPicked;
    if (!single) return false;
    if (single.variant === "reasonConfidence") return !!pick && !!reason && !!confidence;
    if (single.variant === "correctChoice") return !!pick && (pick === "ok" || fixPicks.size > 0);
    if (single.variant === "correctFree") return !!pick && (pick === "ok" || !!freeFix.trim());
    return !!pick;
  })();

  return (
    <div className="space-y-3">
      <SituationCard s={item.situation} />

      <div className={srcBox}>
        <div className="text-[11.5px] font-semibold text-muted-foreground">한국어 원문</div>
        <p className="mt-1 text-[14.5px]">{item.sourceText}</p>
      </div>

      {/* 단일 발화 변형 */}
      {single && (
        <div className={card}>
          <div className="text-[11.5px] font-semibold text-muted-foreground">중국어 번역안</div>
          <p className="mt-1 text-[15px] leading-relaxed">{single.candidate}</p>

          <div className="mt-3.5 text-[13px] font-semibold">
            {single.variant === "politeness5"
              ? "이 상황에 이 표현은 어떤가요?"
              : single.variant === "scale5"
                ? "이 번역안은 이 상황에 얼마나 적절한가요?"
                : "이 번역안은 이 상황에 맞나요?"}
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {(single.variant === "scale5"
              ? SCALE5
              : single.variant === "politeness5"
                ? POLITENESS5
                : (["under", "ok", "over"] as Judgment[]).map((j) => JUDGMENT_LABEL[j])
            ).map((label) => (
              <Choice
                key={label}
                label={label}
                selected={pick === label}
                disabled={answered}
                onClick={() => setPick(label)}
              />
            ))}
          </div>

          {/* ⑤ 이유 + 확신도 — P·D·R 판단이 이유 선택지에 들어 있다 */}
          {single.variant === "reasonConfidence" && pick && (
            <>
              <div className="mt-4 text-[13px] font-semibold">왜 그렇게 보셨나요?</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {single.reasons?.map((r) => (
                  <Choice
                    key={r.key}
                    label={r.label}
                    selected={reason === r.key}
                    disabled={answered}
                    onClick={() => setReason(r.key)}
                  />
                ))}
              </div>
              <div className="mt-4 text-[13px] font-semibold">얼마나 확신하시나요?</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CONFIDENCE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={answered}
                    onClick={() => setConfidence(c)}
                    className={[
                      "rounded-md border px-3 py-1.5 text-[12.5px]",
                      confidence === c
                        ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold"
                        : "border-[#EAE4D2] bg-white",
                    ].join(" ")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ③ 자유 교정 */}
          {single.variant === "correctFree" && pick && pick !== JUDGMENT_LABEL.ok && (
            <>
              <div className="mt-4 text-[13px] font-semibold">어떻게 고치면 좋을까요?</div>
              <Textarea
                className="mt-2"
                rows={3}
                value={freeFix}
                disabled={answered}
                onChange={(e) => setFreeFix(e.target.value)}
                placeholder="중국어로 고쳐 보세요…"
              />
            </>
          )}

          {/* ④ 교정 선택지 — 복수 정답 */}
          {single.variant === "correctChoice" && pick && pick !== JUDGMENT_LABEL.ok && (
            <>
              <div className="mt-4 text-[13px] font-semibold">
                어떻게 고치면 좋을까요? <span className="font-normal">맞는 것을 모두 고르세요</span>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {single.fixOptions?.map((o, i) => (
                  <button
                    key={o.zh}
                    type="button"
                    disabled={answered}
                    onClick={() =>
                      setFixPicks((prev) => {
                        const n = new Set(prev);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    className={[
                      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px]",
                      fixPicks.has(i)
                        ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]"
                        : "border-[#EAE4D2] bg-white",
                      answered && o.correct ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    <div>{o.zh}</div>
                    {answered && (
                      <div className="mt-1 text-[12px] text-muted-foreground">{o.note}</div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {answered && (
            <div className="mt-4 rounded-lg bg-[#F2FAF6] px-3.5 py-3">
              <div className="text-[12px] font-bold text-[#2E7D5B]">
                기준 판정 · {JUDGMENT_LABEL[single.truth]}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed">{single.feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* ⑥ 한 상황 다중 발화 */}
      {multi && (
        <div className={card}>
          <div className="text-[13px] font-semibold">
            같은 원문을 옮긴 번역안들입니다. 각각 어떤가요?
          </div>
          <ul className="mt-3 space-y-2.5">
            {multi.candidates.map((c, i) => (
              <li key={c.zh} className="rounded-lg border border-[#EAE4D2] px-3.5 py-3">
                <div className="text-[14.5px]">{c.zh}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["under", "ok", "over"] as Judgment[]).map((j) => (
                    <button
                      key={j}
                      type="button"
                      disabled={answered}
                      onClick={() => setMultiPicks((p) => ({ ...p, [i]: j }))}
                      className={[
                        "rounded-md border px-2.5 py-1 text-[12px]",
                        multiPicks[i] === j
                          ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold"
                          : "border-[#EAE4D2] bg-white text-muted-foreground",
                        answered && c.truth === j ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                      ].join(" ")}
                    >
                      {JUDGMENT_LABEL[j]}
                    </button>
                  ))}
                </div>
                {answered && (
                  <div className="mt-2 text-[12.5px] text-muted-foreground">{c.note}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!answered ? (
        <Button className="w-full" disabled={!canReveal} onClick={() => setAnswered(true)}>
          확인하기
        </Button>
      ) : (
        <Button className="w-full" onClick={onDone}>
          다음 →
        </Button>
      )}
    </div>
  );
};

const Choice = ({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={[
      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px] transition-colors",
      selected
        ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold"
        : "border-[#EAE4D2] bg-white hover:bg-[#FAFAF7]",
    ].join(" ")}
  >
    {label}
  </button>
);

export default PrototypeMissionV2;
