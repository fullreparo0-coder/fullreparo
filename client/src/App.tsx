import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import SuperAdminDashboard from "./pages/superadmin/Dashboard";
import SuperAdminTenants from "./pages/superadmin/Tenants";
import SuperAdminPlans from "./pages/superadmin/Plans";
import SuperAdminChecklist from "./pages/superadmin/Checklist";
import SuperAdminTenantDetail from "./pages/superadmin/TenantDetail";
import TenantDashboard from "./pages/tenant/Dashboard";
import CentralDoDia from "./pages/tenant/CentralDoDia";
import ServiceOrdersList from "./pages/tenant/ServiceOrdersList";
import ServiceOrderNew from "./pages/tenant/ServiceOrderNew";
import ServiceOrderDetail from "./pages/tenant/ServiceOrderDetail";
import CustomersList from "./pages/tenant/CustomersList";
import CustomerDetail from "./pages/tenant/CustomerDetail";
import UsersList from "./pages/tenant/UsersList";
import StockList from "./pages/tenant/StockList";
import TenantSettings from "./pages/tenant/Settings";
import TenantChecklist from "./pages/tenant/Checklist";
import NotificationsPage from "./pages/tenant/NotificationsPage";
import FinancialReports from "./pages/tenant/FinancialReports";
import HelpTraining from "./pages/tenant/HelpTraining";
import DelivererDashboard from "./pages/deliverer/Dashboard";
import PublicTrack from "./pages/public/Track";
import PublicColeta from "./pages/public/Coleta";
import WarrantyCheck from "./pages/public/WarrantyCheck";
import CadastroPage from "./pages/public/Cadastro";
import PublicPortal from "./pages/public/PublicPortal";
import TrackLookup from "./pages/public/TrackLookup";
import MinhaContaPortal from "./pages/public/MinhaContaPortal";
import CustomerLogin from "./pages/public/CustomerLogin";
import Register from "./pages/public/Register";
import ChangePassword from "./pages/public/ChangePassword";
import ForgotPassword from "./pages/public/ForgotPassword";
import { TenantHostProvider, useTenantHost } from "./contexts/TenantHostContext";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "./lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";

/** Rota raiz: exibe o portal do tenant quando acessado por subdomínio ou modo de teste (?tenant=), ou a landing page do SaaS */
function HomeOrPortal() {
  const { isHostTenant, isTestMode, loading } = useTenantHost();
  if (loading) return null;
  if (isHostTenant || isTestMode) return <PublicPortal />;
  return <Home />;
}

/**
 * Guard para rotas /superadmin — bloqueia qualquer usuário sem role super_admin.
 * - Não autenticado: redireciona para /login
 * - Autenticado mas sem permissão: redireciona para /painel/dashboard
 * - super_admin: renderiza o conteúdo normalmente
 */
function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/superadmin/login", { replace: true });
    } else if (user.role !== "super_admin") {
      navigate("/painel/dashboard", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user || user.role !== "super_admin") return null;
  return <>{children}</>;
}

/**
 * Guard para rotas /painel — bloqueia acesso sem role de staff do tenant.
 * - Não autenticado → /login
 * - super_admin (sem tenantId) → /superadmin
 * - Cliente / role desconhecido → /minha-conta
 * - Staff autorizado (tenant_admin, atendente, tecnico, entregador, admin) → renderiza
 */
const TENANT_STAFF_ROLES = ["tenant_admin", "atendente", "tecnico", "entregador", "admin"];

function TenantGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login?modo=equipe", { replace: true });
    } else if (user.role === "super_admin") {
      navigate("/superadmin", { replace: true });
    } else if (!TENANT_STAFF_ROLES.includes(user.role)) {
      navigate("/minha-conta", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user || !TENANT_STAFF_ROLES.includes(user.role)) return null;
  return <>{children}</>;
}

/**
 * Guard para /minha-conta — apenas clientes autenticados.
 * Suporta dois sistemas de autenticação:
 *   1. Manus OAuth (ctx.user via trpc.auth.me) — para clientes com conta Manus
 *   2. Login local (customer_session cookie via trpc.customerAuth.meLocal) — para clientes sem conta Manus
 * - Não autenticado em nenhum dos dois → /login (preservando o tenant via useTenantHost)
 * - super_admin → /superadmin
 * - Staff do tenant → /painel/dashboard
 * - Cliente autenticado (qualquer dos dois sistemas) → renderiza
 */
function CustomerGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: oauthLoading } = useAuth();
  const { tenant } = useTenantHost();
  const [, navigate] = useLocation();

  // Verifica sessão local do cliente (customer_session cookie)
  const { data: localCustomer, isLoading: localLoading } = trpc.customerAuth.meLocal.useQuery(
    undefined,
    { retry: false, refetchOnWindowFocus: false }
  );

  const loading = oauthLoading || localLoading;
  // Autenticado se: tem usuário OAuth OU tem sessão local de cliente
  const isAuthenticated = Boolean(user) || Boolean(localCustomer);
  // Staff OAuth não deve acessar /minha-conta
  const isStaff = user && (user.role === "super_admin" || TENANT_STAFF_ROLES.includes(user.role));

  useEffect(() => {
    if (loading) return;
    if (isStaff) {
      if (user?.role === "super_admin") {
        navigate("/superadmin", { replace: true });
      } else {
        navigate("/painel/dashboard", { replace: true });
      }
    } else if (!isAuthenticated) {
      const loginPath = tenant?.slug ? `/login?tenant=${tenant.slug}` : "/login";
      navigate(loginPath, { replace: true });
    }
  }, [loading, isAuthenticated, isStaff, user, navigate, tenant]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (isStaff || !isAuthenticated) return null;
  return <>{children}</>;
}

/**
 * Guard exclusivo para /painel/entregador — apenas role entregador.
 * Demais staff vão para /painel/dashboard.
 */
function DelivererGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login?modo=equipe", { replace: true });
    } else if (user.role !== "entregador") {
      navigate("/painel/dashboard", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user || user.role !== "entregador") return null;
  return <>{children}</>;
}

/**
 * Redirect inteligente após login OAuth:
 * - super_admin / tenant_admin / atendente / tecnico / entregador / admin → /painel/dashboard
 * - cliente / user (sem tenantId) → /minha-conta
 * - Renderizado na rota raiz "/" quando o host NÃO é um tenant
 */
function SmartRedirectAfterLogin() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "super_admin") {
      navigate("/superadmin", { replace: true });
    } else if (["tenant_admin", "atendente", "tecnico", "entregador", "admin"].includes(user.role)) {
      navigate("/painel/dashboard", { replace: true });
    } else {
      // cliente ou user genérico
      navigate("/minha-conta", { replace: true });
    }
  }, [loading, user, navigate]);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* ── Landing page & autenticação ──────────────────────────────────── */}
      <Route path="/" component={HomeOrPortal} />
      {/* /login unificado: cliente, staff e tenant_admin — separação por role/tenant_id no backend */}
      <Route path="/login" component={CustomerLogin} />
      <Route path="/register" component={Register} />
      <Route path="/entrar"><Redirect to="/login" /></Route>
      {/* Super admin usa rota separada e discreta */}
      <Route path="/superadmin/login" component={Login} />

      {/* ── Super Admin (protegido — apenas super_admin) ─────────────────── */}
      <Route path="/superadmin">{() => <SuperAdminGuard><SuperAdminDashboard /></SuperAdminGuard>}</Route>
      <Route path="/superadmin/tenants">{() => <SuperAdminGuard><SuperAdminTenants /></SuperAdminGuard>}</Route>
      <Route path="/superadmin/tenants/:id">{() => <SuperAdminGuard><SuperAdminTenantDetail /></SuperAdminGuard>}</Route>
      <Route path="/superadmin/plans">{() => <SuperAdminGuard><SuperAdminPlans /></SuperAdminGuard>}</Route>
      <Route path="/superadmin/checklist">{() => <SuperAdminGuard><SuperAdminChecklist /></SuperAdminGuard>}</Route>

      {/* ── Painel administrativo do tenant (/painel/*) ──────────────────── */}
      <Route path="/painel/dashboard">{() => <TenantGuard><TenantDashboard /></TenantGuard>}</Route>
      <Route path="/painel/central-do-dia">{() => <TenantGuard><CentralDoDia /></TenantGuard>}</Route>
      <Route path="/painel/os/nova">{() => <TenantGuard><ServiceOrderNew /></TenantGuard>}</Route>
      <Route path="/painel/os/:id">{() => <TenantGuard><ServiceOrderDetail /></TenantGuard>}</Route>
      <Route path="/painel/os">{() => <TenantGuard><ServiceOrdersList /></TenantGuard>}</Route>
      <Route path="/painel/clientes/:id">{() => <TenantGuard><CustomerDetail /></TenantGuard>}</Route>
      <Route path="/painel/clientes">{() => <TenantGuard><CustomersList /></TenantGuard>}</Route>
      <Route path="/painel/usuarios">{() => <TenantGuard><UsersList /></TenantGuard>}</Route>
      <Route path="/painel/estoque">{() => <TenantGuard><StockList /></TenantGuard>}</Route>
      <Route path="/painel/configuracoes">{() => <TenantGuard><TenantSettings /></TenantGuard>}</Route>
      <Route path="/painel/checklist">{() => <TenantGuard><TenantChecklist /></TenantGuard>}</Route>
      <Route path="/painel/notificacoes">{() => <TenantGuard><NotificationsPage /></TenantGuard>}</Route>
      <Route path="/painel/relatorios">{() => <TenantGuard><FinancialReports /></TenantGuard>}</Route>
      <Route path="/painel/ajuda">{() => <TenantGuard><HelpTraining /></TenantGuard>}</Route>
      <Route path="/painel/entregador">{() => <DelivererGuard><DelivererDashboard /></DelivererGuard>}</Route>

      {/* /painel sem subpath → redireciona para /painel/dashboard */}
      <Route path="/painel"><Redirect to="/painel/dashboard" /></Route>
      {/* ── Redirecionamentos de compatibilidade (rotas antigas → /painel) ── */}
      <Route path="/dashboard"><Redirect to="/painel/dashboard" /></Route>
      <Route path="/os/nova"><Redirect to="/painel/os/nova" /></Route>
      <Route path="/os/:id">{(params) => <Redirect to={`/painel/os/${params.id}`} />}</Route>
      <Route path="/os"><Redirect to="/painel/os" /></Route>
      <Route path="/clientes/:id">{(params) => <Redirect to={`/painel/clientes/${params.id}`} />}</Route>
      <Route path="/clientes"><Redirect to="/painel/clientes" /></Route>
      <Route path="/usuarios"><Redirect to="/painel/usuarios" /></Route>
      <Route path="/estoque"><Redirect to="/painel/estoque" /></Route>
      <Route path="/configuracoes"><Redirect to="/painel/configuracoes" /></Route>
      <Route path="/entregador"><Redirect to="/painel/entregador" /></Route>

      {/* ── Portal público do tenant ─────────────────────────────────────── */}
      <Route path="/rastrear/:token" component={PublicTrack} />
      {/* /rastrear sem token: formulário de busca por número de OS */}
      <Route path="/rastrear" component={TrackLookup} />
      {/* /coleta sem slug: funciona por detecção automática de host */}
      <Route path="/coleta" component={PublicColeta} />
      <Route path="/coleta/:slug" component={PublicColeta} />
      <Route path="/verificar-garantia">{() => <WarrantyCheck />}</Route>
      <Route path="/garantia/:codigo">{(params) => <WarrantyCheck routeCode={params.codigo} />}</Route>
      <Route path="/garantia">{() => <WarrantyCheck />}</Route>
      <Route path="/cadastro" component={CadastroPage} />
      <Route path="/minha-conta">{() => <CustomerGuard><MinhaContaPortal /></CustomerGuard>}</Route>
      {/* Rotas de senha */}
      <Route path="/trocar-senha" component={ChangePassword} />
      <Route path="/esqueci-senha" component={ForgotPassword} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <TenantHostProvider>
            <Router />
          </TenantHostProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
