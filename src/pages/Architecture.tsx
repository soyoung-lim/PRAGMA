import { Link } from "react-router-dom";

// 심사 설명용 read-only 화면. 새 데이터·API 없이 설계 문서를 코드 상수로 표현한다.
// 학습자 메뉴에는 노출하지 않는다(랜딩 진입점은 VITE_ENABLE_DEMO로 통제).

type Status = "done" | "dev" | "next";

const STATUS_DOT: Record<Status, string> = {
  done: "bg-[#15202B]",
  dev: "bg-[#5C6A7A]/55",
  next: "border border-dashed border-[#909AA6]",
};

type Lane = "supply" | "learn" | "res";

const LANE = {
  supply: { num: "bg-[#3A4A5F]", node: "bg-[#EDF0F4] border-[#DCE1E9]" },
  learn: { num: "bg-[#2F6660]", node: "bg-[#E9F1EF] border-[#CFE0DC]" },
  res: { num: "bg-[#8A6A55]", node: "bg-[#F4EDE7] border-[#E3D5C8]" },
} as const;

const Node = ({ lane, title, desc, status }: { lane: Lane; title: string; desc: string; status: Status }) => (
  <div className={`relative rounded-[9px] border py-2 pl-2.5 pr-7 ${LANE[lane].node}`}>
    <span className={`absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full ${STATUS_DOT[status]}`} />
    <div className="text-[12.5px] font-bold leading-[1.3] text-[#15202B]">{title}</div>
    <div className="mt-0.5 text-[11px] leading-[1.4] text-muted-foreground">{desc}</div>
  </div>
);

const Down = () => (
  <div className="grid h-3 place-items-center text-[11px] text-[#AEB6C0]" aria-hidden>
    ↓
  </div>
);

const Handoff = ({ label }: { label: string }) => (
  <div className="grid content-center justify-items-center gap-1.5" aria-hidden>
    <span className="text-[20px] leading-none text-[#B9A25E]">→</span>
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
              「AI 기반 한중 통번역 학습 워크플로우 개발 연구」
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

    <div className="mx-auto max-w-[1120px] px-6 pb-3.5 pt-3">
      {/* 한 줄 정의 + 구현 상태 총계 */}
      <div className="mb-4 mt-1.5 flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-[14px] font-semibold">
          <b className="border-b-2 border-[#FAD338] pb-px">콘텐츠를 생성·검수</b>하고,{" "}
          <b className="border-b-2 border-[#FAD338] pb-px">학습자가 수행</b>하며, 그 기록이{" "}
          <b className="border-b-2 border-[#FAD338] pb-px">평가와 설계 개선</b>으로 돌아옵니다.
        </p>
        <div className="flex gap-3 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <i className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT.done}`} />
            구현 6
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT.dev}`} />
            개발 중 5
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT.next}`} />
            후속 3
          </span>
        </div>
      </div>

      {/* 3레인 */}
      <div className="grid grid-cols-1 items-stretch lg:grid-cols-[.86fr_52px_1.85fr_52px_.86fr]">
        {/* ① 콘텐츠 생성·검수 */}
        <section className="rounded-[13px] border border-border bg-card px-3 pb-3 pt-3.5">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-bold text-white ${LANE.supply.num}`}>
              1
            </span>
            <h2 className="text-[14px] font-bold tracking-tight">콘텐츠 생성·검수</h2>
          </div>
          <p className="mb-2.5 text-[11.5px] text-muted-foreground">최종 공개 여부는 교수자가 결정</p>

          <Node lane="supply" status="dev" title="목표 화용 요소 패키지" desc="화행 × 목표 화용 요소 단위" />
          <Down />
          <Node lane="supply" status="done" title="AI 기반 자동 생성" desc="시나리오 · 문항" />
          <Down />
          <Node lane="supply" status="dev" title="자동 규칙 검증" desc="사전 노출·선산출 위반 확인" />
          <Down />
          <Node lane="supply" status="next" title="독립 AI 모델 검증" desc="판정이 아니라 경고" />
          <Down />
          <Node lane="supply" status="dev" title="교수자 최종 승인" desc="승인자 · 일시 · 모델 기록" />
        </section>

        <Handoff label="승인분만" />

        {/* ② 학습자 워크플로우 */}
        <section className="rounded-[13px] border border-[#D3D1C7] bg-card px-3 pb-3 pt-3.5 shadow-[0_8px_20px_-18px_rgba(21,32,43,.55)]">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-bold text-white ${LANE.learn.num}`}>
              2
            </span>
            <h2 className="text-[14px] font-bold tracking-tight">학습자 워크플로우</h2>
          </div>
          <p className="mb-2.5 text-[11.5px] text-muted-foreground">
            한 단원에 목표 화용 요소 하나 · 승인된 콘텐츠만
          </p>

          <Node lane="learn" status="done" title="15주 과정 내 화행·화용 요소 배치" desc="9개 화행을 순환 배치" />
          <Down />
          <Node
            lane="learn"
            status="done"
            title="주차 도입 활동"
            desc="장면 제시 → 차이 인식 → 원리 이해 → 적절성 판단"
          />
          <Down />

          {/* 핵심 엔진 */}
          <div className="rounded-[11px] border-[1.5px] border-[#FAD338] bg-[#FFFDF4] px-[11px] pb-[11px] pt-2.5">
            <span className="inline-block rounded-[5px] bg-[#FDF1C4] px-[7px] py-0.5 text-[10px] font-bold tracking-[0.07em] text-[#8A6D00]">
              반복 학습 사이클
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-[5px]">
              {["초안 산출", "수신자 관점 비교·진단", "목표 화용 요소 중심 수정", "맥락 전이"].map((step, i) => (
                <span key={step} className="contents">
                  {i > 0 && <span className="text-[10px] text-[#C9A93A]">→</span>}
                  <span className="whitespace-nowrap rounded-md border border-[#EADFAF] bg-white px-2 py-[5px] text-[11.5px] font-semibold">
                    {step}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-[1.4] text-muted-foreground">
              의미 충실성은 통과 조건, 화용 적절성이 평가 대상 · 번역 과제 필수 포함
            </p>
          </div>

          <Down />
          <Node lane="learn" status="next" title="형성 평가" desc="학습용 문항 · 제출 후 피드백 제공" />
          <Down />
          <Node
            lane="learn"
            status="dev"
            title="음성 · 순차통역 적용"
            desc="같은 화용 요소를 통역 수행 조건으로 재적용"
          />
        </section>

        <Handoff label="수행 로그" />

        {/* ③ 연구·평가·설계 */}
        <section className="rounded-[13px] border border-border bg-card px-3 pb-3 pt-3.5">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-bold text-white ${LANE.res.num}`}>
              3
            </span>
            <h2 className="text-[14px] font-bold tracking-tight">연구·평가·설계</h2>
          </div>
          <p className="mb-2.5 text-[11.5px] text-muted-foreground">학습과 연구를 분리</p>

          <Node lane="res" status="dev" title="학습 수행 로그" desc="콘텐츠·정책 버전과 함께 저장" />
          <Down />
          <Node lane="res" status="dev" title="연구용 기준 평가" desc="사전 · 중간 · 사후" />
          <Down />
          <Node lane="res" status="next" title="평가자 채점" desc="승인 루브릭 · 이중 평정" />
          <Down />
          <Node lane="res" status="done" title="연구 데이터 내보내기" desc="가명 처리 · 대응표 분리 보관" />
          <Down />
          <Node lane="res" status="next" title="교수·학습 설계 개선" desc="사람이 결정" />
        </section>
      </div>

      <p className="mt-2 text-center text-[11.5px] text-muted-foreground">
        <b className="font-semibold text-foreground">승인된 콘텐츠만</b> 학습자에게 공개
        <span className="mx-[7px] text-[#D3D1C7]">·</span>연구용{" "}
        <b className="font-semibold text-foreground">기준 평가 문항은 학습 중 비노출</b>
        <span className="mx-[7px] text-[#D3D1C7]">·</span>
        <b className="font-semibold text-foreground">모든 수행 로그가 자동 저장</b>(콘텐츠·정책 버전 포함)
      </p>

      {/* 두 개의 사이클 */}
      <div className="mt-0.5">
        <svg
          viewBox="0 0 1200 98"
          className="block h-auto w-full"
          role="img"
          aria-label="두 개의 사이클: 수행 로그가 다음 학습 배정으로, 연구 결과가 콘텐츠·정책 개정으로 되돌아온다"
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
            연구 결과 → 콘텐츠·정책 개정
          </text>
        </svg>
      </div>

      {/* 공통 기반 */}
      <div className="mt-1 flex flex-wrap items-center gap-3 rounded-[11px] border border-border bg-card px-3.5 py-2.5">
        <span className="text-[10.5px] font-bold tracking-[0.07em] text-[#909AA6]">공통 정책·버전 관리 기반</span>
        <div className="flex flex-wrap gap-1.5">
          {[
            "수준 정책 (입문·중급·고급)",
            "모드 정책 (학습·전이·숙달·기준 평가)",
            "콘텐츠·정책 버전",
            "검수 이력",
          ].map((c) => (
            <span key={c} className="rounded-full border border-[#D3D1C7] bg-background px-[11px] py-1 text-[11.5px] font-semibold">
              {c}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[10.5px] text-muted-foreground">
        <b className="font-semibold text-foreground">설명 전용 화면.</b> 새 기능 없이 설계 문서를 그대로 옮겼습니다.
        카드 오른쪽 위 점은 구현 상태입니다(채움 = 구현됨, 흐림 = 개발 중, 점선 = 후속).
      </p>
    </div>
  </div>
);

export default Architecture;
