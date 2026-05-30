import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckSquare,
  Clock3,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
};

const daysUntil = (value?: string | Date | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

type MetricCardProps = {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "info" | "danger" | "secondary";
};

const metricToneClasses = {
  default: {
    value: "text-foreground",
    iconWrap: "bg-primary/10",
    icon: "text-primary",
  },
  success: {
    value: "text-emerald-600",
    iconWrap: "bg-emerald-50",
    icon: "text-emerald-600",
  },
  info: {
    value: "text-sky-600",
    iconWrap: "bg-sky-50",
    icon: "text-sky-600",
  },
  danger: {
    value: "text-red-600",
    iconWrap: "bg-red-50",
    icon: "text-red-600",
  },
  secondary: {
    value: "text-foreground",
    iconWrap: "bg-secondary/20",
    icon: "text-secondary-foreground",
  },
};

function MetricCard({ label, value, icon: Icon, tone = "default" }: MetricCardProps) {
  const classes = metricToneClasses[tone];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-h-[2rem] text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">
            {label}
          </p>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${classes.iconWrap}`}>
            <Icon className={`h-4 w-4 ${classes.icon}`} />
          </div>
        </div>
        <p className={`mt-2 font-display text-2xl font-bold leading-none sm:text-3xl ${classes.value}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

type QuickActionProps = {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
};

function QuickAction({ label, description, icon: Icon, onClick }: QuickActionProps) {
  return (
    <Button
      variant="outline"
      className="h-auto justify-between gap-3 px-4 py-3 text-left"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight">{label}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{description}</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Button>
  );
}

export default function SuperAdminDashboard() {
  const [, navigate] = useLocation();
  const { data: tenants } = trpc.tenants.list.useQuery();
  const { data: plans } = trpc.plans.list.useQuery();

  const active = tenants?.filter((t) => t.status === "active").length ?? 0;
  const trial = tenants?.filter((t) => t.status === "trial").length ?? 0;
  const suspended = tenants?.filter((t) => t.status === "suspended").length ?? 0;
  const blocked = tenants?.filter((t) => t.status === "blocked").length ?? 0;
  const attention = suspended + blocked;
  const whatsappPending = tenants?.filter((t) => !t.whatsappNumber).length ?? 0;

  const tenantsRequiringAttention = tenants
    ?.filter((t) => {
      const remainingTrialDays = daysUntil(t.trialEndsAt);
      const remainingSubscriptionDays = daysUntil(t.subscriptionEndsAt);
      return (
        t.status === "blocked" ||
        t.status === "suspended" ||
        (t.status === "trial" && remainingTrialDays !== null && remainingTrialDays <= 3) ||
        (t.status === "active" && remainingSubscriptionDays !== null && remainingSubscriptionDays <= 7) ||
        !t.whatsappNumber
      );
    })
    .slice(0, 6);

  const getPlanName = (planId: number | null | undefined) =>
    plans?.find((p) => p.id === planId)?.name ?? (planId ? `Plano ${planId}` : "—");

  return (
    <TenantLayout title="Super Admin">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/80">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Painel de Administração Global</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Governança por tenant: status, plano, teste grátis, bloqueios e configuração operacional.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit">
            Visão operacional
          </Badge>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Métricas principais</p>
              <p className="text-xs text-muted-foreground">Resumo rápido da base e dos pontos de atenção.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="Total de Assistências" value={tenants?.length ?? 0} icon={Building2} />
            <MetricCard label="Ativas" value={active} icon={Users} tone="success" />
            <MetricCard label="Em teste" value={trial} icon={Clock3} tone="info" />
            <MetricCard label="Suspensas/Bloqueadas" value={attention} icon={AlertTriangle} tone="danger" />
            <MetricCard label="Planos ativos" value={plans?.filter((p) => p.isActive).length ?? 0} icon={Package} tone="secondary" />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Card className="border-amber-200/80 bg-amber-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Tenants que exigem atenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!tenantsRequiringAttention || tenantsRequiringAttention.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência crítica identificada agora.</p>
              ) : (
                <div className="space-y-2.5">
                  {tenantsRequiringAttention.map((tenant) => {
                    const trialDays = daysUntil(tenant.trialEndsAt);
                    const subscriptionDays = daysUntil(tenant.subscriptionEndsAt);
                    const needsWhatsapp = !tenant.whatsappNumber;
                    return (
                      <div
                        key={tenant.id}
                        className="flex flex-col justify-between gap-3 rounded-lg border bg-background/90 p-3 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{tenant.name}</p>
                            <Badge variant={tenant.status === "active" || tenant.status === "trial" ? "secondary" : "destructive"}>
                              {tenant.status === "active" ? "Ativo" : tenant.status === "trial" ? "Teste" : tenant.status === "blocked" ? "Bloqueado" : "Suspenso"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Plano {getPlanName(tenant.planId)} · Teste até {formatDate(tenant.trialEndsAt)} · Assinatura até {formatDate(tenant.subscriptionEndsAt)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {tenant.status === "trial" && trialDays !== null && trialDays <= 3 && <Badge variant="outline">Teste vence em {trialDays} dia(s)</Badge>}
                            {tenant.status === "active" && subscriptionDays !== null && subscriptionDays <= 7 && <Badge variant="outline">Assinatura vence em {subscriptionDays} dia(s)</Badge>}
                            {needsWhatsapp && <Badge variant="outline">WhatsApp sem número</Badge>}
                          </div>
                        </div>
                        <Button className="shrink-0" variant="outline" size="sm" onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}>
                          Ver detalhes <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Checklist de governança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <span>Tenants com WhatsApp pendente</span>
                <Badge variant={whatsappPending > 0 ? "destructive" : "secondary"}>{whatsappPending}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <span>Suspensos por revisão</span>
                <Badge variant={suspended > 0 ? "destructive" : "secondary"}>{suspended}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <span>Bloqueados manualmente</span>
                <Badge variant={blocked > 0 ? "destructive" : "secondary"}>{blocked}</Badge>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground/75">
                Próxima etapa: cobrança manual com vencimento, status de pagamento e histórico antes da automação de gateway.
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Ações rápidas</p>
            <p className="text-xs text-muted-foreground">Atalhos para as rotinas administrativas mais usadas.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <QuickAction
              label="Gerenciar Assistências"
              description="Planos, bloqueios e dados dos tenants"
              icon={Building2}
              onClick={() => navigate("/superadmin/tenants")}
            />
            <QuickAction
              label="Gerenciar Planos"
              description="Limites, recursos e permissões"
              icon={Package}
              onClick={() => navigate("/superadmin/plans")}
            />
            <QuickAction
              label="Checklist Padrão de OS"
              description="Itens-base da operação técnica"
              icon={CheckSquare}
              onClick={() => navigate("/superadmin/checklist")}
            />
          </div>
        </section>
      </div>
    </TenantLayout>
  );
}
