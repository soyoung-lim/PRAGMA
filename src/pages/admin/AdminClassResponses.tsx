import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

import { AdminShell } from "@/components/AdminShell";
import { ClassResponsePatterns } from "@/components/admin/ClassResponsePatterns";
import { Button } from "@/components/ui/button";
import { DEMO_CLASS_RESPONSE_PATTERN } from "@/lib/mission/classResponseDemo";

/**
 * 독립 교수자 화면의 첫 체크포인트.
 * DEMO와 크게 보기를 먼저 고정하고, 실제 교과목·주차·미션 조회는 다음 작업에서 연결한다.
 */
const AdminClassResponses = () => {
  const [projector, setProjector] = useState(false);
  const projectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projector) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    projectorRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProjector(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [projector]);

  return <AdminShell
    title="실시간 학급 응답"
    description="개별 판단을 익명 학급 분포로 비교하고 수업 토론으로 연결합니다."
  >
    <div className="max-w-[1120px] space-y-5">
      <section className="rounded-xl border border-[#D8B84A] bg-[#FFF9E5] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-[#FAD338] px-2.5 py-1 text-xs font-bold text-[#15202B]">
              DEMO · 예시 데이터
            </span>
            <h2 className="mt-3 text-lg font-black text-[#15202B]">우리 반은 어떻게 판단했을까?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              실제 학습자 수행 기록이 아닌 코드 내 고정 예시입니다.
            </p>
          </div>
          <Button variant="outline" onClick={() => setProjector(true)}>
            <Maximize2 className="mr-2 h-4 w-4" />크게 보기
          </Button>
        </div>
        <div className="mt-5">
          <ClassResponsePatterns patterns={[DEMO_CLASS_RESPONSE_PATTERN]} />
        </div>
        <p className="mt-4 border-t border-[#E5D28A] pt-3 text-xs font-semibold text-[#6A5516]">
          DEMO · 예시 데이터 — 실제 학습자 수행 기록이 아니며 DB에 저장되지 않습니다.
        </p>
      </section>
    </div>

    {projector && <div
      ref={projectorRef}
      role="dialog"
      aria-modal="true"
      aria-label="학급 응답 크게 보기"
      tabIndex={-1}
      className="fixed inset-0 z-[110] overflow-y-auto bg-[#F8F6EE] p-6 sm:p-10"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#B8860B]">DEMO · 예시 데이터</p>
            <h1 className="mt-1 text-3xl font-black text-[#15202B]">우리 반은 어떻게 판단했을까?</h1>
            <p className="mt-2 text-base text-muted-foreground">
              가장 많이 선택된 응답이 정답을 의미하지는 않습니다.
            </p>
          </div>
          <Button variant="outline" onClick={() => setProjector(false)}>
            <X className="mr-2 h-4 w-4" />닫기
          </Button>
        </div>
        <ClassResponsePatterns patterns={[DEMO_CLASS_RESPONSE_PATTERN]} projector />
      </div>
    </div>}
  </AdminShell>;
};

export default AdminClassResponses;
