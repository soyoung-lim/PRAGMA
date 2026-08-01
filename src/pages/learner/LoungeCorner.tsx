import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  DECODER_MOCK_ITEMS,
  LOUNGE_CORNERS,
  MEME_ITEMS,
  THEATER_ITEMS,
  type LoungeCornerId,
} from "@/lib/lounge/mockLounge";

// 라운지 코너 공통 문법 — 한 화면에 한 장면, 결과는 같은 자리에서 교체,
// 장면 사이는 좌우 넘김, 라운지 복귀는 항상 왼쪽 위 같은 자리.
// 선택 후 아래로 블록을 계속 붙이면 다시 과제 화면처럼 길어진다. 선택지가 있던
// 자리를 결과가 대신 차지해, 선택 전과 후 모두 한 화면을 유지한다.

// 라운지 안 전용 길찾기 — 홈으로 돌아가지 않고도 코너를 바꿀 수 있고,
// 「라운지 홈」 복귀가 항상 같은 자리에 보인다.
const CornerDock = ({ current }: { current: LoungeCornerId }) => (
  <div className="mb-2.5 flex flex-wrap items-center gap-2">
    <Link
      to="/learner/lounge"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#15202B] bg-white px-3 py-1.5 text-[12px] font-bold text-[#15202B] transition-colors hover:bg-[#F7F4EA]"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      라운지 홈
    </Link>
    <nav className="ml-auto flex gap-1" aria-label="라운지 코너">
      {LOUNGE_CORNERS.map((corner) => {
        const active = corner.id === current;
        return (
          <Link
            key={corner.id}
            to={`/learner/lounge/${corner.id}`}
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors",
              active ? "text-white" : "bg-white text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={active ? { backgroundColor: corner.accent } : undefined}
          >
            <span aria-hidden>{corner.emoji}</span>
            <span className={active ? "" : "hidden sm:inline"}>{corner.title}</span>
          </Link>
        );
      })}
    </nav>
  </div>
);

// 장면 넘김 — 이전/다음 + 점. 마지막 장면에서는 다음 대신 다른 코너로 보낸다.
const Pager = ({
  index,
  total,
  accent,
  onMove,
}: {
  index: number;
  total: number;
  accent: string;
  onMove: (next: number) => void;
}) => {
  const navigate = useNavigate();
  const atEnd = index === total - 1;
  return (
    <div className="mt-3 flex items-center justify-between">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
        className="inline-flex items-center gap-1 rounded-lg border border-[#E4DED0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#3E4C57] transition-colors hover:bg-[#FAF8F2] disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        이전
      </button>
      <div className="flex items-center gap-1.5" aria-label={`장면 ${index + 1} / ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1}번 장면`}
            onClick={() => onMove(i)}
            className="grid h-4 w-4 place-items-center"
          >
            <span
              className="block h-2 w-2 rounded-full transition-colors"
              style={{ backgroundColor: i === index ? accent : "#DDD8CA" }}
            />
          </button>
        ))}
      </div>
      {atEnd ? (
        <button
          type="button"
          onClick={() => navigate("/learner/lounge")}
          className="inline-flex items-center gap-1 rounded-lg border border-[#E4DED0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#3E4C57] transition-colors hover:bg-[#FAF8F2]"
        >
          다른 코너
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onMove(index + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-[#E4DED0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#3E4C57] transition-colors hover:bg-[#FAF8F2]"
        >
          다음
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
};

// 관계가 바뀌면? — 정답 해설 뒤 장문 설명 대신 대비 한 줄. 라운지를 시험으로
// 만들지 않으면서 "관계·장면이 번역을 바꾼다"는 감각만 남긴다.
const ContrastLine = ({ text }: { text: string }) => (
  <div className="mt-2 rounded-xl border border-dashed border-[#D8D0BC] bg-[#FFFDF4] px-3.5 py-2 text-[12px] leading-relaxed text-[#6B5518]">
    <b className="font-bold">관계가 바뀌면?</b> {text}
  </div>
);

const ContextChip = ({ text, accent }: { text: string; accent: string }) => (
  <span
    className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
    style={{ backgroundColor: accent }}
  >
    {text}
  </span>
);

const TheaterCorner = () => {
  const accent = "#FF6B4A";
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [stage, setStage] = useState<"sense" | "line">("sense");
  const [showModel, setShowModel] = useState(false);
  const item = THEATER_ITEMS[index];

  const move = (next: number) => {
    setIndex(next);
    setPick(null);
    setStage("sense");
    setShowModel(false);
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-[#15202B] text-white">
        <div className="relative overflow-hidden px-5 py-3.5">
          <div aria-hidden className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#FF6B4A]/30 blur-2xl" />
          <div className="relative">
            <ContextChip text={item.context} accent={accent} />
            <p className="mt-2 text-[19px] font-bold leading-snug">{item.title}</p>
            <p className="mt-0.5 text-[12.5px] text-[#B9C4CE]">{item.subtitle}</p>
            <div className="mt-2.5 rounded-xl bg-black/20 px-4 py-2 text-[13.5px] leading-relaxed">
              “{item.line}”
            </div>
          </div>
        </div>
      </div>

      {/* 한 카드 두 단계 — ① 한 끗 읽기 → ② 한 줄로 살리기. 같은 자리에서 전환한다. */}
      <section className="mt-2.5 rounded-2xl border border-[#E4DED0] bg-white p-4">
        {stage === "sense" ? (
          <>
            <div className="text-[11px] font-extrabold" style={{ color: accent }}>
              ① 이 장면의 한 끗
            </div>
            <h2 className="mt-1 text-[16px]">{item.question}</h2>
            {pick === null ? (
              <div className="mt-3 space-y-2">
                {item.options.map((option, optionIndex) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPick(optionIndex)}
                    className="w-full rounded-xl border border-[#E4DED0] bg-white px-4 py-2.5 text-left text-[13.5px] transition hover:border-[#BDB5A4] hover:bg-[#FFFDF4]"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <div className="rounded-xl bg-[#FAF8F2] px-4 py-2.5 text-[12.5px] leading-relaxed">
                  <div className="text-[11px] font-bold text-muted-foreground">
                    내 선택 · {item.options[pick]}
                  </div>
                  <p className="mt-1.5">
                    <b>{pick === item.answer ? "이 장면에 가깝습니다." : "이 장면에서는 이렇게 읽습니다."}</b>{" "}
                    {item.explanation}
                  </p>
                </div>
                <ContrastLine text={item.contrast} />
                <button
                  type="button"
                  onClick={() => setStage("line")}
                  className="mt-2.5 w-full rounded-xl bg-[#15202B] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#22313E]"
                >
                  ② 한 줄로 살려보기 →
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-[11px] font-extrabold" style={{ color: accent }}>
              ② 한 줄로 살려보기
            </div>
            <h2 className="mt-1 text-[16px]">이 장면을 한국어 한 줄로 옮긴다면?</h2>
            {showModel ? (
              <div className="mt-3">
                <div className="rounded-xl border-l-4 border-[#FAD338] bg-[#FFFDF4] px-4 py-3 text-[15px] font-semibold">
                  “{item.modelInterpretation}”
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  녹음·채점·기록은 없습니다. 감만 남기고 다음 장면으로 넘어가세요.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  소리 내어 말해본 뒤 모범 통역을 열어보세요.
                </p>
                <button
                  type="button"
                  onClick={() => setShowModel(true)}
                  className="mt-2.5 w-full rounded-xl bg-[#15202B] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#22313E]"
                >
                  모범 통역 보기
                </button>
              </>
            )}
          </>
        )}
      </section>

      <Pager index={index} total={THEATER_ITEMS.length} accent={accent} onMove={move} />
    </>
  );
};

const MemeCorner = () => {
  const accent = "#8D6BFF";
  const [index, setIndex] = useState(0);
  const [vote, setVote] = useState<string | null>(null);
  const item = MEME_ITEMS[index];

  const move = (next: number) => {
    setIndex(next);
    setVote(null);
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#E4DED0] bg-white">
        <div className="px-5 py-4 text-white" style={{ backgroundColor: accent }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-extrabold text-white/75">
              밈 배틀 #{index + 1} · 목업 투표중
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10.5px] font-bold">
              {item.context}
            </span>
          </div>
          <div className="mt-1 text-[23px] font-black">{item.title}</div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-white/80">{item.gloss}</p>
        </div>
        <div className="p-5">
          <div className="rounded-xl bg-[#F3F0FF] px-4 py-2.5">
            <span className="text-[10.5px] font-extrabold text-[#6947D8]">🎯 이번 배틀의 조건 </span>
            <span className="text-[13.5px] font-bold">{item.condition}</span>
          </div>
          {vote === null ? (
            <div className="mt-3 space-y-2">
              {item.captions.map((caption) => (
                <button
                  key={caption.id}
                  type="button"
                  onClick={() => setVote(caption.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E4DED0] bg-white px-4 py-3 text-left text-[13.5px] transition hover:bg-[#FAF8F2]"
                >
                  <span>{caption.text}</span>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#C9C1B2]" />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <div className="rounded-xl border px-4 py-3" style={{ borderColor: accent, backgroundColor: "#F3F0FF" }}>
                <div className="text-[11px] font-bold text-[#6947D8]">내 한 표</div>
                <div className="mt-1 flex items-center gap-2 text-[14px] font-semibold">
                  <Check className="h-4 w-4 shrink-0 text-[#6947D8]" aria-hidden />
                  {item.captions.find((caption) => caption.id === vote)?.text}
                </div>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  목업 투표 완료. 실제 투표·제출 데이터는 저장되지 않습니다.
                </p>
              </div>
              <ContrastLine text={item.contrast} />
            </div>
          )}
        </div>
      </section>

      <Pager index={index} total={MEME_ITEMS.length} accent={accent} onMove={move} />
    </>
  );
};

const DECODER_STORAGE_KEY = "pragma-lounge-decoder-mock-complete";

const DecoderCorner = () => {
  const accent = "#19A974";
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const items = DECODER_MOCK_ITEMS;
  const [complete, setComplete] = useState(() => {
    try {
      return localStorage.getItem(DECODER_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const item = items[index];

  const move = (next: number) => {
    setIndex(next);
    setPick(null);
  };

  const finish = () => {
    setComplete(true);
    try {
      localStorage.setItem(DECODER_STORAGE_KEY, "1");
    } catch {
      // localStorage가 막혀도 현재 화면의 완료 상태는 유지한다.
    }
  };

  const restart = () => {
    setIndex(0);
    setPick(null);
    setComplete(false);
    try {
      localStorage.removeItem(DECODER_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  if (complete) {
    return (
      <section className="relative overflow-hidden rounded-2xl bg-[#0F6B4F] px-5 py-8 text-center text-white">
        <div aria-hidden className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#67D4AA]/25 blur-2xl" />
        <div className="text-[38px]">🔓</div>
        <div className="mt-2 text-[11px] font-extrabold text-[#B8F1DA]">해독 완료 스탬프</div>
        <h2 className="mt-1 text-[21px]">디지털 해독 팩을 모두 풀었습니다</h2>
        <p className="mt-2 text-[12.5px] text-[#CDEADF]">이 완료 표시는 이 기기에만 남습니다.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#15202B]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            다시 해독하기
          </button>
          <Link
            to="/learner/lounge"
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-2.5 text-[12.5px] font-bold text-white"
          >
            다른 코너 둘러보기
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#B7DFD0] bg-white shadow-[0_6px_20px_rgba(25,169,116,0.08)]">
        <div className="relative flex items-center justify-between overflow-hidden bg-[#0F6B4F] px-5 py-2.5 text-white">
          <div aria-hidden className="absolute -right-4 -top-8 h-20 w-20 rounded-full bg-[#67D4AA]/25 blur-xl" />
          <span className="relative text-[11.5px] font-bold text-[#B8F1DA]">오늘의 디지털 해독 팩</span>
          <span className="relative text-[11.5px] text-[#D7F3E8]">
            {index + 1} / {items.length}
          </span>
        </div>
        <div className="p-5">
          <div className="mb-3 rounded-xl border border-dashed border-[#9FD8C3] bg-[#F2FAF6] px-3.5 py-2">
            <span className="text-[10.5px] font-extrabold text-[#0F6B4F]">이 장면의 관계 · 채널 </span>
            <span className="text-[12.5px] leading-relaxed">{item.context}</span>
          </div>
          <div className="rounded-2xl rounded-tl-sm border border-[#BEE6D7] bg-[#DDF5EA] px-4 py-2.5 shadow-sm">
            <div className="text-[10.5px] font-extrabold text-[#0F6B4F]">{item.code}</div>
            <p className="mt-0.5 text-[14px]">{item.message}</p>
          </div>

          {pick === null ? (
            <>
              <div className="mt-4 text-[10.5px] font-extrabold text-[#0F6B4F]">장면 해독</div>
              <h2 className="mt-1 text-[16px]">{item.question}</h2>
              <div className="mt-3 space-y-2">
                {item.options.map((option, optionIndex) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPick(optionIndex)}
                    className="w-full rounded-xl border border-[#E4DED0] bg-white px-4 py-2.5 text-left text-[13.5px] transition hover:border-[#BDB5A4] hover:bg-[#FFFDF4]"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4">
              <div className="rounded-xl border border-[#CDEADF] bg-[#F2FAF6] px-4 py-2.5 text-[12.5px] leading-relaxed">
                <div className="text-[11px] font-bold text-muted-foreground">
                  내 선택 · {item.options[pick]}
                </div>
                <p className="mt-1.5">
                  <b>{pick === item.answer ? "이 장면에 가깝습니다." : "이 장면에서는 이렇게 읽습니다."}</b>{" "}
                  {item.decodedMeaning}
                </p>
              </div>
              <div className="mt-2 rounded-xl border-l-4 bg-[#E8F7F1] px-4 py-2.5" style={{ borderColor: accent }}>
                <span className="text-[10.5px] font-extrabold text-[#0F6B4F]">관계에 맞는 한국어 한 줄 </span>
                <div className="mt-0.5 text-[14.5px] font-bold">“{item.koreanLine}”</div>
              </div>
              <ContrastLine text={item.contrast} />
              {index === items.length - 1 && (
                <button
                  type="button"
                  onClick={finish}
                  className="mt-3 w-full rounded-xl bg-[#FAD338] px-4 py-3 text-[13px] font-extrabold text-[#15202B] hover:bg-[#FCE07A]"
                >
                  팩 완료하기
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <Pager index={index} total={items.length} accent={accent} onMove={move} />
    </>
  );
};

const LoungeCorner = () => {
  const { corner } = useParams();
  if (corner !== "theater" && corner !== "meme" && corner !== "decoder") {
    return <Navigate to="/learner/lounge" replace />;
  }

  return (
    <LearnerJourneyShell
      headerRight={
        <span className="text-[12px] font-semibold text-[#FAD338]">학습 기록에 남지 않아요</span>
      }
    >
      <main className="pb-20">
        <CornerDock current={corner} />
        {corner === "theater" && <TheaterCorner />}
        {corner === "meme" && <MemeCorner />}
        {corner === "decoder" && <DecoderCorner />}
      </main>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LoungeCorner;
