import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, SlidersHorizontal } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
import { ensureSession } from "@/lib/tracking";
import { IS_DEMO } from "@/lib/auth/useProfile";

// 화살표는 hover에서 진행 방향으로 살짝 미끄러진다. 카드가 통째로 떠오르는 동작은
// "이 카드가 반응한다"까지만 말하고, 화살표의 이동이 "누르면 저쪽으로 간다"를 말한다.
const arrow = "transition-transform duration-150 group-hover:translate-x-0.5";

const Landing = () => {
  useEffect(() => {
    ensureSession();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* 브랜드는 앱 전체와 같은 고정 헤더로만 세운다 — hero 중앙에 다시 두면 같은
          문구가 두 번 나오고, 랜딩만 헤더가 없어 다른 화면과 골격이 어긋난다. */}
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      {/* 랜딩은 '읽는 페이지'가 아니라 '갈라지는 문'이다 — 스크롤 없이 한 화면에
          후크 → 설명 → 흐름 → 두 갈래가 모두 들어와야 한다. */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-6 sm:py-8">
        <section className="text-center">
          {/* 후크 — 두 줄이 차례로 올라온 뒤 핵심어에 형광펜이 그어진다. 메시지
              ("같은 뜻인데 다르게 전해진다")를 활자로 시연하는 장치라 장식이 아니다.
              모션을 끈 환경에서는 최종 상태로 즉시 표시된다. */}
          <h1 className="text-[27px] font-bold leading-[1.35] tracking-tight text-[#15202B] sm:text-[33px] lg:text-[36px]">
            <span className="block animate-rise-in motion-reduce:animate-none">
              같은 뜻도,{" "}
              <span className="relative inline-block">
                <span
                  aria-hidden
                  className="absolute inset-x-[-3px] bottom-[3px] h-[32%] origin-left animate-marker-sweep rounded-[2px] bg-[#FAD338] [animation-delay:1200ms] motion-reduce:animate-none"
                />
                {/* 형광펜 위에 얹히도록 텍스트도 위치를 잡아 준다(-z-10은 페이지
                    배경 뒤로 숨어 버린다). */}
                <span className="relative">상황과 관계</span>
              </span>
              에 따라
            </span>
            <span className="block animate-rise-in [animation-delay:600ms] motion-reduce:animate-none">
              다르게 전해집니다.
            </span>
          </h1>

          {/* break-keep — 없으면 낱말 중간에서 줄이 끊긴다. */}
          <p className="mx-auto mt-5 max-w-[620px] break-keep text-[15.5px] leading-relaxed text-muted-foreground sm:text-[16.5px]">
            {/* 의미 단위 2행. 각 행이 max-w를 넘지 않아야 짧은 꼬리 줄이 생기지 않는다(2026-08-06 실측). */}
            <span className="block">
              PRAGMA는 한·중 통번역에서 주어진 원문의 의미는 유지하면서
            </span>
            <span className="block">
              상황과 관계에 맞게 판단하고 산출하는 수업 연계형 AI 플랫폼입니다.
            </span>
          </p>
        </section>

        {/* 두 갈래 — 이 페이지의 유일한 주 행동. 「선택하세요」 안내문은 카드가 이미
            같은 말을 하므로 두지 않는다.
            두 영역은 주·부가 아니라 대등한 두 입구다. 그래서 테두리·그림자·크기는
            똑같이 두고, 왼쪽 띠와 버튼의 색으로만 갈라진다 — 학습자는 노랑, 교수자는
            남색. 카드를 통째로 칠하지 않는 것은 후크의 형광펜과 색이 부딪히기 때문이다. */}
        <section className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/student-login"
            className="group flex flex-col items-start rounded-xl border border-[#E6E1D2] border-l-[5px] border-l-[#FAD338] bg-white px-6 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D5CEBB] hover:border-l-[#FAD338] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            {/* 이모지는 기기마다 다르게 그려지고 색이 튄다 — 앱이 이미 쓰는 lucide
                라인 아이콘으로 바꿔 글자와 같은 무게로 맞춘다. */}
            <span className="flex items-center gap-2 text-[19px] font-bold text-[#15202B]">
              <GraduationCap aria-hidden size={19} strokeWidth={1.75} className="text-[#3E4C57]" />
              학습자 영역
            </span>
            <span className="mt-2.5 break-keep text-[14px] leading-relaxed text-muted-foreground">
              주차별 학습을 따라 표현을 비교하고 직접 번역·통역합니다.
              다듬은 과정은 학습 기록에 쌓입니다.
            </span>
            {/* hover에서 어둡게 눌리면 '비활성'처럼 보인다 — 같은 색상을 한 단계
                밝혀서 떠오르는 쪽으로 반응하게 한다. */}
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#15202B] bg-[#FAD338] px-4 py-1.5 text-[14px] font-bold text-[#15202B] transition-colors group-hover:bg-[#FCE07A]">
              학습 시작하기
              <ArrowRight aria-hidden size={14} strokeWidth={2} className={arrow} />
            </span>
          </Link>

          <Link
            to="/admin-login"
            className="group flex flex-col items-start rounded-xl border border-[#E6E1D2] border-l-[5px] border-l-[#3E4C57] bg-white px-6 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D5CEBB] hover:border-l-[#3E4C57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-[19px] font-bold text-[#15202B]">
              <SlidersHorizontal aria-hidden size={19} strokeWidth={1.75} className="text-[#3E4C57]" />
              교수자 영역
            </span>
            <span className="mt-2.5 break-keep text-[14px] leading-relaxed text-muted-foreground">
              시나리오와 AI 학습 미션을 생성·검수해 15주 강좌에 편성하고,
              게시와 학습 수행 기록까지 운영합니다.
            </span>
            {/* 카드 제목이 이미 '교수자 영역'이라 버튼까지 같은 말이면 한 번 더 읽게 된다.
                버튼은 무엇을 하러 가는지만 말한다 — 학습 시작하기 / 수업 운영하기.
                채움색은 헤더의 #15202B보다 한 단계 연한 남색이다. 순검정-흰색 대비는
                노랑 버튼보다 훨씬 세서, 같은 크기여도 교수자 쪽이 앞으로 튀어나온다. */}
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#3E4C57] bg-[#3E4C57] px-4 py-1.5 text-[14px] font-bold text-white transition-colors group-hover:bg-[#4E5F6C]">
              수업 운영하기
              <ArrowRight aria-hidden size={14} strokeWidth={2} className={arrow} />
            </span>
          </Link>
        </section>

        {/* 전체 구조 보기 — 디펜스 시연 진입점. 두 갈래보다는 작지만 '눌러야 할 것'
            으로 보이도록 테두리·아이콘을 준다. 실증 시작 전에는 VITE_ENABLE_DEMO로 감춘다. */}
        {IS_DEMO && (
          <Link
            to="/architecture"
            className="mt-6 inline-flex items-center gap-2.5 rounded-lg border-[1.5px] border-[#15202B] bg-white px-5 py-2.5 text-[14px] font-bold text-[#15202B] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#FFFDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            {/* 노랑은 형광펜과 학습자 버튼 두 곳으로 끝낸다 — 여기까지 노랑이면
                시선이 한 번 더 새고, 주 경로가 그만큼 흐려진다. */}
            <span
              aria-hidden
              className="grid h-[24px] w-[24px] place-items-center rounded-[7px] bg-[#EFEBDD] text-[13px] text-[#5C6A7A]"
            >
              ◎
            </span>
            PRAGMA 전체 구조 보기
            <ArrowRight aria-hidden size={14} strokeWidth={2} className={`text-[#5C6A7A] ${arrow}`} />
          </Link>
        )}
      </main>

      {/* 연구 산출물임을 로그인 전에 밝혀 둔다 — 심사에서 바로 가리킬 수 있는 한 줄. */}
      <footer className="mx-auto w-full max-w-3xl px-6 pb-7">
        <p className="break-keep border-t border-[#E6E1D2] pt-4 text-center text-[12.5px] leading-relaxed text-[#7C8794]">
          PRAGMA는 「AI 기반 한·중 통번역 학습 워크플로우 개발 연구」를 위해 설계·개발된
          수업 연계형 연구 플랫폼입니다.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
