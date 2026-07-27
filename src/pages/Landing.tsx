import { useEffect } from "react";
import { Link } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";
import { ensureSession } from "@/lib/tracking";
import { IS_DEMO } from "@/lib/auth/useProfile";

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
          후크 → 설명 → 두 갈래 → 구조 보기가 모두 들어와야 한다. */}
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
                <span className="relative">관계와 상황</span>
              </span>
              에 따라
            </span>
            <span className="block animate-rise-in [animation-delay:600ms] motion-reduce:animate-none">
              다르게 전해집니다.
            </span>
          </h1>

          {/* break-keep — 없으면 「AI 피 / 드백을」처럼 낱말 중간에서 줄이 끊긴다.
              nbsp로 「AI」와 「피드백을」을 묶어 줄 끝에 「AI」만 남지 않게 한다. */}
          <p className="mx-auto mt-5 max-w-[620px] break-keep text-[15.5px] leading-relaxed text-muted-foreground sm:text-[16.5px]">
            PRAGMA는 한·중 통번역 과정에서 여러 표현의 차이를 비교하고, 직접 번역·통역한 결과를{" "}
            {"AI 피드백을"} 바탕으로 관계와 상황에 맞게 다듬는 수업 플랫폼입니다.
          </p>
        </section>

        {/* 두 갈래 — 이 페이지의 유일한 주 행동. 「선택하세요」 안내문은 카드가 이미
            같은 말을 하므로 두지 않는다. */}
        <section className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/student-login"
            className="group flex flex-col items-start rounded-xl border border-[#15202B] bg-[#FAD338] px-6 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#E8B91F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-[19px] font-bold text-[#15202B]">
              <span aria-hidden>👤</span> 학습자 영역
            </span>
            <span className="mt-2.5 break-keep text-[14px] leading-relaxed text-[#15202B]/80">
              강의에 배정된 한·중 통번역 미션을 수행하고,
              <br />
              AI 피드백을 참고하여 자신의 표현을 다듬습니다.
            </span>
            <span className="mt-4 inline-flex items-center gap-1 rounded-md border border-[#15202B] bg-transparent px-4 py-1.5 text-[14px] font-medium text-[#15202B]">
              학습 시작하기 →
            </span>
          </Link>

          <Link
            to="/admin-login"
            className="group flex flex-col items-start rounded-xl border border-[#15202B] bg-[#FAFAFA] px-6 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-[19px] font-bold text-[#15202B]">
              <span aria-hidden>⚙️</span> 교수자 영역
            </span>
            <span className="mt-2.5 break-keep text-[14px] leading-relaxed text-muted-foreground">
              AI가 생성한 한·중 통번역 학습 콘텐츠를 검수하고,
              <br />
              주차별 강의 편성과 학습 수행 기록을 관리합니다.
            </span>
            <span className="mt-4 inline-flex items-center gap-1 rounded-md border border-[#15202B] bg-transparent px-4 py-1.5 text-[14px] font-medium text-[#15202B]">
              교수자 영역으로 →
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
            <span
              aria-hidden
              className="grid h-[24px] w-[24px] place-items-center rounded-[7px] bg-[#FAD338] text-[13px]"
            >
              ◎
            </span>
            PRAGMA 전체 구조 보기
            <span aria-hidden className="text-[#5C6A7A]">
              →
            </span>
          </Link>
        )}
      </main>

      {/* 연구 산출물임을 로그인 전에 밝혀 둔다 — 심사에서 바로 가리킬 수 있는 한 줄. */}
      <footer className="mx-auto w-full max-w-3xl px-6 pb-7">
        <p className="break-keep border-t border-[#E6E1D2] pt-4 text-center text-[12.5px] leading-relaxed text-[#7C8794]">
          PRAGMA는 「AI 기반 한중 통번역 학습 워크플로우 개발 연구」를 위해 개발된 수업
          플랫폼입니다.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
