import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { HomeBrand } from "@/components/HomeBrand";
import { SituationBlock } from "@/components/mission/SituationBlock";
import {
  SCENARIO,
  CANDIDATES,
  PRESETS,
  MOCK_CLASS_BEST,
  MOCK_EXPERT_RANGE,
  MOCK_OPPOSING_REASONS,
  MOCK_REPORT,
} from "@/lib/mission/mockMission";
import type { Level, MissionEvent } from "@/lib/mission/mockMission";

// Learner 5-step mission shell — UI MOCKUP ONLY.
//
// Everything is local state over mock data; nothing is read from or written to
// Supabase. Purpose: review the shell visually (and the level_preset swapping)
// before any item_version/attempt schema exists.
//
// Locked ordering (spec §1 "첫 판단 오염 금지"):
//   judgment → context switch → feedback. Hints/explanations never appear
//   before the CS is submitted.

const STEPS = ["상황 이해", "후보 판단", "피드백", "직접 산출", "리포트"] as const;

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

const MissionShell = () => {
  const [level, setLevel] = useState<Level>("intermediate");
  const [step, setStep] = useState(1);
  /** Within step 2: false = situation A judgment, true = context-switch re-judgment. */
  const [csPhase, setCsPhase] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [csRatings, setCsRatings] = useState<Record<string, number>>({});
  const [best, setBest] = useState<string | null>(null);
  const [csBest, setCsBest] = useState<string | null>(null);
  const [needsAdjust, setNeedsAdjust] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [production, setProduction] = useState("");
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [devOpen, setDevOpen] = useState(false);

  const preset = PRESETS[level];
  const candidates = preset.candidateIds.map((id) => CANDIDATES[id]);

  const logEvent = (e: MissionEvent) =>
    setEvents((prev) => (prev.includes(e) ? prev : [...prev, e]));

  const resetMission = (next: Level) => {
    setLevel(next);
    setStep(1);
    setCsPhase(false);
    setRatings({});
    setCsRatings({});
    setBest(null);
    setCsBest(null);
    setNeedsAdjust(null);
    setTags([]);
    setConfidence(null);
    setProduction("");
    setEvents([]);
  };

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const allRated = candidates.every((c) => ratings[c.id] !== undefined);
  const allCsRated = candidates.every((c) => csRatings[c.id] !== undefined);
  const judgmentReady =
    allRated &&
    best !== null &&
    (!preset.showNeedsAdjust || needsAdjust !== null) &&
    (!preset.reasonRequired || tags.length > 0) &&
    (!preset.showConfidence || confidence !== null);

  // ── shared bits ──

  const ScaleRow = ({
    value,
    onPick,
  }: {
    value: number | undefined;
    onPick: (v: number) => void;
  }) => (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {preset.scale.map((labelText, i) => (
        <button
          key={labelText}
          type="button"
          onClick={() => onPick(i)}
          className={[
            "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
            value === i
              ? "border-[#15202B] bg-[#15202B] text-white"
              : "border-[#EAE4D2] bg-background hover:bg-muted",
          ].join(" ")}
        >
          {labelText}
        </button>
      ))}
    </div>
  );

  // ── steps ──

  const Step1 = () => (
    <div className="space-y-4">
      <SituationBlock card={SCENARIO.situation} tone="a" />
      {preset.miniCard && (
        <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">오늘의 표현</span>
            <Badge variant="outline" className="text-[11px]">연습 전용 · 앵커에서는 숨김</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {preset.miniCard.map((m) => (
              <span key={m} className="rounded-md bg-[#FAF7EE] px-2.5 py-1 text-[14px]">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="text-[12px] font-medium text-muted-foreground">한국어 원문</div>
        <p className="mt-1 text-[16px]">{SCENARIO.sourceText}</p>
      </div>
    </div>
  );

  const Step2 = () => {
    const card = csPhase ? preset.csSituation : SCENARIO.situation;
    const value = csPhase ? csRatings : ratings;
    const setValue = csPhase ? setCsRatings : setRatings;
    const pickedBest = csPhase ? csBest : best;
    const setPickedBest = csPhase ? setCsBest : setBest;

    return (
      <div className="space-y-4">
        {csPhase && (
          <div className="flex items-center gap-2">
            <Badge className="bg-[#FAD338] text-[#15202B] hover:bg-[#FAD338]">
              {preset.csLabel}
            </Badge>
            <span className="text-[12px] text-muted-foreground">
              같은 원문·같은 후보, 상황만 바뀌었습니다.
            </span>
          </div>
        )}
        <SituationBlock card={card} tone={csPhase ? "b" : "a"} />

        <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
          <p className="text-[13px] font-medium">{preset.axisPrompt}</p>
          <div className="mt-3 space-y-3">
            {candidates.map((c, idx) => (
              <div key={c.id} className="rounded-lg border border-[#EAE4D2] p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-medium">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <p className="text-[15px]">{c.text}</p>
                </div>
                <ScaleRow
                  value={value[c.id]}
                  onPick={(v) => setValue((prev) => ({ ...prev, [c.id]: v }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#EAE4D2] bg-white p-4 space-y-3">
          <div>
            <div className="text-[13px] font-medium">
              {csPhase ? "이 상황에서 실제로 쓸 표현" : "실제로 쓸 표현 (Best)"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidates.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPickedBest(c.id)}
                  className={[
                    "rounded-md border px-3 py-1 text-[12px]",
                    pickedBest === c.id
                      ? "border-[#15202B] bg-[#15202B] text-white"
                      : "border-[#EAE4D2] hover:bg-muted",
                  ].join(" ")}
                >
                  {String.fromCharCode(65 + idx)}
                </button>
              ))}
            </div>
          </div>

          {!csPhase && preset.showNeedsAdjust && (
            <div>
              <div className="text-[13px] font-medium">가장 조정이 필요한 표현</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {candidates.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNeedsAdjust(c.id)}
                    className={[
                      "rounded-md border px-3 py-1 text-[12px]",
                      needsAdjust === c.id
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-[#EAE4D2] hover:bg-muted",
                    ].join(" ")}
                  >
                    {String.fromCharCode(65 + idx)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!csPhase && (
            <div>
              <div className="text-[13px] font-medium">
                이유 {preset.reasonRequired ? "(필수)" : "(선택)"}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preset.reasonTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={[
                      "rounded-full border px-3 py-1 text-[12px]",
                      tags.includes(t)
                        ? "border-[#15202B] bg-[#15202B] text-white"
                        : "border-[#EAE4D2] hover:bg-muted",
                    ].join(" ")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!csPhase && preset.showConfidence && (
            <div>
              <div className="text-[13px] font-medium">확신도</div>
              <div className="mt-2 flex gap-1.5">
                {["낮음", "보통", "높음"].map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setConfidence(i)}
                    className={[
                      "rounded-md border px-3 py-1 text-[12px]",
                      confidence === i
                        ? "border-[#15202B] bg-[#15202B] text-white"
                        : "border-[#EAE4D2] hover:bg-muted",
                    ].join(" ")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border border-dashed border-[#EAE4D2] bg-[#FAF7EE] p-3 text-[12px] text-muted-foreground">
          해설·학급 분포·전문가 의견은 <strong>Context Switch까지 제출한 뒤에만</strong> 공개됩니다.
          (첫 판단 오염 방지)
        </div>
      </div>
    );
  };

  const Step3 = () => {
    const shifted = best !== csBest;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
          <div className="text-[13px] font-semibold">내 판단의 변화</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded bg-[#FAF7EE] px-2 py-1">
              상황 A → <strong>{labelOf(best, preset.candidateIds)}</strong>
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="rounded bg-[#FFFBEA] px-2 py-1">
              상황 B → <strong>{labelOf(csBest, preset.candidateIds)}</strong>
            </span>
            <Badge variant={shifted ? "default" : "outline"} className="text-[11px]">
              {shifted ? "상황에 따라 판단을 바꿨습니다" : "두 상황에서 같은 표현을 골랐습니다"}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
          <div className="text-[13px] font-semibold">학급 판단 분포 (Best 기준)</div>
          <div className="mt-3 space-y-2">
            {candidates.map((c, idx) => {
              const pct = MOCK_CLASS_BEST[c.id] ?? 0;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="w-4 text-[12px] text-muted-foreground">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-[#FAD338]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-9 text-right text-[12px] text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            최소 응답 수가 확보된 뒤에만 표시됩니다. (목업 수치)
          </p>
        </div>

        <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
          <div className="text-[13px] font-semibold">전문가 참조 범위</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            하나의 정답이 아니라, 상황별로 적합한 범위입니다.
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {candidates.map((c, idx) => (
              <li key={c.id} className="flex gap-2">
                <span className="shrink-0 font-medium">{String.fromCharCode(65 + idx)}</span>
                <span className="text-muted-foreground">
                  <span className="mr-1.5 rounded bg-[#FAF7EE] px-1.5 py-0.5 text-[11px]">
                    {c.gloss}
                  </span>
                  {MOCK_EXPERT_RANGE[c.id]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
          <div className="text-[13px] font-semibold">서로 다른 대표 이유</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MOCK_OPPOSING_REASONS.map((r) => (
              <div key={r.stance} className="rounded-lg bg-[#FAF7EE] p-3">
                <div className="text-[12px] font-medium">{r.stance}</div>
                <p className="mt-1 text-[13px] text-muted-foreground">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const Step4 = () => (
    <div className="space-y-4">
      <SituationBlock card={SCENARIO.situation} tone="a" />
      <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            {preset.production === "strength_adjust"
              ? "표현 강도 조절 연습"
              : preset.production === "controlled_translation"
                ? "통제 번역"
                : "상황 기반 실전 메시지"}
          </Badge>
          {preset.hintPolicy === "on" ? (
            <span className="text-[11px] text-muted-foreground">힌트 사용 가능 (연습)</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">작성 중 힌트 없음</span>
          )}
        </div>
        <p className="mt-2 text-[13px]">{preset.productionPrompt}</p>

        {preset.production === "strength_adjust" && (
          <div className="mt-3 rounded-lg bg-[#FAF7EE] p-3">
            <div className="text-[12px] text-muted-foreground">고칠 문장</div>
            <p className="mt-1 text-[15px]">{CANDIDATES.cand_d.text}</p>
          </div>
        )}
        {preset.production === "real_message" && (
          <div className="mt-3 rounded-lg bg-[#FAF7EE] p-3 text-[12px]">
            <div className="font-medium text-muted-foreground">허용된 약속 (allowed_commitments)</div>
            <ul className="mt-1 list-disc pl-4">
              {SCENARIO.allowedCommitments.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <Textarea
          className="mt-3"
          rows={preset.production === "real_message" ? 8 : 3}
          value={production}
          onChange={(e) => setProduction(e.target.value)}
          placeholder="여기에 작성하세요"
        />

        {production.trim() !== "" && (
          <div className="mt-3 rounded-lg border border-[#EAE4D2] p-3">
            <div className="text-[12px] font-medium">작성 검사 (목업)</div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">
                원문 정보 단위 {SCENARIO.sourceInformationUnits.length}개 중 3개 유지
              </span>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-900">상황 카드 사실 사용</span>
              <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-900">완화 표현 1개</span>
              <span className="rounded bg-red-100 px-2 py-0.5 text-red-900">근거 없는 추가 0건</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const Step5 = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          나의 실전 중국어 리포트
        </div>
        <p className="mt-1.5 text-[17px] font-semibold">{MOCK_REPORT.headline}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">{MOCK_REPORT.evidence}</p>
        <p className="text-[13px] text-muted-foreground">{MOCK_REPORT.classContext}</p>
        <div className="mt-3 rounded-lg bg-[#FAF7EE] p-3">
          <div className="text-[12px] font-medium">바로 적용할 전략</div>
          <p className="mt-1 text-[13px]">{MOCK_REPORT.strategy}</p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge className="bg-[#FAD338] text-[#15202B] hover:bg-[#FAD338]">
            {MOCK_REPORT.next}
          </Badge>
          <span className="text-[11px] text-muted-foreground">1회 관찰 → 단정하지 않음</span>
        </div>
      </div>

      <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="text-[13px] font-semibold">평가 3축</div>
        <div className="mt-3 space-y-2.5">
          {MOCK_REPORT.rubrics.map((r) => (
            <div key={r.axis} className="rounded-lg border border-[#EAE4D2] p-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium">{r.axis}</span>
                <Badge
                  variant="outline"
                  className={[
                    "text-[11px]",
                    r.verdict === "조정 필요" ? "border-amber-400 text-amber-700" : "",
                  ].join(" ")}
                >
                  {r.verdict}
                </Badge>
                {r.tags.map((t) => (
                  <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[13px] text-muted-foreground">{r.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="text-[13px] font-semibold">이 수준의 리포트 초점</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {preset.reportFocus.map((f) => (
            <span key={f} className="rounded-full bg-[#FAF7EE] px-3 py-1 text-[12px]">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  // ── nav ──

  const canAdvance = () => {
    if (step === 1) return true;
    if (step === 2) return csPhase ? allCsRated && csBest !== null : judgmentReady;
    if (step === 4) return production.trim() !== "";
    return true;
  };

  const advance = () => {
    if (step === 1) {
      logEvent("context_viewed");
      setStep(2);
      return;
    }
    if (step === 2 && !csPhase) {
      logEvent("judgment_submitted");
      setCsPhase(true);
      return;
    }
    if (step === 2 && csPhase) {
      logEvent("context_switch_submitted");
      setStep(3);
      return;
    }
    if (step === 3) {
      logEvent("feedback_viewed");
      setStep(4);
      return;
    }
    if (step === 4) {
      logEvent("production_submitted");
      logEvent("report_viewed");
      setStep(5);
      return;
    }
  };

  const nextLabel =
    step === 2 && !csPhase
      ? "판단 제출 → 상황 바꿔 다시 보기"
      : step === 2 && csPhase
        ? "제출하고 피드백 보기"
        : step === 4
          ? "제출하고 리포트 보기"
          : step === 5
            ? ""
            : "다음";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <HomeBrand />
          <span className="text-[12px] text-[#8899A6]">목업 · 데이터 저장 안 됨</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-6">
        {/* level switcher — proves single engine, level_preset swap */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => resetMission(l)}
                className={[
                  "rounded-md border px-3 py-1.5 text-[12px] transition-colors",
                  level === l
                    ? "border-[#15202B] bg-[#15202B] text-white"
                    : "border-[#EAE4D2] hover:bg-muted",
                ].join(" ")}
              >
                {PRESETS[l].label}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-muted-foreground">
            {SCENARIO.speechAct} · {SCENARIO.situation.channel} · {SCENARIO.mode}
          </span>
        </div>

        {/* 5-step indicator */}
        <ol className="mt-5 flex items-center gap-1.5">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <li key={s} className="flex flex-1 items-center gap-1.5">
                <div
                  className={[
                    "flex w-full flex-col gap-1 rounded-md px-2 py-1.5",
                    active ? "bg-[#FAD338]" : done ? "bg-[#EAE4D2]" : "bg-muted",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-[11px] font-medium",
                      active ? "text-[#15202B]" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {n}. {s}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5">
          {step === 1 && <Step1 />}
          {step === 2 && <Step2 />}
          {step === 3 && <Step3 />}
          {step === 4 && <Step4 />}
          {step === 5 && <Step5 />}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={step === 1 && !csPhase}
            onClick={() => {
              if (step === 2 && csPhase) {
                setCsPhase(false);
                return;
              }
              setStep((s) => Math.max(1, s - 1));
            }}
          >
            ← 이전
          </Button>
          {step < 5 ? (
            <Button onClick={advance} disabled={!canAdvance()}>
              {nextLabel}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => resetMission(level)}>
              처음부터 다시
            </Button>
          )}
        </div>

        {/* dev panel — design proof, not part of the learner UI */}
        <div className="mt-8 rounded-lg border border-dashed border-[#EAE4D2] bg-[#FAF7EE] p-3">
          <button
            type="button"
            onClick={() => setDevOpen((v) => !v)}
            className="text-[12px] font-medium text-muted-foreground"
          >
            {devOpen ? "▾" : "▸"} 설계 확인 패널 (학습자에게는 보이지 않음)
          </button>
          {devOpen && (
            <div className="mt-3 space-y-3 text-[12px]">
              <div>
                <div className="font-medium">기록된 6이벤트</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(
                    [
                      "context_viewed",
                      "judgment_submitted",
                      "context_switch_submitted",
                      "feedback_viewed",
                      "production_submitted",
                      "report_viewed",
                    ] as MissionEvent[]
                  ).map((e) => (
                    <span
                      key={e}
                      className={[
                        "rounded px-2 py-0.5 font-mono text-[11px]",
                        events.includes(e)
                          ? "bg-[#15202B] text-white"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium">내부 P·D·R (화면에 노출 금지)</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  상황 A — P: {SCENARIO.situation.internalPdr.p} / D:{" "}
                  {SCENARIO.situation.internalPdr.d} / R: {SCENARIO.situation.internalPdr.r}
                  <br />
                  상황 B — P: {preset.csSituation.internalPdr.p} / D:{" "}
                  {preset.csSituation.internalPdr.d} / R: {preset.csSituation.internalPdr.r}
                </div>
              </div>
              <div>
                <div className="font-medium">item_version (목업)</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  level: {preset.level} · judgment_axis: {preset.judgmentAxis} ·
                  context_switch_type: {preset.csType} · production: {preset.production} ·
                  hint_policy: {preset.hintPolicy} · candidates: {preset.candidateIds.length}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function labelOf(candId: string | null, order: string[]) {
  if (!candId) return "—";
  const i = order.indexOf(candId);
  return i < 0 ? "—" : String.fromCharCode(65 + i);
}

export default MissionShell;
