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
  MessageCircleWarning,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";

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
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Painel de Administração Global</p>
            <p className="text-sm text-muted-foreground">
              Governança por tenant: status, plano, teste grátis, bloqueios e configuração operacional.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total de Assistências</p>
                  <p className="text-3xl font-bold font-display">{tenants?.length ?? 0}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ativas</p>
                  <p className="text-3xl font-bold font-display text-emerald-600">{active}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Em teste</p>
                  <p className="text-3xl font-bold font-display text-sky-600">{trial}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50">
                  <Clock3 className="h-5 w-5 text-sky-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Suspensas/Bloqueadas</p>
                  <p className="text-3xl font-bold font-display text-red-600">{attention}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Planos ativos</p>
                  <p className="text-3xl font-bold font-display">{plans?.filter((p) => p.isActive).length ?? 0}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/20">
                  <Package className="h-5 w-5 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Tenants que exigem atenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!tenantsRequiringAttention || tenantsRequiringAttention.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência crítica identificada agora.</p>
              ) : (
                <div className="space-y-3">
                  {tenantsRequiringAttention.map((tenant) => {
                    const trialDays = daysUntil(tenant.trialEndsAt);
                    const subscriptionDays = daysUntil(tenant.subscriptionEndsAt);
                    const needsWhatsapp = !tenant.whatsappNumber;
                    return (
                      <div key={tenant.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{tenant.name}</p>
                            <Badge variant={tenant.status === "active" || tenant.status === "trial" ? "secondary" : "destructive"}>
                              {tenant.status === "active" ? "Ativo" : tenant.status === "trial" ? "Teste" : tenant.status === "blocked" ? "Bloqueado" : "Suspenso"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Plano {getPlanName(tenant.planId)} · Teste até {formatDate(tenant.trialEndsAt)} · Assinatura até {formatDate(tenant.subscriptionEndsAt)}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {tenant.status === "trial" && trialDays !== null && trialDays <= 3 && <Badge variant="outline">Teste vence em {trialDays} dia(s)</Badge>}
                            {tenant.status === "active" && subscriptionDays !== null && subscriptionDays <= 7 && <Badge variant="outline">Assinatura vence em {subscriptionDays} dia(s)</Badge>}
                            {needsWhatsapp && <Badge variant="outline">WhatsApp sem número</Badge>}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}>
                          Ver detalhes <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist de governança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span>Tenants com WhatsApp pendente</span>
                <Badge variant={whatsappPending > 0 ? "destructive" : "secondary"}>{whatsappPending}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span>Suspensos por revisão</span>
                <Badge variant={suspended > 0 ? "destructive" : "secondary"}>{suspended}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span>Bloqueados manualmente</span>
                <Badge variant={blocked > 0 ? "destructive" : "secondary"}>{blocked}</Badge>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                Próxima etapa: cobrança manual com vencimento, status de pagamento e histórico antes da automação de gateway.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button variant="outline" className="h-auto py-5 flex-col gap-2" onClick={() => navigate("/superadmin/tenants")}>
            <Building2 className="h-6 w-6 text-primary" />
            <span>Gerenciar Assistências</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="outline" className="h-auto py-5 flex-col gap-2" onClick={() => navigate("/superadmin/plans")}>
            <Package className="h-6 w-6 text-secondary-foreground" />
            <span>Gerenciar Planos</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="outline" className="h-auto py-5 flex-col gap-2" onClick={() => navigate("/superadmin/checklist")}>
            <CheckSquare className="h-6 w-6 text-primary" />
            <span>Checklist Padrão de OS</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </TenantLayout>
  );
}
