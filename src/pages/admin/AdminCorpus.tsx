import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_TYPES = [
  {
    key: "general_corpus",
    label: "일반 코퍼스",
    description: "중국어 자연성·용례 확인",
  },
  {
    key: "learner_corpus",
    label: "학습자 코퍼스",
    description: "한국어권 학습자 오류 참고",
  },
  {
    key: "parallel_corpus",
    label: "병렬 코퍼스",
    description: "한중/중한 번역 대응 참고",
  },
  {
    key: "official_text",
    label: "공식 자료",
    description: "업무·공식 문체 시나리오 seed",
  },
  {
    key: "classroom_pilot_data",
    label: "수업 기반 설계 자료",
    description: "2차 토론·기말보고서·원어민 코멘트 등 수업 기반 설계 자료",
  },
];

const FlowItem = ({ label, isLast = false }: { label: string; isLast?: boolean }) => (
  <div className="flex items-center gap-2">
    <div className="rounded-md bg-[#15202B] px-3 py-1.5 text-[13px] font-medium text-[#F1EFE8]">
      {label}
    </div>
    {!isLast && (
      <span className="text-[#8a857c]" aria-hidden>
        →
      </span>
    )}
  </div>
);

const AdminCorpus = () => {
  return (
    <AdminShell
      title="코퍼스 기반 Source Bank"
      description="AI 시나리오 생성을 위한 근거 자료 관리"
    >
      <div className="space-y-6">
        {/* 설명 문단 */}
        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-4 text-[13px] leading-relaxed text-foreground">
          코퍼스, 공식자료, 수업자료, 원어민 코멘트를 AI 시나리오 생성의 근거 자료로 관리합니다. 본 기능은
          코퍼스 분석 모듈이 아니라, AI 생성물이 임의로 만들어지지 않도록 통제하기 위한 Source
          Bank입니다. 본실험 분석 데이터는 한→중 요청·거절 decision_trace입니다.
        </div>

        {/* 한 줄 callout */}
        <div className="rounded-md border-l-4 border-[#FAD338] bg-[#FAD338]/10 p-3 text-[13px] font-medium text-foreground">
          코퍼스는 본 연구의 분석 대상이 아니라, AI 생성 시나리오의 근거 자료이자 통제 장치입니다.
        </div>

        {/* 5개 source type 카드 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCE_TYPES.map((st) => (
            <Card key={st.key} className="border-[#EAE4D2] bg-[#FAF7EE]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{st.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-muted-foreground">{st.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* flow diagram */}
        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">자료 흐름</h3>
          <div className="flex flex-wrap items-center gap-2">
            <FlowItem label="코퍼스 (Source Bank)" />
            <FlowItem label="AI 시나리오 생성" />
            <FlowItem label="프롬프트 관리" />
            <FlowItem label="시나리오 검수" />
            <FlowItem label="시나리오 아카이브" />
            <FlowItem label="학습자 decision_trace" isLast />
          </div>
        </div>

        {/* 정직한 skeleton 문구 */}
        <div className="rounded-md border border-dashed border-[#EAE4D2] bg-background p-4 text-center text-[13px] text-muted-foreground">
          현재는 source bank 구조를 보여주는 skeleton 단계입니다. 실제 RAG 검색, corpus query, AI-Hub
          연동은 후속 구현으로 분리합니다.
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminCorpus;
