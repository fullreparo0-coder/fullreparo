import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, ClipboardList, Plus, Users, Package,
  Settings, Truck, LogOut, Wrench, Menu, X, ChevronRight,
  SunMedium,
  UserCog, ShieldCheck, CheckSquare, Bell, BarChart2, AlertTriangle,
  HelpCircle
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PwaInstallButton } from "@/components/PwaInstallButton";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/painel/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/painel/central-do-dia", label: "Central do Dia", icon: SunMedium },
  { href: "/painel/os", label: "Ordens de Serviço", icon: ClipboardList },
  { href: "/painel/os/nova", label: "Nova OS", icon: Plus },
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/usuarios", label: "Equipe", icon: UserCog, roles: ["tenant_admin", "admin", "super_admin"] },
  { href: "/painel/estoque", label: "Estoque", icon: Package },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings, roles: ["tenant_admin", "admin", "super_admin"] },
  { href: "/painel/checklist", label: "Checklist", icon: CheckSquare, roles: ["tenant_admin", "admin", "super_admin"] },
  { href: "/painel/notificacoes", label: "Notificações", icon: Bell, roles: ["tenant_admin", "admin", "super_admin"] },
  { href: "/painel/relatorios", label: "Relatórios", icon: BarChart2, roles: ["tenant_admin", "admin", "super_admin"] },
  { href: "/painel/ajuda", label: "Ajuda e Treinamento", icon: HelpCircle },
];

// Item dinâmico de Coletas — inserido após "Ordens de Serviço" com badge numérico
const COLETAS_ITEM: NavItem = {
  href: "/painel/os?status=aguardando_coleta",
  label: "Coletas",
  icon: Truck,
};

const SUPER_ADMIN_ITEMS: NavItem[] = [
  { href: "/superadmin", label: "Super Admin", icon: ShieldCheck },
  { href: "/superadmin/tenants", label: "Assistências", icon: Wrench },
  { href: "/superadmin/plans", label: "Planos", icon: Package },
];

interface TenantLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function TenantLayout({ children, title }: TenantLayoutProps) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: tenant } = trpc.tenants.getMine.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.tenantId,
  });

  const { data: metrics } = trpc.serviceOrders.metrics.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.tenantId,
    refetchInterval: 60_000, // atualiza a cada 1 min
  });
  const pendingPickup = metrics?.pendingPickup ?? 0;

  // Rotas operacionais que exigem tenantId (todas sob /painel)
  const requiresTenant = location === "/painel" || location.startsWith("/painel/");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    // super_admin sem tenant tentando acessar rota operacional → redireciona para superadmin
    if (!loading && isAuthenticated && !user?.tenantId && requiresTenant) {
      navigate("/superadmin");
    }
  }, [loading, isAuthenticated, location, user?.tenantId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isSuperAdmin = user?.role === "super_admin" || user?.role === "admin";
  const navItems = isSuperAdmin && location.startsWith("/superadmin") ? SUPER_ADMIN_ITEMS : NAV_ITEMS;
  const filteredItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role ?? "");
  });

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const trialEndsAt = tenant?.trialEndsAt ? new Date(tenant.trialEndsAt as any) : null;
  const subscriptionEndsAt = tenant?.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt as any) : null;
  const daysUntilTrialEnd = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000) : null;
  const showSubscriptionNotice = !!tenant && ["trial", "suspended", "blocked"].includes(tenant.status as string);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
        <button
          onClick={() => navigate("/painel/dashboard")}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary overflow-hidden shrink-0 hover:opacity-80 transition-opacity"
        >
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name ?? "logo"} className="h-full w-full object-contain" />
          ) : (
            <Wrench className="h-4 w-4 text-sidebar-primary-foreground" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate("/painel/dashboard")}
            className="font-display text-sm font-bold text-sidebar-foreground truncate hover:text-sidebar-primary transition-colors text-left"
          >
            {tenant?.name ?? "fullreparo"}
          </button>
          {tenant?.status && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] h-4 px-1.5 border-sidebar-border",
                tenant.status === "active" ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {tenant.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {isSuperAdmin && !location.startsWith("/superadmin") && (
          <>
            <button
              onClick={() => { navigate("/superadmin"); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors mb-2"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Super Admin
              <ChevronRight className="h-3 w-3 ml-auto" />
            </button>
            <Separator className="bg-sidebar-border mb-2" />
          </>
        )}
        {(() => {
          // Injeta o item Coletas logo após "Ordens de Serviço"
          const items: NavItem[] = [];
          for (const item of filteredItems) {
            items.push(item);
            if (item.href === "/painel/os") {
              items.push({ ...COLETAS_ITEM, badge: pendingPickup > 0 ? String(pendingPickup) : undefined });
            }
          }
          return items.map((item) => {
            const isActive = item.href === "/painel/os?status=aguardando_coleta"
              ? location === "/painel/os" && new URLSearchParams(window.location.search).get("status") === "aguardando_coleta"
              : location === item.href || (item.href !== "/" && location.startsWith(item.href) && item.href !== "/painel/os/nova");
            return (
              <button
                key={item.href}
                onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  item.href === "/painel/os?status=aguardando_coleta" && "pl-7", // recuo visual para sub-item
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-auto text-[10px] h-4 px-1.5",
                      item.href === "/painel/os?status=aguardando_coleta" && "bg-blue-100 text-blue-700"
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          });
        })()}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <PwaInstallButton variant="sidebar" />
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name ?? "Usuário"}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-transparent"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full max-w-full bg-background overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-60 flex-col bg-sidebar shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-sidebar flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 w-full max-w-full items-center gap-3 border-b border-border bg-background px-4 lg:px-6 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          {title && (
            <h1 className="font-display text-base font-semibold text-foreground">{title}</h1>
          )}
          <div className="ml-auto flex items-center gap-2">
            {user?.role === "entregador" && (
              <Button size="sm" variant="outline" onClick={() => navigate("/painel/entregador")}>
                <Truck className="h-3.5 w-3.5 mr-1.5" /> Minhas Entregas
              </Button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-contain p-4 lg:p-6">
          {showSubscriptionNotice && (
            <div className={cn(
              "mb-4 rounded-xl border p-3 text-sm flex items-start gap-3",
              tenant?.status === "trial" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900"
            )}>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {tenant?.status === "trial" ? "Teste grátis em andamento" : tenant?.status === "blocked" ? "Assistência bloqueada" : "Assinatura ou teste vencido"}
                </p>
                <p className="text-xs mt-0.5">
                  {tenant?.status === "trial"
                    ? `Seu teste termina em ${trialEndsAt ? trialEndsAt.toLocaleString("pt-BR") : "data não informada"}${daysUntilTrialEnd !== null ? ` (${Math.max(daysUntilTrialEnd, 0)} dia(s) restante(s))` : ""}.`
                    : tenant?.status === "blocked"
                    ? "O super admin bloqueou esta assistência. Entre em contato para regularização."
                    : `O acesso operacional pode ser limitado até regularização. ${subscriptionEndsAt ? `Assinatura venceu em ${subscriptionEndsAt.toLocaleString("pt-BR")}.` : ""}`}
                </p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
