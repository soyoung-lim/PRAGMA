import type { ReactNode } from "react";
import { HomeBrand } from "@/components/HomeBrand";

interface LearnerJourneyShellProps {
  children: ReactNode;
  /** 헤더 우측 슬롯 (모드 전환 등). 학습자 UI에 노출되는 요소만 넣을 것. */
  headerRight?: ReactNode;
  /** 데스크톱 미션 화면에서 세로 단계표와 본문을 아우르는 축에 헤더를 맞춘다. */
  missionLayout?: boolean;
}

/**
 * 학습자 여정 공통 레이아웃.
 * 프로토타입의 조용한 header + 제한된 본문 폭에 대응. 중국어 가독성을 위해 본문은
 * 기존 검토용보다 약간 넓은 896px 상한을 사용한다. 프로토타입의 여정 맵(jmap)은
 * 개발용 라우터이므로 학습자 UI에는 포함하지 않는다.
 */
export const LearnerJourneyShell = ({ children, headerRight, missionLayout = false }: LearnerJourneyShellProps) => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 bg-[#15202B]">
      <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-4 sm:px-6 ${missionLayout ? "max-w-[72rem]" : "max-w-4xl"}`}>
        <HomeBrand />
        {headerRight}
      </div>
    </header>
    <div className={`mx-auto px-4 py-5 sm:px-6 ${missionLayout ? "max-w-[72rem]" : "max-w-4xl"}`}>{children}</div>
  </div>
);
