import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, DollarSign, Wrench, CreditCard, Download, FileText, BarChart2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildPdfViewerUrl } from "@/lib/pdfViewer";

const STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  aguardando_coleta: "Aguardando Coleta",
  coleta_agendada: "Coleta Agendada",
  coletado: "Coletado",
  recebido_na_assistencia: "Recebido na Assistência",
  em_diagnostico: "Em Diagnóstico",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  aguardando_peca: "Aguardando Peça",
  em_reparo: "Em Reparo",
  pronto: "Pronto",
  aguardando_entrega: "Aguardando Entrega",
  saiu_para_entrega: "Saiu para Entrega",
  entregue: "Entregue",
  finalizado: "Entregue reparado",
  encerrado_sem_reparo: "Encerrado sem Reparo",
  encerrado_condenado: "Encerrado Condenado",
  cancelado: "Cancelado",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  transferencia: "Transferência",
  outro: "Outro",
};

const PIE_COLORS = ["#1e3a5f", "#d4a017", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonthLabel(ym: string) {
  const [yr, mo] = ym.split("-");
  return new Date(Number(yr), Number(mo) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");
}

type PeriodPreset = "3" | "6" | "12" | "custom";

export default function FinancialReports() {
  const [, navigate] = useLocation();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("12");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const queryInput = useMemo(() => {
    if (periodPreset === "custom" && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    if (periodPreset === "custom") return { months: 12 };
    return { months: parseInt(periodPreset) };
  }, [periodPreset, customStart, customEnd]);

  const { data, isLoading } = trpc.serviceOrders.financialReport.useQuery(queryInput);

  const totalRevenue = useMemo(
    () => (data?.monthlyRevenue ?? []).reduce((s, r) => s + r.total, 0),
    [data]
  );
  const totalOsPaid = useMemo(
    () => (data?.monthlyRevenue ?? []).reduce((s, r) => s + r.count, 0),
    [data]
  );
  const totalOsAll = useMemo(
    () => (data?.statusSummary ?? []).reduce((s, r) => s + r.count, 0),
    [data]
  );

  const barData = useMemo(
    () => (data?.monthlyRevenue ?? []).map((r) => ({
      name: formatMonthLabel(r.month),
      receita: r.total,
      os: r.count,
    })),
    [data]
  );

  const pieData = useMemo(
    () => (data?.paymentMethods ?? []).map((r) => ({
      name: PAYMENT_METHOD_LABELS[r.method] ?? r.method,
      value: r.total,
    })),
    [data]
  );

  const [exportingCsv, setExportingCsv] = useState(false);

  // Constrói query string de período para os endpoints de exportação
  const periodParams = useMemo(() => {
    const p = new URLSearchParams();
    if (periodPreset === "custom" && customStart && customEnd) {
      p.set("startDate", customStart);
      p.set("endDate", customEnd);
    } else if (periodPreset !== "custom") {
      p.set("months", periodPreset);
    }
    return p.toString() ? `?${p.toString()}` : "";
  }, [periodPreset, customStart, customEnd]);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const filename = `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`;
      navigate(buildPdfViewerUrl({
        src: `/api/export/relatorio-financeiro.pdf${periodParams}`,
        title: "Relatório financeiro",
        filename,
        back: "/painel/relatorios",
      }));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const a = document.createElement("a");
      a.href = `/api/export/relatorio-financeiro.csv${periodParams}`;
      a.download = `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <TenantLayout title="Relatórios">
      <div className="space-y-6">
        {/* Header com seletor de período e botões de exportação */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          {/* Seletor de período */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Período</Label>
              <div className="flex gap-1">
                {(["3", "6", "12"] as PeriodPreset[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodPreset(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      periodPreset === p
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {p === "3" ? "3 meses" : p === "6" ? "6 meses" : "12 meses"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPeriodPreset("custom")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    periodPreset === "custom"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  Personalizado
                </button>
              </div>
            </div>
            {periodPreset === "custom" && (
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
              </div>
            )}
          </div>
          {/* Botões de exportação */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 bg-background shrink-0"
                disabled={exportingPdf || exportingCsv || isLoading}
              >
                <Download className="h-4 w-4" />
                {(exportingPdf || exportingCsv) ? "Gerando..." : "Exportar"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCsv} disabled={exportingCsv}>
                <Download className="h-4 w-4 mr-2 text-green-600" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} disabled={exportingPdf}>
                <FileText className="h-4 w-4 mr-2 text-red-600" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receita Total</span>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
              </div>
              {isLoading ? (
                <div className="h-7 w-32 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Pagamentos confirmados</p>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">OS com Pagamento</span>
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                </div>
              </div>
              {isLoading ? (
                <div className="h-7 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold">{totalOsPaid}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Nos últimos 12 meses</p>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total de OS</span>
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              {isLoading ? (
                <div className="h-7 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold">{totalOsAll}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Todas as ordens</p>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket Médio</span>
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
              {isLoading ? (
                <div className="h-7 w-24 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(totalOsPaid > 0 ? totalRevenue / totalOsPaid : 0)}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Por OS com pagamento</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Receita Mensal */}
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Receita Mensal (últimos 12 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 bg-muted animate-pulse rounded" />
            ) : barData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum pagamento registrado no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [formatCurrency(value), "Receita"]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="receita" fill="#1e3a5f" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Grid: Métodos de Pagamento + Top Defeitos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Métodos de Pagamento — Gráfico de Pizza */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Métodos de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-52 bg-muted animate-pulse rounded" />
              ) : pieData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum pagamento registrado
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => [formatCurrency(value), "Total"]}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => <span style={{ fontSize: "11px" }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Tabela de métodos */}
                  <div className="divide-y divide-border">
                    {(data?.paymentMethods ?? []).map((r, i) => {
                      const total = (data?.paymentMethods ?? []).reduce((s, x) => s + x.total, 0);
                      const pct = total > 0 ? ((r.total / total) * 100).toFixed(1) : "0.0";
                      return (
                        <div key={r.method} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                            <span className="text-sm">{PAYMENT_METHOD_LABELS[r.method] ?? r.method}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-muted-foreground">{r.count}x</span>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                            <span className="text-sm font-semibold text-primary">{formatCurrency(r.total)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 5 Defeitos */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                Top 5 Defeitos Mais Comuns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : (data?.topDefects ?? []).length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhuma OS registrada
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {(data?.topDefects ?? []).map((r, i) => {
                    const maxCount = Math.max(...(data?.topDefects ?? []).map((x) => x.count), 1);
                    const pct = Math.round((r.count / maxCount) * 100);
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm truncate max-w-[75%]" title={r.defect ?? ""}>
                            <span className="text-muted-foreground mr-2 font-mono text-xs">#{i + 1}</span>
                            {r.defect ?? "—"}
                          </span>
                          <span className="text-sm font-semibold text-primary shrink-0 ml-2">
                            {r.count} OS
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: PIE_COLORS[i % PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Status de OS */}
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (data?.statusSummary ?? []).length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Nenhuma OS registrada
              </div>
            ) : (
              <div className="divide-y divide-border">
                <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30">
                  <span>Status</span>
                  <span className="text-right">Quantidade</span>
                  <span className="text-right">Valor Total</span>
                </div>
                {(data?.statusSummary ?? []).map((r) => (
                  <div
                    key={r.status}
                    className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-2 sm:gap-4 px-5 py-3 items-center"
                  >
                    <span className="text-sm">{STATUS_LABELS[r.status] ?? r.status}</span>
                    <span className="text-sm font-semibold text-right">{r.count}</span>
                    <span className="text-sm text-primary font-semibold text-right">{formatCurrency(r.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
}
