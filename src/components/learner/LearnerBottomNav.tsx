import { NavLink } from "react-router-dom";

// 학습자 최상위 공간 — 학습 동선(홈→수업→기록)을 앞에 두고, 연구 무관 쉬어가기
// 공간인 라운지를 맨 끝에 둔다(2026-07-31 사용자 지시).
// 셀프 연습은 실제 기능이 생기기 전까지 탭이나 자리표시자로 노출하지 않는다.
const TABS = [
  { to: "/learner/home", label: "홈", icon: "⌂" },
  { to: "/learner/course", label: "수업", icon: "▦" },
  { to: "/learner/records", label: "기록", icon: "◷" },
  { to: "/learner/lounge", label: "라운지", icon: "☕" },
];

export const LearnerBottomNav = () => (
  <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EAE4D2] bg-white/95 backdrop-blur">
    <div className="mx-auto flex max-w-3xl">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            [
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[13px] font-bold",
              isActive ? "text-[#15202B]" : "text-muted-foreground",
            ].join(" ")
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={[
                  "flex h-7 w-11 items-center justify-center rounded-full text-[16px]",
                  isActive ? "bg-[#FAD338]" : "",
                ].join(" ")}
              >
                {t.icon}
              </span>
              {t.label}
            </>
          )}
        </NavLink>
      ))}
    </div>
  </nav>
);
