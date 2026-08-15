import { Link, useLocation } from "react-router-dom";

const MODES = [
  { to: "/admin/generator", label: "개별 생성", description: "조건을 직접 정해 한 건씩 생성" },
  { to: "/admin/batch", label: "배치 생성", description: "정해진 조합을 여러 건 일괄 생성" },
] as const;

export const GenerationModeTabs = () => {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="문항 생성 방식"
      className="mb-5 grid gap-2 rounded-xl border border-[#DDD7C9] bg-[#F8F5ED] p-2 sm:grid-cols-2"
    >
      {MODES.map((mode) => {
        const active = pathname === mode.to;
        return (
          <Link
            key={mode.to}
            to={mode.to}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg border px-4 py-3 transition-colors ${
              active
                ? "border-[#D6AD00] bg-white text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:bg-white/70 hover:text-foreground"
            }`}
          >
            <span className="block text-sm font-semibold">{mode.label}</span>
            <span className="mt-0.5 block text-xs">{mode.description}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default GenerationModeTabs;
