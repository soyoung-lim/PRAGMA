const AdminArchive = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-base font-medium text-[#F1EFE8] sm:text-lg">
            <span aria-hidden className="inline-block h-4 w-[2px] rounded-full bg-[#FAD338]" />
            통번역 데이터 아카이브
          </span>
          <span className="rounded-md border border-[#5C6A7A] bg-transparent px-3 py-1.5 text-sm font-medium text-[#F1EFE8]">
            관리자 영역
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 sm:py-14">
        <section>
          <div className="flex items-stretch gap-3">
            <span
              aria-hidden
              className="mt-1 w-[5px] shrink-0 self-stretch rounded-sm bg-[#FAD338]"
            />
            <div>
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                통번역 데이터 아카이브
              </h1>
              <p className="mt-1 text-xl text-muted-foreground sm:text-2xl">
                Interpretation & Translation Archive
              </p>
              <p className="mt-1 text-base text-muted-foreground sm:text-lg">
                한·중 AI 통번역 학습자료 큐레이션
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              이 메타데이터는 자료 큐레이션·검색을 위한 운영 태그이며, 본실험 통제 조건은 별도 locked scenario 단계에서 확정됩니다.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminArchive;
