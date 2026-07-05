import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const AdminYoutubeSources = () => {
  return (
    <AdminShell
      title="영상·음성 소스"
      description="YouTube/Supadata 기반 통역 시나리오 자료 관리"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3.5 text-[13px] leading-relaxed text-foreground">
          YouTube 링크와 자막 데이터를 통역 시나리오 seed로 활용하기 위한 영역입니다. (다음 단계 연동 예정)
        </div>

        <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3.5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">자료 흐름</h3>
          <div className="flex flex-wrap items-center gap-2">
            <FlowItem label="YouTube 링크" />
            <FlowItem label="Supadata 자막 추출" />
            <FlowItem label="통역 시나리오 seed" />
            <FlowItem label="TTS 음성화" isLast />
          </div>
        </div>

        <Card className="border-[#EAE4D2] bg-[#FAF7EE]">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">등록된 영상·음성 소스</CardTitle>
              <Badge variant="secondary">연동 예정</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button disabled>
                YouTube 링크 추가
                <Badge variant="secondary" className="ml-2">연동 예정</Badge>
              </Button>
              <Button disabled variant="outline">
                자막 추출하기
                <Badge variant="secondary" className="ml-2">연동 예정</Badge>
              </Button>
              <Button disabled variant="outline">
                통역 시나리오로 변환
                <Badge variant="secondary" className="ml-2">연동 예정</Badge>
              </Button>
            </div>

            <div className="rounded-md border border-[#EAE4D2] bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>영상 제목</TableHead>
                    <TableHead>언어</TableHead>
                    <TableHead>자막 추출 상태</TableHead>
                    <TableHead>시나리오 변환 상태</TableHead>
                    <TableHead>사용 주차</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-[13px] text-muted-foreground">
                      https://youtube.com/watch?v=example
                    </TableCell>
                    <TableCell className="text-[13px]">(예시) 비즈니스 회의 통역 클립</TableCell>
                    <TableCell className="text-[13px]">中→韓</TableCell>
                    <TableCell>
                      <Badge variant="secondary">대기</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">대기</Badge>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-md border border-dashed border-[#EAE4D2] bg-background p-3.5 text-center text-[13px] text-muted-foreground">
          현재는 화면 구조만 준비된 skeleton 단계입니다. Supadata API 연동 및 저장은 후속 구현으로 분리합니다.
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminYoutubeSources;
