import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Index from "./pages/Index.tsx";
import Welcome from "./pages/Welcome.tsx";
import Auth from "./pages/Auth.tsx";
import PublicPage from "@/components/shared/PublicPage";


// Screens load on demand, so the first open downloads far less code
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const PlansScreen = lazy(() => import("./pages/PlansScreen.tsx"));
const GuidedSetup = lazy(() => import("./pages/GuidedSetup.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const GestaoFinanceira = lazy(() => import("./pages/GestaoFinanceira.tsx"));
const FaturaCartao = lazy(() => import("./pages/FaturaCartao.tsx"));
const Configuracoes = lazy(() => import("./pages/Configuracoes.tsx"));
const Transacoes = lazy(() => import("./pages/Transacoes.tsx"));
const ContaDetalhe = lazy(() => import("./pages/ContaDetalhe.tsx"));
const RaioX = lazy(() => import("./pages/RaioX.tsx"));
const Financeiro = lazy(() => import("./pages/Financeiro.tsx"));
const GerenciarCategorias = lazy(() => import("./pages/GerenciarCategorias.tsx"));
const Metas = lazy(() => import("./pages/Metas.tsx"));
const MetaDetalhe = lazy(() => import("./pages/MetaDetalhe.tsx"));
const AnalyticsCategorias = lazy(() => import("./pages/AnalyticsCategorias.tsx"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso.tsx"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade.tsx"));
const Suporte = lazy(() => import("./pages/Suporte.tsx"));
const ReceitasDespesasDetalhe = lazy(() => import("./pages/ReceitasDespesasDetalhe.tsx"));
const ParcelamentosDetalhe = lazy(() => import("./pages/ParcelamentosDetalhe.tsx"));
const Cartoes = lazy(() => import("./pages/Cartoes.tsx"));
const Hilo = lazy(() => import("./pages/Hilo.tsx"));
const CentralAjuda = lazy(() => import("./pages/CentralAjuda.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

/** Shown while a screen's code is still downloading. */
const ScreenFallback = () => (
  <div className="willo-bg flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary text-lg">Carregando...</div>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/welcome" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/planos" element={<PlansScreen />} />
            <Route path="/configurar" element={<ProtectedRoute><GuidedSetup /></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/termos-de-uso" element={<PublicPage><TermosDeUso /></PublicPage>} />
            <Route path="/politica-privacidade" element={<PublicPage><PoliticaPrivacidade /></PublicPage>} />
            <Route path="/suporte" element={<PublicPage><Suporte /></PublicPage>} />
            <Route path="/ajuda" element={<PublicPage><CentralAjuda /></PublicPage>} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/transacoes" element={<Transacoes />} />
              <Route path="/detalhe/:tipo" element={<ReceitasDespesasDetalhe />} />
              <Route path="/gestao" element={<GestaoFinanceira />} />
              <Route path="/fatura/:cardId" element={<FaturaCartao />} />
              <Route path="/conta/:accountId" element={<ContaDetalhe />} />
              
              <Route path="/bot-finance" element={<RaioX />} />
              <Route path="/bot-finance/projecoes" element={<Financeiro initialTab="projecoes" />} />
              <Route path="/bot-finance/saude" element={<Navigate to="/bot-finance" replace />} />
              <Route path="/bot-finance/balanco" element={<Financeiro initialTab="balanco" />} />
              <Route path="/bot-finance/radar" element={<Navigate to="/bot-finance#radar" replace />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/categorias" element={<GerenciarCategorias />} />
              <Route path="/metas" element={<Metas />} />
              <Route path="/metas/:goalId" element={<MetaDetalhe />} />
              <Route path="/analytics/categorias" element={<AnalyticsCategorias />} />
              <Route path="/parcelamentos" element={<ParcelamentosDetalhe />} />
              <Route path="/fluxo-de-caixa" element={<Financeiro initialTab="fluxo" />} />
              <Route path="/cartoes" element={<Cartoes />} />
              <Route path="/hilo" element={<Hilo />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
