import { useMemo, useState } from "react";
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
  Clock3,
  ClipboardList,
  CreditCard,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const priorityClasses: Record<string, string> = {
  alta: "border-red-200 bg-red-50 text-red-700",
  media: "border-amber-200 bg-amber-50 text-amber-700",
  normal: "border-slate-200 bg-slate-50 text-slate-700",
  baixa: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const alertClasses: Record<string, string> = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};


type QueueFilter = "all" | "critical" | "stalled" | "attention" | "new_today" | "pending_budget" | "overdue" | "ready_pickup";

const filterLabels: Record<QueueFilter, string> = {
  all: "Fila geral",
  critical: "OS críticas",
  stalled: "OS paradas",
  attention: "OS em atenção",
  new_today: "OS novas hoje",
  pending_budget: "Orçamentos pendentes",
  overdue: "OS atrasadas",
  ready_pickup: "Prontas para retirada",
};

function matchesQueueFilter(order: any, filter: QueueFilter) {
  if (filter === "all") return true;
  if (filter === "critical") return order.priority === "alta";
  if (filter === "stalled") return Boolean(order.sla?.isStageStalled || order.sla?.isOverdue || order.isOverdue);
  if (filter === "attention") return order.priority === "alta" || order.priority === "media" || Boolean(order.sla?.isStageStalled || order.sla?.isOverdue || order.isOverdue);
  if (filter === "new_today") return Boolean(order.isNewToday);
  if (filter === "pending_budget") return Boolean(order.isPendingBudget || order.status === "aguardando_aprovacao");
  if (filter === "overdue") return Boolean(order.isOverdue || order.sla?.isOverdue);
  if (filter === "ready_pickup") return Boolean(order.isReadyForPickup || order.status === "pronto" || order.status === "aguardando_entrega");
  return true;
}

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

function priorityLabel(priority?: string | null) {
  if (priority === "alta") return "Alta prioridade";
  if (priority === "media") return "Prioridade média";
  if (priority === "baixa") return "Baixa prioridade";
  return "Normal";
}

function channelLabel(channel?: string | null) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "E-mail";
  if (channel === "push_pwa") return "Push";
  return channel ?? "Canal";
}

function ProgressBar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const percent = max > 0 ? Math.max(6, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function StatCard({ title, value, description, icon: Icon, tone, onClick, active }: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  tone: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <Card className={`w-full min-w-0 overflow-hidden rounded-2xl border bg-card/95 shadow-sm transition hover:shadow-md ${active ? "border-primary/60 ring-2 ring-primary/15" : "border-border/70"}`}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex min-h-[112px] flex-col justify-between gap-3 sm:min-h-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium leading-tight text-muted-foreground sm:text-sm">{title}</p>
            <p className="mt-1 font-display text-3xl font-bold leading-none tracking-tight sm:mt-2">{value}</p>
            <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">{description}</p>
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tone}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        {onClick && (
          <div className="mt-2 flex h-7 items-center text-[11px] font-medium text-primary sm:mt-4 sm:h-8 sm:text-xs">
            Ver fila <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} className="w-full min-w-0 rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-primary/30">
      {content}
    </button>
  );
}

function LoadingGrid() {
  return (
    <div className="space-y-6">
      <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
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
  const [activeFilter, setActiveFilter] = useState<QueueFilter>("all");
  const { data, isLoading, isError, refetch, isFetching } = trpc.serviceOrders.centralDay.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const actionQueueForFilter = data?.actionQueue ?? [];
  const criticalQueue = useMemo(() => actionQueueForFilter.filter((order) => matchesQueueFilter(order, "critical")), [actionQueueForFilter]);
  const stalledQueue = useMemo(() => actionQueueForFilter.filter((order) => matchesQueueFilter(order, "stalled")), [actionQueueForFilter]);
  const attentionQueue = useMemo(() => actionQueueForFilter.filter((order) => matchesQueueFilter(order, "attention")), [actionQueueForFilter]);
  const filteredActionQueue = useMemo(() => actionQueueForFilter.filter((order) => matchesQueueFilter(order, activeFilter)), [actionQueueForFilter, activeFilter]);

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
  const alerts = (data.alerts ?? []).filter(Boolean) as AlertItem[];
  const actionQueue = actionQueueForFilter;
  const statusDistribution = data.statusDistribution ?? [];
  const technicianMetrics = data.technicianMetrics ?? [];
  const actionSummary = data.actionSummary ?? { high: 0, medium: 0, normal: 0, stalled: 0 };
  const inboxByOs = data.inboxByOs ?? [];
  const activeFilterLabel = filterLabels[activeFilter];
  const totalAttention = attentionQueue.length;
  const totalCards = cards.newOrdersToday + cards.pendingBudgets + cards.overdueOrders + cards.readyForPickup;
  const statusMax = Math.max(1, ...statusDistribution.map((item) => item.count));
  const technicianMax = Math.max(1, ...technicianMetrics.map((item) => item.total));

  return (
    <TenantLayout title="Central do Dia">
      <div className="max-w-full space-y-4 overflow-x-hidden pb-4 sm:space-y-6">
        <Card className="overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background shadow-sm">
          <CardContent className="p-4 sm:p-5 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div className="min-w-0 space-y-2">
                <Badge variant="outline" className="w-fit rounded-full border-primary/30 bg-background/70 text-primary">Painel operacional</Badge>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Central do Dia</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    Priorize atendimento, SLA, financeiro e comunicações usando as filas que já existem no sistema.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border bg-background/70 px-3 py-1">Atualização automática a cada 60s</span>
                  <span className="rounded-full border bg-background/70 px-3 py-1">{actionQueue.length} OS na fila de ação</span>
                  <span className="rounded-full border bg-background/70 px-3 py-1">{inboxByOs.length} conversas recentes</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <button type="button" onClick={() => setActiveFilter("critical")} className={`rounded-2xl border border-red-200 bg-red-50 p-3 text-left text-red-800 transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-red-200 ${activeFilter === "critical" ? "ring-2 ring-red-200" : ""}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wide">Críticas</p>
                  <strong className="mt-1 block text-2xl leading-none">{criticalQueue.length}</strong>
                </button>
                <button type="button" onClick={() => setActiveFilter("stalled")} className={`rounded-2xl border border-purple-200 bg-purple-50 p-3 text-left text-purple-800 transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-200 ${activeFilter === "stalled" ? "ring-2 ring-purple-200" : ""}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wide">Paradas</p>
                  <strong className="mt-1 block text-2xl leading-none">{stalledQueue.length}</strong>
                </button>
                <button type="button" onClick={() => setActiveFilter("attention")} className={`rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-amber-800 transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ${activeFilter === "attention" ? "ring-2 ring-amber-200" : ""}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wide">Atenção</p>
                  <strong className="mt-1 block text-2xl leading-none">{totalAttention}</strong>
                </button>
                <button type="button" onClick={() => setActiveFilter("all")} className={`rounded-2xl border bg-background/80 p-3 text-left text-foreground transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${activeFilter === "all" ? "ring-2 ring-primary/20" : ""}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Resumo</p>
                  <strong className="mt-1 block text-2xl leading-none">{actionQueue.length}</strong>
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-10 justify-start rounded-xl bg-background/80 text-xs sm:text-sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Atualizar agora
              </Button>
              <Button className="h-10 justify-start rounded-xl text-xs shadow-sm sm:text-sm" onClick={() => navigate("/painel/os/nova")}>
                <Plus className="mr-2 h-4 w-4" />
                Nova OS
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-xl bg-background/80 text-xs sm:text-sm" onClick={() => navigate("/painel/os?status=aguardando_aprovacao")}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Orçamentos
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-xl bg-background/80 text-xs sm:text-sm" onClick={() => navigate("/painel/notificacoes")}>
                <Bell className="mr-2 h-4 w-4" />
                Comunicações
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="OS novas hoje"
            value={cards.newOrdersToday}
            description="Entradas registradas desde o início do dia"
            icon={ClipboardList}
            tone="bg-blue-50 text-blue-600"
            onClick={() => setActiveFilter("new_today")}
            active={activeFilter === "new_today"}
          />
          <StatCard
            title="Orçamentos pendentes"
            value={cards.pendingBudgets}
            description="Aguardando aprovação do cliente"
            icon={CalendarClock}
            tone="bg-amber-50 text-amber-600"
            onClick={() => setActiveFilter("pending_budget")}
            active={activeFilter === "pending_budget"}
          />
          <StatCard
            title="OS atrasadas"
            value={cards.overdueOrders}
            description="Com prazo estimado vencido"
            icon={AlertTriangle}
            tone="bg-red-50 text-red-600"
            onClick={() => setActiveFilter("overdue")}
            active={activeFilter === "overdue"}
          />
          <StatCard
            title="Prontas para retirada"
            value={cards.readyForPickup}
            description="Serviços concluídos aguardando cliente"
            icon={CheckCircle2}
            tone="bg-emerald-50 text-emerald-600"
            onClick={() => setActiveFilter("ready_pickup")}
            active={activeFilter === "ready_pickup"}
          />
        </div>

        <div className="grid w-full max-w-full gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardHeader className="flex flex-col gap-3 px-4 pb-2 pt-4 sm:px-5 sm:pb-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold leading-tight sm:text-lg">
                  <Zap className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                  Fila de ação operacional
                </CardTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {activeFilter === "all" ? "OS ordenadas por urgência, SLA parado, prazo vencido e próxima ação sugerida." : `Exibindo: ${activeFilterLabel}.`}
                </p>
                {activeFilter !== "all" && (
                  <Button variant="ghost" size="sm" className="mt-2 h-7 px-0 text-xs text-primary" onClick={() => setActiveFilter("all")}>
                    Limpar filtro e voltar para fila geral
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] leading-tight sm:gap-2 sm:text-xs">
                <div className="rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-red-700"><strong className="block text-base leading-none sm:text-lg">{actionSummary.high}</strong> alta</div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-amber-700"><strong className="block text-base leading-none sm:text-lg">{actionSummary.medium}</strong> média</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700"><strong className="block text-base leading-none sm:text-lg">{actionSummary.normal}</strong> normal</div>
                <div className="rounded-xl border border-purple-200 bg-purple-50 px-2 py-2 text-purple-700"><strong className="block text-base leading-none sm:text-lg">{actionSummary.stalled}</strong> paradas</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3 pt-0 sm:space-y-3 sm:px-5 sm:pb-5">
              {filteredActionQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                  <h3 className="mt-3 font-semibold">Tudo em dia por enquanto</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Nenhuma OS encontrada para o filtro selecionado.</p>
                </div>
              ) : filteredActionQueue.map((order) => (
                <button
                  key={order.id}
                  onClick={() => navigate(order.href)}
                  className="w-full rounded-2xl border bg-card/95 p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md sm:p-4"
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-sm font-semibold leading-tight">#{order.osNumber}</span>
                        <StatusBadge status={order.status} />
                        {order.orderType === "retorno_garantia" && (
                          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                            RETORNO GARANTIA
                          </Badge>
                        )}
                        <Badge variant="outline" className={priorityClasses[order.priority] ?? priorityClasses.normal}>
                          {priorityLabel(order.priority)}
                        </Badge>
                      </div>

                      <div>
                        <p className="truncate text-sm font-semibold leading-tight sm:text-base">{order.customerName ?? "Cliente não informado"}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">
                          {order.deviceLabel} • {order.nextBestAction?.description ?? order.reason}
                        </p>
                      </div>

                      <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Próxima ação</p>
                        <p className="mt-1 text-sm font-medium leading-snug text-foreground">
                          {order.suggestedAction ?? order.nextBestAction?.ctaLabel ?? "Atualizar andamento"}
                        </p>
                      </div>

                      {order.orderType === "retorno_garantia" && (
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">
                          Vinculada à OS original{order.originalServiceOrderId ? ` #${order.originalServiceOrderId}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2 text-left lg:grid-cols-1 lg:bg-transparent lg:p-0 lg:text-right">
                      <div>
                        <p className="text-[10px] text-muted-foreground sm:text-xs">Prazo</p>
                        <p className="text-xs font-medium sm:text-sm">{formatDate(order.estimatedDelivery)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground sm:text-xs">Valor</p>
                        <p className="text-xs font-medium sm:text-sm">{currency.format(order.totalAmount ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground sm:text-xs">Etapa</p>
                        <Badge variant="outline" className={order.sla?.isOverdue || order.sla?.isStageStalled ? "mt-1 border-red-200 bg-red-50 text-red-700" : "mt-1 border-emerald-200 bg-emerald-50 text-emerald-700"}>
                          <Clock3 className="mr-1 h-3 w-3" />{order.sla?.label ?? `${order.sla?.statusAgeHours ?? 0}h`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-2xl border border-border/70 shadow-sm">
              <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                <CardTitle className="text-base font-semibold leading-tight sm:text-lg">Alertas inteligentes</CardTitle>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">Sinais que merecem conferência antes de continuar o atendimento.</p>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3 pt-0 sm:space-y-3 sm:px-5 sm:pb-5">
                {alerts.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-5 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                    <p className="mt-2 text-sm text-muted-foreground">Nenhum alerta operacional neste momento.</p>
                  </div>
                ) : alerts.map((item, idx) => (
                  <button
                    key={`${item.title}-${idx}`}
                    onClick={() => navigate(item.href)}
                    className={`w-full rounded-2xl border p-3 text-left transition hover:shadow-sm ${alertClasses[item.type] ?? alertClasses.warning}`}
                  >
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs opacity-80">{item.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/70 shadow-sm">
              <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                <CardTitle className="text-base font-semibold leading-tight sm:text-lg">Financeiro rápido</CardTitle>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">Recebidos e pendências já calculados pelo sistema.</p>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3 pt-0 sm:space-y-3 sm:px-5 sm:pb-5">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><span className="text-sm font-medium">Pendente</span></div>
                    <strong>{currency.format(financial.pendingAmount)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                    <div className="flex items-center gap-2"><Wallet className="h-4 w-4" /><span className="text-xs">Hoje</span></div>
                    <strong className="mt-1 block text-sm">{currency.format(financial.paidToday)}</strong>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-800">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /><span className="text-xs">Mês</span></div>
                    <strong className="mt-1 block text-sm">{currency.format(financial.paidMonth)}</strong>
                  </div>
                </div>
                <Button variant="outline" className="h-10 w-full rounded-xl text-xs sm:text-sm" onClick={() => navigate("/painel/relatorios")}>Abrir relatórios</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid w-full max-w-full gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
              <CardTitle className="text-base font-semibold leading-tight sm:text-lg">Distribuição por status</CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">Volume atual de OS por etapa operacional.</p>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3 pt-0 sm:px-5 sm:pb-5">
              {statusDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum status encontrado.</p>
              ) : statusDistribution.map((item) => (
                <button key={item.status} onClick={() => navigate(`/painel/os?status=${item.status}`)} className="w-full rounded-xl border bg-card/80 p-3 text-left transition hover:border-primary/40 hover:shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><StatusBadge status={item.status} /><span className="text-xs text-muted-foreground">abrir fila</span></div>
                    <strong>{item.count}</strong>
                  </div>
                  <ProgressBar value={item.count} max={statusMax} tone="bg-primary" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
              <CardTitle className="text-base font-semibold leading-tight sm:text-lg">Métricas por técnico</CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">Produtividade e gargalos por responsável.</p>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3 pt-0 sm:px-5 sm:pb-5">
              {technicianMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma OS atribuída ainda.</p>
              ) : technicianMetrics.map((item) => (
                <div key={`${item.technicianId ?? "none"}-${item.technicianName}`} className="rounded-xl border bg-card/80 p-3">
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold">{item.technicianName}</p><Badge variant={item.overdueCount > 0 ? "destructive" : "secondary"}>{item.total} OS</Badge></div>
                  <ProgressBar value={item.total} max={technicianMax} tone={item.overdueCount > 0 ? "bg-red-500" : "bg-emerald-500"} />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                    <span><strong className="block text-foreground">{item.openCount}</strong> abertas</span>
                    <span><strong className="block text-foreground">{item.finishedCount}</strong> concluídas</span>
                    <span><strong className="block text-foreground">{item.overdueCount}</strong> atrasadas</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 px-4 pb-2 pt-4 sm:px-5 sm:pb-3">
            <div>
              <CardTitle className="text-base font-semibold leading-tight sm:text-lg">Comunicação recente por OS</CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">Mensagens recentes para retomar o atendimento certo.</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-xl px-2 text-xs" onClick={() => navigate("/painel/notificacoes")}>Histórico</Button>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0 sm:px-5 sm:pb-5">
            {inboxByOs.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Bell className="mx-auto h-9 w-9 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Nenhuma comunicação recente registrada.</p>
              </div>
            ) : (
              <div className="grid w-full max-w-full gap-3 md:grid-cols-2 xl:grid-cols-3">
                {inboxByOs.map((item, idx) => {
                  const Icon = channelIcon[item.channel] ?? Bell;
                  return (
                    <button
                      key={`${item.osId}-${item.sentAt}-${idx}`}
                      onClick={() => navigate(item.href ?? `/painel/os/${item.osId}`)}
                      className="rounded-2xl border bg-card/95 p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="gap-1"><Icon className="h-3 w-3" />{channelLabel(item.channel)}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(item.sentAt)}</span>
                      </div>
                      <p className="mt-3 text-sm font-medium">OS #{item.osNumber ?? item.osId}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Responsável: {item.actorName ?? "Sistema"}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid w-full max-w-full gap-3 md:grid-cols-3">
          <Button variant="outline" className="h-11 justify-start rounded-xl bg-card/80 text-xs sm:text-sm" onClick={() => navigate("/painel/os/nova")}>
            <Plus className="mr-2 h-4 w-4" /> Abrir nova OS
          </Button>
          <Button variant="outline" className="h-11 justify-start rounded-xl bg-card/80 text-xs sm:text-sm" onClick={() => navigate("/painel/os?status=aguardando_aprovacao")}>
            <CalendarClock className="mr-2 h-4 w-4" /> Ver orçamentos pendentes
          </Button>
          <Button variant="outline" className="h-11 justify-start rounded-xl bg-card/80 text-xs sm:text-sm" onClick={() => navigate("/painel/os?status=pronto")}>
            <Wrench className="mr-2 h-4 w-4" /> Ver prontos para retirada
          </Button>
        </div>
      </div>
    </TenantLayout>
  );
}
