import type { ReactNode } from "react";
import { HomeBrand } from "@/components/HomeBrand";

interface LearnerJourneyShellProps {
  children: ReactNode;
  /** 헤더 우측 슬롯 (모드 전환 등). 학습자 UI에 노출되는 요소만 넣을 것. */
  headerRight?: ReactNode;
  /** 세 열 리포트처럼 넓은 읽기 폭이 필요한 화면에만 사용한다. */
  wide?: boolean;
}

/**
 * 학습자 여정 공통 레이아웃.
 * 프로토타입의 header + .wrap(max-width 720px)에 대응. 프로토타입의 여정 맵(jmap)은
 * 개발용 라우터이므로 학습자 UI에는 포함하지 않는다.
 */
export const LearnerJourneyShell = ({
  children,
  headerRight,
  wide = false,
}: LearnerJourneyShellProps) => {
  const widthClass = wide ? "max-w-6xl" : "max-w-3xl";
  const verticalPaddingClass = wide ? "py-3" : "py-6";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B] print:hidden">
        <div className={`mx-auto flex ${widthClass} items-center justify-between gap-4 px-6 py-4`}>
          <HomeBrand />
          {headerRight}
        </div>
      </header>
      <div className={`mx-auto ${widthClass} px-6 ${verticalPaddingClass}`}>{children}</div>
    </div>
  );
};
