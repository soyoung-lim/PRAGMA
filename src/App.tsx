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
import AdminArchive from "./pages/AdminArchive.tsx";
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
          <Route path="/scenario" element={<ScenarioSelect />} />
          <Route path="/pdr" element={<Pdr />} />
          <Route path="/translate" element={<Translate />} />
          <Route path="/finalize" element={<Finalize />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Navigate to="/admin/archive" replace />} />
          <Route path="/admin/archive" element={<AdminArchive />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
