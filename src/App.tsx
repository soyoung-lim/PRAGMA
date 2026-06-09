import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ScenarioSelect from "./pages/ScenarioSelect.tsx";
import Placeholder from "./pages/Placeholder.tsx";
import Pdr from "./pages/Pdr.tsx";
import Translate from "./pages/Translate.tsx";
import Finalize from "./pages/Finalize.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import AdminCorpus from "./pages/admin/AdminCorpus.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminGenerator from "./pages/admin/AdminGenerator.tsx";
import AdminPromptHarness from "./pages/admin/AdminPromptHarness.tsx";
import AdminReview from "./pages/admin/AdminReview.tsx";
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
import EntryTaskMode from "./pages/EntryTaskMode.tsx";
import EntryLanguageDirection from "./pages/EntryLanguageDirection.tsx";
import EntryUnavailable from "./pages/EntryUnavailable.tsx";
import { RequireApproved } from "./components/RequireApproved";
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
          <Route path="/student-login" element={<StudentLogin />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/home" element={<Home />} />
          <Route path="/entry/task-mode" element={<RequireApproved><EntryTaskMode /></RequireApproved>} />
          <Route path="/entry/language-direction" element={<RequireApproved><EntryLanguageDirection /></RequireApproved>} />
          <Route path="/entry/unavailable" element={<RequireApproved><EntryUnavailable /></RequireApproved>} />
          <Route path="/scenario" element={<RequireApproved><ScenarioSelect /></RequireApproved>} />
          <Route path="/pdr" element={<RequireApproved><Pdr /></RequireApproved>} />
          <Route path="/translate" element={<RequireApproved><Translate /></RequireApproved>} />
          <Route path="/finalize" element={<RequireApproved><Finalize /></RequireApproved>} />
          <Route path="/dashboard" element={<RequireApproved><Dashboard /></RequireApproved>} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/corpus" element={<AdminCorpus />} />
          <Route path="/admin/archive" element={<AdminArchive />} />
          <Route path="/admin/generator" element={<AdminGenerator />} />
          <Route path="/admin/prompt-harness" element={<AdminPromptHarness />} />
          <Route path="/admin/review" element={<AdminReview />} />
          <Route path="/admin/learners" element={<AdminLearners />} />
          <Route path="/admin/decision-traces" element={<AdminDecisionTraces />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/export" element={<AdminExport />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
