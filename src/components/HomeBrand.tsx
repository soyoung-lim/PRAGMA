import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

export const HomeBrand = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pulse, setPulse] = useState(false);

  const handleClick = () => {
    if (pathname === "/") {
      setPulse(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => setPulse(false), 250);
    } else {
      navigate("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="홈으로"
      className={[
        "group inline-flex items-center gap-1.5 text-base font-medium text-[#F1EFE8] sm:text-lg",
        "cursor-pointer transition-all duration-200 hover:text-white",
        pulse ? "scale-[0.98] opacity-90" : "scale-100 opacity-100",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="inline-block h-5 w-[5px] rounded-full bg-[#FAD338]"
      />
      <span>AI 기반 한·중 통번역 학습 워크플로우</span>
    </button>
  );
};

export default HomeBrand;