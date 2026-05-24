import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantLayout } from "@/components/TenantLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Wallet,
  Wrench,
} from "lucide-react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const priorityClasses: Record<string, string> = {
  alta: "border-red-200 bg-red-50 text-red-700",
  media: "border-amber-200 bg-amber-50 text-amber-700",
  normal: "border-slate-200 bg-slate-50 text-slate-700",
};

const alertClasses: Record<string, string> = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const channelIcon: Record<string, React.ElementType> = {
  email: Mail,
  push_pwa: Smartphone,
  whatsapp: Send,
};

function formatDate(value?: string | null) {
  if (!value) return "Sem prazo";
  return dateOnly.format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Agora";
  return dateTime.format(new Date(value));
}

function StatCard({ title, value, description, icon: Icon, tone, onClick }: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  tone: string;
  onClick?: () => void;
}) {
  return (
    <Card className="overflow-hidden transition hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={`rounded-xl p-3 ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {onClick && (
          <Button variant="ghost" size="sm" className="mt-4 h-8 px-0 text-xs" onClick={onClick}>
            Ver detalhes <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
    </div>
  );
}

export default function CentralDoDia() {
  const [, navigate] = useLocation();
  const { data, isLoading, isError, refetch, isFetching } = trpc.serviceOrders.centralDay.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <TenantLayout title="Central do Dia">
        <LoadingGrid />
      </TenantLayout>
    );
  }

  if (isError || !data) {
    return (
      <TenantLayout title="Central do Dia">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-red-600" />
            <div>
              <h2 className="text-lg font-semibold text-red-900">Não foi possível carregar a Central do Dia</h2>
              <p className="text-sm text-red-700">Tente novamente para atualizar os dados operacionais.</p>
            </div>
            <Button onClick={() => refetch()} variant="outline">Tentar novamente</Button>
          </CardContent>
        </Card>
      </TenantLayout>
    );
  }

  type AlertItem = NonNullable<NonNullable<typeof data.alerts>[number]>;
  const cards = data.cards;
  const financial = data.financial;
  const alerts = (data.alerts ?? []).filter((item): item is AlertItem => item !== null);
  const actionQueue = data.actionQueue ?? [];
  const recentCommunications = data.recentCommunications ?? [];

  return (
    <TenantLayout title="Central do Dia">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Central do Dia</h1>
            <p className="text-sm text-muted-foreground">
              Prioridades operacionais, alertas e comunicações da assistência em tempo quase real.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={() => navigate("/painel/os/nova")}>
              <Plus className="mr-2 h-4 w-4" />
              Nova OS
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="OS novas hoje"
            value={cards.newOrdersToday}
            description="Entradas registradas desde o início do dia"
            icon={ClipboardList}
            tone="bg-blue-50 text-blue-600"
            onClick={() => navigate("/painel/os")}
          />
          <StatCard
            title="Orçamentos pendentes"
            value={cards.pendingBudgets}
            description="Aguardando aprovação do cliente"
            icon={CalendarClock}
            tone="bg-amber-50 text-amber-600"
            onClick={() => navigate("/painel/os?status=aguardando_aprovacao")}
          />
          <StatCard
            title="OS atrasadas"
            value={cards.overdueOrders}
            description="Com prazo estimado vencido"
            icon={AlertTriangle}
            tone="bg-red-50 text-red-600"
            onClick={() => navigate("/painel/os")}
          />
          <StatCard
            title="Prontas para retirada"
            value={cards.readyForPickup}
            description="Serviços concluídos aguardando cliente"
            icon={CheckCircle2}
            tone="bg-emerald-50 text-emerald-600"
            onClick={() => navigate("/painel/os?status=pronto")}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Fila de ação operacional</CardTitle>
                <p className="text-sm text-muted-foreground">As OS mais importantes para o atendimento agir agora.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/painel/os")}>Ver todas</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                  <h3 className="mt-3 font-semibold">Tudo em dia por enquanto</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Nenhuma OS crítica ou pendente foi encontrada para ação imediata.</p>
                </div>
              ) : actionQueue.map((order) => (
                <button
                  key={order.id}
                  onClick={() => navigate(order.href)}
                  className="w-full rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">#{order.osNumber}</span>
                        <StatusBadge status={order.status} />
                        <Badge variant="outline" className={priorityClasses[order.priority] ?? priorityClasses.normal}>
                          {order.priority === "alta" ? "Alta prioridade" : order.priority === "media" ? "Prioridade média" : "Normal"}
                        </Badge>
                      </div>
                      <p className="truncate text-sm font-medium">{order.customerName ?? "Cliente não informado"}</p>
                      <p className="truncate text-xs text-muted-foreground">{order.deviceLabel} • {order.reason}</p>
                    </div>
                    <div className="shrink-0 text-left md:text-right">
                      <p className="text-xs text-muted-foreground">Prazo</p>
                      <p className="text-sm font-medium">{formatDate(order.estimatedDelivery)}</p>
                      <p className="text-xs text-muted-foreground">{currency.format(order.totalAmount ?? 0)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alertas inteligentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alerts.map((item, idx) => {
                  if (!item) return null;
                  return (
                    <button
                      key={`${item.title}-${idx}`}
                      onClick={() => navigate(item.href)}
                      className={`w-full rounded-xl border p-3 text-left transition hover:shadow-sm ${alertClasses[item.type] ?? alertClasses.warning}`}
                    >
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs opacity-80">{item.description}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financeiro rápido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-emerald-800">
                  <div className="flex items-center gap-2"><Wallet className="h-4 w-4" /><span className="text-sm">Recebido hoje</span></div>
                  <strong>{currency.format(financial.paidToday)}</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-blue-50 p-3 text-blue-800">
                  <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /><span className="text-sm">Recebido no mês</span></div>
                  <strong>{currency.format(financial.paidMonth)}</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-amber-800">
                  <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><span className="text-sm">Pendente</span></div>
                  <strong>{currency.format(financial.pendingAmount)}</strong>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate("/painel/relatorios")}>Abrir relatórios</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Comunicações recentes</CardTitle>
              <p className="text-sm text-muted-foreground">Últimos push PWA, e-mails e avisos registrados na OS.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/painel/notificacoes")}>Histórico</Button>
          </CardHeader>
          <CardContent>
            {recentCommunications.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Bell className="mx-auto h-9 w-9 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Nenhuma comunicação recente registrada.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {recentCommunications.map((item) => {
                  const Icon = channelIcon[item.channel] ?? Bell;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(`/painel/os/${item.serviceOrderId}`)}
                      className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="gap-1"><Icon className="h-3 w-3" />{item.channel}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(item.sentAt)}</span>
                      </div>
                      <p className="mt-3 text-sm font-medium">OS #{item.osNumber ?? item.serviceOrderId}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Button variant="outline" className="justify-start" onClick={() => navigate("/painel/os/nova")}>
            <Plus className="mr-2 h-4 w-4" /> Abrir nova OS
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => navigate("/painel/os?status=aguardando_aprovacao")}>
            <CalendarClock className="mr-2 h-4 w-4" /> Ver orçamentos pendentes
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => navigate("/painel/os?status=pronto")}>
            <Wrench className="mr-2 h-4 w-4" /> Ver prontos para retirada
          </Button>
        </div>
      </div>
    </TenantLayout>
  );
}
