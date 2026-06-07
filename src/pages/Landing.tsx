import { useEffect } from "react";
import { Link } from "react-router-dom";
import { User, Settings, ArrowRight } from "lucide-react";
import { ensureSession } from "@/lib/tracking";
import { HomeBrand } from "@/components/HomeBrand";

const Landing = () => {
  useEffect(() => {
    ensureSession();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F3] text-[#15202B]">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-20 sm:py-28">
        <section className="text-center">
          <h1 className="text-[34px] font-bold leading-[1.2] tracking-tight text-[#15202B] sm:text-[42px] lg:text-[48px]">
            AI 기반 한·중 통번역 학습 워크플로우
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#5B6B7B] sm:text-[16px]">
            상황을 이해하고, 여러 번역안을 비교하며, 피드백을 바탕으로 나만의 최종안을 만들어갑니다.
          </p>
        </section>

        <section className="mt-14 grid w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
          {/* Primary — 학습자 */}
          <article className="lg:col-span-3 group relative flex flex-col rounded-2xl border border-[#EADFC4] bg-gradient-to-br from-[#FFF8E6] to-[#FDF1D1] p-8 shadow-[0_6px_24px_-12px_rgba(21,32,43,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-14px_rgba(21,32,43,0.25)] sm:p-10">
            <span className="inline-flex w-fit items-center rounded-full bg-[#15202B] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#FAD338]">
              Student
            </span>
            <div className="mt-5 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 ring-1 ring-[#EADFC4]">
                <User className="h-5 w-5 text-[#15202B]" strokeWidth={1.75} />
              </span>
              <h2 className="text-[22px] font-bold tracking-tight text-[#15202B] sm:text-[24px]">
                학습자 입장
              </h2>
            </div>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-[#3D4A57]">
              시나리오를 선택하고 AI 번역안을 비교·평가하며 통번역 의사결정 역량을 키웁니다.
            </p>
            <div className="mt-8">
              <Link
                to="/student-login"
                className="inline-flex items-center gap-2 rounded-lg bg-[#15202B] px-5 py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-[#0B1620] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF8E6]"
              >
                학습 시작하기
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              </Link>
            </div>
          </article>

          {/* Secondary — 교수자 */}
          <article className="lg:col-span-2 group relative flex flex-col rounded-2xl border border-[#E7EBF0] bg-white p-7 shadow-[0_4px_16px_-12px_rgba(21,32,43,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D5DCE4] hover:shadow-[0_10px_28px_-14px_rgba(21,32,43,0.18)] sm:p-8">
            <span className="inline-flex w-fit items-center rounded-full bg-[#F1F3F6] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#5B6B7B]">
              Instructor
            </span>
            <div className="mt-5 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F7FA] ring-1 ring-[#E7EBF0]">
                <Settings className="h-5 w-5 text-[#5B6B7B]" strokeWidth={1.75} />
              </span>
              <h2 className="text-[19px] font-semibold tracking-tight text-[#15202B] sm:text-[20px]">
                교수자 입장
              </h2>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-[#5B6B7B]">
              AI로 시나리오를 생성·검수하고 학습자 데이터를 분석·관리합니다.
            </p>
            <div className="mt-auto pt-8">
              <Link
                to="/admin-login"
                className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#15202B] underline-offset-4 transition-colors hover:text-[#0B1620] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 rounded"
              >
                관리자 영역 진입
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              </Link>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
};

export default Landing;
