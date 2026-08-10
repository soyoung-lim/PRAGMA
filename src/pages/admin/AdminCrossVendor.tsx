import { AdminShell } from "@/components/AdminShell";
import { CORE_AXIS_LABEL, CORE_QUALITY_AXES } from "@/lib/pragma/coreQualityAudit";

// AI 모델 간 독립 검토(교차 벤더 방식) — 생성계약 §5.4
// (2026-08-07 신설 → 같은 날 실행/노출 분리로 2차 개정).
//
// 이 화면이 하는 일: **읽기 전용 열람**뿐이다.
//   - 실행 트리거를 두지 않는다. 배치는 오프라인 스크립트로만 돌리며 §10 승인 게이트를 따른다.
//   - DB를 읽지 않는다. 결과 반입은 배치 산출 파일 열람부터이며 스키마 추가는 별도 승인 사안이다.
//   - 실행 전에는 미실행 상태를 있는 그대로 표시한다. 없는 결과를 채워 보이지 않는다.
//
// 왜 화면이 필요한가: 설계도(/architecture)가 QA 사슬의 한 층으로 공표하는 단계를
// 관리 도구에서 확인할 수 없으면 그 표시가 근거를 잃는다.

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
    <div className="text-[12.5px] font-semibold text-foreground">{title}</div>
    <div className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{children}</div>
  </div>
);

const HUMAN_VERDICTS: [string, string][] = [
  ["결함 확정", "독립 검토의 지적이 타당했다 — 콘텐츠를 고치거나 내린다"],
  ["기존 검사가 옳았음", "독립 검토의 지적이 타당하지 않았다 — 그대로 둔다"],
  ["판단 유보", "둘 다로 결론 내리기 어렵다 — 사유를 남긴다"],
];

const AdminCrossVendor = () => (
  <AdminShell
    title="AI 모델 간 독립 검토"
    description="다른 모델이 동일한 15개 기준으로 독립 판정하며, 불일치는 교수자가 확인합니다. 이 화면은 열람 전용입니다."
  >
    {/* 상태 — 실행 전이라는 사실을 가장 먼저, 가장 분명하게 */}
    <div className="max-w-[42rem] rounded-xl border border-dashed border-[#C3CAD3] bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-dashed border-[#C3CAD3] px-2 py-0.5 text-[10.5px] font-semibold text-[#6B7785]">
          준비 중
        </span>
        <span className="text-[13px] font-semibold">아직 실행하지 않았습니다</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
        검토 대상은 <b>실행 시점의 동결 연구 세트</b>이므로, 콘텐츠 조건 LOCK과 재생산이 끝난 뒤
        한 차례 실행합니다. 실행 이력이 없으므로 이 화면에 표시할 결과도 없습니다.
      </p>
    </div>

    <section className="mt-5">
      <h2 className="text-base font-semibold">이 단계의 지위</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="검증이 아니라 결함 탐지">
          단일 모델 계열에서는 원리적으로 얻을 수 없는 <b>독립 편향 프로파일</b>을 하나 더 대는
          절차입니다. 두 판정이 일치한다고 해서 내용이 타당함을 뜻하지 않습니다.
        </Card>
        <Card title="승인 권한 없음">
          결과가 무엇이든 미션 상태를 바꾸지 못합니다 — 검토 완료로 올리지도, 되돌리지도
          않습니다. 승인·반려는 교수자 검토에서만 결정됩니다.
        </Card>
        <Card title="이견은 사람에게">
          두 벤더의 판정이 갈린 항목은 자동으로 조정하지 않습니다. 다수결·평균·자동 채택을
          두지 않고 사람 판정으로 넘깁니다.
        </Card>
      </div>
    </section>

    <section className="mt-6">
      <h2 className="text-base font-semibold">판정 축 · 15개</h2>
      <p className="mt-1 max-w-[42rem] text-[12px] text-muted-foreground">
        코어 비평과 <b>같은 축</b>을 그대로 씁니다. 축이 다르면 두 판정을 비교할 수 없습니다.
      </p>
      <div className="mt-2 flex max-w-[52rem] flex-wrap gap-1.5">
        {CORE_QUALITY_AXES.map((axis) => (
          <span
            key={axis}
            className="rounded-md border border-[#EAE4D2] bg-[#FAF8F2] px-2 py-1 text-[11.5px]"
          >
            {CORE_AXIS_LABEL[axis]}
          </span>
        ))}
      </div>
    </section>

    <section className="mt-6">
      <h2 className="text-base font-semibold">실행 방법</h2>
      <p className="mt-1 max-w-[42rem] text-[12px] leading-relaxed text-muted-foreground">
        이 화면에는 <b>실행 버튼이 없습니다.</b> 대량 배치는 계약 §10의 승인 게이트를 따르며,
        오프라인 스크립트로만 실행합니다. 대상·규모·모델을 먼저 보고한 뒤 승인을 받습니다.
      </p>
      <pre className="mt-2 max-w-[52rem] overflow-x-auto rounded-lg border border-[#EAE4D2] bg-[#FAF8F2] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed">
{`# 입력 토큰만 계측 (모델 생성 없음 · 비용 0)
node scripts/cross-vendor-review.mjs --run <run_id> --count-only

# 승인 후 실행
node scripts/cross-vendor-review.mjs --run <run_id>`}
      </pre>
    </section>

    <section className="mt-6">
      <h2 className="text-base font-semibold">결과를 읽는 법</h2>
      <p className="mt-1 max-w-[42rem] text-[12px] leading-relaxed text-muted-foreground">
        보고 대상은 일치율이 아니라 <b>불일치</b>입니다. 일치는 &ldquo;둘 다 옳다&rdquo;와
        &ldquo;둘이 비슷한 편향을 공유한다&rdquo;를 구분하지 못하므로 품질의 증거로 쓰지
        않습니다. 축이 갈린 항목마다 사람이 다음 셋 중 하나로 판정합니다.
      </p>
      <div className="mt-2 grid max-w-[52rem] gap-2 sm:grid-cols-3">
        {HUMAN_VERDICTS.map(([label, desc]) => (
          <div key={label} className="rounded-lg border border-[#EAE4D2] bg-white px-3 py-2.5">
            <div className="text-[12.5px] font-semibold">{label}</div>
            <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 max-w-[42rem] text-[11.5px] text-muted-foreground">
        실행 결과는 배치 산출 파일(<code>results.jsonl</code> · <code>SUMMARY.md</code>)로 남습니다.
        이 화면에 결과를 불러오는 것은 파일 열람부터 시작하며, DB 반입은 별도 승인 사안입니다.
      </p>
    </section>

    <p className="mt-6 max-w-[42rem] text-[11px] text-muted-foreground">
      근거: 생성계약 §5.4(AI 모델 간 독립 검토) · §8(provenance) · §10(운영 금지와 승인 게이트).
    </p>
  </AdminShell>
);

export default AdminCrossVendor;
