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
import AdminPromptHarness from "./pages/admin/AdminPromptHarness.tsx";
import AdminQuestionDesigner from "./pages/admin/AdminQuestionDesigner.tsx";
import AdminYoutubeSources from "./pages/admin/AdminYoutubeSources.tsx";
import AdminReview from "./pages/admin/AdminReview.tsx";
import AdminCurriculum from "./pages/admin/AdminCurriculum.tsx";
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
import PracticeMission from "./pages/learner/PracticeMission.tsx";
import EntryTaskMode from "./pages/EntryTaskMode.tsx";
import EntryLanguageDirection from "./pages/EntryLanguageDirection.tsx";
import EntryUnavailable from "./pages/EntryUnavailable.tsx";
import { RequireApproved } from "./components/RequireApproved";
import { RequireAdmin } from "./components/RequireAdmin";
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
          <Route path="/learner/course/week/2" element={<RequireApproved><WeekDetail /></RequireApproved>} />
          <Route path="/learner/course/week/2/intro" element={<RequireApproved><IntroArc /></RequireApproved>} />
          <Route path="/learner/records" element={<RequireApproved><LearnerRecords /></RequireApproved>} />
          {/* legacy 판단형 셸 — 연구/앵커 후보로 보관. 개발 환경에서만 접근 가능. */}
          <Route
            path="/mission-legacy"
            element={import.meta.env.DEV ? <MissionShell /> : <Navigate to="/scenario" replace />}
          />
          <Route path="/entry/task-mode" element={<RequireApproved><EntryTaskMode /></RequireApproved>} />
          <Route path="/entry/language-direction" element={<RequireApproved><EntryLanguageDirection /></RequireApproved>} />
          <Route path="/entry/unavailable" element={<RequireApproved><EntryUnavailable /></RequireApproved>} />
          <Route path="/scenario" element={<RequireApproved><PracticeMission /></RequireApproved>} />
          <Route path="/admin" element={<RequireAdmin><Navigate to="/admin/dashboard" replace /></RequireAdmin>} />
          <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/corpus" element={<RequireAdmin><AdminCorpus /></RequireAdmin>} />
          <Route path="/admin/youtube-sources" element={<RequireAdmin><AdminYoutubeSources /></RequireAdmin>} />
          <Route path="/admin/archive" element={<RequireAdmin><AdminArchive /></RequireAdmin>} />
          <Route path="/admin/generator" element={<RequireAdmin><AdminGenerator /></RequireAdmin>} />
          <Route path="/admin/curriculum" element={<RequireAdmin><AdminCurriculum /></RequireAdmin>} />
          <Route path="/admin/prompt-harness" element={<RequireAdmin><AdminPromptHarness /></RequireAdmin>} />
          <Route path="/admin/question-designer" element={<RequireAdmin><AdminQuestionDesigner /></RequireAdmin>} />
          <Route path="/admin/review" element={<RequireAdmin><AdminReview /></RequireAdmin>} />
          <Route path="/admin/learners" element={<RequireAdmin><AdminLearners /></RequireAdmin>} />
          <Route path="/admin/decision-traces" element={<RequireAdmin><AdminDecisionTraces /></RequireAdmin>} />
          <Route path="/admin/reports" element={<RequireAdmin><AdminReports /></RequireAdmin>} />
          <Route path="/admin/analytics" element={<RequireAdmin><AdminAnalytics /></RequireAdmin>} />
          <Route path="/admin/export" element={<RequireAdmin><AdminExport /></RequireAdmin>} />
          <Route path="/admin-login" element={<AdminLogin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
