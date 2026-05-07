import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";

export const PREP_STORAGE_KEY = "translation-workflow-prep";
const NICK_MAX = 20;
const GOAL_MAX = 30;

export interface PrepData {
  nickname: string;
  goal: string;
}

const Prep = () => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/prep" }, "/prep");
    const raw = localStorage.getItem(PREP_STORAGE_KEY);
    if (raw) {
      try {
        const p: PrepData = JSON.parse(raw);
        setNickname(p.nickname || "");
        setGoal(p.goal || "");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const canProceed =
    nickname.trim().length >= 1 &&
    nickname.trim().length <= NICK_MAX &&
    goal.trim().length >= 1 &&
    goal.trim().length <= GOAL_MAX;

  const handleNext = () => {
    if (!canProceed) return;
    const payload: PrepData = { nickname: nickname.trim(), goal: goal.trim() };
    localStorage.setItem(PREP_STORAGE_KEY, JSON.stringify(payload));
    logAction("input", { field: "prep", nickname: payload.nickname, goal: payload.goal });
    navigate("/scenario");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={0} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold sm:text-3xl">학습 준비</h1>
        <p className="mt-2 text-sm text-muted-foreground">닉네임과 오늘의 목표</p>

        <section className="mt-8 space-y-6">
          <div>
            <label htmlFor="prep-nick" className="block text-sm font-bold">
              닉네임 <span className="text-muted-foreground font-normal">(필수)</span>
            </label>
            <input
              id="prep-nick"
              type="text"
              value={nickname}
              onChange={(e) => {
                const v = e.target.value.slice(0, NICK_MAX);
                setNickname(v);
              }}
              maxLength={NICK_MAX}
              placeholder="예: 통번역초보"
              className="mt-2 block w-full rounded-lg border border-foreground bg-background px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              현재 글자수 {nickname.length} / {NICK_MAX}
            </div>
          </div>

          <div>
            <label htmlFor="prep-goal" className="block text-sm font-bold">
              오늘의 학습 목표 <span className="text-muted-foreground font-normal">(필수)</span>
            </label>
            <input
              id="prep-goal"
              type="text"
              value={goal}
              onChange={(e) => {
                const v = e.target.value.slice(0, GOAL_MAX);
                setGoal(v);
              }}
              maxLength={GOAL_MAX}
              placeholder="예: 중요 거래처에 이메일 보낼 때 기분 안 나쁘게 보내기"
              className="mt-2 block w-full rounded-lg border border-foreground bg-background px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div
              className={[
                "mt-1 text-right text-xs",
                goal.length >= GOAL_MAX
                  ? "font-bold text-foreground"
                  : "text-muted-foreground",
              ].join(" ")}
            >
              현재 글자수 {goal.length} / {GOAL_MAX}
            </div>
          </div>
        </section>

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6">
          <Link
            to="/"
            className="rounded-lg border border-foreground bg-background px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
          >
            ← 처음으로
          </Link>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            className={[
              "rounded-lg px-6 py-3 text-base font-medium transition-colors",
              canProceed
                ? "bg-foreground text-background hover:opacity-90"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            ].join(" ")}
          >
            다음 단계로 →
          </button>
        </div>
      </main>
    </div>
  );
};

export default Prep;