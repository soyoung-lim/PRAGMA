import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { SPEECH_ACT_UI, LEVEL, type ChannelUI } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { SCALE4_CODES, SCALE4_LABELS, type Scale4Code } from "@/lib/pragma/targetFeatures";
import type { MissionV1, MpjItem } from "@/lib/pragma/missionSchema";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { fetchMissionByScenario, type RunnableMission } from "@/lib/mission/missionDb";

// 학습자 미션 실행 — 계약 스키마 mission_v1을 직접 구동한다(프로토타입 대체).
//   ① 감각 쌓기(MPJ 5) → ② 적용(DCT 산출 1회) → ③ 피드백 → ④ 수정
// 판정은 초점별 band 카탈로그(targetFeatures) 기준. 답별 AI 피드백은 후속(feedback-lite)이라
// ③은 참고 표현·핵심 원칙만 보여준다(정직 표기).

const STEPS = ["감각 쌓기", "적용", "피드백", "수정"] as const;
const CONFIDENCE = ["매우 확신", "꽤 확신", "확신 없음"] as const;

const CHANNEL_LABEL: Record<ChannelUI, string> = {
  email: "이메일",
  messenger: "메신저",
  facetoface: "대면",
  phone: "전화",
};

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

  const mission = loaded?.mission ?? SAMPLE_MISSION_V1;
  const isSample = !loaded;
  const headerRight = loaded
    ? `${loaded.speech_act ? SPEECH_ACT_UI[loaded.speech_act] : ""} · ${loaded.learner_level ? LEVEL[loaded.learner_level] : ""}`
    : "샘플 미션";

  return <MissionRunner mission={mission} isSample={isSample} headerRight={headerRight} status={loaded?.mission_status ?? null} />;
};

// ── 러너 본체 ───────────────────────────────────────────────────────────
function MissionRunner({
  mission,
  isSample,
  headerRight,
  status,
}: {
  mission: MissionV1;
  isSample: boolean;
  headerRight: string;
  status: string | null;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [mpjIdx, setMpjIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [revised, setRevised] = useState("");
  const [done, setDone] = useState(false);

  const step = STEPS[stepIdx];
  const items = mission.mpj_items;
  const item = items[mpjIdx];

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
              channel={mission.production_task.channel as ChannelUI}
            />
            <div className={card}>
              <div className="text-[13px] font-semibold">
                {mission.production_task.mode === "interpreting" ? "중국어로 통역해 보세요" : "중국어로 옮겨 보세요"}
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                방금 판단해 본 감각을 <b>새로운 상황</b>에 적용하는 단계입니다. 참고 표현은 제출한 뒤에 함께 봅니다.
              </p>
              <div className={`mt-3 ${srcBox}`}>
                <div className="text-[11.5px] font-semibold text-muted-foreground">한국어 원문</div>
                <p className="mt-1 text-[14.5px]">{mission.production_task.source_text_ko}</p>
              </div>
              <Textarea className="mt-3" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="여기에 중국어로 입력…" />
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
            </div>

            <div className={card}>
              <div className="text-[13px] font-semibold"><span className="mr-1.5 text-[#8899A6]">2</span>참고 표현</div>
              <p className="mt-1 text-[12px] text-muted-foreground">정답이 아니라 비교용입니다. 상황에 따라 어울리는 범위가 달라집니다.</p>
              <ul className="mt-2.5 space-y-2">
                {mission.production_task.reference_alternatives.map((a) => (
                  <li key={a.zh} className="rounded-lg bg-[#FAF8F2] px-3.5 py-2.5">
                    <div className="text-[14px]">{a.zh}</div>
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
            <Button className="w-full" onClick={() => setDone(true)}>마치기</Button>
          </div>
        )}

        {/* ── 완료 ── */}
        {done && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#15202B] p-5 text-white">
              <div className="text-[11.5px] font-bold text-[#FAD338]">이번 미션의 핵심</div>
              <p className="mt-1.5 text-[14.5px] leading-relaxed">{mission.unit.closing_ko}</p>
            </div>
            <div className={card}>
              <div className="text-[13px] font-semibold">이번에 본 알맞은 표현들</div>
              <ul className="mt-2 space-y-1.5">
                {items.map((it) => (
                  <li key={it.id} className="rounded-lg bg-[#FAF8F2] px-3.5 py-2 text-[13.5px]">
                    {it.recommended_example_zh}
                  </li>
                ))}
              </ul>
            </div>
            <div className={card}>
              <div className="text-[11.5px] font-semibold text-muted-foreground">내 최종 번역</div>
              <p className="mt-1 whitespace-pre-wrap text-[14.5px]">{revised || draft}</p>
            </div>
          </div>
        )}
      </div>
    </LearnerJourneyShell>
  );
}

// ── 상황 카드 ───────────────────────────────────────────────────────────
function SituationCard({ situation, relation, channel }: { situation: string; relation: string; channel: ChannelUI }) {
  return (
    <div className="rounded-xl border-l-[3px] border-[#EAE4D2] border-l-[#15202B] bg-white p-4">
      <p className="text-[14.5px] font-semibold">{situation}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="font-normal">{relation}</Badge>
        <Badge variant="secondary" className="font-normal">{CHANNEL_LABEL[channel] ?? channel}</Badge>
      </div>
    </div>
  );
}

// ── MPJ 한 문항 ─────────────────────────────────────────────────────────
function MpjStage({ item, onDone }: { item: MpjItem; onDone: () => void }) {
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
      <SituationCard situation={item.situation_ko} relation={item.relation_ko} channel={item.channel as ChannelUI} />

      <div className={srcBox}>
        <div className="text-[11.5px] font-semibold text-muted-foreground">한국어 원문</div>
        <p className="mt-1 text-[14.5px]">{item.source_ko}</p>
      </div>

      {/* 단일 발화 문항(scale4/judge3/fix_choice/reason_conf) */}
      {item.type !== "multi_judge" && (
        <div className={card}>
          <div className="text-[11.5px] font-semibold text-muted-foreground">중국어 번역안</div>
          <p className="mt-1 text-[15px] leading-relaxed">{item.target_zh}</p>
          {item.highlights_zh.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.highlights_zh.map((h) => (
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
                      fixPicks.has(i) ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]" : "border-[#EAE4D2] bg-white",
                      answered && o.is_valid ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    <div>{o.zh}</div>
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
          <div className="text-[13px] font-semibold">같은 원문을 옮긴 번역안들입니다. 각각 어떤가요?</div>
          <ul className="mt-3 space-y-2.5">
            {item.candidates.map((c, i) => (
              <li key={c.zh} className="rounded-lg border border-[#EAE4D2] px-3.5 py-3">
                <div className="text-[14.5px]">{c.zh}</div>
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
          {answered && <p className="mt-3 rounded-lg bg-[#F2FAF6] px-3.5 py-3 text-[13px] leading-relaxed">{item.explanation_ko}</p>}
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
