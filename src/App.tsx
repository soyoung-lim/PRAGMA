import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Architecture from "./pages/Architecture.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminArchive from "./pages/AdminArchive.tsx";
import AdminCorpus from "./pages/admin/AdminCorpus.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminGenerator from "./pages/admin/AdminGenerator.tsx";
import AdminBatch from "./pages/admin/AdminBatch.tsx";
import AdminBrowser from "./pages/admin/AdminBrowser.tsx";
import AdminPromptHarness from "./pages/admin/AdminPromptHarness.tsx";
import AdminQuestionDesigner from "./pages/admin/AdminQuestionDesigner.tsx";
import AdminYoutubeSources from "./pages/admin/AdminYoutubeSources.tsx";
import AdminReview from "./pages/admin/AdminReview.tsx";
import AdminCurriculum from "./pages/admin/AdminCurriculum.tsx";
import AdminComposer from "./pages/admin/AdminComposer.tsx";
import AdminLearners from "./pages/admin/AdminLearners.tsx";
import AdminReports from "./pages/admin/AdminReports.tsx";
import AdminAnalytics from "./pages/admin/AdminAnalytics.tsx";
import AdminExport from "./pages/admin/AdminExport.tsx";
import AdminDecisionTraces from "./pages/admin/AdminDecisionTraces.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import StudentLogin from "./pages/StudentLogin.tsx";
import PendingApproval from "./pages/PendingApproval.tsx";
import ProfileSetup from "./pages/ProfileSetup.tsx";
import Home from "./pages/Home.tsx";
import Roadmap from "./pages/Roadmap.tsx";
import WorkflowPreview from "./pages/WorkflowPreview.tsx";
import MissionShell from "./pages/MissionShell.tsx";
import LearnerHome from "./pages/learner/LearnerHome.tsx";
import CourseOverview from "./pages/learner/CourseOverview.tsx";
import WeekDetail from "./pages/learner/WeekDetail.tsx";
import IntroArc from "./pages/learner/IntroArc.tsx";
import LearnerRecords from "./pages/learner/LearnerRecords.tsx";
import StrategyMap from "./pages/learner/StrategyMap.tsx";
import PrototypeMissionV2 from "./pages/learner/PrototypeMissionV2.tsx";
import MissionRunV1 from "./pages/learner/MissionRunV1.tsx";
import LearnerCourseLive from "./pages/learner/LearnerCourseLive.tsx";
import EntryTaskMode from "./pages/EntryTaskMode.tsx";
import EntryLanguageDirection from "./pages/EntryLanguageDirection.tsx";
import EntryUnavailable from "./pages/EntryUnavailable.tsx";
import { RequireApproved } from "./components/RequireApproved";
import { RequireAdmin } from "./components/RequireAdmin";
import { AdminPlaceholder } from "@/components/AdminShell";
import { ScrollToTop } from "./components/ScrollToTop";
import { seedIfEmpty } from "./lib/learningSessions";

seedIfEmpty();

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
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
          <Route path="/learner/course" element={<RequireApproved><CourseOverview /></RequireApproved>} />
          <Route path="/learner/course-live" element={<RequireApproved><LearnerCourseLive /></RequireApproved>} />
          <Route path="/learner/course/week/2" element={<RequireApproved><WeekDetail /></RequireApproved>} />
          <Route path="/learner/course/week/2/intro" element={<RequireApproved><IntroArc /></RequireApproved>} />
          <Route path="/learner/records" element={<RequireApproved><LearnerRecords /></RequireApproved>} />
          <Route path="/learner/strategy" element={<RequireApproved><StrategyMap /></RequireApproved>} />
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
          <Route path="/admin/package" element={<RequireAdmin><AdminPlaceholder title="수업 패키지 생성" description="학습자용 교수 단원(hook·화용 설명·원리) + 교수자 전용 교안(이론·예상 Q&A)" /></RequireAdmin>} />
          <Route path="/admin/course-ops" element={<RequireAdmin><AdminPlaceholder title="교과목 운영" description="개설 교과목·수강 코호트 운영" /></RequireAdmin>} />
          <Route path="/admin/users" element={<RequireAdmin><AdminPlaceholder title="사용자·권한" description="관리자·교수자·학습자 계정 및 권한" /></RequireAdmin>} />
          <Route path="/admin-login" element={<AdminLogin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
