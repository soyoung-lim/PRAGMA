import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "./components/ScrollToTop";
import { seedIfEmpty } from "./lib/learningSessions";

const RequireApproved = lazy(() => import("./components/RequireApproved"));
const RequireAdmin = lazy(() => import("./components/RequireAdmin"));
const AdminPlaceholder = lazy(() =>
  import("@/components/AdminShell").then((module) => ({ default: module.AdminPlaceholder })),
);
const Index = lazy(() => import("./pages/Index.tsx"));
const Architecture = lazy(() => import("./pages/Architecture.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AdminArchive = lazy(() => import("./pages/AdminArchive.tsx"));
const AdminCorpus = lazy(() => import("./pages/admin/AdminCorpus.tsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const AdminGenerator = lazy(() => import("./pages/admin/AdminGenerator.tsx"));
const AdminBatch = lazy(() => import("./pages/admin/AdminBatch.tsx"));
const AdminBrowser = lazy(() => import("./pages/admin/AdminBrowser.tsx"));
const AdminPromptHarness = lazy(() => import("./pages/admin/AdminPromptHarness.tsx"));
const AdminQuestionDesigner = lazy(() => import("./pages/admin/AdminQuestionDesigner.tsx"));
const AdminYoutubeSources = lazy(() => import("./pages/admin/AdminYoutubeSources.tsx"));
const AdminReview = lazy(() => import("./pages/admin/AdminReview.tsx"));
const AdminCurriculum = lazy(() => import("./pages/admin/AdminCurriculum.tsx"));
const AdminComposer = lazy(() => import("./pages/admin/AdminComposer.tsx"));
const AdminLearners = lazy(() => import("./pages/admin/AdminLearners.tsx"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports.tsx"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics.tsx"));
const AdminExport = lazy(() => import("./pages/admin/AdminExport.tsx"));
const AdminDecisionTraces = lazy(() => import("./pages/admin/AdminDecisionTraces.tsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.tsx"));
const StudentLogin = lazy(() => import("./pages/StudentLogin.tsx"));
const PendingApproval = lazy(() => import("./pages/PendingApproval.tsx"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Roadmap = lazy(() => import("./pages/Roadmap.tsx"));
const WorkflowPreview = lazy(() => import("./pages/WorkflowPreview.tsx"));
const MissionShell = lazy(() => import("./pages/MissionShell.tsx"));
const LearnerHome = lazy(() => import("./pages/learner/LearnerHome.tsx"));
const LoungeHome = lazy(() => import("./pages/learner/LoungeHome.tsx"));
const LoungeCorner = lazy(() => import("./pages/learner/LoungeCorner.tsx"));
const CourseOverview = lazy(() => import("./pages/learner/CourseOverview.tsx"));
const WeekDetail = lazy(() => import("./pages/learner/WeekDetail.tsx"));
const IntroArc = lazy(() => import("./pages/learner/IntroArc.tsx"));
const WeeklyLearningNote = lazy(() => import("./pages/learner/WeeklyLearningNote.tsx"));
const LearnerRecords = lazy(() => import("./pages/learner/LearnerRecords.tsx"));
const StrategyMap = lazy(() => import("./pages/learner/StrategyMap.tsx"));
const PrototypeMissionV2 = lazy(() => import("./pages/learner/PrototypeMissionV2.tsx"));
const MissionRunV1 = lazy(() => import("./pages/learner/MissionRunV1.tsx"));
const LearnerCourseLive = lazy(() => import("./pages/learner/LearnerCourseLive.tsx"));
const EntryTaskMode = lazy(() => import("./pages/EntryTaskMode.tsx"));
const EntryLanguageDirection = lazy(() => import("./pages/EntryLanguageDirection.tsx"));
const EntryUnavailable = lazy(() => import("./pages/EntryUnavailable.tsx"));

seedIfEmpty();

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
    화면을 불러오는 중…
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Index />} />
          {/* 심사 설명용 read-only 구조 화면 — 실데이터가 없어 로그인을 요구하지 않는다. */}
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/student-login" element={<StudentLogin />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/home" element={<Home />} />
          <Route path="/roadmap" element={<RequireApproved><Roadmap /></RequireApproved>} />
          <Route path="/workflow-preview" element={<WorkflowPreview />} />
          <Route path="/learner/home" element={<RequireApproved><LearnerHome /></RequireApproved>} />
          <Route path="/learner/lounge" element={<RequireApproved><LoungeHome /></RequireApproved>} />
          <Route path="/learner/lounge/:corner" element={<RequireApproved><LoungeCorner /></RequireApproved>} />
          {/* 게시·편성된 DB 강좌가 일반 학습자 수업의 단일 정본이다. */}
          <Route path="/learner/course" element={<RequireApproved><LearnerCourseLive /></RequireApproved>} />
          <Route path="/learner/course-live" element={<Navigate to="/learner/course" replace />} />
          <Route path="/learner/course/week/:weekNo/note" element={<RequireApproved><WeeklyLearningNote /></RequireApproved>} />
          {/* 구 2주차 목업 주소는 실제 강좌로 복귀시킨다. */}
          <Route path="/learner/course/week/2" element={<Navigate to="/learner/course" replace />} />
          <Route path="/learner/course/week/2/intro" element={<Navigate to="/learner/course" replace />} />
          {/* 고정 진행률·샘플 주차 흐름은 개발 환경에서만 명시적 demo 경로로 연다. */}
          <Route
            path="/learner/demo/course"
            element={
              import.meta.env.DEV
                ? <RequireApproved><CourseOverview /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          <Route
            path="/learner/demo/course/week/2"
            element={
              import.meta.env.DEV
                ? <RequireApproved><WeekDetail /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          <Route
            path="/learner/demo/course/week/2/intro"
            element={
              import.meta.env.DEV
                ? <RequireApproved><IntroArc /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          <Route
            path="/learner/demo/course/week/2/note"
            element={
              import.meta.env.DEV
                ? <RequireApproved><WeeklyLearningNote allowSample /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          <Route path="/learner/records" element={<RequireApproved><LearnerRecords /></RequireApproved>} />
          <Route path="/learner/strategy" element={<Navigate to="/learner/course" replace />} />
          <Route
            path="/learner/demo/strategy"
            element={
              import.meta.env.DEV
                ? <RequireApproved><StrategyMap /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          {/* legacy 판단형 셸 — 연구/앵커 후보로 보관. 개발 환경에서만 접근 가능. */}
          <Route
            path="/mission-legacy"
            element={import.meta.env.DEV ? <MissionShell /> : <Navigate to="/learner/practice" replace />}
          />
          <Route path="/entry/task-mode" element={<RequireApproved><EntryTaskMode /></RequireApproved>} />
          <Route path="/entry/language-direction" element={<RequireApproved><EntryLanguageDirection /></RequireApproved>} />
          <Route path="/entry/unavailable" element={<RequireApproved><EntryUnavailable /></RequireApproved>} />
          {/* 학습 미션 정본 = /learner/practice (MissionRunV1, 프로토타입 v2 이식). 구 /scenario·mission-run은 리다이렉트/별칭 */}
          <Route path="/learner/practice" element={<RequireApproved><MissionRunV1 /></RequireApproved>} />
          <Route path="/learner/practice/:scenarioId" element={<RequireApproved><MissionRunV1 /></RequireApproved>} />
          {/* 구 학습 미션 경로 — 새 정본으로 리다이렉트(구 PracticeMission 목업 은퇴) */}
          <Route path="/scenario" element={<Navigate to="/learner/practice" replace />} />
          {/* legacy 별칭(옛 북마크 호환) — UI 네비게이션은 전부 /learner/practice 사용 */}
          <Route path="/learner/mission-run" element={<Navigate to="/learner/practice" replace />} />
          <Route path="/learner/mission-run/:scenarioId" element={<RequireApproved><MissionRunV1 /></RequireApproved>} />
          {/* 고정 예시 피드백을 쓰는 구 흐름 검증 화면은 개발 환경에서만 접근한다.
              프로덕션에서 직접 URL로 열려 정본 AI 피드백과 혼동되는 일을 막는다. */}
          <Route
            path="/prototype/mission-v2"
            element={
              import.meta.env.DEV
                ? <RequireApproved><PrototypeMissionV2 /></RequireApproved>
                : <Navigate to="/learner/practice" replace />
            }
          />
          <Route path="/admin" element={<RequireAdmin><Navigate to="/admin/dashboard" replace /></RequireAdmin>} />
          <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/corpus" element={<RequireAdmin><AdminCorpus /></RequireAdmin>} />
          <Route path="/admin/youtube-sources" element={<RequireAdmin><AdminYoutubeSources /></RequireAdmin>} />
          <Route path="/admin/archive" element={<RequireAdmin><AdminArchive /></RequireAdmin>} />
          <Route path="/admin/generator" element={<RequireAdmin><AdminGenerator /></RequireAdmin>} />
          <Route path="/admin/batch" element={<RequireAdmin><AdminBatch /></RequireAdmin>} />
          <Route path="/admin/browser" element={<RequireAdmin><AdminBrowser /></RequireAdmin>} />
          <Route path="/admin/curriculum" element={<RequireAdmin><AdminCurriculum /></RequireAdmin>} />
          <Route path="/admin/composer" element={<RequireAdmin><AdminComposer /></RequireAdmin>} />
          <Route path="/admin/prompt-harness" element={<RequireAdmin><AdminPromptHarness /></RequireAdmin>} />
          <Route path="/admin/question-designer" element={<RequireAdmin><AdminQuestionDesigner /></RequireAdmin>} />
          <Route path="/admin/review" element={<RequireAdmin><AdminReview /></RequireAdmin>} />
          <Route path="/admin/learners" element={<RequireAdmin><AdminLearners /></RequireAdmin>} />
          <Route path="/admin/decision-traces" element={<RequireAdmin><AdminDecisionTraces /></RequireAdmin>} />
          <Route path="/admin/reports" element={<RequireAdmin><AdminReports /></RequireAdmin>} />
          <Route path="/admin/analytics" element={<RequireAdmin><AdminAnalytics /></RequireAdmin>} />
          <Route path="/admin/export" element={<RequireAdmin><AdminExport /></RequireAdmin>} />
          {/* 워크플로 골격 — 후속 구현 화면(준비중). AdminPlaceholder가 "이 화면은 후속 단계에서 구현됩니다" 렌더 */}
          <Route path="/admin/package" element={<RequireAdmin><AdminPlaceholder title="수업 자료 생성" description="주차별 수업 패키지 = 교수자용 교안(이론·예상 Q&A) + 학습자용 도입 화면(도입 장면·화용 설명·원리)" /></RequireAdmin>} />
          <Route path="/admin/course-ops" element={<RequireAdmin><AdminPlaceholder title="교과목 운영" description="개설 교과목·수강 코호트 운영" /></RequireAdmin>} />
          <Route path="/admin/users" element={<RequireAdmin><AdminPlaceholder title="사용자·권한" description="관리자·교수자·학습자 계정 및 권한" /></RequireAdmin>} />
          <Route path="/admin-login" element={<AdminLogin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
