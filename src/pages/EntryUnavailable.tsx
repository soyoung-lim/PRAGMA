import { useNavigate, useSearchParams } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";

const EntryUnavailable = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const kind = params.get("kind") === "interpreting" ? "interpreting" : "extension";

  const title =
    kind === "interpreting" ? "통역 학습 준비 중" : "확장 기능 준비 중";
  const body =
    kind === "interpreting"
      ? "통역 학습은 음성을 텍스트로 변환한 뒤 직접 수정하며 학습하는 방식으로 준비 중입니다. 발음·성조·유창성 평가는 제공하지 않습니다."
      : "이 조합의 학습은 준비 중입니다. 현재는 한국어 → 중국어 번역 학습만 체험할 수 있어요.";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="inline-flex items-center rounded-full bg-[#FAD338] px-3 py-1 text-[12px] font-medium text-[#15202B]">
            준비 중
          </div>
          <h1 className="mt-4 text-[24px] font-bold tracking-tight sm:text-[28px]">
            {title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground/80">
            {body}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/entry/task-mode")}
              className="inline-flex items-center rounded-md bg-[#15202B] px-5 py-2.5 text-sm font-medium text-white shadow-sm"
            >
              학습 유형 다시 선택
            </button>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="inline-flex items-center rounded-md border border-foreground bg-background px-5 py-2.5 text-sm font-medium text-foreground"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EntryUnavailable;