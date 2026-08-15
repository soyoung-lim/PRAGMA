import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";

/** pending = 라우트는 있으나 내용이 후속 단계. 메뉴에 「준비 중」 배지를 단다. */
type NavItem = { to?: string; label: string; pending?: boolean; activePaths?: string[] };
type NavGroup = {
  header: string;
  items: NavItem[];
};

const STANDALONE: NavItem = { to: "/admin/dashboard", label: "운영 대시보드" };

// 관리자 사이드바는 위에서 아래로 읽으면 실제 작업 순서가 되도록 구성한다.
// 그룹 번호는 없애고, 수업 전 필수 절차인 「품질 검증과 공개」에만 1~4단계를 쓴다.
// 수행기록 내려받기는 학기 후 연구자료 처리이므로 공개 게이트에서 분리한다.
const GROUPS: NavGroup[] = [
  {
    header: "재료와 규칙",
    items: [
      { to: "/admin/corpus", label: "소스 뱅크 (HSK 어휘)" },
      { to: "/admin/question-designer", label: "수준별 문항 설계" },
      // 생성 규칙은 화면이 무거워 맨 뒤로(자주 열지 않는다).
      { to: "/admin/prompt-harness", label: "생성 규칙·프롬프트" },
    ],
  },
  {
    header: "문항 생성",
    items: [
      {
        to: "/admin/generator",
        label: "문항 생성",
        activePaths: ["/admin/generator", "/admin/batch"],
      },
      { to: "/admin/browser", label: "학습 미션 조립" },
    ],
  },
  {
    header: "품질 검증과 공개",
    items: [
      { to: "/admin/research-qa", label: "전체 현황" },
      { to: "/admin/research-qa/calibration", label: "1. 기준답안 연구자 판정" },
      { to: "/admin/research-qa/gold-experts", label: "2. 기준답안 외부 전문가 확인" },
      { to: "/admin/research-qa/final-review", label: "3. 504개 자동 점검·경고 검토" },
      { to: "/admin/research-qa/releases", label: "4. 학습자 공개" },
    ],
  },
  {
    header: "수업 편성",
    items: [
      { to: "/admin/curriculum", label: "커리큘럼 구조" },
      { to: "/admin/composer", label: "주차별 시나리오 편성" },
      { to: "/admin/package", label: "수업 자료 생성", pending: true },
    ],
  },
  {
    header: "학습자와 연구자료",
    items: [
      { to: "/admin/learners", label: "학습자 관리" },
      { to: "/admin/decision-traces", label: "수행·의사결정 기록" },
      { to: "/admin/analytics", label: "학습 분석", pending: true },
      { to: "/admin/research-qa/improvements", label: "학습 콘텐츠 개선" },
      { to: "/admin/export", label: "수행기록 내려받기" },
    ],
  },
  {
    header: "흐름 밖 참조",
    items: [
      { to: "/admin/archive", label: "시나리오 아카이브" },
    ],
  },
];

interface AdminShellProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export const AdminShell = ({ title, description, children }: AdminShellProps) => {
  const { pathname } = useLocation();

  const standaloneClasses = (active: boolean) =>
    [
      "rounded-md px-3 py-[6px] text-[14px] whitespace-nowrap transition-colors mr-2",
      active
        ? "bg-[#FAD338] text-[#15202B] font-medium"
        : "text-foreground font-normal hover:bg-muted hover:text-foreground",
    ].join(" ");

  const itemClasses = (active: boolean) =>
    [
      "rounded-md px-3 py-[6px] text-[14px] whitespace-nowrap transition-colors mr-2",
      active
        ? "bg-[#FAD338] text-[#15202B] font-medium"
        : "text-foreground font-normal hover:bg-muted hover:text-foreground",
    ].join(" ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
          <Link
            to="/"
            className="text-sm text-[#8899A6] transition-colors hover:text-[#F1EFE8]"
          >
            ← 학습자 화면으로
          </Link>
        </div>
      </header>

      <div className="flex gap-6 pl-5 pr-8 py-6">
        <aside className="hidden w-[285px] shrink-0 md:block">
          <nav className="flex flex-col px-1">
            <Link
              to={STANDALONE.to}
              className={standaloneClasses(pathname === STANDALONE.to)}
            >
              {STANDALONE.label}
            </Link>

            {GROUPS.map((group) => (
              <div key={group.header} className="flex flex-col">
                <span
                  className="mt-5 mb-1.5 px-3 text-[12px] font-medium uppercase tracking-[0.08em] text-[#8a857c] whitespace-nowrap cursor-default select-none"
                >
                  {group.header}
                </span>
                <div className="flex flex-col gap-[2px] border-l border-[#e5e1d8] pl-4">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to ?? "#"}
                      className={itemClasses(
                        pathname === item.to || item.activePaths?.includes(pathname) === true,
                      )}
                    >
                      {item.label}
                      {item.pending && (
                        <span className="ml-1.5 rounded-full bg-[#EDE9DD] px-1.5 py-[1px] align-middle text-[10px] font-normal text-[#8a857c]">
                          준비 중
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex items-stretch gap-3">
            <span
              aria-hidden
              className="mt-1 w-[5px] shrink-0 self-stretch rounded-sm bg-[#FAD338]"
            />
            <div>
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export const AdminPlaceholder = ({
  title,
  description,
  note = "이 화면은 후속 단계에서 구현됩니다.",
}: {
  title: string;
  description?: string;
  note?: string;
}) => (
  <AdminShell title={title} description={description}>
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  </AdminShell>
);

export default AdminShell;
