import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  INTRO_STEPS,
  INTRO_FEATURE_ID,
  HOOK_SCENE,
  CLUES,
  CLUE_TAIL,
  CLUES_REQUIRED,
  REFERENCE_CASES,
  PRINCIPLE_TABLE,
  PRINCIPLE_LEAD,
  STRATEGY_MAP_UNLOCK,
  CLASS_LABELS,
  CLASSIFY_PROMPT,
  CLASSIFY_ITEMS,
  ARC_CLOSING,
  type ClassLabel,
} from "@/lib/mission/mockIntroArc";
import { WEEK_REQUEST } from "@/lib/mission/mockWeek";
import { updateFeatureState } from "@/lib/mission/learnerState";

// 도입 아크 — 새 목표 특징 최초 도입 시 1회. 입력 먼저(장면→관찰→명시→수용) 후
// 미션 1개로 합류한다. 미션 사이클(산출 먼저)과 순서가 반대인 상위 루프.
//
// 게이트: ②는 단서 3개 이상, ④는 3문항 분류 완료. ③에 도달하면 전략 지도가 열린다
// (선산출 원칙의 예외 — 같은 산출 문항의 복사 가능한 답안만 최초 수행 전 금지).

const IntroArc = () => {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [foundClues, setFoundClues] = useState<number[]>([]);
  const [picks, setPicks] = useState<Record<number, ClassLabel>>({});

  const step = INTRO_STEPS[stepIdx];
  const cluesEnough = foundClues.length >= CLUES_REQUIRED;
  const classifyDone = Object.keys(picks).length >= CLASSIFY_ITEMS.length;
  const allRight = classifyDone && CLASSIFY_ITEMS.every((g, i) => picks[i] === g.truth);

  const canAdvance =
    step === "차이 찾기" ? cluesEnough : step === "감각 확인" ? classifyDone : true;

  const advance = () => {
    // ③ 원리 이해 도달 = 명시적 설명을 봄 → 전략 지도 개방 조건 충족
    if (INTRO_STEPS[stepIdx + 1] === "원리 이해") {
      updateFeatureState(INTRO_FEATURE_ID, { introExplanationCompleted: true });
    }
    setStepIdx((i) => Math.min(INTRO_STEPS.length - 1, i + 1));
  };

  const finish = () => {
    updateFeatureState(INTRO_FEATURE_ID, { introExplanationCompleted: true });
    navigate("/scenario");
  };

  // ── 화면들 ──

  const screenHook = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] font-bold text-[#B8860B]">{HOOK_SCENE.eyebrow}</div>
      <h2 className="mt-1 text-[19px] font-bold">{HOOK_SCENE.title}</h2>
      <p className="mt-1.5 text-[13.5px] text-muted-foreground">{HOOK_SCENE.lead}</p>

      <div className="mt-4 rounded-xl bg-[#1B2836] p-4 text-[#DDE4EA]">
        <div className="text-[12.5px] italic text-[#8899A6]">— {HOOK_SCENE.direction}</div>
        {HOOK_SCENE.lines.map((l, i) => (
          <div key={i} className="mt-2.5 text-[14.5px] leading-relaxed">
            {l.who && <b className="mr-1.5">{l.who}:</b>}
            {l.zh && <span className="text-white">{l.zh}</span>}
            {l.note && (
              <span className={l.who ? "ml-1.5 text-[12.5px] italic text-[#8899A6]" : "text-[12.5px] italic text-[#FF9C9C]"}>
                {l.who ? `(${l.note})` : l.note}
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3.5 text-[13.5px] leading-relaxed text-muted-foreground">
        {HOOK_SCENE.closing}
      </p>
    </div>
  );

  const screenNotice = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] font-bold text-[#B8860B]">검수된 참조 사례 — 정답이 아니라 범위</div>
      <h2 className="mt-1 text-[19px] font-bold">특이한 부분을 눌러보세요</h2>
      <p className="mt-1.5 text-[13.5px] text-muted-foreground">
        비슷한 상황(아직 어색한 동급생에게 위챗 부탁)의 사례예요. <strong>민준의 말에는 없던 것</strong>이 4군데 숨어 있어요.
      </p>

      <p className="mt-4 text-[15px] leading-loose">
        {CLUES.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setFoundClues((prev) => (prev.includes(i) ? prev : [...prev, i]))}
            className={[
              "mr-1 rounded px-0.5 transition-colors",
              foundClues.includes(i)
                ? "bg-[#FAD338]"
                : "border-b-2 border-dotted border-[#B8860B] hover:bg-[#FFFBEA]",
            ].join(" ")}
          >
            {c.zh}
          </button>
        ))}
        <span>{CLUE_TAIL}</span>
      </p>

      <div className="mt-3 inline-block rounded-full bg-[#15202B] px-3 py-1 text-[12px] font-bold text-white">
        단서 {foundClues.length} / {CLUES.length} 발견 {cluesEnough && "— 충분해요!"}
      </div>
      <ul className="mt-2 space-y-1">
        {foundClues.map((i) => (
          <li key={i} className="text-[13px] font-semibold text-[#2E7D5B]">
            ✓ {CLUES[i].why}
          </li>
        ))}
      </ul>

      {cluesEnough && (
        <div className="mt-4 space-y-2">
          <p className="text-[13.5px] text-muted-foreground">
            적절한 방식은 <strong>하나가 아니에요</strong> — 같은 부탁의 다른 사례와 경계도 보세요.
          </p>
          <div className="rounded-lg border border-emerald-500 p-3">
            <Badge className="bg-emerald-100 text-[11px] text-emerald-900 hover:bg-emerald-100">
              {REFERENCE_CASES.good.label}
            </Badge>
            <p className="mt-1.5 text-[15px]">{REFERENCE_CASES.good.zh}</p>
          </div>
          <div className="rounded-lg border border-destructive bg-destructive/5 p-3">
            <Badge className="bg-red-100 text-[11px] text-red-900 hover:bg-red-100">
              {REFERENCE_CASES.edge.label}
            </Badge>
            <p className="mt-1.5 text-[15px]">{REFERENCE_CASES.edge.zh}</p>
          </div>
        </div>
      )}

      <p className="mt-3 text-[12px] text-muted-foreground">
        왜 이런 말들이 붙었을까요? 규칙은 다음 화면에서. (3개 이상 찾으면 진행)
      </p>
    </div>
  );

  const screenPrinciple = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] font-bold text-[#B8860B]">이제 원리를 봅시다</div>
      <h2 className="mt-1 text-[19px] font-bold">방금 그 사례, 이렇게 읽습니다</h2>

      <dl className="mt-3.5 overflow-hidden rounded-lg border border-[#EAE4D2]">
        {PRINCIPLE_TABLE.map((r) => (
          <div key={r.k} className="flex border-b border-[#EAE4D2] last:border-b-0">
            <dt className="w-[110px] shrink-0 bg-[#F5F5F2] px-3 py-2.5 text-[12px] font-medium">
              {r.k}
            </dt>
            <dd
              className={[
                "flex-1 px-3 py-2.5 text-[13.5px]",
                r.hi ? "bg-[#FFFBEA] font-medium" : "",
              ].join(" ")}
            >
              {r.v}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{PRINCIPLE_LEAD}</p>

      <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[#FAD338] bg-[#FFFBEA] p-3.5 text-[13.5px] font-semibold">
        <span aria-hidden>🔓</span>
        <span>{STRATEGY_MAP_UNLOCK}</span>
      </div>
    </div>
  );

  const screenClassify = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] font-bold text-[#B8860B]">분류 게임 — 온도 맞추기</div>
      <h2 className="mt-1 text-[19px] font-bold">세 사람의 부탁, 각각 어떤가요?</h2>
      <p className="mt-1.5 text-[13.5px] text-muted-foreground">{CLASSIFY_PROMPT}</p>

      <div className="mt-3.5 space-y-2.5">
        {CLASSIFY_ITEMS.map((g, i) => {
          const sel = picks[i];
          return (
            <div key={i} className="rounded-lg border border-[#EAE4D2] p-3">
              <p className="text-[15px]">{g.zh}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CLASS_LABELS.map(({ key, label }) => {
                  const on = sel === key;
                  const right = on && key === g.truth;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [i]: key }))}
                      className={[
                        "rounded-md border px-3 py-1 text-[12px] transition-colors",
                        on
                          ? right
                            ? "border-emerald-600 font-bold text-emerald-700"
                            : "border-destructive font-bold text-destructive"
                          : "border-[#EAE4D2] hover:bg-muted",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {sel && (
                <p
                  className={[
                    "mt-2 text-[13px] font-semibold",
                    sel === g.truth ? "text-emerald-700" : "text-destructive",
                  ].join(" ")}
                >
                  {sel === g.truth ? "✓ " : "✗ "}
                  {g.fb}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {classifyDone && (
        <p className="mt-3 text-[13.5px] text-muted-foreground">
          {allRight ? ARC_CLOSING.allRight : ARC_CLOSING.partial} 이제 직접 해볼 차례예요.
        </p>
      )}
    </div>
  );

  const SCREENS: Record<string, () => JSX.Element> = {
    "장면 만나기": screenHook,
    "차이 찾기": screenNotice,
    "원리 이해": screenPrinciple,
    "감각 확인": screenClassify,
  };

  const nextLabel = [
    "다음: 이 상황을 잘 넘긴 사람들",
    "다음: 왜 그럴까?",
    "다음: 눈으로 확인",
  ][stepIdx];

  return (
    <LearnerJourneyShell
      headerRight={
        <span className="text-[12px] text-[#8899A6]">
          {WEEK_REQUEST.weekNo}주차 · {WEEK_REQUEST.speechAct}
        </span>
      }
    >
      <nav aria-label="학습 위치" className="mb-3 text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">
          {WEEK_REQUEST.weekNo}주차 {WEEK_REQUEST.speechAct}
        </span>
        <span aria-hidden className="mx-1.5">›</span>
        처음 배우기
      </nav>

      {/* 아크 진행바 — 4단계 */}
      <ol className="flex gap-1.5">
        {INTRO_STEPS.map((s, i) => (
          <li key={s} className="flex-1 text-center">
            <div
              className={[
                "h-[3px] rounded-full",
                i <= stepIdx ? "bg-[#FAD338]" : "bg-[#D3D1C7]",
              ].join(" ")}
            />
            <div
              className={[
                "mt-1.5 text-[11px]",
                i === stepIdx ? "font-bold text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              {s}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6">{SCREENS[step]()}</div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={stepIdx === 0}
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
        >
          ← 이전
        </Button>
        {step !== "감각 확인" ? (
          <Button onClick={advance} disabled={!canAdvance}>
            {nextLabel} →
          </Button>
        ) : (
          <Button onClick={finish} disabled={!classifyDone}>
            {ARC_CLOSING.cta} →
          </Button>
        )}
      </div>
    </LearnerJourneyShell>
  );
};

export default IntroArc;
