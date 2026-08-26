import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronRight, PlayCircle, RotateCcw } from "lucide-react";
import { MPJ_ITEM_COUNT } from "@/lib/curriculum/learnerWorkflow";
import { FINAL_GOLD_POPULATION_COUNT } from "@/lib/pragma/goldProtocol";
import { IS_DEMO } from "@/lib/auth/useProfile";
import { REPRESENTATIVE_MISSION_PATH } from "@/lib/demo/representativeMission";

// 심사 설명용 read-only 화면. 현재 런타임 흐름과 연구자료 처리 경계를 요약한다.

type Lane = "supply" | "learn" | "res";

const LANE = {
  supply: { num: "bg-[#3A4A5F]", node: "bg-[#EDF0F4] border-[#DCE1E9]" },
  learn: { num: "bg-[#2F6660]", node: "bg-[#E9F1EF] border-[#CFE0DC]" },
  res: { num: "bg-[#8A6A55]", node: "bg-[#F4EDE7] border-[#E3D5C8]" },
} as const;

// 배지 규칙 — 화면 전체에서 이 두 가지만 쓴다. 나머지(배지 없음)는 구현 완료다.
//   초록 실선 = 수업에서 실제로 하고 있다
//   회색 점선 = 아직 하지 않았다 → 라벨은 「준비 중」 하나로 통일한다
// 미실행 항목을 「연구 예정」·「구현 예정」처럼 여러 이름으로 부르면 심사에서
// 그 차이가 무슨 뜻이냐는 질문만 늘어난다. 아직 안 한 것은 다 「준비 중」이다.
// 점선은 미실행의 시각 관례라 색맹 조건에서도 형태만으로 갈린다.
const STATUS_TONE: Record<string, string> = {
  "수업 운영": "border-[#B6D3C0] bg-[#EAF5EE] text-[#2C5F4F]",
  "준비 중": "border-dashed border-[#C3CAD3] bg-white text-[#6B7785]",
};

const Node = ({
  lane,
  title,
  desc,
  status,
  decision,
}: {
  lane: Lane;
  title: string;
  desc: React.ReactNode;
  status?: string;
  /** 사람이 결정하는 노드 — AI 점검 노드와 성격이 다르다는 것을 테두리로 보인다. */
  decision?: boolean;
}) => (
  <div
    className={`rounded-[9px] border px-3 py-2.5 ${
      decision ? "border-[1.5px] border-[#3A4A5F] bg-white" : LANE[lane].node
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="text-[13px] font-bold leading-[1.3] text-[#15202B]">{title}</div>
      {status && (
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold leading-none ${
            STATUS_TONE[status] ?? "border-[#D5C6B8] bg-white/70 text-[#765D4C]"
          }`}
        >
          {status}
        </span>
      )}
    </div>
    <div className="mt-0.5 text-[11px] leading-[1.35] text-muted-foreground">{desc}</div>
  </div>
);

const LaneHeader = ({
  lane,
  num,
  title,
  desc,
}: {
  lane: Lane;
  num: string;
  title: string;
  desc: React.ReactNode;
}) => (
  <div className="mb-3">
    <div className="flex items-center gap-2">
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${LANE[lane].num}`}>
        {num}
      </span>
      <h2 className="text-[15.5px] font-extrabold leading-tight tracking-[-0.025em] text-[#15202B]">{title}</h2>
    </div>
    <p className="mt-1 pl-7 text-[11px] leading-[1.35] text-muted-foreground">{desc}</p>
  </div>
);

// 강조는 밑줄이 아니라 글자 아래를 덮는 반투명 형광펜으로 — 랜딩 후크와 같은 어법이다.
const Mark = ({ children }: { children: React.ReactNode }) => (
  <b className="bg-[linear-gradient(to_top,rgba(250,211,56,.5)_40%,transparent_40%)] px-[1px] font-bold text-[#15202B]">
    {children}
  </b>
);

// 연결자는 타이핑한 글리프(↓·→)가 아니라 아이콘으로 둔다 — 글리프는 폰트마다
// 굵기·baseline이 달라 도식 안에서 혼자 손글씨처럼 보인다.
const Down = () => (
  <div className="grid h-4 place-items-center" aria-hidden>
    <ChevronDown size={13} strokeWidth={2.25} className="text-[#8996A3]" />
  </div>
);

// 레인 사이의 인계는 이 도식에서 가장 중요한 두 지점이다(승인분만 넘어간다 /
// 수행 로그만 넘어간다). 옅은 화살표 하나로는 그 관문이 보이지 않아, 레인 높이를
// 관통하는 세로선 위에 노란 토큰으로 얹는다.
const Handoff = ({ label }: { label: string }) => (
  <div className="relative grid self-stretch content-center justify-items-center" aria-hidden>
    <span className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-[#E7E1CF]" />
    <span className="relative grid justify-items-center gap-1 rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-[7px] py-2.5 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)]">
      <ArrowRight size={16} strokeWidth={2.5} className="text-[#A9761A]" />
      <span
        className="text-[10px] font-bold tracking-[0.08em] text-[#6B5518]"
        style={{ writingMode: "vertical-rl" }}
      >
        {label}
      </span>
    </span>
  </div>
);

// ③의 개선 판단이 다음 ①·② 설계로 돌아가는 회귀 경로. 데스크톱에서는
// 오른쪽에서 출발해 아래를 감고 왼쪽 ①로 올라가는 U자형 화살표로 순환을 명시한다.
const CycleReturn = () => (
  <div
    className="relative mt-1 h-[40px]"
    aria-label="평가와 개선 결과를 다음 콘텐츠, 미션, 수업 설계에 반영"
  >
    <svg
      className="absolute inset-0 hidden h-full w-full overflow-visible lg:block"
      viewBox="0 0 1000 40"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <marker id="cycle-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="#A9761A" />
        </marker>
      </defs>
      <path
        d="M 965 1 V 8 C 965 20 954 24 932 24 H 68 C 46 24 35 20 35 8 V 1"
        fill="none"
        stroke="#A9761A"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        markerEnd="url(#cycle-arrowhead)"
      />
    </svg>
    <div className="absolute left-1/2 top-[10px] hidden -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-3 py-1 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)] lg:flex">
      <RotateCcw size={13} strokeWidth={2.5} className="text-[#A9761A]" aria-hidden />
      <span className="text-[10.5px] font-bold text-[#6B5518]">③ 설계 개선 → ①·② 반영</span>
    </div>
    <div className="flex items-center justify-center gap-1.5 rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-3 py-2 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)] lg:hidden">
      <RotateCcw size={14} strokeWidth={2.5} className="shrink-0 text-[#A9761A]" aria-hidden />
      <span className="text-[11px] font-bold text-[#6B5518]">③ 설계 개선 → ①·② 반영</span>
    </div>
  </div>
);

const Architecture = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 bg-[#15202B]">
      {/* 아래 도식과 같은 1024 격자를 쓴다 — 헤더만 1120이면 CTA가 3열 우측
          테두리보다 49px 바깥에 떠서 액자가 그림보다 커 보인다(실측). */}
      <div className="mx-auto flex max-w-[1024px] flex-wrap items-center justify-between gap-4 px-6 py-[11px]">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-[34px] w-[5px] rounded-sm bg-[#FAD338]" />
          <div>
            <h1 className="text-[16.5px] font-bold leading-tight tracking-tight text-white">
              PRAGMA · 통합 워크플로우
            </h1>
            {/* 관리자·심사 화면에서는 제품 설명어 대신 논문 가제를 그대로 쓴다. */}
            <p className="mt-0.5 text-[13px] text-[#95A2B0]">
              「AI 기반 한·중 통번역 학습 워크플로우 개발 연구」
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {IS_DEMO && (
            <Link
              to={REPRESENTATIVE_MISSION_PATH}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#FAD338] bg-[#FAD338] px-3 py-1.5 text-[12px] font-semibold text-[#15202B] transition-colors hover:bg-[#F5C400]"
            >
              <PlayCircle aria-hidden size={14} strokeWidth={2} />
              대표 미션 시연
            </Link>
          )}
          <Link
            to="/"
            className="rounded-lg border border-white/35 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            ← 처음으로
          </Link>
        </div>
      </div>
    </header>

    {/* 하단 여백: 레인은 flex-1이라 pb만큼 세 열이 함께 조금 줄고, 그만큼 환류
        화살표가 화면 안쪽으로 들어온다. 다만 ①레인 자연 높이가 약 573px이라
        세로가 짧은 화면에서는 이 압축분이 그대로 넘침이 된다(1280×720 실측 -13px).
        그래서 세로 900px 이상일 때만 준다 — 1920×1080 캡처에서는 여백이 생기고
        작은 노트북에서는 이전과 동일하다. */}
    <div className="mx-auto max-w-[1024px] px-6 pb-0 pt-3 [@media(min-height:900px)]:pb-5 lg:flex lg:h-[calc(100dvh-66px)] lg:flex-col lg:pt-4">
      {/* 세 레인을 한 문장으로 — 강조한 세 마디가 그대로 ①②③ 제목이다.
          밑줄 2px 대신 글자 아래쪽을 덮는 반투명 형광펜을 쓴다(랜딩 후크와 같은 어법).
          문장 자체는 굵기를 낮춰, 강조가 세 마디에만 남게 한다. */}
      <p className="mb-2 text-[14.5px] font-medium leading-relaxed text-[#4A5A66]">
        <Mark>콘텐츠를 생성·품질 검증</Mark>하고, <Mark>학습자가 수행</Mark>하며, 그 기록이{" "}
        <Mark>연구자료와 설계 개선</Mark>으로 돌아옵니다.
      </p>

      {/* 3레인 */}
      <div className="grid grid-cols-1 items-start lg:min-h-0 lg:flex-1 lg:grid-cols-[243px_44px_393px_44px_251px] lg:items-stretch">
        {/* ① 콘텐츠 생성·품질 검증 */}
        <section className="rounded-[13px] border border-border bg-card px-3.5 pb-4 pt-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:justify-between">
          <LaneHeader
            lane="supply"
            num="1"
            title="콘텐츠 생성·품질 검증"
            desc="규칙 확정 → 정식 문항 504개 생성 → 4단계 승인"
          />

          <Node lane="supply" title="표현 규칙·생성계약 확정" desc="9개 화행의 목표 요소·판정 대역·근거 고정" />
          <Down />
          <Node lane="supply" title="AI 학습 콘텐츠 신규 생성" desc="확정 규칙으로 정식 문항 504개 생성" />
          <Down />
          <Node lane="supply" title="1. 기준답안 연구 책임자 판정" desc={`9화행 × 5개 = ${FINAL_GOLD_POPULATION_COUNT}개 · 시스템 운영 게이트 설정`} />
          <Down />
          <Node lane="supply" title="2. 기준답안 자동 회귀 점검" desc="연구자 확정 기준답안으로 품질 점검 자동화의 작동 조건 확인" />
          <Down />
          <Node lane="supply" title="3. 콘텐츠 자동 점검·교수자 검수" desc="504개 전량 자동 점검 · 교수자는 경고 문항을 우선 확인하고 최종 승인" />
          <Down />
          <Node
            lane="supply"
            title="4. 교수자의 학습자 사용 승인"
            desc="시스템이 필수 조건 확인 · 교수자가 최종 사용 여부 결정 · 이력 저장"
            decision
          />
        </section>

        <Handoff label="교수자 승인분" />

        {/* ② 학습자 워크플로우 */}
        <section className="rounded-[13px] border border-[#D3D1C7] bg-card px-3.5 pb-4 pt-4 shadow-[0_8px_20px_-18px_rgba(21,32,43,.55)] lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:justify-between">
          <LaneHeader
            lane="learn"
            num="2"
            title="학습자 워크플로우"
            desc="15주 동안 승인된 콘텐츠로 판단·산출·수정을 반복"
          />

          <Node
            lane="learn"
            title="15주 강좌 편성"
            desc="9개 화행과 목표 요소를 순환 배치 · 승인 미션만 사용"
          />
          <Down />
          <Node lane="learn" title="주차 학습 노트" desc="예습·복습용 · 주차 목표와 상황 판단 기준" />
          <Down />
          <Node
            lane="learn"
            title="주차 도입 활동"
            desc="장면 제시 → 차이 인식 → 원리 이해"
          />
          <Down />

          {/* 핵심 엔진 */}
          <div className="rounded-[11px] border-[1.5px] border-[#FAD338] bg-[#FFFDF4] px-[11px] pb-[11px] pt-2.5">
            <span className="inline-block rounded-[5px] bg-[#FDF1C4] px-[7px] py-0.5 text-[10px] font-bold tracking-[0.07em] text-[#8A6D00]">
              한 미션의 흐름 · 매 미션 반복
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-[5px] lg:flex-nowrap lg:justify-center lg:gap-0.5 xl:gap-1">
              {[`감각 익히기(MPJ ${MPJ_ITEM_COUNT})`, "직접 표현하기", "피드백 확인", "한 곳 다듬기"].map((step, i) => (
                <span key={step} className="contents">
                  {i > 0 && <ChevronRight size={9} strokeWidth={2.25} className="shrink-0 text-[#D6B84A]" />}
                  <span className="whitespace-nowrap rounded-md border border-[#EADFAF] bg-white px-2 py-1 text-[11px] font-semibold lg:px-[5px] lg:text-[9.5px] xl:px-1.5 xl:text-[10px]">
                    {step}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-[1.4] text-muted-foreground">
              번역·통역 수행에서 의미·문법·화용 피드백을 확인하고 핵심 한 곳을 수정
            </p>
          </div>

          <Down />
          <Node lane="learn" title="상황 바꿔보기" desc="한 조건이 달라진 상황에 같은 원리를 다시 적용" />
          <Down />
          <Node
            lane="learn"
            title="수행·의사결정 기록"
            desc="판단·선택·근거·최초안·수정안을 맥락·버전과 함께 저장"
            status="수업 운영"
          />
        </section>

        <Handoff label="동의한 수행기록" />

        {/* ③ 학습 기록·연구자료 */}
        <section className="rounded-[13px] border border-border bg-card px-3.5 pb-4 pt-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:justify-between">
          <LaneHeader
            lane="res"
            num="3"
            title="학습 기록·연구자료"
            desc="학습 운영과 연구자료 포함 여부를 분리"
          />

          <Node
            lane="res"
            title="수행·의사결정 기록"
            desc={
              <>
                판단·선택·근거·수정·최종 산출을
                <br />
                맥락·버전과 함께 저장
              </>
            }
          />
          <Down />
          <Node
            lane="res"
            title="연구자료 포함 여부 확인"
            desc={
              <>
                참여 동의·과제 완료·필수 응답의
                <br />포함·제외 조건 확인
              </>
            }
          />
          <Down />
          <Node
            lane="res"
            title="가명 처리"
            desc={
              <>
                직접 식별자를 제외하고 안정된
                <br />가명 식별자로 연결
              </>
            }
          />
          <Down />
          <Node
            lane="res"
            title="수행기록 내려받기"
            desc="포함 기준을 통과한 가명 연구자료만 버전과 함께 추출"
          />
          <Down />
          <Node
            lane="res"
            title="학습 콘텐츠 개선"
            desc={
              <>
                반복되는 학습자 반응·품질 신호를 모으고
                <br />연구 책임자가 반영 여부 결정
              </>
            }
          />
        </section>
      </div>

      <CycleReturn />
    </div>
  </div>
);

export default Architecture;
