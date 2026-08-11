import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { CORE_AXIS_LABEL, CORE_QUALITY_AXES } from "@/lib/pragma/coreQualityAudit";

// AI 모델 간 독립 검토(교차 벤더 방식) — 생성계약 §5.4
// 실행 트리거와 DB 반입은 두지 않는다. 이 화면은 승인 후 오프라인에서 실행한
// 2026-08-10 Claude Opus 5 목적 표집 6건의 파일 결과를 읽기 전용으로 보여 준다.

type ModelVerdict = "fail" | "warning" | "pass";
type ContractCheck = "근거 확인" | "일부 확인·일부 유보" | "제시 근거 미지지";

type PilotResult = {
  id: string;
  context: string;
  verdict: ModelVerdict;
  axes: string;
  contractCheck: ContractCheck;
  note: string;
};

const PILOT_RESULTS: PilotResult[] = [
  {
    id: "7476fd20…df78",
    context: "고급 · 통역 · 요청 · 학업",
    verdict: "fail",
    axes: "학생용 장면",
    contractCheck: "근거 확인",
    note: "상황문이 부담·거절 권리라는 내부 평가 기준을 노출해 R30과 충돌했습니다.",
  },
  {
    id: "73beae07…e585",
    context: "고급 · 번역 · 거절 · 직장",
    verdict: "warning",
    axes: "부담",
    contractCheck: "제시 근거 미지지",
    note: "학습자 A의 업무 부담과 상대 B에게 주는 부담 R을 혼동한 지적으로 확인됐습니다.",
  },
  {
    id: "d297b754…d780",
    context: "입문 · 통역 · 감사 · 일상",
    verdict: "fail",
    axes: "부담 · 통역 참여자 · 학생용 장면",
    contractCheck: "일부 확인·일부 유보",
    note: "A/B/C 역할 중첩과 평가 방향 노출은 확인했고, 감사 화행의 부담 해석은 유보했습니다.",
  },
  {
    id: "940df465…94f9",
    context: "입문 · 번역 · 거절 · 학업",
    verdict: "warning",
    axes: "학생용 장면",
    contractCheck: "근거 확인",
    note: "‘정중하게 거절’이 답 방향을 노출했습니다. 계약상 warning보다 fail에 가까운 근거입니다.",
  },
  {
    id: "4202edc4…ce64",
    context: "중급 · 통역 · 사과 · 직장",
    verdict: "fail",
    axes: "지시 대상 · 통역 참여자 · 학생용 장면",
    contractCheck: "근거 확인",
    note: "학습자가 원발화자이면서 자기 발화 통역사여서 A/B/C 분리 규칙과 충돌했습니다.",
  },
  {
    id: "c50236f7…8cd4",
    context: "중급 · 번역 · 반대 · 일상",
    verdict: "fail",
    axes: "지시 대상 · 인접쌍 · 상황-원문 · 학생용 장면",
    contractCheck: "근거 확인",
    note: "선행발화가 이미 반대를 수행하고 턴별 제안 소유자가 뒤집힌 계약 위반 후보입니다.",
  },
];

const HUMAN_VERDICTS: [string, string][] = [
  ["결함 확정", "지적이 타당함 · 콘텐츠 수정 또는 제외"],
  ["기존 검사가 옳았음", "지적이 타당하지 않음 · 콘텐츠 유지"],
  ["판단 유보", "현재 근거로 결론 내리기 어려움 · 사유 기록"],
];

const VERDICT_CLASS: Record<ModelVerdict, string> = {
  fail: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  pass: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

const CONTRACT_CLASS: Record<ContractCheck, string> = {
  "근거 확인": "text-emerald-800",
  "일부 확인·일부 유보": "text-amber-800",
  "제시 근거 미지지": "text-slate-700",
};

const StatusCard = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className="rounded-lg border border-[#E5DEC9] bg-white p-3">
    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A7621]">{label}</p>
    <p className="mt-1 text-[19px] font-bold text-[#26333B]">{value}</p>
    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{note}</p>
  </div>
);

const AdminCrossVendor = () => (
  <AdminShell
    title="AI 모델 간 독립 검토"
    description="다른 벤더 모델이 같은 15개 축으로 찾은 결함 후보와 그 한계를 읽기 전용으로 확인합니다. 승인·반려는 교수자가 결정합니다."
  >
    <section aria-labelledby="pilot-result-title" className="rounded-xl border border-[#D9D2BF] bg-[#FFFDF7] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 font-normal text-emerald-900">
          파일럿 실행 완료
        </Badge>
        <Badge variant="outline" className="border-amber-300 bg-amber-50 font-normal text-amber-900">
          연구자 판정 대기
        </Badge>
        <span className="text-[11.5px] text-muted-foreground">2026-08-10 · Claude Opus 5</span>
      </div>
      <h2 id="pilot-result-title" className="mt-2 text-[18px] font-bold text-[#26333B]">
        구세대 코어 6건에서 결함 후보를 구조화해 제시했습니다
      </h2>
      <p className="mt-1 max-w-[50rem] text-[12.5px] leading-relaxed text-muted-foreground">
        수준×모드 3×2 목적 표집을 API로 6/6 검토했습니다. 2차 AI 정본 대조에서 5건은 적어도
        하나의 계약 근거가 직접 확인됐지만, 축 혼동과 심각도 과소도 함께 발견됐습니다.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="API 실행" value="6/6" note="오류 없이 구조화 결과 저장" />
        <StatusCard label="모델 총평" value="fail 4 · warning 2" note="pass 0 · 파일럿 내부 결과" />
        <StatusCard label="2차 AI 정본 대조" value="근거 확인 5/6" note="최종 연구자 판정은 아님" />
        <StatusCard label="실측 비용" value="$0.6740" note="입력 48,710 · 출력 17,219 토큰" />
      </div>

      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-[12px] leading-relaxed text-amber-950">
        <b>해석 한계</b> · 무작위 표본이 아니며 모두 <code>needs_review</code>인 구세대
        <code>core_v8</code> 계열입니다. OpenAI 기준선 비교와 최종 연구자 판정은 실행하지 않았습니다.
        따라서 불일치율·정확도·신뢰도·현행 콘텐츠 결함률을 계산하거나 주장할 수 없습니다.
      </div>
    </section>

    <section className="mt-6" aria-labelledby="pilot-items-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="pilot-items-title" className="text-base font-semibold">파일럿 6건 · 행별 대조</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            모델 총평과 계약 근거 대조를 분리했습니다. 연구자 판정은 6건 모두 pending입니다.
          </p>
        </div>
        <Badge variant="outline" className="bg-white font-normal">DB·콘텐츠 상태 변경 0건</Badge>
      </div>

      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {PILOT_RESULTS.map((result) => (
          <article key={result.id} className="rounded-xl border border-[#E5E0D4] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] text-muted-foreground">{result.id}</p>
                <h3 className="mt-0.5 text-[13px] font-semibold text-[#26333B]">{result.context}</h3>
              </div>
              <Badge variant="outline" className={VERDICT_CLASS[result.verdict]}>
                Claude {result.verdict}
              </Badge>
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">비통과 축 · {result.axes}</p>
            <p className={`mt-2 text-[12px] font-semibold ${CONTRACT_CLASS[result.contractCheck]}`}>
              2차 AI 대조 · {result.contractCheck}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#4F5960]">{result.note}</p>
            <div className="mt-3 border-t border-[#EEE9DD] pt-2 text-[11.5px] text-muted-foreground">
              연구자 판정 · <b className="text-[#6D675D]">pending</b>
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="mt-6 rounded-xl border border-[#E5E0D4] bg-[#FBFAF7] p-4" aria-labelledby="procedure-title">
      <h2 id="procedure-title" className="text-base font-semibold">절차의 지위와 다음 판정</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <p className="text-[12.5px] font-semibold">결함 탐지 · 검증 아님</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            독립 벤더의 편향 프로파일을 하나 더 대는 절차입니다. 모델 간 일치는 내용 타당성을
            보장하지 않습니다.
          </p>
        </div>
        <div>
          <p className="text-[12.5px] font-semibold">승인 권한 없음</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            결과가 미션 상태를 올리거나 내리지 않습니다. DB 반입도 별도 승인 사안입니다.
          </p>
        </div>
        <div>
          <p className="text-[12.5px] font-semibold">자동 다수결 없음</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            불일치와 유보 항목은 평균내거나 자동 채택하지 않고 사람에게 넘깁니다.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {HUMAN_VERDICTS.map(([label, desc]) => (
          <div key={label} className="rounded-lg border border-[#E5E0D4] bg-white px-3 py-2.5">
            <div className="text-[12.5px] font-semibold">{label}</div>
            <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>
    </section>

    <section className="mt-6" aria-labelledby="axes-title">
      <h2 id="axes-title" className="text-base font-semibold">판정 축 · 15개</h2>
      <p className="mt-1 max-w-[46rem] text-[12px] text-muted-foreground">
        코어 비평과 같은 축을 사용해야 결과를 비교할 수 있습니다. 이번 파일럿도 이 15축을 고정했습니다.
      </p>
      <div className="mt-2 flex max-w-[56rem] flex-wrap gap-1.5">
        {CORE_QUALITY_AXES.map((axis) => (
          <span key={axis} className="rounded-md border border-[#EAE4D2] bg-[#FAF8F2] px-2 py-1 text-[11.5px]">
            {CORE_AXIS_LABEL[axis]}
          </span>
        ))}
      </div>
    </section>

    <section className="mt-6" aria-labelledby="execution-title">
      <h2 id="execution-title" className="text-base font-semibold">실행·증거 보존</h2>
      <p className="mt-1 max-w-[48rem] text-[12px] leading-relaxed text-muted-foreground">
        이 화면에는 실행 버튼이 없습니다. 추가 배치는 대상·규모·모델을 먼저 보고하고 승인받은 뒤
        오프라인 스크립트로 실행합니다. 원본은 Git 제외 <code>results.jsonl</code>, 정본 대조는
        아래 연구 증거 문서에 보존했습니다.
      </p>
      <div className="mt-2 max-w-[56rem] rounded-lg border border-[#EAE4D2] bg-[#FAF8F2] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[#5B6166]">
        docs/research-trail/evidence/2026-08-10-claude-core-pilot6-adjudication.md
      </div>
    </section>

    <p className="mt-6 max-w-[48rem] text-[11px] text-muted-foreground">
      근거: 생성계약 §5.4(AI 모델 간 독립 검토) · §8(provenance) · §10(승인 게이트).
      후속 미실행: OpenAI 기준선 비교 · 나머지 18건 확대 · 최종 연구자 판정.
    </p>
  </AdminShell>
);

export default AdminCrossVendor;
