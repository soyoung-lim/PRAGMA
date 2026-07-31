import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";

// 심사 설명용 read-only 화면. 새 데이터·API 없이 설계 문서를 코드 상수로 표현한다.
// 학습자 메뉴에는 노출하지 않는다(랜딩 진입점은 VITE_ENABLE_DEMO로 통제).

type Lane = "supply" | "learn" | "res";

const LANE = {
  supply: { num: "bg-[#3A4A5F]", node: "bg-[#EDF0F4] border-[#DCE1E9]" },
  learn: { num: "bg-[#2F6660]", node: "bg-[#E9F1EF] border-[#CFE0DC]" },
  res: { num: "bg-[#8A6A55]", node: "bg-[#F4EDE7] border-[#E3D5C8]" },
} as const;

const Node = ({ lane, title, desc }: { lane: Lane; title: string; desc: string }) => (
  <div className={`rounded-[9px] border px-2.5 py-[7px] ${LANE[lane].node}`}>
    <div className="text-[12.5px] font-bold leading-[1.3] text-[#15202B]">{title}</div>
    <div className="mt-0.5 text-[11px] leading-[1.4] text-muted-foreground">{desc}</div>
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
  <div className="grid h-2.5 place-items-center" aria-hidden>
    <ChevronDown size={11} strokeWidth={2} className="text-[#B6BEC7]" />
  </div>
);

const Handoff = ({ label }: { label: string }) => (
  <div className="grid content-center justify-items-center gap-1.5" aria-hidden>
    <ArrowRight size={20} strokeWidth={1.75} className="text-[#B9A25E]" />
    <span
      className="text-[9.5px] font-bold tracking-[0.05em] text-[#909AA6]"
      style={{ writingMode: "vertical-rl" }}
    >
      {label}
    </span>
  </div>
);

const Architecture = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 bg-[#15202B]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-[11px]">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-[34px] w-[5px] rounded-sm bg-[#FAD338]" />
          <div>
            <h1 className="text-[16.5px] font-bold leading-tight tracking-tight text-white">
              PRAGMA · 전체 시스템 구조
            </h1>
            {/* 관리자·심사 화면에서는 제품 설명어 대신 논문 가제를 그대로 쓴다. */}
            <p className="mt-0.5 text-[13px] text-[#95A2B0]">
              「AI 기반 한·중 통번역 학습 워크플로우 개발 연구」
            </p>
          </div>
        </div>
        <nav className="flex gap-1.5" aria-label="구조 화면">
          <span
            aria-current="page"
            className="rounded-lg border border-[#FAD338] bg-[#FAD338] px-3 py-1.5 text-[12px] font-semibold text-[#15202B]"
          >
            전체 구조
          </span>
          <Link
            to="/"
            className="rounded-lg border border-[#2E3B49] px-3 py-1.5 text-[12px] font-semibold text-[#B7C1CC] transition-colors hover:border-[#4A5967] hover:text-white"
          >
            ← 처음으로
          </Link>
        </nav>
      </div>
    </header>

    <div className="mx-auto max-w-[1120px] px-6 pb-2 pt-4">
      {/* 세 레인을 한 문장으로 — 강조한 세 마디가 그대로 ①②③ 제목이다.
          밑줄 2px 대신 글자 아래쪽을 덮는 반투명 형광펜을 쓴다(랜딩 후크와 같은 어법).
          문장 자체는 굵기를 낮춰, 강조가 세 마디에만 남게 한다. */}
      <p className="mb-2 text-[15px] font-medium leading-relaxed text-[#4A5A66]">
        <Mark>콘텐츠를 생성·검수</Mark>하고, <Mark>학습자가 수행</Mark>하며, 그 기록이{" "}
        <Mark>평가와 설계</Mark>로 돌아옵니다.
      </p>

      {/* 3레인 */}
      <div className="grid grid-cols-1 items-stretch lg:grid-cols-[.86fr_52px_1.85fr_52px_.86fr]">
        {/* ① 콘텐츠 생성·검수 */}
        <section className="rounded-[13px] border border-border bg-card px-3 pb-2 pt-3">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-bold text-white ${LANE.supply.num}`}>
              1
            </span>
            <h2 className="text-[14px] font-bold tracking-tight">콘텐츠 생성·검수</h2>
          </div>
          <p className="mb-2.5 text-[11.5px] text-muted-foreground">최종 공개 여부는 교수자가 결정</p>

          <Node lane="supply" title="목표 화용 요소 카탈로그" desc="9개 화행 · 대역과 제외 혼입변인 정의" />
          <Down />
          <Node lane="supply" title="시나리오 코어 대량 생성" desc="관계·부담 × 매체 × 도메인 조합" />
          <Down />
          <Node lane="supply" title="학습 미션 조립" desc="코어 → 판단 4문항 + 산출 과제" />
          <Down />
          <Node lane="supply" title="자동 규칙 검증" desc="사전 노출·선산출·대역 정합" />
          <Down />
          <Node lane="supply" title="AI 품질 점검" desc="판정이 아니라 경고" />
          <Down />
          <Node lane="supply" title="교수자 최종 승인" desc="승인자 · 일시 · 모델 · 프롬프트 지문" />
        </section>

        <Handoff label="승인분만" />

        {/* ② 학습자 워크플로우 */}
        <section className="rounded-[13px] border border-[#D3D1C7] bg-card px-3 pb-2 pt-3 shadow-[0_8px_20px_-18px_rgba(21,32,43,.55)]">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-bold text-white ${LANE.learn.num}`}>
              2
            </span>
            <h2 className="text-[14px] font-bold tracking-tight">학습자 워크플로우</h2>
          </div>
          <p className="mb-2.5 text-[11.5px] text-muted-foreground">
            한 단원에 목표 화용 요소 하나 · 승인된 콘텐츠만
          </p>

          <Node lane="learn" title="15주 편성 · 화행 순환 배치" desc="교수자가 승인 미션을 주차에 배정" />
          <Down />
          <Node lane="learn" title="주차 학습 노트" desc="예습·복습면 · 주차 목표와 상황 읽는 기준" />
          <Down />
          <Node
            lane="learn"
            title="주차 도입 활동"
            desc="장면 제시 → 차이 인식 → 원리 이해 → 적절성 판단"
          />
          <Down />

          {/* 핵심 엔진 */}
          <div className="rounded-[11px] border-[1.5px] border-[#FAD338] bg-[#FFFDF4] px-[11px] pb-[11px] pt-2.5">
            <span className="inline-block rounded-[5px] bg-[#FDF1C4] px-[7px] py-0.5 text-[10px] font-bold tracking-[0.07em] text-[#8A6D00]">
              한 미션의 흐름 · 매 미션 반복
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-[5px]">
              {["장면 이해", "표현 비교", "직접 번역·통역", "피드백 살피기", "다시 다듬기"].map((step, i) => (
                <span key={step} className="contents">
                  {i > 0 && <ChevronRight size={12} strokeWidth={2.25} className="text-[#D6B84A]" />}
                  <span className="whitespace-nowrap rounded-md border border-[#EADFAF] bg-white px-2 py-[5px] text-[11.5px] font-semibold">
                    {step}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-[1.4] text-muted-foreground">
              의미 전달·문법은 통과 조건, 상황 적절성이 평가 대상 · 판단이 산출보다 먼저
            </p>
          </div>

          <Down />
          <Node lane="learn" title="학습 기록" desc="최초안 · 최종안 · 수정 초점 누적" />
        </section>

        <Handoff label="수행 로그" />

        {/* ③ 연구·평가·설계 */}
        <section className="rounded-[13px] border border-border bg-card px-3 pb-2 pt-3">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-bold text-white ${LANE.res.num}`}>
              3
            </span>
            <h2 className="text-[14px] font-bold tracking-tight">연구·평가·설계</h2>
          </div>
          <p className="mb-2.5 text-[11.5px] text-muted-foreground">학습과 연구를 분리</p>

          <Node lane="res" title="학습 수행 로그" desc="콘텐츠·정책·프롬프트 버전과 함께 저장" />
          <Down />
          <Node lane="res" title="학습자 이견 기록" desc="AI 판정에 대한 이견을 수행 로그와 함께 보관" />
          <Down />
          <Node lane="res" title="설계 추적 기록" desc="결정 · 반복 · 증거를 ID로 연결" />
          <Down />
          <Node lane="res" title="전문가 형성 평가" desc="승인 루브릭 · 이중 평정" />
          <Down />
          <Node lane="res" title="연구 데이터 내보내기" desc="가명 처리 · 대응표 분리 보관" />
          <Down />
          <Node lane="res" title="교수·학습 설계 개선" desc="사람이 결정" />
        </section>
      </div>

      <p className="mt-1 text-center text-[11.5px] text-muted-foreground">
        <b className="font-semibold text-foreground">승인된 콘텐츠만</b> 학습자에게 공개
        <span className="mx-[7px] text-[#D3D1C7]">·</span>생성은{" "}
        <b className="font-semibold text-foreground">동결된 프롬프트 지문에서만</b>
        <span className="mx-[7px] text-[#D3D1C7]">·</span>
        <b className="font-semibold text-foreground">모든 수행 로그가 자동 저장</b>(콘텐츠·정책·프롬프트 버전 포함)
      </p>

      {/* 두 개의 사이클 */}
      <div className="mt-0.5">
        <svg
          viewBox="0 0 1200 98"
          className="block h-auto w-full"
          role="img"
          aria-label="두 개의 사이클: 수행 로그가 다음 학습 배정으로, 설계 추적이 콘텐츠·프롬프트 개정으로 되돌아온다"
        >
          <defs>
            <marker id="arch-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#C9A93A" />
            </marker>
            <marker id="arch-ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#8A6A55" />
            </marker>
          </defs>
          <path
            d="M1030,4 C1030,38 870,44 730,44 C655,44 600,38 600,6"
            fill="none"
            stroke="#C9A93A"
            strokeWidth="2.2"
            markerEnd="url(#arch-ah)"
          />
          <text x="820" y="38" textAnchor="middle" fontSize="12" fontWeight="700" fill="#8A6D00">
            빠른 사이클
          </text>
          <text x="820" y="55" textAnchor="middle" fontSize="11" fill="#5C6A7A">
            수행 로그 → 다음 학습 배정
          </text>
          <path
            d="M1110,4 C1110,80 900,84 600,84 C320,84 130,82 130,8"
            fill="none"
            stroke="#8A6A55"
            strokeWidth="2.2"
            strokeDasharray="5 4"
            markerEnd="url(#arch-ah2)"
          />
          <text x="372" y="76" textAnchor="middle" fontSize="12" fontWeight="700" fill="#7A5A46">
            느린 사이클
          </text>
          <text x="372" y="93" textAnchor="middle" fontSize="11" fill="#5C6A7A">
            설계 추적 → 콘텐츠·프롬프트 개정
          </text>
        </svg>
      </div>

      {/* 공통 기반 */}
      <div className="mt-1 flex flex-wrap items-center gap-3 rounded-[11px] border border-border bg-card px-3.5 py-1.5">
        <span className="text-[10.5px] font-bold tracking-[0.07em] text-[#909AA6]">공통 정책·버전 관리 기반</span>
        <div className="flex flex-wrap gap-1.5">
          {[
            "수준 정책 (입문·중급·고급)",
            "콘텐츠·프롬프트·정책 버전",
            "검수 이력",
          ].map((c) => (
            <span key={c} className="rounded-full border border-[#D3D1C7] bg-background px-[11px] py-1 text-[11.5px] font-semibold">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default Architecture;
