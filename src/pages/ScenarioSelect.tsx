import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer } from "@/lib/learningSessions";
import { isDemoMode } from "@/lib/demo";
import { toast } from "sonner";
import { PageTitle } from "@/components/PageTitle";
import { Volume2, Loader2 } from "lucide-react";
import { requestTtsAudio } from "@/lib/tts";
import { supabase } from "@/integrations/supabase/client";
import { setSelectedScenarioId } from "@/lib/entryGate";

type DbScenario = {
  scenario_id: string;
  title: string | null;
  speech_act: string | null;
  speech_act_text: string | null;
  industry_sector: string | null;
  domain: string | null;
  source_text: string | null;
  week_no: number | null;
  language_direction: string | null;
  scenario_p: string | null;
  scenario_d: string | null;
  scenario_r: string | null;
  pragmatic_challenge: string[] | null;
  challenge_intensity: string | null;
  hsk_level_min: number | null;
};

type ActId = "request" | "refusal";
const ACT_STORAGE_KEY = "step1-speech-act";
const STEP1_ANSWERS_KEY = "step1-answers";
const BODY_OPEN_KEY = "step1-body-open";
const SELECTED_SCENARIO_KEY = "step1-scenario-id";

const ACTS: { id: ActId; title: string; desc: string }[] = [
  { id: "request", title: "요청 상황", desc: "상대에게 무언가를 요청하는 상황" },
  { id: "refusal", title: "거절 상황", desc: "상대의 요청을 거절해야 하는 상황" },
];

const QUESTIONS: { id: "q1" | "q2" | "q3"; label: string; options: string[] }[] = [
  {
    id: "q1",
    label: "1. 이 상황에서 상대방은 나와 비교해 어떤 위치에 있다고 느껴지나요?",
    options: [
      "상대가 나보다 더 큰 결정권이나 영향력을 가진다",
      "상대와 나는 비슷한 위치에 있다",
      "상대는 나보다 결정권이나 영향력이 작다",
    ],
  },
  {
    id: "q2",
    label: "2. 상대방과의 관계는 얼마나 가깝거나 멀다고 느껴지나요?",
    options: [
      "처음이거나 매우 격식 있는 관계이다",
      "업무상 몇 차례 소통했지만 친밀하지는 않다",
      "자주 소통하고 비교적 가까운 관계이다",
    ],
  },
  {
    id: "q3",
    label: "3. 이 요청 또는 거절은 상대방에게 어느 정도 부담이 된다고 느껴지나요?",
    options: [
      "상대의 일정, 비용, 계획에 큰 영향을 줄 수 있다",
      "어느 정도 조정이 필요하지만 감당 가능한 수준이다",
      "부담이 크지 않은 간단한 요청 또는 거절이다",
    ],
  },
];

type Answers = { q1: number | null; q2: number | null; q3: number | null };
const EMPTY: Answers = { q1: null, q2: null, q3: null };

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
    {children}
  </div>
);

const DIRECTION_LABEL: Record<string, string> = {
  ko_to_zh: "한 → 중",
  zh_to_ko: "중 → 한",
};

const ScenarioSelect = () => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [selected, setSelected] = useState<ActId | null>(null);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [bodyOpen, setBodyOpen] = useState<boolean>(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [ttsError, setTtsError] = useState<{ cardKey: string; msg: string } | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [dbScenarios, setDbScenarios] = useState<DbScenario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("scenarios")
        .select(
          "scenario_id,title,speech_act,speech_act_text,industry_sector,domain,source_text,week_no,language_direction,scenario_p,scenario_d,scenario_r,pragmatic_challenge,challenge_intensity,hsk_level_min",
        )
        .eq("review_status", "approved")
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (!error && data) setDbScenarios(data as DbScenario[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cleanupAudio = () => {
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioEl(null);
  };

  const playTTS = async (cardKey: string, buttonKey: string, text: string, lang: "ko" | "zh") => {
    setTtsError(null);
    cleanupAudio();
    setPlaying(buttonKey);
    try {
      const result = await requestTtsAudio({ text, lang, logPrefix: "[TTS Step1]" });
      if (result.ok === false) {
        setTtsError({ cardKey, msg: result.message || "음성 생성에 실패했습니다. 다시 시도해 주세요." });
        return;
      }
      const url = URL.createObjectURL(result.blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      setAudioEl(audio);
      audio.onended = () => {
        if (audioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          audioUrlRef.current = null;
        }
        setAudioEl(null);
      };
      audio.onerror = () => {
        if (audioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          audioUrlRef.current = null;
        }
        setAudioEl(null);
        setTtsError({ cardKey, msg: "음성 재생에 실패했습니다. 다시 시도해 주세요." });
      };
      await audio.play().catch(() => {
        setTtsError({ cardKey, msg: "음성 재생에 실패했습니다. 다시 시도해 주세요." });
      });
    } catch (e) {
      setTtsError({ cardKey, msg: (e as Error).message || "음성 생성에 실패했습니다." });
    } finally {
      setPlaying(null);
    }
  };

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/scenario" }, "/scenario");
    try {
      const saved = localStorage.getItem(ACT_STORAGE_KEY);
      if (saved === "request" || saved === "refusal") setSelected(saved);
      const sid = localStorage.getItem(SELECTED_SCENARIO_KEY);
      if (sid) setSelectedIdState(sid);
      const a = localStorage.getItem(STEP1_ANSWERS_KEY);
      if (a) {
        const parsed = JSON.parse(a) as Partial<Answers>;
        setAnswers({
          q1: typeof parsed.q1 === "number" ? parsed.q1 : null,
          q2: typeof parsed.q2 === "number" ? parsed.q2 : null,
          q3: typeof parsed.q3 === "number" ? parsed.q3 : null,
        });
      }
      const b = localStorage.getItem(BODY_OPEN_KEY);
      if (b === "1") setBodyOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useStageTimer(1);

  useEffect(() => {
    return () => {
      if (audioEl) audioEl.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [audioEl]);

  const scenariosForAct = useMemo(
    () => (selected ? dbScenarios.filter((s) => s.speech_act === selected) : []),
    [dbScenarios, selected],
  );

  const activeScenario = useMemo(
    () => scenariosForAct.find((s) => s.scenario_id === selectedId) ?? null,
    [scenariosForAct, selectedId],
  );

  const handleSelectAct = (id: ActId) => {
    if (demo) return;
    if (selected === id) return;
    logAction(selected ? "revision" : "selection", {
      field: "speechAct",
      ...(selected ? { oldValue: selected, newValue: id } : { value: id }),
    });
    setSelected(id);
    setSelectedIdState(null);
    setSelectedScenarioId(null);
    setAnswers(EMPTY);
    setBodyOpen(false);
    try {
      localStorage.setItem(ACT_STORAGE_KEY, id);
      localStorage.removeItem(SELECTED_SCENARIO_KEY);
      localStorage.setItem(STEP1_ANSWERS_KEY, JSON.stringify(EMPTY));
      localStorage.setItem(BODY_OPEN_KEY, "0");
    } catch {
      /* ignore */
    }
  };

  const handlePickScenario = (s: DbScenario) => {
    if (demo) {
      toast("데모 모드에서는 미리보기만 가능합니다.");
      return;
    }
    setSelectedIdState(s.scenario_id);
    setSelectedScenarioId(s.scenario_id);
    setBodyOpen(true);
    try {
      localStorage.setItem(SELECTED_SCENARIO_KEY, s.scenario_id);
      localStorage.setItem(BODY_OPEN_KEY, "1");
    } catch {
      /* ignore */
    }
    logAction("selection", { field: "scenarioId", value: s.scenario_id });
  };

  const setAnswer = (q: "q1" | "q2" | "q3", idx: number) => {
    if (demo) return;
    setAnswers((prev) => {
      const next = { ...prev, [q]: idx };
      try {
        localStorage.setItem(STEP1_ANSWERS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    logAction("selection", { field: q, value: idx });
  };

  const allAnswered = answers.q1 !== null && answers.q2 !== null && answers.q3 !== null;
  const canProceed = demo || (Boolean(selected) && Boolean(activeScenario) && bodyOpen && allAnswered);

  const keyInfoRows = activeScenario
    ? [
        activeScenario.industry_sector && { label: "업종", value: activeScenario.industry_sector },
        activeScenario.domain && { label: "도메인", value: activeScenario.domain },
        activeScenario.language_direction && {
          label: "언어 방향",
          value: DIRECTION_LABEL[activeScenario.language_direction] ?? activeScenario.language_direction,
        },
        activeScenario.speech_act_text && { label: "화행 설명", value: activeScenario.speech_act_text },
        activeScenario.scenario_p && { label: "P (권력관계)", value: activeScenario.scenario_p },
        activeScenario.scenario_d && { label: "D (사회적 거리)", value: activeScenario.scenario_d },
        activeScenario.scenario_r && { label: "R (부담도)", value: activeScenario.scenario_r },
        activeScenario.challenge_intensity && { label: "난이도", value: activeScenario.challenge_intensity },
        activeScenario.hsk_level_min != null && { label: "권장 HSK", value: String(activeScenario.hsk_level_min) },
      ].filter(Boolean) as { label: string; value: string }[]
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={1} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTitle title="발화 상황 판단" />
        <p className="mt-2 text-sm text-muted-foreground">
          오늘 연습할 상황을 고르고, 이 상황을 어떻게 느꼈는지 알려주세요.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ACTS.map((act) => {
            const isSel = selected === act.id;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => handleSelectAct(act.id)}
                aria-pressed={isSel}
                aria-expanded={isSel}
                disabled={demo}
                className={[
                  "rounded-lg p-6 text-left transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  isSel
                    ? "border-2 border-[#15202B] bg-[#FFFFFF] text-[#15202B] font-bold"
                    : "border border-foreground bg-background hover:-translate-y-0.5 hover:shadow-md",
                  demo ? "cursor-default" : "",
                ].join(" ")}
              >
                <div className="text-xl font-bold">{act.title}</div>
                <div className="mt-2 text-sm text-foreground">{act.desc}</div>
              </button>
            );
          })}
        </div>

        {selected && (
          <section key={selected} className="fade-in mt-6 space-y-6">
            <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6">
              <SectionLabel>상황 설정 라이브러리</SectionLabel>
              <p className="text-sm leading-relaxed text-muted-foreground">
                관리자 아카이브에서 등록·승인된 시나리오 중 하나를 선택하면 아래에 상세가 표시됩니다.
              </p>

              {loading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 시나리오 불러오는 중…
                </div>
              ) : scenariosForAct.length === 0 ? (
                <div className="mt-4 rounded-md border-[0.5px] border-[#D3D1C7] bg-[#FAF8F2] p-4 text-sm text-muted-foreground">
                  아직 등록된 승인 시나리오가 없습니다. 관리자 아카이브에서 시나리오를 추가하고 검수 상태를 <b>approved</b>로 바꿔주세요.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {scenariosForAct.map((s) => {
                    const isPicked = selectedId === s.scenario_id;
                    return (
                      <button
                        key={s.scenario_id}
                        type="button"
                        onClick={() => handlePickScenario(s)}
                        className={[
                          "flex flex-col gap-2 rounded-lg p-4 text-left transition-all duration-200",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                          isPicked
                            ? "border-[1.5px] border-[#15202B] bg-[#FFFFFF] shadow-sm"
                            : "border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] hover:-translate-y-0.5 hover:shadow-md",
                        ].join(" ")}
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {s.industry_sector ?? "미지정"}
                          {s.week_no != null ? ` · Week ${s.week_no}` : ""}
                        </span>
                        <span className="text-[15px] font-semibold leading-snug text-[#15202B]">
                          {s.title ?? "(제목 없음)"}
                        </span>
                        {s.source_text && (
                          <span className="text-xs leading-relaxed text-foreground/80 line-clamp-3">
                            {s.source_text}
                          </span>
                        )}
                        <span
                          className={[
                            "mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                            isPicked
                              ? "bg-[#FAD338] text-[#15202B]"
                              : "border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] text-[#5C6A7A]",
                          ].join(" ")}
                        >
                          {isPicked ? "선택됨" : "선택하기"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {activeScenario && (demo || bodyOpen) && (
              <>
                {keyInfoRows.length > 0 && (
                  <div className="rounded-lg border border-foreground/30 bg-background p-6">
                    <SectionLabel>핵심 정보</SectionLabel>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {keyInfoRows.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                          <span className="text-sm font-semibold text-foreground">{item.value}</span>
                        </div>
                      ))}
                      {activeScenario.pragmatic_challenge && activeScenario.pragmatic_challenge.length > 0 && (
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <span className="text-xs font-medium text-muted-foreground">화용적 난점</span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeScenario.pragmatic_challenge.map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-full border-[0.5px] border-[#D3D1C7] bg-[#FAF8F2] px-2 py-0.5 text-[11px] font-medium text-[#15202B]"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeScenario.source_text && (
                  <div className="rounded-xl border-[0.5px] border-[#D3D1C7] border-l-[4px] border-l-[#15202B] bg-[#FFFFFF] p-7 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
                        번역해야 할 원문 (출발어)
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="원문 듣기"
                        onClick={(e) => {
                          e.stopPropagation();
                          const lang =
                            activeScenario.language_direction === "zh_to_ko" ? "zh" : "ko";
                          const key = `source-${activeScenario.scenario_id}`;
                          if (playing !== key) playTTS(key, key, activeScenario.source_text!, lang);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] px-2 py-0.5 text-[11px] font-medium text-[#15202B] hover:bg-[#FAF8F2]"
                      >
                        {playing === `source-${activeScenario.scenario_id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                        듣기
                      </span>
                    </div>
                    <p className="text-[19px] font-semibold leading-relaxed text-[#15202B]">
                      {activeScenario.source_text}
                    </p>
                    {ttsError?.cardKey === `source-${activeScenario.scenario_id}` && (
                      <p className="mt-2 text-[12px] text-[#B91C1C]">{ttsError.msg}</p>
                    )}
                  </div>
                )}

                <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6">
                  <SectionLabel>상황을 읽고, 본인이 느낀 그대로 골라주세요</SectionLabel>
                  <div className="mt-2 space-y-6">
                    {QUESTIONS.map((q) => (
                      <fieldset key={q.id}>
                        <legend className="text-sm font-semibold text-foreground">{q.label}</legend>
                        <div className="mt-3 space-y-2">
                          {q.options.map((opt, idx) => {
                            const checked = answers[q.id] === idx;
                            return (
                              <label
                                key={idx}
                                className={[
                                  "flex cursor-pointer items-start gap-3 rounded-md p-3 text-sm transition-colors text-[#15202B]",
                                  checked
                                    ? "border-[1.5px] border-[#15202B] bg-[#EEF2F7] font-medium"
                                    : "border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] font-normal hover:bg-muted/30",
                                ].join(" ")}
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  className="mt-0.5 h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-[#B4B2A9] bg-white checked:border-[#15202B] checked:bg-[radial-gradient(circle,_#FAD338_0_3.5px,_transparent_3.5px)]"
                                  checked={checked}
                                  disabled={demo}
                                  onChange={() => setAnswer(q.id, idx)}
                                />
                                <span className="leading-snug">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  <p className="mt-5 text-xs text-muted-foreground">
                    정답이 있는 질문이 아닙니다. 본인이 상황을 어떻게 받아들였는지 그대로 골라주세요.
                  </p>
                </div>
              </>
            )}
          </section>
        )}

        <div className="mt-12 flex justify-end border-t border-border pt-6">
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => canProceed && navigate("/pdr")}
            className={[
              "rounded-lg px-6 py-3 text-base font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              canProceed
                ? "bg-[#FAD338] text-[#15202B] hover:bg-[#E8B91F]"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            ].join(" ")}
          >
            번역안 비교하기 →
          </button>
        </div>
      </main>
    </div>
  );
};

export default ScenarioSelect;
