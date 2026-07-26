import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ensureSession } from "@/lib/tracking";
import { HomeBrand } from "@/components/HomeBrand";
import { IS_DEMO } from "@/lib/auth/useProfile";

const Landing = () => {
  useEffect(() => {
    ensureSession();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 sm:py-24">
        <section className="text-center">
          <h1 className="text-[32px] font-bold leading-[1.15] tracking-tight sm:text-[38px] lg:text-[44px]">
            AI 기반 한·중 통번역 학습 워크플로우
          </h1>
          {/* 데스크톱에서 한 줄로 놓이도록 이 문단만 넓힌다(제목·카드 폭은 그대로). */}
          <p className="mx-auto mt-4 w-[min(1120px,92vw)] max-w-none text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
            원문의 의미와 발화자의 의도를 도착어로 옮긴 뒤, 의사소통 맥락에 맞게 표현을 비교하고 수정하며 학습합니다.
          </p>
        </section>

        {/* 전체 구조 진입점 — 실증 시작 전에는 VITE_ENABLE_DEMO를 꺼서 감춘다. */}
        {IS_DEMO && (
          <Link
            to="/architecture"
            className="mt-10 flex w-full flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-[#15202B] bg-white px-6 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#FFFDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span
              aria-hidden
              className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[9px] bg-[#FAD338] text-[18px]"
            >
              ◎
            </span>
            <span className="min-w-[220px] flex-1 text-left">
              <span className="block text-[16px] font-bold text-[#15202B]">PRAGMA 전체 구조 보기</span>
              <span className="mt-0.5 block text-[13.5px] text-muted-foreground">
                AI 콘텐츠 생성·검수부터 학습자 수행, 연구 평가까지 전체 구조를 확인합니다.
              </span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#15202B] px-4 py-2 text-[14px] font-medium text-[#15202B]">
              전체 구조 보기 →
            </span>
          </Link>
        )}

        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          학습자 또는 관리자 영역을 선택하세요.
        </p>

        <section className="mt-4 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/student-login"
            className="group flex flex-col items-start rounded-xl border border-[#15202B] bg-[#FAD338] px-6 py-7 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#E8B91F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-[20px] font-bold text-[#15202B]">
              <span aria-hidden>👤</span> 학습자 영역
            </span>
            <span className="mt-3 text-[14px] leading-relaxed text-[#15202B]/80">
              매주 하나의 핵심 화용 요소를 학습합니다.
              <br />
              원문의 의미와 발화자의 의도를 도착어로 먼저 옮긴 뒤,
              <br />
              의사소통 맥락에 맞게 표현을 비교하고 수정합니다.
            </span>
            <span className="mt-5 inline-flex items-center gap-1 rounded-md border border-[#15202B] bg-transparent px-4 py-2 text-[14px] font-medium text-[#15202B]">
              학습 시작하기 →
            </span>
          </Link>

          <Link
            to="/admin-login"
            className="group flex flex-col items-start rounded-xl border border-[#15202B] bg-[#FAFAFA] px-6 py-7 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-[20px] font-bold text-[#15202B]">
              <span aria-hidden>⚙️</span> 교수자·관리자 영역
            </span>
            <span className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              AI가 생성한 학습 콘텐츠의 자동 검증 결과를 확인하고, 교수자가 최종 공개 여부를 결정합니다.
              학습 기록과 연구 데이터도 함께 관리합니다.
            </span>
            <span className="mt-5 inline-flex items-center gap-1 rounded-md border border-[#15202B] bg-transparent px-4 py-2 text-[14px] font-medium text-[#15202B]">
              관리자 영역으로 →
            </span>
          </Link>
        </section>

      </main>
    </div>
  );
};

export default Landing;
