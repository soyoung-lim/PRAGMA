import { NavLink } from "react-router-dom";

// MVP 하단 메뉴 — 홈/과정/기록 3개만 활성. 자유 연습은 홈의 '준비 중' 타일로만 존재.
const TABS = [
  { to: "/learner/home", label: "홈", icon: "⌂" },
  { to: "/learner/course", label: "과정", icon: "▦" },
  { to: "/learner/records", label: "기록", icon: "◷" },
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
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              isActive ? "text-[#15202B]" : "text-muted-foreground",
            ].join(" ")
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={[
                  "flex h-6 w-10 items-center justify-center rounded-full text-[14px]",
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
