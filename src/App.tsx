import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import Prep from "./pages/Prep.tsx";
import { ScrollToTop } from "./components/ScrollToTop";

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
          <Route path="/prep" element={<Prep />} />
          <Route path="/scenario" element={<ScenarioSelect />} />
          <Route path="/pdr" element={<Pdr />} />
          <Route path="/translate" element={<Translate />} />
          <Route path="/finalize" element={<Finalize />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
