// 「실제 자료 활용」 — /admin/authentic (2026-07-30 승격, 사용자 결정).
// 이전에는 개별 생성 화면의 접이식 패널이었으나, 자료 입력→추출→AI 해석→후보 비교→
// 생성기 채우기의 완결된 저작 워크플로우라 독립 화면으로 분리했다.
// 생성 로직은 복제하지 않는다 — 후보 선택 시 페이로드를 sessionStorage로 넘기고
// /admin/generator가 기존 applyAuthentic 경로로 소비한다.

import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import AuthenticImportPanel, {
  AUTHENTIC_HANDOFF_KEY,
  type AuthenticApply,
} from "./AuthenticImportPanel";

const AdminAuthentic = () => {
  const navigate = useNavigate();

  const handleApply = (a: AuthenticApply) => {
    try {
      sessionStorage.setItem(AUTHENTIC_HANDOFF_KEY, JSON.stringify(a));
    } catch {
      // sessionStorage 실패(프라이빗 모드 등) — 전달 없이 생성기만 연다.
    }
    navigate("/admin/generator?from=authentic");
  };

  return (
    <AdminShell
      title="실제 자료 활용"
      description="중국 쇼츠 캡처·소설 구절·메신저 문구 같은 실제 자료를 AI가 분석해, 시나리오·선행 발화·표현 자원 활용 후보를 제안합니다."
    >
      <div className="mt-4">
        <AuthenticImportPanel onApply={handleApply} />
      </div>
    </AdminShell>
  );
};

export default AdminAuthentic;
