import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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

// 샘플은 v1 → 정규화해 v2로 구동(러너는 정규화 형태만 본다, 0-l·84).
const SAMPLE_MISSION_V2 = normalizeMission(SAMPLE_MISSION_V1).data as MissionV2;

// 방향별 언어 이름 라벨(0-l·85).
const LANG_NAME: Record<"ko" | "zh", string> = { ko: "한국어", zh: "중국어" };
const srcLangName = (dir: LanguageDirection) => LANG_NAME[DIRECTION_LANGS[dir].source];
const tgtLangName = (dir: LanguageDirection) => LANG_NAME[DIRECTION_LANGS[dir].target];

// 학습자 미션 실행 — 계약 스키마 mission_v1을 직접 구동한다(프로토타입 대체).
//   ① 감각 쌓기(MPJ 5) → ② 적용(DCT 산출 1회) → ③ 피드백 → ④ 수정
// 판정은 초점별 band 카탈로그(targetFeatures) 기준. 답별 AI 피드백은 후속(feedback-lite)이라
// ③은 참고 표현·핵심 원칙만 보여준다(정직 표기).

const STEPS = ["감각 쌓기", "적용", "피드백", "수정"] as const;
const CONFIDENCE = ["매우 확신", "꽤 확신", "확신 없음"] as const;

// B1(계약 0-g·44·0-e·⑨): 판정 대역은 proposed(확정 정답 아님). 학습자에게
// 지위를 정직하게 — 유일 정답이 아니라 현재 수업 기준·AI 제안임을 판정 노출 지점에 캡션.
const JUDGMENT_STATUS_CAPTION = "현재 수업 기준 · AI 제안(검증 예정)이며 다른 적절한 표현도 있을 수 있어요";

// PDR 학습자 라벨(근거 서랍용 — 내부 코드 노출 금지)
const PDR_R_LABEL: Record<string, string> = { low: "가벼운 부탁", mid: "보통", high: "부담이 큼" };
const PDR_D_LABEL: Record<string, string> = { close: "가까운 사이", acquaintance: "아는 사이", distant: "처음/먼 사이" };

const card = "rounded-xl border border-[#EAE4D2] bg-white p-4";
const srcBox = "rounded-lg border-l-[3px] border-[#EAE4D2] border-l-[#FAD338] bg-[#F5F5F2] p-3";

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

// ── 페이지: 라우트 파라미터로 DB 조회, 없으면 샘플 ──────────────────────
const MissionRunV1 = () => {
  const { scenarioId } = useParams();
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

  const mission = loaded?.mission ?? SAMPLE_MISSION_V2;
  const isSample = !loaded;
  const headerRight = loaded
    ? `${loaded.speech_act ? SPEECH_ACT_UI[loaded.speech_act] : ""} · ${loaded.learner_level ? LEVEL[loaded.learner_level] : ""}`
    : "샘플 미션";

  return (
    <MissionRunner
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
  const [stepIdx, setStepIdx] = useState(0);
  const [mpjIdx, setMpjIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [revised, setRevised] = useState("");
  const [done, setDone] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "demo" | "error">("idle");
  const startedAtRef = useRef<string>(new Date().toISOString());

  const step = STEPS[stepIdx];
  const items = mission.mpj_items;
  const item = items[mpjIdx];
  const dir = mission.direction;
  const tgtName = tgtLangName(dir);
  const srcName = srcLangName(dir);
  // B2(계약 0-k): counter_rule 반례를 완료 화면에 노출 — "직접형=무조건 나쁨" 오학습 방지.
  const feat = getTargetFeature(mission.unit.target_feature);
  const counterRule =
    dir === "zh_ko" && feat?.counter_rule_note_zh_ko ? feat.counter_rule_note_zh_ko : feat?.counter_rule_note;

  // 미션 완료 = 수행 로그 저장(루프 마지막 노드). 데모 스텁은 저장 불가 → 안내만.
  const finish = async () => {
    setDone(true);
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
    if (res.ok) setSaveState("saved");
    else setSaveState((res as { reason?: string }).reason === "no_auth" ? "demo" : "error");
  };

  const nextMpj = () => {
    if (mpjIdx < items.length - 1) setMpjIdx((i) => i + 1);
    else setStepIdx(1);
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

        {/* 진행바 */}
        <ol className="mb-4 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-1.5">
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  i < stepIdx ? "bg-[#15202B] text-white" : i === stepIdx ? "bg-[#FAD338] text-[#15202B]" : "bg-[#EAE4D2] text-[#8A8272]",
                ].join(" ")}
              >
                {i + 1}
              </span>
              <span className={["text-[12px]", i === stepIdx ? "font-semibold text-foreground" : "text-muted-foreground"].join(" ")}>
                {s}
              </span>
            </li>
          ))}
        </ol>

        {/* ── ① 감각 쌓기 ── */}
        {step === "감각 쌓기" && (
          <div className="space-y-3">
            {mpjIdx === 0 && <MissionContractBar mission={mission} />}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className="font-normal">이번 핵심 · {mission.unit.learner_label}</Badge>
              <span className="text-[12px] text-muted-foreground">{mpjIdx + 1} / {items.length}</span>
            </div>
            <MpjStage key={item.id} item={item} onDone={nextMpj} />
          </div>
        )}

        {/* ── ② 적용(DCT) ── */}
        {step === "적용" && (
          <div className="space-y-3">
            <SituationCard
              situation={mission.production_task.situation_ko}
              relation={mission.production_task.relation_ko}
            />
            <div className={card}>
              <div className="text-[13px] font-semibold">
                {mission.production_task.mode === "interpreting" ? `${tgtName}로 통역해 보세요` : `${tgtName}로 옮겨 보세요`}
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                방금 판단해 본 감각을 <b>새로운 상황</b>에 적용하는 단계입니다. 참고 표현은 제출한 뒤에 함께 봅니다.
              </p>
              <div className={`mt-3 ${srcBox}`}>
                <div className="text-[11.5px] font-semibold text-muted-foreground">{srcName} 원문</div>
                <p className="mt-1 text-[14.5px]">{mission.production_task.source_text}</p>
              </div>
              <Textarea className="mt-3" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`여기에 ${tgtName}로 입력…`} />
            </div>
            <Button className="w-full" disabled={!draft.trim()} onClick={() => setStepIdx(2)}>적용하기 →</Button>
          </div>
        )}

        {/* ── ③ 피드백 ── */}
        {step === "피드백" && (
          <div className="space-y-3">
            <div className={card}>
              <div className="text-[11.5px] font-semibold text-muted-foreground">내 번역</div>
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

            <Button className="w-full" onClick={() => setStepIdx(3)}>고치러 가기 →</Button>
          </div>
        )}

        {/* ── ④ 수정 ── */}
        {step === "수정" && !done && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#FAD338] bg-[#FFF8DE] p-4">
              <div className="text-[12px] font-bold text-[#6B5518]">{mission.unit.learner_label}</div>
              <p className="mt-1 text-[14px]">{mission.unit.closing_ko}</p>
            </div>
            <Textarea rows={5} value={revised || draft} onChange={(e) => setRevised(e.target.value)} />
            <Button className="w-full" onClick={finish}>마치기</Button>
          </div>
        )}

        {/* ── 완료 ── */}
        {done && (
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
            <RevisionMap
              first={draft}
              final={revised || draft}
              featureLabel={mission.unit.learner_label}
            />
          </div>
        )}
      </div>
    </LearnerJourneyShell>
  );
}

// ── 평가 계약 바(0-i·65) — 제출 전엔 무엇으로 판단받는지만, 정답·참고안은 제출 후 ──
function MissionContractBar({ mission }: { mission: MissionV2 }) {
  const feat = getTargetFeature(mission.unit.target_feature);
  const estMin = mission.production_task.mode === "interpreting" ? 15 : 12;
  const tgtName = tgtLangName(mission.direction);
  return (
    <div className="rounded-xl border border-[#EAE4D2] bg-[#FAF7EE] p-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Badge className="bg-[#15202B] text-white hover:bg-[#15202B]">이번 핵심 · {mission.unit.learner_label}</Badge>
        <span className="text-muted-foreground">약 {estMin}분</span>
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        완료 조건: 판단 5문항 → {tgtName}로 옮기기 1회 → 피드백 확인 → 다듬기 1회.
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
function RevisionMap({ first, final, featureLabel }: { first: string; final: string; featureLabel: string }) {
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
          : "이번에는 최초 번역을 그대로 두었습니다."}
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

  return (
    <div className="space-y-3">
      <SituationCard situation={item.situation_ko} relation={item.relation_ko} />

      <div className={srcBox}>
        <div className="text-[11.5px] font-semibold text-muted-foreground">원문</div>
        <p className="mt-1 text-[14.5px]">{item.source}</p>
      </div>

      {/* 단일 발화 문항(scale4/judge3/fix_choice/reason_conf) — AI 초안 검수 프레임(0-i·59) */}
      {item.type !== "multi_judge" && (
        <div className={card}>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted-foreground">AI가 제안한 번역 초안</span>
            <span className="rounded bg-[#EEF2F6] px-1.5 py-0.5 text-[10.5px] font-medium text-[#5B6B76]">발송 전 검수</span>
          </div>
          <p className="mt-1 text-[15px] leading-relaxed">{item.target}</p>
          {item.highlights.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.highlights.map((h) => (
                <span key={h} className="rounded bg-[#FFF3C4] px-1.5 py-0.5 text-[12px]">{h}</span>
              ))}
            </div>
          )}

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
              <p className="mt-1.5 text-[11px] text-[#5B6B76]">{JUDGMENT_STATUS_CAPTION}</p>
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
              <p className="mt-1.5 text-[11px] text-[#5B6B76]">{JUDGMENT_STATUS_CAPTION}</p>
            </div>
          )}
        </div>
      )}

      {!answered ? (
        <Button className="w-full" disabled={!canReveal} onClick={() => setAnswered(true)}>확인하기</Button>
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
