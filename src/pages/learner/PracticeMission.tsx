import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { SituationBlock } from "@/components/mission/SituationBlock";
import { WeChatThread } from "@/components/mission/WeChatThread";
import {
  ReceiverPerspectiveCard,
  MappingDiagnosis,
  ContrastTriad,
  MessageXray,
} from "@/components/mission/DiscoverParts";
import { PrincipleCard } from "@/components/mission/PrincipleCard";
import {
  PRACTICE_SCENARIO,
  WECHAT_THREAD,
  RELATION_GUESS_OPTIONS,
  ONE_SPOT_FIX,
  TRANSFER_CS,
  PRACTICE_EVENT_SEQUENCE,
  DEMO_VALUES,
  CONTRAST_ADJUSTED,
} from "@/lib/mission/mockPracticeMission";
import type { PracticeMode, PracticeMissionEvent } from "@/lib/mission/mockPracticeMission";
import {
  loadPracticeSession,
  savePracticeSession,
  savePracticeSessionDebounced,
  clearPracticeSession,
  type PracticeSessionData,
} from "@/lib/mission/practiceSession";
import { markMissionCompleted, updateFeatureState } from "@/lib/mission/learnerState";
import { MISSION_ID_BY_MODE, WEEK_REQUEST, getTodayAssignment } from "@/lib/mission/mockWeek";

// 일반 미션(산출 먼저) 런타임 — UI 목업 전용, DB 미연결.
//
// 학습자에게 보이는 진행 단계와 내부 컴포넌트 수는 분리한다:
//   quick    5단계 — 상황 읽기 / 직접 해보기 / 차이 발견 / 한 곳 고치기 / 마무리
//   transfer 6단계 — 위 4단계 + 전이(CS) + 마무리
// "차이 발견" 한 단계 안에 수신자 관점·2단 진단·3종 대조·엑스레이 네 블록이 들어간다.
//
// CS는 transfer 모드에서만 렌더링하며 축을 하나만 바꾼다(상대·매체).
// 해당 문항의 참조 표현은 학습자의 최초 산출 이전에 노출하지 않는다.

const QUICK_STEPS = ["상황 읽기", "직접 해보기", "차이 발견", "한 곳 고치기", "마무리"] as const;
const TRANSFER_STEPS = [
  "상황 읽기",
  "직접 해보기",
  "차이 발견",
  "한 곳 고치기",
  "전이",
  "마무리",
] as const;

const PracticeMission = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlMode: PracticeMode = searchParams.get("mode") === "transfer" ? "transfer" : "quick";

  const [mode, setMode] = useState<PracticeMode>(urlMode);
  const [stepIdx, setStepIdx] = useState(0);

  const [relationGuess, setRelationGuess] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [situationCall, setSituationCall] = useState<string | null>(null);
  const [productionReflected, setProductionReflected] = useState<string | null>(null);
  const [contrastViewed, setContrastViewed] = useState(false);
  const [focusedDifference, setFocusedDifference] = useState<string | null>(null);
  const [revised, setRevised] = useState("");
  const [csDraft, setCsDraft] = useState("");
  const [events, setEvents] = useState<PracticeMissionEvent[]>([]);
  const [devOpen, setDevOpen] = useState(false);
  /**
   * 복원이 '반영된 렌더' 이후에만 저장한다. ref가 아니라 state인 이유:
   * ref를 복원 effect에서 동기로 세우면 같은 사이클의 저장 effect가
   * 복원 전 초기값(빈 세션)을 한 번 덮어쓴다.
   */
  const [hydrated, setHydrated] = useState(false);
  const completedRef = useRef(false);

  const missionId = MISSION_ID_BY_MODE[mode];
  const steps = mode === "transfer" ? TRANSFER_STEPS : QUICK_STEPS;
  const step = steps[stepIdx];

  const logEvent = (e: PracticeMissionEvent) =>
    setEvents((prev) => (prev.includes(e) ? prev : [...prev, e]));

  // ── 중단 지점 복귀 (일반·전이 연습 전용 — 앵커·평가에는 사용 금지) ──
  useEffect(() => {
    const saved = loadPracticeSession(missionId, mode);
    if (saved) {
      setStepIdx(Math.min(saved.stepIdx, steps.length - 1));
      setRelationGuess(saved.relationGuess);
      setDraft(saved.draft);
      setSituationCall(saved.situationCall);
      setProductionReflected(saved.productionReflected);
      setContrastViewed(saved.contrastViewed);
      setFocusedDifference(saved.focusedDifference);
      setRevised(saved.revised);
      setCsDraft(saved.csDraft);
    }
    setHydrated(true);
    // mode가 바뀌면(리셋) 다시 복원 시도
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, mode]);

  const sessionData = (): PracticeSessionData => ({
    stepIdx,
    relationGuess,
    draft,
    situationCall,
    productionReflected,
    contrastViewed,
    focusedDifference,
    revised,
    csDraft,
  });

  // 선택형 상태·단계 이동은 즉시 저장, textarea는 debounce 저장
  useEffect(() => {
    if (!hydrated || completedRef.current) return;
    if (step === "마무리") return; // 완료 시점엔 저장하지 않음 (아래에서 삭제)
    savePracticeSession(missionId, mode, sessionData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, stepIdx, relationGuess, situationCall, productionReflected, contrastViewed, focusedDifference]);

  useEffect(() => {
    if (!hydrated || completedRef.current) return;
    if (step === "마무리") return;
    savePracticeSessionDebounced(missionId, mode, sessionData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, draft, revised, csDraft]);

  useEffect(() => {
    if (step === "차이 발견") {
      logEvent("receiver_perspective_viewed");
      logEvent("xray_viewed");
    }
    if (step === "마무리") logEvent("principle_viewed");
  }, [step]);

  // ── 완료 처리: 세션 삭제 + 진행 상태 갱신 → 홈의 '오늘의 학습' 추천이 바뀐다 ──
  useEffect(() => {
    if (step !== "마무리" || completedRef.current) return;
    completedRef.current = true;
    clearPracticeSession(missionId, mode);
    // 다음 활동 커서: quick 완료 → transfer, transfer 완료 → 점검 대기(null)
    const nextActivityId = mode === "quick" ? MISSION_ID_BY_MODE.transfer : null;
    markMissionCompleted(missionId, nextActivityId);
    // 일반 미션 최초 수행 완료 → 전략지도 개방 조건 충족
    updateFeatureState(WEEK_REQUEST.featureId, { firstPerformanceCompleted: true });
    void getTodayAssignment; // (홈이 다음 렌더에서 새로 계산)
  }, [step, missionId, mode]);

  const resetMission = (nextMode: PracticeMode) => {
    clearPracticeSession(MISSION_ID_BY_MODE[nextMode], nextMode);
    completedRef.current = false;
    setMode(nextMode);
    setStepIdx(0);
    setRelationGuess(null);
    setDraft("");
    setSituationCall(null);
    setProductionReflected(null);
    setContrastViewed(false);
    setFocusedDifference(null);
    setRevised("");
    setCsDraft("");
    setEvents([]);
  };

  const canAdvance = () => {
    if (step === "상황 읽기") return relationGuess !== null;
    if (step === "직접 해보기") return draft.trim().length >= 2;
    if (step === "차이 발견") return !!situationCall && !!productionReflected && contrastViewed;
    if (step === "한 곳 고치기") return revised.trim().length >= 2;
    if (step === "전이") return csDraft.trim().length >= 2;
    return true;
  };

  const advance = () => {
    if (step === "상황 읽기") logEvent("situation_read");
    if (step === "직접 해보기") logEvent("first_translation_submitted");
    if (step === "차이 발견") logEvent("mapping_diagnosis_submitted");
    if (step === "한 곳 고치기") logEvent("one_spot_fix_submitted");
    if (step === "전이") logEvent("cs_submitted");
    setStepIdx((i) => Math.min(steps.length - 1, i + 1));
  };

  const focusContrast = (key: string) => {
    setContrastViewed(true);
    setFocusedDifference(key);
  };

  // DEV 전용 — 프로토타입 mDemo() 대응. 현재 화면에 필요한 값만 채워
  // 단계 이동 테스트를 빠르게 한다. 학습자 UI 어디에도 노출되지 않는다.
  const fillDemo = () => {
    if (step === "상황 읽기") setRelationGuess((v) => v ?? DEMO_VALUES.relationGuess);
    if (step === "직접 해보기") setDraft((v) => (v.trim() ? v : DEMO_VALUES.draft));
    if (step === "차이 발견") {
      setSituationCall((v) => v ?? DEMO_VALUES.situationCall);
      setProductionReflected((v) => v ?? DEMO_VALUES.productionReflected);
      if (!focusedDifference) focusContrast(CONTRAST_ADJUSTED.label);
    }
    if (step === "한 곳 고치기") setRevised((v) => (v.trim() ? v : DEMO_VALUES.revised));
    if (step === "전이") setCsDraft((v) => (v.trim() ? v : DEMO_VALUES.csDraft));
  };

  // ── 화면들 (컴포넌트가 아니라 함수로 호출 — 리마운트로 IME 입력이 끊기지 않게) ──

  const screenSituation = () => (
    <div className="space-y-4">
      <SituationBlock card={PRACTICE_SCENARIO.situation} tone="a" />
      <WeChatThread title={WECHAT_THREAD.title} messages={WECHAT_THREAD.messages} />
      <div className="rounded-xl border-l-[3px] border-[#EAE4D2] border-l-[#FAD338] bg-[#F5F5F2] p-4">
        <div className="text-[11.5px] font-semibold text-muted-foreground">내가 전하려는 말 (한국어)</div>
        <p className="mt-1 text-[15px]">{PRACTICE_SCENARIO.sourceText}</p>
      </div>
      <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <p className="text-[14.5px] font-semibold">
          번역하기 전에 하나만. 지금 이 상대와 나는 어떤 사이일까?
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {RELATION_GUESS_OPTIONS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setRelationGuess(o)}
              className={[
                "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px] transition-colors",
                relationGuess === o
                  ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold"
                  : "border-[#EAE4D2] bg-white hover:bg-[#FAFAF7]",
              ].join(" ")}
            >
              {o}
            </button>
          ))}
        </div>
        {relationGuess && (
          <p className="mt-2.5 text-[12.5px] font-semibold text-[#2E7D5B]">
            ✓ 좋아요 — 이 사이라면 '너무 딱딱하지도, 너무 막 던지지도 않게'가 관건이에요.
          </p>
        )}
      </div>
    </div>
  );

  const screenProduce = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[13px] font-semibold">중국어로 바꿔보세요</div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        먼저 스스로 해보는 게 핵심이에요. 참고 표현은 제출한 뒤에 함께 봅니다.
      </p>
      <div className="mt-3 rounded-lg border-l-[3px] border-[#EAE4D2] border-l-[#FAD338] bg-[#F5F5F2] p-3">
        <div className="text-[11.5px] font-semibold text-muted-foreground">한국어 원문</div>
        <p className="mt-1 text-[15px]">{PRACTICE_SCENARIO.sourceText}</p>
      </div>
      <Textarea
        className="mt-3"
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="여기에 중국어로 입력…"
      />
    </div>
  );

  const screenDiscover = () => (
    <div className="space-y-4">
      <ReceiverPerspectiveCard />
      <MappingDiagnosis
        situationCall={situationCall}
        productionReflected={productionReflected}
        onSituationCall={setSituationCall}
        onProductionReflected={setProductionReflected}
      />
      <ContrastTriad draft={draft} focusedDifference={focusedDifference} onFocus={focusContrast} />
      <MessageXray />
    </div>
  );

  const screenFix = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#FAD338] bg-[#FFF8DE] p-4">
        <div className="text-[12px] font-bold text-[#6B5518]">고칠 위치와 이유</div>
        <p className="mt-1 text-[14px]">
          <strong>{ONE_SPOT_FIX.location}</strong>에 손을 대 보세요. {ONE_SPOT_FIX.hint}
        </p>
      </div>
      <Textarea
        rows={4}
        value={revised || draft}
        onChange={(e) => setRevised(e.target.value)}
        placeholder="딱 한 군데만 고쳐보세요…"
      />
      <p className="text-[12px] text-muted-foreground">
        참고 표현을 베끼지 않아도 돼요. 당신 문장에 한 곳만.
      </p>
    </div>
  );

  const screenTransfer = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#FAD338] bg-[#FFF8DE] p-4">
        <Badge className="bg-[#FAD338] text-[#15202B] hover:bg-[#FAD338]">{TRANSFER_CS.csLabel}</Badge>
        <p className="mt-2 text-[14px]">
          바뀐 것 하나: <strong>{TRANSFER_CS.changedDimension}</strong>. 부탁 내용은 그대로예요.
        </p>
      </div>
      <SituationBlock card={TRANSFER_CS.situation} tone="b" />
      <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="text-[11.5px] font-semibold text-muted-foreground">
          같은 뜻을, 이번엔 이 상대에게
        </div>
        <p className="mt-1 text-[15px]">{PRACTICE_SCENARIO.sourceText}</p>
        <Textarea
          className="mt-3"
          rows={4}
          value={csDraft}
          onChange={(e) => setCsDraft(e.target.value)}
          placeholder="이메일로 다시 옮겨보세요…"
        />
        <p className="mt-2 text-[12px] text-muted-foreground">
          방금 다듬은 완화를, 관계·매체가 바뀌면 얼마나 조정할지 감을 시험해 보세요.
        </p>
      </div>
    </div>
  );

  const screenWrap = () => (
    <div className="space-y-4">
      <PrincipleCard />
      <p className="text-[13px] text-muted-foreground">
        이 기록은 학습 프로파일에 쌓여요. 홈에서 다음 미션을 이어가세요.
      </p>
    </div>
  );

  const SCREENS: Record<string, () => JSX.Element> = {
    "상황 읽기": screenSituation,
    "직접 해보기": screenProduce,
    "차이 발견": screenDiscover,
    "한 곳 고치기": screenFix,
    "전이": screenTransfer,
    "마무리": screenWrap,
  };

  const nextLabel =
    step === "직접 해보기"
      ? "제출하고 비교하기"
      : step === "차이 발견"
        ? "한 곳 고치러"
        : step === "한 곳 고치기" && mode === "transfer"
          ? "전이"
          : step === "한 곳 고치기"
            ? "마무리"
            : "다음";

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">{PRACTICE_SCENARIO.speechAct} · {PRACTICE_SCENARIO.channel}</span>}
    >
      {/* 학습자 진행바 — quick 5단계 / transfer 6단계 */}
      <ol className="flex gap-1.5">
        {steps.map((s, i) => {
          const active = i === stepIdx;
          const done = i < stepIdx;
          return (
            <li key={s} className="flex-1 text-center">
              <div
                className={[
                  "h-[5px] rounded-full",
                  active || done ? "bg-[#FAD338]" : "bg-[#D3D1C7]",
                ].join(" ")}
              />
              <div
                className={[
                  "mt-1.5 text-[10.5px]",
                  active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                ].join(" ")}
              >
                {s}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6">{SCREENS[step]()}</div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="outline" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
          ← 이전
        </Button>
        {step !== "마무리" ? (
          <Button onClick={advance} disabled={!canAdvance()}>
            {nextLabel} →
          </Button>
        ) : (
          <Button onClick={() => navigate("/learner/home")}>홈으로 →</Button>
        )}
      </div>

      {/* 설계 확인 패널 — 개발 환경 전용. 운영 빌드에는 포함되지 않는다. */}
      {import.meta.env.DEV && (
        <div className="mt-8 rounded-lg border border-dashed border-[#EAE4D2] bg-[#FAF7EE] p-3">
          <button
            type="button"
            onClick={() => setDevOpen((v) => !v)}
            className="text-[12px] font-medium text-muted-foreground"
          >
            {devOpen ? "▾" : "▸"} [DEV] 설계 확인 패널
          </button>
          {devOpen && (
            <div className="mt-3 space-y-2 text-[12px]">
              <div className="flex flex-wrap gap-1.5">
                {(["quick", "transfer"] as PracticeMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => resetMission(m)}
                    className={[
                      "rounded-md border px-3 py-1 text-[11px]",
                      mode === m ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#EAE4D2]",
                    ].join(" ")}
                  >
                    {m}
                  </button>
                ))}
                {step !== "마무리" && (
                  <button
                    type="button"
                    onClick={fillDemo}
                    className="rounded-md border border-dashed border-muted-foreground/40 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    데모 채우기
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRACTICE_EVENT_SEQUENCE.map((e) => (
                  <span
                    key={e}
                    className={[
                      "rounded px-2 py-0.5 font-mono text-[11px]",
                      events.includes(e) ? "bg-[#15202B] text-white" : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {e}
                  </span>
                ))}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                mode: {mode} · 진행바: {steps.length}단계 · CS 렌더:{" "}
                {mode === "transfer" ? "예" : "아니오"} · contrastViewed: {String(contrastViewed)} ·
                내부 P·D·R(비노출): P {PRACTICE_SCENARIO.situation.internalPdr.p} / D{" "}
                {PRACTICE_SCENARIO.situation.internalPdr.d} / R {PRACTICE_SCENARIO.situation.internalPdr.r}
              </div>
            </div>
          )}
        </div>
      )}
    </LearnerJourneyShell>
  );
};

export default PracticeMission;
