import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { SPEECH_ACT_UI, LEVEL, DIRECTION_LANGS, type LanguageDirection } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { SCALE4_CODES, SCALE4_LABELS, type Scale4Code } from "@/lib/pragma/targetFeatures";
import { normalizeMission, type MissionV2, type MpjItemV2 } from "@/lib/pragma/missionSchema";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { fetchMissionByScenario, type RunnableMission } from "@/lib/mission/missionDb";
import { saveMissionAttempt } from "@/lib/mission/missionLog";
import { ChatScene, ChatBubble, ChatCaption, ChatAvatar, highlightZh } from "@/components/mission/ChatScene";
import { IS_DEMO } from "@/lib/auth/useProfile";

// 샘플은 v1 → 정규화해 v2로 구동(러너는 정규화 형태만 본다, 0-l·84).
const SAMPLE_MISSION_V2 = normalizeMission(SAMPLE_MISSION_V1).data as MissionV2;

// 방향별 언어 이름 라벨(0-l·85).
const LANG_NAME: Record<"ko" | "zh", string> = { ko: "한국어", zh: "중국어" };
const srcLangName = (dir: LanguageDirection) => LANG_NAME[DIRECTION_LANGS[dir].source];
const tgtLangName = (dir: LanguageDirection) => LANG_NAME[DIRECTION_LANGS[dir].target];

// 학습자 미션 실행 — 계약 스키마 mission_v1을 직접 구동한다(프로토타입 v2 이식).
//   1부 판단 연습(MPJ 5) → 인계 → 2부 실전 적용(상황 확인 → 산출/통역 → 피드백 → 다듬기 → 완료)
// 판정은 초점별 band 카탈로그(targetFeatures) 기준. 답별 AI 피드백은 후속(feedback-lite)이라
// 피드백 단계는 참고 표현·핵심 원칙만 보여준다(정직 표기).

const CONFIDENCE = ["매우 확신", "꽤 확신", "확신 없음"] as const;

// B1(계약 0-g·44·0-e·⑨): 판정 대역은 proposed(확정 정답 아님). 프로토타입 v2 기준 —
// 매 문항 반복 대신 1부 시작에 1회만 지위를 정직하게 고지한다.
const JUDGMENT_STATUS_CAPTION =
  "판정은 현재 수업 기준 · AI 제안(검증 예정)입니다 — 유일한 정답이 아니라, 상황에 따라 다른 적절한 표현도 있을 수 있어요.";

// PDR 학습자 라벨(근거 서랍용 — 내부 코드 노출 금지)
const PDR_R_LABEL: Record<string, string> = { low: "가벼운 부탁", mid: "보통", high: "부담이 큼" };
const PDR_D_LABEL: Record<string, string> = { close: "가까운 사이", acquaintance: "아는 사이", distant: "처음/먼 사이" };

// MPJ 5문항 유형 라벨(진행바 하위 스텝 노출용, 프로토타입 v2).
const MPJ_LABEL: Record<string, string> = {
  scale4: "적절성 판단",
  judge3: "정도 판단",
  fix_choice: "판단 후 교정",
  reason_conf: "판단 + 근거",
  multi_judge: "복수 동시 판단",
};

const card = "rounded-xl border border-[#EAE4D2] bg-white p-4";
const srcBox = "rounded-lg border-l-[3px] border-[#EAE4D2] border-l-[#FAD338] bg-[#F5F5F2] p-3";
// 데모/검증 전용 버튼(프로토타입 v2 "데모 채우기") — IS_DEMO(개발·데모 배포)에서만 노출.
// 실제 학습 세션(VITE_ENABLE_DEMO 미설정)에는 나오지 않아 수행 데이터 오염 없음.
const demoBtn =
  "block w-full rounded-lg border border-dashed border-[#D8D0BC] bg-[#F5F5F2] px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-[#EFEEE9]";

// ── 2부 진행 단계 ────────────────────────────────────────────────────────
type Phase = "mpj" | "handoff" | "ctx" | "produce" | "feedback" | "revise" | "done";
const PART2_STEP_INDEX: Partial<Record<Phase, number>> = { ctx: 0, produce: 1, feedback: 2, revise: 3, done: 4 };
const part2Labels = (interp: boolean) => ["상황 확인", interp ? "통역하기" : "번역하기", "피드백", "다듬기", "완료"];

// ── band 라벨 헬퍼 ──────────────────────────────────────────────────────
function bandLabel(featureCode: string, code: string): string {
  const feat = getTargetFeature(featureCode);
  return feat?.band_schema.find((b) => b.code === code)?.label_ko ?? code;
}
/** 초점의 band 선택지(카탈로그 우선, 없으면 문항에 등장한 코드로 폴백). */
function bandOptions(featureCode: string, fallback: string[]): { code: string; label: string }[] {
  const feat = getTargetFeature(featureCode);
  if (feat) return feat.band_schema.map((b) => ({ code: b.code, label: b.label_ko }));
  return [...new Set(fallback)].map((c) => ({ code: c, label: c }));
}

// ── 상황 확인(판단형) — PDR에서 규칙적으로 파생. 데이터·AI 0회, 점수 없음 ──
// 프로토타입 v2 "필요한 화용 조절점" 판단. 요청·완화 계열 기준(현행 DB 범위).
function deriveCtx(pdr: { d?: string; r?: string }) {
  const opts = [
    "친한 사이라 간결·직접적으로 말해도 괜찮다",
    "아직 친하지 않으니 상대가 선택할 여지를 남기는 완화가 필요하다",
    "겹겹의 격식과 존대를 최대한 갖춰야 한다",
  ];
  let right = 1;
  if (pdr.d === "close" && pdr.r !== "high") right = 0;
  else if (pdr.d === "distant" && pdr.r === "high") right = 2;
  const okRight = [
    "친하고 부담이 낮아 간결·직접적인 표현이 자연스럽습니다. 완화를 겹겹이 쌓으면 오히려 어색합니다.",
    "아직 친하지 않고 상대가 결정할 여지가 있는 상황이라, 부담을 낮추는 완화와 선택권이 적절합니다. 과한 격식은 오히려 거리감을 줍니다.",
    "부담이 크고 관계가 먼 상황이라, 격식과 존대를 충분히 갖추는 편이 안전합니다.",
  ][right];
  const okWrong = [
    "이번 상대는 편한 사이입니다. 완화를 과하게 쌓기보다 간결·직접적인 표현이 더 자연스럽습니다.",
    "이번 상대는 아직 친하지 않습니다. 간결한 직접형은 부담스럽고 과한 격식은 거리감을 줍니다 — 거절할 여지를 남기는 완화가 이 관계에 맞습니다.",
    "이번 상대는 부담이 크고 먼 관계입니다. 간결한 직접형보다 격식을 갖추는 편이 적절합니다.",
  ][right];
  return { q: "이 상대·이 부담이라면, 요청을 어느 정도로 조절하는 게 자연스러울까요?", opts, right, okRight, okWrong };
}

// ── 페이지: 라우트 파라미터로 DB 조회, 없으면 샘플 ──────────────────────
const MissionRunV1 = () => {
  const { scenarioId } = useParams();
  const [searchParams] = useSearchParams();
  // 데모/검증 토글 — 샘플 경로에서만 통역 흐름을 켠다(실제 DB 미션에는 영향 없음).
  const forceInterp = !scenarioId && searchParams.get("mode") === "interpreting";
  const [loaded, setLoaded] = useState<RunnableMission | null>(null);
  const [loading, setLoading] = useState<boolean>(!!scenarioId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetchMissionByScenario(scenarioId);
        if (!cancelled) setLoaded(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "미션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  if (scenarioId && loading) {
    return (
      <LearnerJourneyShell>
        <p className="py-10 text-center text-[13px] text-muted-foreground">미션을 불러오는 중…</p>
      </LearnerJourneyShell>
    );
  }
  if (scenarioId && error) {
    return (
      <LearnerJourneyShell>
        <div className="my-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">{error}</div>
      </LearnerJourneyShell>
    );
  }

  const baseMission = loaded?.mission ?? SAMPLE_MISSION_V2;
  const mission =
    forceInterp
      ? { ...baseMission, production_task: { ...baseMission.production_task, mode: "interpreting" as const } }
      : baseMission;
  const isSample = !loaded;
  const headerRight = loaded
    ? `${loaded.speech_act ? SPEECH_ACT_UI[loaded.speech_act] : ""} · ${loaded.learner_level ? LEVEL[loaded.learner_level] : ""}`
    : "샘플 미션";

  return (
    <MissionRunner
      key={`${loaded?.scenario_id ?? "sample"}:${mission.production_task.mode}`}
      mission={mission}
      isSample={isSample}
      headerRight={headerRight}
      status={loaded?.mission_status ?? null}
      scenarioId={loaded?.scenario_id ?? null}
      speechAct={loaded?.speech_act ?? null}
      level={loaded?.learner_level ?? null}
    />
  );
};

// ── 러너 본체 ───────────────────────────────────────────────────────────
function MissionRunner({
  mission,
  isSample,
  headerRight,
  status,
  scenarioId,
  speechAct,
  level,
}: {
  mission: MissionV2;
  isSample: boolean;
  headerRight: string;
  status: string | null;
  scenarioId: string | null;
  speechAct: string | null;
  level: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("mpj");
  const [mpjIdx, setMpjIdx] = useState(0);
  const [ctxPick, setCtxPick] = useState<number | null>(null);
  const [ctxDone, setCtxDone] = useState(false);
  const [draft, setDraft] = useState("");
  const [revised, setRevised] = useState("");
  const [savedLater, setSavedLater] = useState(false);
  const [resume, setResume] = useState<{ phase: Phase; draft: string; revised: string; ctxPick: number | null; ctxDone: boolean } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "demo" | "error">("idle");
  const startedAtRef = useRef<string>(new Date().toISOString());

  const items = mission.mpj_items;
  const item = items[mpjIdx];
  const dir = mission.direction;
  const langs = DIRECTION_LANGS[dir];
  const tgtName = tgtLangName(dir);
  const srcName = srcLangName(dir);
  const pt = mission.production_task;
  const isInterp = pt.mode === "interpreting";
  const part = phase === "mpj" || phase === "handoff" ? 1 : 2;
  // 데모 채우기 예시 답안(참고 표현 재사용 — 산출/다듬기가 다르게 보이도록 서로 다른 안)
  const demoDraft = pt.reference_alternatives[0]?.text ?? "";
  const demoRevised = pt.reference_alternatives[1]?.text ?? pt.reference_alternatives[0]?.text ?? "";

  // B2(계약 0-k): counter_rule 반례를 완료 화면에 노출 — "직접형=무조건 나쁨" 오학습 방지.
  const feat = getTargetFeature(mission.unit.target_feature);
  const counterRule =
    dir === "zh_ko" && feat?.counter_rule_note_zh_ko ? feat.counter_rule_note_zh_ko : feat?.counter_rule_note;

  // 중단 후 재개(프로토타입 v2 ②) — 2부 진행분만 미션별 localStorage에 보존. 실패해도 흐름 무해.
  const storageKey = `pragma:mrun:${scenarioId ?? "sample"}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s.phase === "string" && s.phase !== "mpj" && s.phase !== "handoff") setResume(s);
      }
    } catch {
      /* localStorage 미지원 — 재개 없이 정상 진행 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (part !== 2) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ phase, draft, revised, ctxPick, ctxDone }));
    } catch {
      /* 무시 */
    }
  }, [part, phase, draft, revised, ctxPick, ctxDone, storageKey]);
  const clearSaved = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* 무시 */
    }
  };
  const applyResume = () => {
    if (!resume) return;
    setDraft(resume.draft || "");
    setRevised(resume.revised || "");
    setCtxPick(resume.ctxPick ?? null);
    setCtxDone(!!resume.ctxDone);
    setPhase(resume.phase);
    setResume(null);
    window.scrollTo(0, 0);
  };

  // 미션 완료 = 수행 로그 저장(루프 마지막 노드). 데모 스텁은 저장 불가 → 안내만.
  const finish = async () => {
    setPhase("done");
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    const res = await saveMissionAttempt({
      mission,
      scenarioId,
      speechAct,
      level,
      firstResponse: draft,
      revisedResponse: revised || draft,
      startedAtIso: startedAtRef.current,
    });
    if (res.ok) {
      setSaveState("saved");
      clearSaved();
    } else {
      setSaveState((res as { reason?: string }).reason === "no_auth" ? "demo" : "error");
      clearSaved();
    }
  };

  const nextMpj = () => {
    if (mpjIdx < items.length - 1) setMpjIdx((i) => i + 1);
    else {
      setPhase("handoff");
      window.scrollTo(0, 0);
    }
  };

  const goto = (p: Phase) => {
    setPhase(p);
    window.scrollTo(0, 0);
  };

  const resetAll = () => {
    clearSaved();
    setPhase("mpj");
    setMpjIdx(0);
    setCtxPick(null);
    setCtxDone(false);
    setDraft("");
    setRevised("");
    setSavedLater(false);
    setResume(null);
    setSaveState("idle");
    startedAtRef.current = new Date().toISOString();
    window.scrollTo(0, 0);
  };

  return (
    <LearnerJourneyShell headerRight={<span className="text-[12px] text-[#8899A6]">{headerRight}</span>}>
      <div className="pb-24">
        {(isSample || status === "generated") && (
          <div className="mb-3 rounded-lg border border-dashed border-[#C9A227] bg-[#FFFBEA] px-3.5 py-2.5 text-[12px] text-[#6B5518]">
            {isSample ? (
              <>
                <b>샘플 미션</b> · 렌더 검증용입니다. 중국어 예문은 <b>원어민 검토 전</b> 초안입니다.
              </>
            ) : (
              <>
                <b>검토 전(generated)</b> 미션입니다 · 개발 확인용. 학습자 배포는 검토 완료본만 됩니다.
              </>
            )}
          </div>
        )}

        {/* 중단 후 재개 배너 — 2부 진행분이 남아 있을 때만 */}
        {resume && phase === "mpj" && mpjIdx === 0 && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-[#FAD338] bg-[#FFF8DE] px-3.5 py-2.5 text-[12.5px] text-[#6B5518]">
            <span>이전에 진행하던 <b>2부</b>가 있어요.</span>
            <button
              type="button"
              onClick={applyResume}
              className="shrink-0 rounded-md bg-[#15202B] px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              이어서 하기 →
            </button>
          </div>
        )}

        {/* ── 2계층 진행바 (IS_DEMO면 클릭해 1부/2부 바로 이동 — 프로토타입 v2 devGo) ── */}
        <div className="mb-1.5 flex gap-2">
          {[
            { n: "1부", label: "판단 연습", active: part === 1, done: part > 1, target: "mpj" as Phase },
            { n: "2부", label: "실전 적용", active: part === 2, done: false, target: "ctx" as Phase },
          ].map((t) => {
            const cls = [
              "flex-1 rounded-[10px] border px-3 py-2 text-left text-[12.5px]",
              t.done
                ? "border-[#FAD338] bg-[#FAD338] font-bold text-[#15202B]"
                : t.active
                ? "border-[#15202B] bg-[#15202B] font-bold text-white"
                : "border-[#EAE4D2] bg-white text-muted-foreground",
              IS_DEMO ? "cursor-pointer hover:opacity-90" : "",
            ].join(" ");
            const inner = (
              <>
                <div className="text-[11px] opacity-80">{t.n}</div>
                {t.label} {t.done ? "✓" : ""}
              </>
            );
            return IS_DEMO ? (
              <button
                key={t.n}
                type="button"
                onClick={() => {
                  if (t.target === "mpj") setMpjIdx(0);
                  goto(t.target);
                }}
                className={cls}
              >
                {inner}
              </button>
            ) : (
              <div key={t.n} className={cls}>{inner}</div>
            );
          })}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#A9B0BA]">
          {part === 1 ? (
            phase === "handoff" ? (
              <span className="font-bold text-foreground">판단 {items.length} / {items.length} 완료</span>
            ) : (
              <>
                <span>판단 {mpjIdx + 1} / {items.length}</span>
                <span className="text-[#E3E1D8]">·</span>
                <span className="font-bold text-foreground">{MPJ_LABEL[item.type] ?? ""}</span>
              </>
            )
          ) : (
            part2Labels(isInterp).map((s, i) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={i === (PART2_STEP_INDEX[phase] ?? 0) ? "font-bold text-foreground" : ""}>{s}</span>
                {i < 4 && <span className="text-[#E3E1D8]">›</span>}
              </span>
            ))
          )}
        </div>

        {/* ── 1부: 판단 연습(MPJ) ── */}
        {phase === "mpj" && (
          <div className="space-y-3">
            {mpjIdx === 0 && <MissionContractBar mission={mission} />}
            {mpjIdx === 0 && (
              <p className="rounded-lg border border-dashed border-[#D8D0BC] bg-[#FBFAF5] px-3.5 py-2 text-[11.5px] leading-relaxed text-[#6B5518]">
                {JUDGMENT_STATUS_CAPTION}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className="font-normal">이번 핵심 · {mission.unit.learner_label}</Badge>
              <span className="text-[12px] text-muted-foreground">{mpjIdx + 1} / {items.length}</span>
            </div>
            <MpjStage key={item.id} item={item} onDone={nextMpj} />
          </div>
        )}

        {/* ── 1부 → 2부 인계 ── */}
        {phase === "handoff" && (
          <Handoff
            mission={mission}
            dir={dir}
            isInterp={isInterp}
            saved={savedLater}
            onContinue={() => goto("ctx")}
            onSaveLater={() => {
              try {
                localStorage.setItem(storageKey, JSON.stringify({ phase: "ctx", draft: "", revised: "", ctxPick: null, ctxDone: false }));
              } catch {
                /* 무시 */
              }
              setSavedLater(true);
            }}
          />
        )}

        {/* ── 2부 ①: 상황 확인(판단형) ── */}
        {phase === "ctx" && (
          <CtxStage
            pt={pt}
            isInterp={isInterp}
            pick={ctxPick}
            done={ctxDone}
            onPick={setCtxPick}
            onConfirm={() => setCtxDone(true)}
            onNext={() => goto("produce")}
          />
        )}

        {/* ── 2부 ②: 실전 산출 — 번역(입력) / 통역(오디오) ── */}
        {phase === "produce" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#15202B] p-4 text-white">
              <div className="text-[11px] font-bold text-[#FAD338]">판단하기 정리</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed">
                이 상대·이 부담에 맞는 만큼만 골라 쓰세요 — 많이 얹을수록 좋은 게 아닙니다.
              </p>
            </div>
            {isInterp ? (
              <AudioFrame
                sourceText={pt.source_text}
                srcName={srcName}
                tgtName={tgtName}
                ttsLang={langs.tts}
                sttLang={langs.stt}
                situation={pt.situation_ko}
                relation={pt.relation_ko}
                demoText={demoDraft}
                onSubmit={(t) => {
                  setDraft(t);
                  goto("feedback");
                }}
              />
            ) : (
              <>
                <ChatScene situation={pt.situation_ko} relation={pt.relation_ko} eyebrow="직접 옮길 요청">
                  {pt.preceding_turn && <ChatBubble side="them">{pt.preceding_turn}</ChatBubble>}
                  <ChatCaption>내가 전할 말 ({srcName}) · {pt.source_text}</ChatCaption>
                  <div className="mb-3 flex items-end justify-end gap-2">
                    <Textarea
                      className="w-[78%] resize-y rounded-[19px] rounded-br-[6px] border border-[#7ED158] bg-gradient-to-b from-[#9EED7C] to-[#8CE768] px-3 py-2 text-[14.5px] leading-[1.46] text-[#0c3300] placeholder:text-[#4a7a4a]"
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`여기에 ${tgtName}로 답장 입력…`}
                    />
                    <ChatAvatar side="me" />
                  </div>
                </ChatScene>
                <p className="px-0.5 text-[12px] text-muted-foreground">
                  먼저 스스로 옮겨 보세요 — 상대에게 답장하듯이. 참고 표현은 제출한 뒤에 함께 봅니다.
                </p>
                <Button className="w-full bg-[#FAD338] text-[#15202B] hover:bg-[#F0C800]" disabled={!draft.trim()} onClick={() => goto("feedback")}>번역 제출 →</Button>
                {IS_DEMO && (
                  <button type="button" className={demoBtn} onClick={() => setDraft(demoDraft)}>데모 채우기 — 예시 답안 입력</button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 2부 ③: 피드백 ── */}
        {phase === "feedback" && (
          <div className="space-y-3">
            <div className={card}>
              <div className="text-[11.5px] font-semibold text-muted-foreground">{isInterp ? "내 통역(확인한 전사)" : "내 번역"}</div>
              <p className="mt-1 whitespace-pre-wrap text-[14.5px]">{draft}</p>
            </div>

            <div className={card}>
              <div className="text-[13px] font-semibold"><span className="mr-1.5 text-[#8899A6]">1</span>이번 화용 초점 — {mission.unit.learner_label}</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed">{mission.unit.closing_ko}</p>
              <FeedbackReasonDrawer mission={mission} />
            </div>

            <div className={card}>
              <div className="text-[13px] font-semibold"><span className="mr-1.5 text-[#8899A6]">2</span>참고 표현</div>
              <p className="mt-1 text-[12px] text-muted-foreground">정답이 아니라 비교용입니다. 상황에 따라 어울리는 범위가 달라집니다.</p>
              <ul className="mt-2.5 space-y-2">
                {mission.production_task.reference_alternatives.map((a) => (
                  <li key={a.text} className="rounded-lg bg-[#FAF8F2] px-3.5 py-2.5">
                    <div className="text-[14px]">{a.text}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{a.note_ko}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-dashed border-[#B9C4CE] bg-[#F7F9FA] p-3 text-[11.5px] text-[#5B6B76]">
              답변별 자동 피드백(의미·문법 진단)은 다음 단계(feedback-lite 모듈)에서 붙습니다. 지금은 핵심 원칙과 참고 표현만 제공합니다.
            </div>

            <Button className="w-full" onClick={() => goto("revise")}>고치러 가기 →</Button>
          </div>
        )}

        {/* ── 2부 ④: 다듬기 ── */}
        {phase === "revise" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#FAD338] bg-[#FFF8DE] p-4">
              <div className="text-[12px] font-bold text-[#6B5518]">{mission.unit.learner_label}</div>
              <p className="mt-1 text-[14px]">{mission.unit.closing_ko}</p>
            </div>
            <Textarea rows={5} value={revised || draft} onChange={(e) => setRevised(e.target.value)} />
            <Button className="w-full" onClick={finish}>마치기</Button>
            {IS_DEMO && (
              <button type="button" className={demoBtn} onClick={() => setRevised(demoRevised)}>데모 채우기 — 다듬은 안 적용</button>
            )}
          </div>
        )}

        {/* ── 완료 ── */}
        {phase === "done" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#15202B] p-5 text-white">
              <div className="text-[11.5px] font-bold text-[#FAD338]">이번 미션의 핵심</div>
              <p className="mt-1.5 text-[14.5px] leading-relaxed">{mission.unit.closing_ko}</p>
            </div>

            {/* B2: 예외 반례 — "직접형=무조건 나쁨"이 아님을 완료 시 상기(counter_rule) */}
            {counterRule && (
              <div className="rounded-xl border border-dashed border-[#D8D0BC] bg-[#FFFDF4] px-4 py-3">
                <div className="text-[11.5px] font-bold text-[#6B5518]">예외 — 늘 그런 것은 아니에요</div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#5B4A1E]">{counterRule}</p>
              </div>
            )}

            {/* 수행 로그 저장 상태 — 루프 마지막 노드(실행 → 저장) */}
            <div
              className={[
                "rounded-lg px-3.5 py-2.5 text-[12.5px]",
                saveState === "saved" ? "bg-[#F2FAF6] text-[#2E7D5B]" : "bg-[#F7F9FA] text-[#5B6B76]",
              ].join(" ")}
            >
              {saveState === "saving" && "수행 기록 저장 중…"}
              {saveState === "saved" && "✓ 수행 기록이 저장되었습니다 (기록 탭에서 확인)"}
              {saveState === "demo" && "데모 모드입니다 — 실제 로그인 시 수행 기록이 저장됩니다."}
              {saveState === "error" && "수행 기록 저장에 실패했습니다. 네트워크를 확인해 주세요."}
              {saveState === "idle" && "수행 기록을 준비 중입니다."}
            </div>
            <div className={card}>
              <div className="text-[13px] font-semibold">이번에 본 알맞은 표현들</div>
              <ul className="mt-2 space-y-1.5">
                {items.map((it) => (
                  <li key={it.id} className="rounded-lg bg-[#FAF8F2] px-3.5 py-2 text-[13.5px]">
                    {it.recommended_example}
                  </li>
                ))}
              </ul>
            </div>
            <RevisionMap first={draft} final={revised || draft} featureLabel={mission.unit.learner_label} interp={isInterp} />

            {/* 보상·환기 구역 — 학습 코어와 물리적 분리. 생생 중국어(쇼츠 발췌)는 완료 후 보상 슬롯에만(UX 분리 원칙) */}
            <div className="rounded-xl border border-[#EAE4D2] border-t-[3px] border-t-[#FAD338] bg-[#FFFDF4] p-4">
              <div className="text-[12px] font-extrabold tracking-wide text-[#6B5518]">🎬 오늘의 생생 표현 · 쉬어가기</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                실제 원어민이 이 상황에서 자주 쓰는 <b>생생한 표현</b>을 여기서 가볍게 만나요. 학습 과제가 아니라 <b>보상·환기용</b>입니다.{" "}
                <span className="text-[#A9B0BA]">(유튜브 쇼츠 발췌 — 후속 구현. 이 자리는 레이아웃 예약 구역)</span>
              </p>
              <div className="mt-3 rounded-[10px] border border-dashed border-[#A9B0BA] bg-white px-3 py-5 text-center text-[12.5px] text-[#A9B0BA]">
                생생 중국어 콘텐츠 배치 예정
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={resetAll}>처음부터 다시 보기 ↺</Button>
          </div>
        )}
      </div>
    </LearnerJourneyShell>
  );
}

// ── 통역 오디오 프레임 — 듣기(≤2회) → 녹음 → STT 초안 → 전사 확인 → 제출 ──
// 실동작: speechSynthesis(원문 재생)·MediaRecorder(원본 녹음 보존)·SpeechRecognition(전사 초안).
// 미지원/거부 시 폴백 — 학습자가 전사를 직접 입력해 확인·제출할 수 있다(구인 타당성 유지).
function AudioFrame({
  sourceText,
  srcName,
  tgtName,
  ttsLang,
  sttLang,
  situation,
  relation,
  demoText,
  onSubmit,
}: {
  sourceText: string;
  srcName: string;
  tgtName: string;
  ttsLang: string;
  sttLang: string;
  situation: string;
  relation: string;
  demoText: string;
  onSubmit: (transcript: string) => void;
}) {
  const MAX_PLAYS = 2;
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const sttSupported = useMemo(
    () => typeof window !== "undefined" && !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition),
    [],
  );
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* 무시 */
      }
      try {
        recRef.current?.stop();
      } catch {
        /* 무시 */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const play = () => {
    if (plays >= MAX_PLAYS || playing) return;
    if (!ttsSupported) {
      setNotice("이 브라우저는 음성 재생(TTS)을 지원하지 않습니다 — 원문은 아래 텍스트로 확인하세요.");
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(sourceText);
      u.lang = ttsLang;
      u.onend = () => setPlaying(false);
      u.onerror = () => setPlaying(false);
      window.speechSynthesis.cancel();
      setPlaying(true);
      setPlays((n) => n + 1);
      window.speechSynthesis.speak(u);
    } catch {
      setPlaying(false);
    }
  };

  const startRec = async () => {
    setNotice(null);
    setRecorded(false);
    // ① STT 초안(가능하면)
    if (sttSupported) {
      try {
        const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const rec = new SR();
        rec.lang = sttLang;
        rec.interimResults = true;
        rec.continuous = true;
        rec.onresult = (e: any) => {
          let out = "";
          for (let i = 0; i < e.results.length; i++) out += e.results[i][0].transcript;
          setTranscript(out.trim());
        };
        rec.onerror = () => {};
        recRef.current = rec;
        rec.start();
      } catch {
        /* STT 실패 — 녹음/수동 입력으로 계속 */
      }
    }
    // ② 원본 녹음 보존
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      if (!sttSupported) setNotice("자동 전사(STT)를 지원하지 않는 브라우저입니다 — 녹음을 멈춘 뒤 전사를 직접 입력해 주세요.");
    } catch {
      // 마이크 거부/미지원 — 수동 전사 경로로 진행(구인 유지)
      setRecording(true);
      setNotice("마이크를 사용할 수 없습니다 — 통역한 내용을 아래에 직접 입력해 확인·제출할 수 있습니다.");
    }
  };

  const stopRec = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* 무시 */
    }
    try {
      mediaRef.current?.stop();
    } catch {
      /* 무시 */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
    setRecorded(true);
  };

  const canSubmit = confirmed && transcript.trim().length > 0;
  const dark = "rounded-xl bg-[#0F1B24] p-4 text-[#EAF0F4]";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-l-[3px] border-[#EAE4D2] border-l-[#15202B] bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">통역 — 듣고 옮기기</div>
        <p className="mt-1 text-[14.5px] font-semibold">{situation}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="font-normal">{relation}</Badge>
          <Badge variant="secondary" className="font-normal">음성 · 순차 통역</Badge>
        </div>
      </div>

      {/* ① 원문 듣기 */}
      <div className={dark}>
        <div className="text-[11px] font-bold text-[#FAD338]">① 원문 듣기 ({srcName}) · 최대 {MAX_PLAYS}회</div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={play}
            disabled={plays >= MAX_PLAYS || playing}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAD338] text-[18px] font-bold text-[#15202B] disabled:opacity-40"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <div>
            <div className="text-[14px]">{playing ? "재생 중…" : "원발화 재생"}</div>
            <div className="text-[12px] text-[#9FB0BC]">남은 재생 {Math.max(0, MAX_PLAYS - plays)}회 · 재생 {plays}회</div>
          </div>
        </div>

        {/* ② 통역 녹음 */}
        <div className="mt-4 text-[11px] font-bold text-[#9FB0BC]">② 통역 녹음 ({tgtName})</div>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={recording ? stopRec : startRec}
            className={[
              "rounded-lg border px-4 py-2 text-[13px] font-bold",
              recording ? "border-[#C4494A] bg-[#C4494A] text-white" : "border-[#C4494A] bg-transparent text-[#F0A3A4]",
            ].join(" ")}
          >
            {recording ? "■ 녹음 정지" : recorded ? "● 다시 녹음" : "● 녹음 시작"}
          </button>
          <span className="text-[12px] text-[#9FB0BC]">
            {recording ? "녹음 중…" : recorded ? "녹음 완료 · 아래 전사를 확인하세요" : "버튼을 누르고 통역해 말하세요"}
          </span>
        </div>

        {notice && <div className="mt-3 rounded-lg bg-[#16252F] px-3 py-2 text-[12px] leading-relaxed text-[#C6D2DB]">{notice}</div>}

        {/* ③ 전사 확인 */}
        {(recorded || notice) && (
          <div className="mt-3 rounded-lg border border-[#2A3A45] bg-[#16252F] p-3">
            <div className="text-[11px] font-bold text-[#9FB0BC]">③ 전사 확인 — 자동 전사가 맞는지 보고 고치세요 (원본 녹음은 보존)</div>
            <textarea
              rows={2}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setConfirmed(false);
              }}
              placeholder={`통역한 ${tgtName} 문장`}
              className="mt-2 w-full rounded-md border border-[#2A3A45] bg-[#0F1B24] p-2.5 text-[14.5px] leading-relaxed text-[#EAF0F4] outline-none focus:border-[#FAD338]"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => transcript.trim() && setConfirmed(true)}
                className={[
                  "rounded-md border px-3 py-1.5 text-[12px] font-semibold",
                  confirmed ? "border-[#2E7D5B] bg-[#12321F] text-[#8FE3B4]" : "border-[#2A3A45] bg-[#0F1B24] text-[#C6D2DB]",
                ].join(" ")}
              >
                {confirmed ? "✓ 확인됨" : "이 전사가 맞아요"}
              </button>
              <span className="text-[11px] text-[#9FB0BC]">전사 확인은 통역 구인 타당성 장치입니다.</span>
            </div>
          </div>
        )}
      </div>

      <Button className="w-full" disabled={!canSubmit} onClick={() => onSubmit(transcript.trim())}>
        확인한 전사로 제출 →
      </Button>
      {IS_DEMO && (
        <button
          type="button"
          className={demoBtn}
          onClick={() => {
            setPlays(MAX_PLAYS);
            setRecorded(true);
            setRecording(false);
            setTranscript(demoText);
            setConfirmed(true);
          }}
        >
          데모 채우기 — 듣기·녹음·전사 자동
        </button>
      )}
    </div>
  );
}

// ── 1부 → 2부 인계(프로토타입 v2 ②) — "1부 완료 ≠ 미션 완료" ────────────
function Handoff({
  mission,
  dir,
  isInterp,
  saved,
  onContinue,
  onSaveLater,
}: {
  mission: MissionV2;
  dir: LanguageDirection;
  isInterp: boolean;
  saved: boolean;
  onContinue: () => void;
  onSaveLater: () => void;
}) {
  const feat = getTargetFeature(mission.unit.target_feature);
  const tools =
    (dir === "zh_ko" && feat?.relevant_resources_zh_ko?.length ? feat.relevant_resources_zh_ko : feat?.relevant_resources) ?? [];
  return (
    <div className="rounded-xl border border-[#FAD338] bg-white p-5">
      <div className="text-[11px] font-bold text-[#2E7D5B]">판단 연습 완료</div>
      <h2 className="mt-0.5 text-[16px] font-bold">1부를 마쳤습니다</h2>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">방금 확인한 도구 — 문장을 외우지 말고 <b>범주</b>만 기억하세요.</p>
      {tools.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <li key={t} className="rounded-md border border-[#EAE4D2] bg-[#F5F5F2] px-2.5 py-1 text-[12.5px]">{t}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12.5px] text-muted-foreground">
        이제 <b>새로운 상황</b>에서 직접 {isInterp ? "통역" : "옮겨"} 봅니다. 많이 얹을수록 좋은 것이 아니라, 이 상대·이 부담에 맞는 만큼만.
      </p>
      {saved ? (
        <div className="mt-3.5 rounded-lg bg-[#F2FAF6] px-3.5 py-2.5 text-[12.5px] text-[#2E7D5B]">
          저장했습니다 — 다음에 들어오면 2부부터 이어집니다.
          <button type="button" onClick={onContinue} className="ml-2 underline">지금 계속하기 →</button>
        </div>
      ) : (
        <div className="mt-3.5 flex gap-2.5">
          <Button className="flex-1 bg-[#FAD338] text-[#15202B] hover:bg-[#F0C800]" onClick={onContinue}>바로 실전 적용 →</Button>
          <Button variant="outline" className="flex-1" onClick={onSaveLater}>저장하고 나중에</Button>
        </div>
      )}
      <p className="mt-2.5 text-[12px] text-muted-foreground">
        ※ <b>1부 완료 ≠ 미션 완료.</b> 2부({isInterp ? "통역" : "번역"}·피드백·다듬기)까지 마쳐야 이번 주 미션이 완료됩니다.
      </p>
    </div>
  );
}

// ── 2부 상황 확인(판단형) — 산출 전 필요한 조절 수준 1문항. 점수 없음 ──
function CtxStage({
  pt,
  isInterp,
  pick,
  done,
  onPick,
  onConfirm,
  onNext,
}: {
  pt: MissionV2["production_task"];
  isInterp: boolean;
  pick: number | null;
  done: boolean;
  onPick: (i: number) => void;
  onConfirm: () => void;
  onNext: () => void;
}) {
  const ctx = useMemo(() => deriveCtx(pt.pdr), [pt.pdr]);
  const wrong = done && pick !== ctx.right;
  return (
    <div className="space-y-3">
      <SituationCard situation={pt.situation_ko} relation={pt.relation_ko} />
      <div className={card}>
        <div className="text-[13px] font-semibold">{ctx.q}</div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {isInterp ? "통역" : "번역"} 전에 필요한 조절 수준을 한 번 짚어 봅니다. 점수는 없습니다.
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {ctx.opts.map((o, i) => (
            <Choice key={i} label={o} selected={pick === i} disabled={done} onClick={() => onPick(i)} />
          ))}
        </div>
        {done && (
          <div className="mt-3 rounded-lg bg-[#F2FAF6] px-3.5 py-3">
            <div className="text-[12px] font-bold text-[#2E7D5B]">{wrong ? "다시 짚어 보면" : "상황 핵심"}</div>
            <p className="mt-1 text-[13px] leading-relaxed">{wrong ? ctx.okWrong : ctx.okRight}</p>
          </div>
        )}
      </div>
      {done ? (
        <Button className="w-full" onClick={onNext}>{isInterp ? "통역하러" : "번역하러"} 가기 →</Button>
      ) : (
        <>
          <Button className="w-full" disabled={pick === null} onClick={onConfirm}>확인하기</Button>
          {IS_DEMO && (
            <button
              type="button"
              className={demoBtn}
              onClick={() => {
                onPick(ctx.right);
                onConfirm();
              }}
            >
              데모 채우기
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── 평가 계약 바(0-i·65) — 제출 전엔 무엇으로 판단받는지만, 정답·참고안은 제출 후 ──
function MissionContractBar({ mission }: { mission: MissionV2 }) {
  const feat = getTargetFeature(mission.unit.target_feature);
  const estMin = mission.production_task.mode === "interpreting" ? 15 : 12;
  const tgtName = tgtLangName(mission.direction);
  const isInterp = mission.production_task.mode === "interpreting";
  return (
    <div className="rounded-xl border border-[#EAE4D2] bg-[#FAF7EE] p-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Badge className="bg-[#15202B] text-white hover:bg-[#15202B]">이번 핵심 · {mission.unit.learner_label}</Badge>
        <span className="text-muted-foreground">약 {estMin}분</span>
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        완료 조건: 판단 {mission.mpj_items.length}문항 → {isInterp ? `${tgtName}로 통역` : `${tgtName}로 옮기기`} 1회 → 피드백 확인 → 다듬기 1회.
        <b className="text-foreground"> 정답·참고 표현은 제출한 뒤에 공개됩니다.</b>
      </p>
      <details className="mt-2 text-[12.5px]">
        <summary className="cursor-pointer text-[#6B5518]">무엇을 확인하나요?</summary>
        <div className="mt-2 space-y-1.5 text-muted-foreground">
          <p>확인하는 것 — ① 원문의 의미·의도가 유지됐는가 ② 의미를 방해하는 문법 오류가 있는가 ③ 이 관계·상황에서 「{mission.unit.learner_label}」이 적절한가</p>
          {feat && feat.excluded_confounds.length > 0 && (
            <p>확인하지 않는 것 — {feat.excluded_confounds.join(" · ")}</p>
          )}
        </div>
      </details>
    </div>
  );
}

// ── 피드백 근거 서랍(의견4 ③) — 판정↔상황 조건 연결. 카탈로그·상황 데이터만(AI 0회) ──
function FeedbackReasonDrawer({ mission }: { mission: MissionV2 }) {
  const feat = getTargetFeature(mission.unit.target_feature);
  const pt = mission.production_task;
  return (
    <details className="mt-2.5 text-[12.5px]">
      <summary className="cursor-pointer text-[#6B5518]">왜 이 초점인가요?</summary>
      <div className="mt-2 space-y-1.5">
        <div className="rounded-lg bg-[#FAF8F2] px-3 py-2 text-muted-foreground">
          <div>상황 · {pt.relation_ko}</div>
          <div className="mt-0.5">부담 · {PDR_R_LABEL[pt.pdr.r] ?? pt.pdr.r} / 관계 거리 · {PDR_D_LABEL[pt.pdr.d] ?? pt.pdr.d}</div>
        </div>
        {feat && <p className="text-foreground">{feat.operational_definition.split(".")[0]}.</p>}
      </div>
    </details>
  );
}

// ── 수정 지도(0-i) — 최초↔최종 + 수정 성격. 클라이언트만(AI·DB 0회) ──
function RevisionMap({ first, final, featureLabel, interp }: { first: string; final: string; featureLabel: string; interp: boolean }) {
  const changed = first.trim() !== final.trim();
  return (
    <div className={card}>
      <div className="text-[13px] font-semibold">내가 무엇을 바꿨나요?</div>
      <div className="mt-2.5 space-y-2">
        <div className="rounded-lg bg-[#F5F5F2] px-3.5 py-2.5">
          <div className="text-[11.5px] font-semibold text-muted-foreground">최초</div>
          <p className="mt-0.5 whitespace-pre-wrap text-[14px]">{first}</p>
        </div>
        <div className="rounded-lg border border-[#FAD338] bg-[#FFF8DE] px-3.5 py-2.5">
          <div className="text-[11.5px] font-semibold text-[#6B5518]">최종</div>
          <p className="mt-0.5 whitespace-pre-wrap text-[14px]">{final}</p>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        {changed
          ? `이번에 조절한 초점 · ${featureLabel}. 더 길게 고친 것이 아니라, 이 상황에 맞게 무엇을 조절했는지 확인하세요.`
          : `이번에는 최초 ${interp ? "통역" : "번역"}을 그대로 두었습니다.`}
      </p>
    </div>
  );
}

// ── 상황 카드 ───────────────────────────────────────────────────────────
// channel 폐기(2026-07-25): 매체 배지 제거. 관계(P/D/R)만 노출한다 — 매체는 상황 자연어에 녹아 있을 뿐 축이 아니다.
function SituationCard({ situation, relation }: { situation: string; relation: string }) {
  return (
    <div className="rounded-xl border-l-[3px] border-[#EAE4D2] border-l-[#15202B] bg-white p-4">
      <p className="text-[14.5px] font-semibold">{situation}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="font-normal">{relation}</Badge>
      </div>
    </div>
  );
}

// ── MPJ 한 문항 ─────────────────────────────────────────────────────────
function MpjStage({ item, onDone }: { item: MpjItemV2; onDone: () => void }) {
  const [answered, setAnswered] = useState(false);
  const [scalePick, setScalePick] = useState<string | null>(null);
  const [bandPick, setBandPick] = useState<string | null>(null);
  const [reasonPicks, setReasonPicks] = useState<Set<string>>(new Set());
  const [confidence, setConfidence] = useState<string | null>(null);
  const [fixPicks, setFixPicks] = useState<Set<number>>(new Set());
  const [multiPicks, setMultiPicks] = useState<Record<number, string>>({});

  const feature = item.axis_feature;
  const bands =
    item.type === "multi_judge"
      ? bandOptions(feature, item.candidates.flatMap((c) => c.accepted_band_codes))
      : bandOptions(feature, item.type === "judge3" || item.type === "fix_choice" || item.type === "reason_conf" ? item.accepted_band_codes : []);

  const canReveal = (() => {
    switch (item.type) {
      case "scale4":
        return !!scalePick;
      case "judge3":
        return !!bandPick;
      case "fix_choice":
        return !!bandPick && fixPicks.size > 0;
      case "reason_conf":
        return !!bandPick && reasonPicks.size > 0 && !!confidence;
      case "multi_judge":
        return Object.keys(multiPicks).length === item.candidates.length;
      default:
        return false;
    }
  })();

  const toggleReason = (id: string) =>
    setReasonPicks((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // 데모 채우기(프로토타입 v2) — 이 문항의 기준 정답으로 자동 응답 후 판정 공개.
  const demoFill = () => {
    switch (item.type) {
      case "scale4":
        setScalePick(item.accepted_scale_codes[0]);
        break;
      case "judge3":
        setBandPick(item.accepted_band_codes[0]);
        break;
      case "fix_choice":
        setBandPick(item.accepted_band_codes[0]);
        setFixPicks(new Set(item.corrections.map((c, i) => (c.is_valid ? i : -1)).filter((i) => i >= 0)));
        break;
      case "reason_conf":
        setBandPick(item.accepted_band_codes[0]);
        setReasonPicks(new Set(item.accepted_reason_ids));
        setConfidence("꽤 확신");
        break;
      case "multi_judge":
        setMultiPicks(Object.fromEntries(item.candidates.map((c, i) => [i, c.accepted_band_codes[0]])));
        break;
    }
    setAnswered(true);
  };

  return (
    <div className="space-y-3">
      {/* 대화 스킨 — 상황·선행발화 + AI 초안(내 미발송 초안 말풍선). 프로토타입 v2 */}
      <ChatScene situation={item.situation_ko} relation={item.relation_ko}>
        {item.preceding_turn && <ChatBubble side="them">{item.preceding_turn}</ChatBubble>}
        {item.type !== "multi_judge" && (
          <>
            <ChatCaption>전하려는 뜻 · {item.source}</ChatCaption>
            <ChatCaption tone="draft">↓ AI가 만든 초안 · 아직 안 보냄</ChatCaption>
            <ChatBubble side="me" variant="draft">
              {answered ? highlightZh(item.target, item.highlights) : item.target}
            </ChatBubble>
          </>
        )}
      </ChatScene>

      {/* 단일 발화 문항(scale4/judge3/fix_choice/reason_conf) — 위 대화창 AI 초안에 대한 판정(0-i·59) */}
      {item.type !== "multi_judge" && (
        <div className={card}>
          {/* scale4 */}
          {item.type === "scale4" && (
            <>
              <div className="mt-3.5 text-[13px] font-semibold">이 번역안은 이 상황에 얼마나 적절한가요?</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {SCALE4_CODES.map((code) => (
                  <Choice key={code} label={SCALE4_LABELS[code as Scale4Code]} selected={scalePick === code} disabled={answered} onClick={() => setScalePick(code)} />
                ))}
              </div>
            </>
          )}

          {/* judge3 / fix_choice / reason_conf 공통: band 판정 */}
          {item.type !== "scale4" && (
            <>
              <div className="mt-3.5 text-[13px] font-semibold">이 번역안은 이 상황에 맞나요?</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {bands.map((b) => (
                  <Choice key={b.code} label={b.label} selected={bandPick === b.code} disabled={answered} onClick={() => setBandPick(b.code)} />
                ))}
              </div>
            </>
          )}

          {/* fix_choice: 교정 복수 선택 */}
          {item.type === "fix_choice" && (
            <>
              <div className="mt-4 text-[13px] font-semibold">어떻게 고치면 좋을까요? <span className="font-normal">맞는 것을 모두 고르세요</span></div>
              <div className="mt-2 flex flex-col gap-1.5">
                {item.corrections.map((o, i) => (
                  <button
                    key={o.text}
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
                      fixPicks.has(i) ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]" : "border-[#EAE4D2] bg-white",
                      answered && o.is_valid ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    <div>{o.text}</div>
                    {answered && <div className="mt-1 text-[12px] text-muted-foreground">{o.note_ko}</div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* reason_conf: 이유 + 확신도 */}
          {item.type === "reason_conf" && bandPick && (
            <>
              <div className="mt-4 text-[13px] font-semibold">왜 그렇게 보셨나요? <span className="font-normal">맞는 것을 모두 고르세요</span></div>
              <div className="mt-2 flex flex-col gap-1.5">
                {item.reasons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={answered}
                    onClick={() => toggleReason(r.id)}
                    className={[
                      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px]",
                      reasonPicks.has(r.id) ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]" : "border-[#EAE4D2] bg-white",
                      answered && item.accepted_reason_ids.includes(r.id) ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    {r.text_ko}
                  </button>
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
                    className={["rounded-md border px-3 py-1.5 text-[12.5px]", confidence === c ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold" : "border-[#EAE4D2] bg-white"].join(" ")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          {answered && (
            <div className="mt-4 rounded-lg bg-[#F2FAF6] px-3.5 py-3">
              <div className="text-[12px] font-bold text-[#2E7D5B]">
                기준 판정 · {(item.type === "scale4" ? item.accepted_scale_codes.map((c) => SCALE4_LABELS[c as Scale4Code] ?? c) : item.accepted_band_codes.map((c) => bandLabel(feature, c))).join(" / ")}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed">{item.explanation_ko}</p>
            </div>
          )}
        </div>
      )}

      {/* multi_judge: 한 상황 다중 발화 */}
      {item.type === "multi_judge" && (
        <div className={card}>
          <div className="text-[13px] font-semibold">AI가 만든 여러 번역 초안입니다. 각각 어떤가요?</div>
          <ul className="mt-3 space-y-2.5">
            {item.candidates.map((c, i) => (
              <li key={c.text} className="rounded-lg border border-[#EAE4D2] px-3.5 py-3">
                <div className="text-[14.5px]">{c.text}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {bands.map((b) => (
                    <button
                      key={b.code}
                      type="button"
                      disabled={answered}
                      onClick={() => setMultiPicks((p) => ({ ...p, [i]: b.code }))}
                      className={[
                        "rounded-md border px-2.5 py-1 text-[12px]",
                        multiPicks[i] === b.code ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold" : "border-[#EAE4D2] bg-white text-muted-foreground",
                        answered && c.accepted_band_codes.includes(b.code) ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                      ].join(" ")}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                {answered && <div className="mt-2 text-[12.5px] text-muted-foreground">{c.note_ko}</div>}
              </li>
            ))}
          </ul>
          {answered && (
            <div className="mt-3 rounded-lg bg-[#F2FAF6] px-3.5 py-3">
              <p className="text-[13px] leading-relaxed">{item.explanation_ko}</p>
            </div>
          )}
        </div>
      )}

      {!answered ? (
        <>
          <Button className="w-full" disabled={!canReveal} onClick={() => setAnswered(true)}>확인하기</Button>
          {IS_DEMO && (
            <button type="button" className={demoBtn} onClick={demoFill}>데모 채우기 — 이 문항 자동 응답</button>
          )}
        </>
      ) : (
        <Button className="w-full" onClick={onDone}>다음 →</Button>
      )}
    </div>
  );
}

const Choice = ({ label, selected, disabled, onClick }: { label: string; selected: boolean; disabled: boolean; onClick: () => void }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={[
      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px] transition-colors",
      selected ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold" : "border-[#EAE4D2] bg-white hover:bg-[#FAFAF7]",
    ].join(" ")}
  >
    {label}
  </button>
);

export default MissionRunV1;
