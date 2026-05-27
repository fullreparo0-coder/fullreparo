import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ClipboardList, Users, TrendingUp, Plus, ArrowRight,
  Wrench, Clock, CheckCircle2, AlertCircle, Truck, BarChart2
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Area, AreaChart,
} from "recharts";
import { StatusBadge as _StatusBadge, STATUS_LABELS } from "@/components/StatusBadge";

export default function TenantDashboard() {
  const [, navigate] = useLocation();
  const { data: metrics } = trpc.serviceOrders.metrics.useQuery();
  const { data: recentOsData } = trpc.serviceOrders.list.useQuery({ pageSize: 6 });
  const { data: usage } = trpc.serviceOrders.usageStats.useQuery();
  const { data: productivity } = trpc.serviceOrders.productivity.useQuery();

  // Cores por status para o gráfico de barras
  const STATUS_COLORS: Record<string, string> = {
    orcamento: "#8b5cf6",
    aguardando_aprovacao: "#f59e0b",
    aprovado: "#3b82f6",
    aguardando_coleta: "#06b6d4",
    coleta_agendada: "#0ea5e9",
    em_reparo: "#f97316",
    aguardando_peca: "#ef4444",
    reparo_concluido: "#10b981",
    aguardando_entrega: "#6366f1",
    saiu_para_entrega: "#8b5cf6",
    finalizado: "#22c55e",
    encerrado_sem_reparo: "#64748b",
    encerrado_condenado: "#dc2626",
    entregue: "#16a34a",
    cancelado: "#6b7280",
  };

  // Preparar dados do gráfico de barras por status
  const byStatusData = (productivity?.byStatus ?? [])
    .map((r) => ({
      status: (STATUS_LABELS as Record<string, string>)[r.status] ?? r.status,
      statusKey: r.status,
      count: r.count,
      fill: STATUS_COLORS[r.status] ?? "#94a3b8",
    }))
    .sort((a, b) => b.count - a.count);

  // Preparar série temporal (últimos 30 dias)
  const dailySeries = (productivity?.dailySeries ?? []).map((d) => ({
    day: new Date(d.day + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    count: d.count,
  }));

  const recent = recentOsData?.data ?? [];

  const kpis = [
    {
      label: "Total de OS",
      value: metrics?.total ?? 0,
      icon: ClipboardList,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "OS em Aberto",
      value: metrics?.open ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Finalizadas",
      value: metrics?.finished ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <TenantLayout title="Dashboard">
      <div className="space-y-6">
        {/* Banner de limite atingido */}
        {usage?.isAtLimit && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="text-sm">
              <p className="font-medium text-red-800">Limite de OS atingido</p>
              <p className="text-red-700">
                Você usou <strong>{usage.used}/{usage.limit}</strong> OS este mês no plano <strong>{usage.planName}</strong>. Não será possível criar novas OS até o próximo mês ou após upgrade.
              </p>
            </div>
          </div>
        )}
        {/* Banner de coletas pendentes */}
        {(metrics?.pendingPickup ?? 0) > 0 && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => navigate("/painel/os?status=aguardando_coleta")}
          >
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">
                  {metrics!.pendingPickup} {metrics!.pendingPickup === 1 ? "coleta aguardando" : "coletas aguardando"} agendamento
                </p>
                <p className="text-blue-700 text-xs">Clique para ver as OS com status "Aguardando Coleta" ou "Coleta Agendada".</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-blue-500 shrink-0" />
          </div>
        )}
        {/* Banner de aviso próximo do limite */}
        {usage?.isNearLimit && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Atenção: limite próximo</p>
              <p className="text-amber-700">
                Você usou <strong>{usage.used} de {usage.limit}</strong> OS este mês ({usage.percentUsed}%) no plano <strong>{usage.planName}</strong>.
              </p>
            </div>
          </div>
        )}
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{kpi.label}</p>
                    <p className="text-3xl font-bold text-foreground font-display">{kpi.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${kpi.bg}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Indicador de uso mensal */}
        {usage && !usage.isUnlimited && (
          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">OS este mês</p>
                </div>
                <span className={`text-sm font-bold ${
                  usage.isAtLimit ? "text-red-600" : usage.isNearLimit ? "text-amber-600" : "text-foreground"
                }`}>
                  {usage.used} / {usage.limit}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.isAtLimit ? "bg-red-500" : usage.isNearLimit ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(usage.percentUsed, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Plano {usage.planName} — {usage.percentUsed}% utilizado</p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button
            variant="default"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/painel/os/nova")}
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">Nova OS</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/painel/os")}
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs">Ver OS</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/painel/clientes")}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs">Clientes</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/painel/estoque")}
          >
            <Wrench className="h-5 w-5" />
            <span className="text-xs">Estoque</span>
          </Button>
        </div>

        {/* Gráficos de Produtividade */}
        {(byStatusData.length > 0 || dailySeries.some((d) => d.count > 0)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gráfico de barras: OS por status */}
            {byStatusData.length > 0 && (
              <Card className="border border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">OS por Status — últimos 30 dias</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={Math.max(160, byStatusData.length * 32)}>
                    <BarChart
                      data={byStatusData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="status"
                        width={130}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          color: "hsl(var(--card-foreground))",
                        }}
                        formatter={(value: number) => [value, "OS"]}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {byStatusData.map((entry, index) => (
                          <rect key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Gráfico de área: OS criadas por dia */}
            <Card className="border border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">OS criadas por dia — últimos 30 dias</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={dailySeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        color: "hsl(var(--card-foreground))",
                      }}
                      formatter={(value: number) => [value, "OS"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorCount)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent OS */}
        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Ordens de Serviço Recentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/painel/os")}>
              Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma OS encontrada</p>
                <Button size="sm" className="mt-4" onClick={() => navigate("/painel/os/nova")}>
                  Abrir primeira OS
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recent.map((os) => (
                  <button
                    key={os.id}
                    onClick={() => navigate(`/painel/os/${os.id}`)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground">{os.osNumber}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {os.origin === "coleta" ? "Coleta" : "Balcão"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{os.reportedDefect}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={os.status} size="sm" />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(os.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
}
