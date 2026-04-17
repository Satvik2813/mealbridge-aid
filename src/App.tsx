import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Welcome from "./pages/Welcome.tsx";
import Landing from "./pages/Landing.tsx";
import NotFound from "./pages/NotFound.tsx";
import RoleLogin from "./pages/RoleLogin.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import DonorDashboard from "./pages/DonorDashboard.tsx";
import RecipientDashboard from "./pages/RecipientDashboard.tsx";
import PartnerDashboard from "./pages/PartnerDashboard.tsx";
import Impact from "./pages/Impact.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/landing" element={<Landing />} />

            {/* Unified login for all roles */}
            <Route path="/login/:role" element={<RoleLogin />} />

            {/* OAuth callback — processes Google redirect and routes to dashboard */}
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Open dashboards (actions restricted internally) */}
            <Route path="/donor" element={<DonorDashboard />} />
            <Route path="/recipient" element={<RecipientDashboard />} />
            <Route path="/partner" element={<PartnerDashboard />} />

            <Route path="/impact" element={<Impact />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
