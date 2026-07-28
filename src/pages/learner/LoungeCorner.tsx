import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  DECODER_MOCK_ITEMS,
  LOUNGE_CORNERS,
  MEME_MOCK,
  THEATER_MOCK,
  type LoungeCornerId,
} from "@/lib/lounge/mockLounge";

const choiceClass = (selected: boolean, correct?: boolean) =>
  [
    "w-full rounded-xl border px-4 py-3 text-left text-[13.5px] transition",
    selected
      ? correct
        ? "border-[#2E7D5B] bg-[#F2FAF6] text-[#205B43]"
        : "border-[#D49332] bg-[#FFF8E8] text-[#6B5518]"
      : "border-[#E4DED0] bg-white hover:border-[#BDB5A4] hover:bg-[#FFFDF4]",
  ].join(" ");

const CornerHeader = ({ id }: { id: LoungeCornerId }) => {
  const corner = LOUNGE_CORNERS.find((item) => item.id === id)!;
  return (
    <div className="mb-4">
      <Link
        to="/learner/lounge"
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        라운지
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[25px] shadow-sm">
          {corner.emoji}
        </div>
        <div>
          <div className="text-[11.5px] font-bold" style={{ color: corner.accent }}>
            {corner.eyebrow}
          </div>
          <h1 className="text-[22px]">{corner.title}</h1>
        </div>
      </div>
    </div>
  );
};

const TheaterCorner = () => {
  const [pick, setPick] = useState<number | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [selfCheck, setSelfCheck] = useState<"done" | "later" | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-[#15202B] text-white">
        <div className="relative flex min-h-[240px] flex-col justify-end overflow-hidden p-5">
          <div aria-hidden className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#FF6B4A]/30 blur-2xl" />
          <div aria-hidden className="absolute bottom-10 left-8 h-28 w-28 rounded-full bg-[#FAD338]/15 blur-2xl" />
          <div className="relative">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-bold text-[#D7DEE5]">
              클립 연결 전 · 대사 미리보기
            </span>
            <p className="mt-4 text-[22px] font-bold leading-snug">{THEATER_MOCK.title}</p>
            <p className="mt-1 text-[12.5px] text-[#B9C4CE]">{THEATER_MOCK.subtitle}</p>
            <div className="mt-5 rounded-xl bg-black/20 px-4 py-3 text-[14px] leading-relaxed">
              “{THEATER_MOCK.line}”
            </div>
          </div>
        </div>
      </div>

      <section className="mt-3 rounded-2xl border border-[#E4DED0] bg-white p-5">
        <div className="text-[11px] font-extrabold text-[#FF6B4A]">
          ① 이 장면의 한 끗
        </div>
        <h2 className="mt-1 text-[16px]">{THEATER_MOCK.question}</h2>
        <div className="mt-3 space-y-2">
          {THEATER_MOCK.options.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => setPick(index)}
              className={choiceClass(pick === index, index === THEATER_MOCK.answer)}
            >
              {option}
            </button>
          ))}
        </div>
        {pick !== null && (
          <div className="mt-3 rounded-xl bg-[#FAF8F2] px-4 py-3 text-[12.5px] leading-relaxed">
            <b>{pick === THEATER_MOCK.answer ? "이 장면에 가깝습니다." : "이 장면에서는 이렇게 읽습니다."}</b>{" "}
            {THEATER_MOCK.explanation}
          </div>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-[#E4DED0] bg-white p-5">
        <div className="text-[11px] font-extrabold text-[#FF6B4A]">② 통역 도전 · 선택</div>
        <h2 className="mt-1 text-[16px]">이 장면을 한국어 한 줄로 살려본다면?</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          소리 내어 말해본 뒤 모범 통역을 열어보십시오. 녹음·채점·기록은 없습니다.
        </p>
        <button
          type="button"
          onClick={() => setShowModel((value) => !value)}
          className="mt-3 w-full rounded-xl bg-[#15202B] px-4 py-3 text-[13px] font-bold text-white hover:bg-[#22313E]"
        >
          {showModel ? "모범 통역 닫기" : "모범 통역 보기"}
        </button>
        {showModel && (
          <div className="mt-3 rounded-xl border-l-4 border-[#FAD338] bg-[#FFFDF4] px-4 py-3 text-[15px] font-semibold">
            “{THEATER_MOCK.modelInterpretation}”
          </div>
        )}
        {showModel && (
          <div className="mt-3 flex gap-2">
            {(["done", "later"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelfCheck(value)}
                className={[
                  "flex-1 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold",
                  selfCheck === value ? "border-[#15202B] bg-[#15202B] text-white" : "bg-white",
                ].join(" ")}
              >
                {value === "done" ? "해냈다 🙌" : "다음에"}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

const MemeCorner = () => {
  const [vote, setVote] = useState<string | null>(null);
  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#E4DED0] bg-white">
        <div className="bg-[#8D6BFF] px-5 py-4 text-white">
          <div className="text-[11px] font-extrabold text-white/75">밈 배틀 #6 · 목업 투표중</div>
          <div className="mt-1 text-[24px] font-black">{MEME_MOCK.title}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-white/80">{MEME_MOCK.gloss}</p>
        </div>
        <div className="p-5">
          <div className="rounded-xl bg-[#F3F0FF] px-4 py-3">
            <div className="text-[10.5px] font-extrabold text-[#6947D8]">
              🎯 이번 배틀의 조건
            </div>
            <div className="mt-1 text-[14px] font-bold">{MEME_MOCK.condition}</div>
          </div>
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            조건을 가장 잘 살리면서 재미있는 캡션 하나를 고르십시오. 득표 수는 결과 공개 전까지 보이지 않습니다.
          </p>
          <div className="mt-3 space-y-2">
            {MEME_MOCK.captions.map((caption) => (
              <button
                key={caption.id}
                type="button"
                onClick={() => setVote(caption.id)}
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[13.5px] transition",
                  vote === caption.id
                    ? "border-[#8D6BFF] bg-[#F3F0FF]"
                    : "border-[#E4DED0] bg-white hover:bg-[#FAF8F2]",
                ].join(" ")}
              >
                <span>{caption.text}</span>
                <span
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    vote === caption.id ? "border-[#8D6BFF] bg-[#8D6BFF] text-white" : "border-[#C9C1B2]",
                  ].join(" ")}
                >
                  {vote === caption.id && <Check className="h-3 w-3" aria-hidden />}
                </span>
              </button>
            ))}
          </div>
          {vote && (
            <div className="mt-3 rounded-xl bg-[#F2FAF6] px-4 py-3 text-[12.5px] text-[#205B43]">
              목업 투표 완료. 실제 투표·제출 데이터는 저장되지 않습니다.
            </div>
          )}
        </div>
      </section>
    </>
  );
};

const DECODER_STORAGE_KEY = "pragma-lounge-decoder-mock-complete";

const DecoderCorner = () => {
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const items = DECODER_MOCK_ITEMS;
  const storageKey = DECODER_STORAGE_KEY;
  const [complete, setComplete] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const item = items[index];

  const next = () => {
    if (index === items.length - 1) {
      setComplete(true);
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        // localStorage가 막혀도 현재 화면의 완료 상태는 유지한다.
      }
      return;
    }
    setIndex((value) => value + 1);
    setPick(null);
  };

  const restart = () => {
    setIndex(0);
    setPick(null);
    setComplete(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {complete ? (
        <section className="relative overflow-hidden rounded-2xl bg-[#0F6B4F] px-5 py-8 text-center text-white">
          <div aria-hidden className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#67D4AA]/25 blur-2xl" />
          <div className="text-[38px]">🔓</div>
          <div className="mt-2 text-[11px] font-extrabold text-[#B8F1DA]">해독 완료 스탬프</div>
          <h2 className="mt-1 text-[21px]">디지털 해독 팩을 모두 풀었습니다</h2>
          <p className="mt-2 text-[12.5px] text-[#CDEADF]">이 완료 표시는 이 기기에만 남습니다.</p>
          <button
            type="button"
            onClick={restart}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#15202B]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            다시 해독하기
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#B7DFD0] bg-white shadow-[0_6px_20px_rgba(25,169,116,0.08)]">
          <div className="relative flex items-center justify-between overflow-hidden bg-[#0F6B4F] px-5 py-3 text-white">
            <div aria-hidden className="absolute -right-4 -top-8 h-20 w-20 rounded-full bg-[#67D4AA]/25 blur-xl" />
            <span className="relative text-[11.5px] font-bold text-[#B8F1DA]">
              오늘의 디지털 해독 팩
            </span>
            <span className="relative text-[11.5px] text-[#D7F3E8]">{index + 1} / {items.length}</span>
          </div>
          <div className="p-5">
            <div className="mb-3 rounded-xl border border-dashed border-[#9FD8C3] bg-[#F2FAF6] px-3.5 py-2.5">
              <div className="text-[10.5px] font-extrabold text-[#0F6B4F]">이 장면의 관계 · 채널</div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed">{item.context}</div>
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-[#BEE6D7] bg-[#DDF5EA] px-4 py-3 shadow-sm">
              <div className="text-[10.5px] font-extrabold text-[#0F6B4F]">{item.code}</div>
              <p className="mt-1 text-[14px]">{item.message}</p>
            </div>
            <div className="mt-5 text-[10.5px] font-extrabold text-[#0F6B4F]">장면 해독</div>
            <h2 className="mt-1 text-[16px]">{item.question}</h2>
            <div className="mt-3 space-y-2">
              {item.options.map((option, optionIndex) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPick(optionIndex)}
                  className={choiceClass(pick === optionIndex, optionIndex === item.answer)}
                >
                  {option}
                </button>
              ))}
            </div>
            {pick !== null && (
              <>
                <div className="mt-3 rounded-xl border border-[#CDEADF] bg-[#F2FAF6] px-4 py-3 text-[12.5px] leading-relaxed">
                  <b>{pick === item.answer ? "이 장면에 가깝습니다." : "이 장면에서는 이렇게 읽습니다."}</b>{" "}
                  {item.decodedMeaning}
                </div>
                <div className="mt-4 rounded-xl border-l-4 border-[#19A974] bg-[#E8F7F1] px-4 py-3">
                  <div className="text-[10.5px] font-extrabold text-[#0F6B4F]">관계에 맞는 한국어 한 줄</div>
                  <div className="mt-1 text-[15px] font-bold">“{item.koreanLine}”</div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                    {item.koreanReason}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={next}
                  className="mt-5 w-full rounded-xl bg-[#FAD338] px-4 py-3 text-[13px] font-extrabold text-[#15202B] hover:bg-[#F5C81F]"
                >
                  {index === items.length - 1 ? "팩 완료하기" : "다음 장면 →"}
                </button>
              </>
            )}
          </div>
        </section>
      )}
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
      headerRight={<span className="text-[12px] font-semibold text-[#FAD338]">기록 없음</span>}
    >
      <main className="pb-24">
        <CornerHeader id={corner} />
        {corner === "theater" && <TheaterCorner />}
        {corner === "meme" && <MemeCorner />}
        {corner === "decoder" && <DecoderCorner />}
        <div className="mt-4 text-center text-[11.5px] text-muted-foreground">
          쉬어가기 목업 · 점수와 연구 기록에 반영되지 않습니다.
        </div>
      </main>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LoungeCorner;
