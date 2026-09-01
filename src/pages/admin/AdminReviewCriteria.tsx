import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Lock } from "lucide-react";

import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MISSION_RULE_CATALOG } from "@/lib/pragma/missionRuleCatalog";
import { LEARNER_RUNTIME_PROMPT_GROUPS } from "@/lib/pragma/promptGovernance";
import { PROMPT_SNAPSHOT, type PromptSnapshotEntry } from "@/lib/pragma/promptSnapshot.generated";
import {
  CONTENT_REVIEW_ADJUDICATION_PROMPT,
  CONTENT_REVIEW_AUDIT_PROMPT,
  CONTENT_REVIEW_CLAUDE_PROMPT,
  CONTENT_REVIEW_PROMPT_SURFACE,
  CONTENT_REVIEW_STEPS,
  CONTENT_REVIEW_VERSION,
  reviewHash,
} from "../../../supabase/functions/_shared/contentReview";

const STEP_DESCRIPTION: Record<(typeof CONTENT_REVIEW_STEPS)[number]["key"], string> = {
  rules: "결정론적 R 규칙을 무료로 실행하고 치명적 오류를 먼저 차단합니다.",
  openai: "원본과 현행 기준만으로 의미·자연성·화용 적절성을 1차 점검합니다.",
  claude: "OpenAI 결과를 보지 않고 같은 원본과 기준을 독립적으로 교차검수합니다.",
  adjudication: "Claude 지적을 원본 근거와 대조해 수용·보완·기각으로 정리합니다.",
  professor: "원본과 모든 근거를 비교해 교수자가 수업 사용 여부를 최종 결정합니다.",
};

const OPERATIONAL_PROMPTS = [
  {
    key: "openai",
    title: "2. OpenAI 1차",
    input: "현재 콘텐츠 원본 + 현행 검수 기준",
    isolation: "Claude 결과 없음",
    text: CONTENT_REVIEW_AUDIT_PROMPT,
  },
  {
    key: "claude",
    title: "3. Claude 교차",
    input: "현재 콘텐츠 원본 + 현행 검수 기준",
    isolation: "OpenAI 1차 결과를 제공하지 않음",
    text: CONTENT_REVIEW_CLAUDE_PROMPT,
  },
  {
    key: "adjudication",
    title: "4. OpenAI 정리",
    input: "현재 콘텐츠 원본 + 현행 검수 기준 + Claude 지적",
    isolation: "OpenAI 1차 결과를 제공하지 않음",
    text: CONTENT_REVIEW_ADJUDICATION_PROMPT,
  },
] as const;

function plainRuleText(value: string) {
  return value.replace(/\*\*/g, "").replace(/`/g, "");
}

function PromptDetails({ entry }: { entry: PromptSnapshotEntry }) {
  return (
    <details className="rounded-lg border border-[#E5E1D8] bg-white p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        <span>{entry.label}</span>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          {entry.sha256.slice(0, 10)}
        </Badge>
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
      <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
        {entry.text}
      </pre>
      <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
        {entry.key} · sha256 {entry.sha256}
      </p>
    </details>
  );
}

const AdminReviewCriteria = () => {
  const [surfaceHash, setSurfaceHash] = useState<string | null>(null);
  const [hashError, setHashError] = useState(false);
  const runtimePrompts = PROMPT_SNAPSHOT.prompts.filter((prompt) =>
    LEARNER_RUNTIME_PROMPT_GROUPS.includes(prompt.group as (typeof LEARNER_RUNTIME_PROMPT_GROUPS)[number]),
  );

  useEffect(() => {
    let active = true;
    void reviewHash(CONTENT_REVIEW_PROMPT_SURFACE)
      .then((hash) => active && setSurfaceHash(hash))
      .catch(() => active && setHashError(true));
    return () => { active = false; };
  }, []);

  return (
    <AdminShell
      title="검수 기준·운영 프롬프트"
      description="R 검사부터 교수자 최종 승인까지, 현재 콘텐츠 버전의 5단계 품질 검사 기준과 모델 간 정보 경계를 확인합니다."
    >
      <section className="rounded-xl border border-[#D9D2BF] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[50rem]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A7621]">현재 콘텐츠 버전</p>
            <h2 className="mt-1 text-[18px] font-bold text-[#26333B]">품질 검사는 5단계입니다</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              콘텐츠 생성은 이 검사에 앞선 제작 과정입니다. 아래 다섯 단계는 순서대로 실행되며,
              어떤 AI도 원문을 자동 수정하거나 최종 승인할 수 없습니다.
            </p>
          </div>
          <Link to="/admin/prompt-harness" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D5C1F] hover:text-[#15202B]">
            생성 계약·개발 프롬프트 <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-[#D8D3C4] bg-[#F8F7F3] px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">생성·저장 선행 게이트 · 5단계 밖</strong>
          <span className="ml-2">콘텐츠 생성 → R 규칙 검사 + production quality critic → generated 저장</span>
        </div>

        <ol className="mt-4 grid gap-2 md:grid-cols-5">
          {CONTENT_REVIEW_STEPS.map((step, index) => (
            <li key={step.key} className="rounded-lg border border-[#E5DEC9] bg-[#FBFAF6] p-3">
              <span className="text-[11px] font-semibold text-[#8A7621]">{index + 1}</span>
              <h3 className="mt-1 text-sm font-bold">{step.label}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{STEP_DESCRIPTION[step.key]}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-xl border border-[#D9D2BF] bg-white p-4 sm:p-5" aria-labelledby="rule-catalogue-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[52rem]">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="rule-catalogue-title" className="text-[17px] font-bold">1. R 검사</h2>
              <Badge variant="outline">결정론 · API 0회</Badge>
              <Badge variant="outline">R1–R33</Badge>
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">R22 retired</Badge>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              구조·언어 방향·대역 코드·계승·중복처럼 코드로 재현할 수 있는 범위만 검사합니다.
              R1c는 코어 구조용 하위 감사 키이고, R22는 비차단 HSK 어휘 점검으로 대체되어 번호만 보존합니다.
              의미 보존·자연성·교육적 적합성은 뒤의 AI와 교수자 단계가 판단합니다.
            </p>
          </div>
          <Link to="/admin/corpus" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D5C1F] hover:text-[#15202B]">
            HSK 기준·최근 결과 <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <details className="mt-4 rounded-lg border border-[#E5E1D8] bg-[#FBFAF6] p-3">
          <summary className="cursor-pointer text-sm font-semibold">R1–R33 전체 카탈로그 보기 · 33개 번호</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#D9D2BF] text-muted-foreground">
                  <th className="w-24 px-2 py-2 font-semibold">코드</th>
                  <th className="px-2 py-2 font-semibold">검사 내용</th>
                  <th className="w-64 px-2 py-2 font-semibold">판정·범위</th>
                  <th className="w-20 px-2 py-2 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {MISSION_RULE_CATALOG.map((rule) => (
                  <tr key={rule.displayId} className="border-b border-[#ECE8DE] align-top last:border-0">
                    <td className="px-2 py-2 font-mono font-semibold">{rule.displayId}</td>
                    <td className="px-2 py-2 leading-relaxed">{plainRuleText(rule.check)}</td>
                    <td className="px-2 py-2 leading-relaxed text-muted-foreground">{plainRuleText(rule.verdict)}</td>
                    <td className="px-2 py-2">
                      <Badge variant="outline" className={rule.status === "retired" ? "border-amber-300 bg-amber-50 text-amber-900" : "bg-white"}>
                        {rule.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="mt-6 space-y-3" aria-labelledby="operational-prompts-title">
        <div className="rounded-xl border border-[#D9D2BF] bg-[#FBFAF7] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Lock className="h-4 w-4 text-[#8a857c]" aria-hidden />
            <h2 id="operational-prompts-title" className="text-[17px] font-bold">운영 검수 프롬프트 · 읽기 전용</h2>
            <Badge variant="outline">{CONTENT_REVIEW_VERSION}</Badge>
          </div>
          <p className="mt-2 max-w-[52rem] text-[12.5px] leading-relaxed text-muted-foreground">
            아래 원문은 실제 검수 Edge와 같은 공용 모듈을 읽습니다. 화면용 복사본이 아니며,
            각 결과에는 prompt version·입력 지문·provider·model·실행 시각이 별도로 저장됩니다.
          </p>
          <p className="mt-2 break-all font-mono text-[10.5px] text-muted-foreground">
            현재 프롬프트 표면 SHA-256 · {surfaceHash ?? (hashError ? "계산 불가" : "계산 중…")}
          </p>
        </div>

        {OPERATIONAL_PROMPTS.map((prompt) => (
          <Card key={prompt.key}>
            <CardHeader className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{prompt.title}</CardTitle>
                <Badge variant="outline">입력 격리</Badge>
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <p className="rounded bg-[#F8F7F3] p-2"><strong>입력</strong><br />{prompt.input}</p>
                <p className="rounded bg-[#F8F7F3] p-2"><strong>보지 않는 정보</strong><br />{prompt.isolation}</p>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-xs font-semibold">실제 system prompt 보기</summary>
                <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                  {prompt.text}
                </pre>
              </details>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-[#D9D2BF] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[17px] font-bold">5. 교수자 최종 승인</h2>
          <Badge variant="outline">최종 권한</Badge>
          <Badge variant="outline">API 0회</Badge>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
          <li>Claude 원 지적과 OpenAI 정리는 삭제하거나 합치지 않고 나란히 보존합니다.</li>
          <li>교수자는 각 지적을 수정 필요·수정 없이 사용·판단 보류로 직접 결정하고 이유를 남깁니다.</li>
          <li>수정 필요나 판단 보류가 남으면 승인할 수 없으며, 콘텐츠 수정 시 새 버전으로 1–4단계를 다시 실행합니다.</li>
          <li>AI는 수정안을 제안할 뿐 콘텐츠를 자동 수정하거나 학습자에게 공개하지 않습니다.</li>
        </ul>
        <Link to="/admin/review" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#6D5C1F] hover:text-[#15202B]">
          콘텐츠 검수·확정으로 이동 <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </section>

      {runtimePrompts.length > 0 && (
        <details className="mt-6 rounded-xl border border-[#D9D2BF] bg-[#FBFAF7] p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold">학습자 실행 중 피드백 프롬프트 · 5단계 품질 검사 밖</summary>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            교수자가 승인한 콘텐츠를 학습자가 수행한 뒤 받는 피드백입니다. 콘텐츠 승인용 5단계와
            목적·대상·실행 시점이 달라 기본 화면에서는 접어 둡니다.
          </p>
          <div className="mt-3 space-y-2">
            {runtimePrompts.map((entry) => <PromptDetails key={entry.key} entry={entry} />)}
          </div>
        </details>
      )}
    </AdminShell>
  );
};

export default AdminReviewCriteria;
