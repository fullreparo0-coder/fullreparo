import { useState, useEffect, useMemo } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, STATUS_LABELS } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Plus, Search, ClipboardList, Wrench, Filter, HelpCircle, Truck, Calendar, X, Download, FileText, AlertTriangle, Clock3, UserRound, WalletCards, Smartphone, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState as useExportState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS);
const PAGE_SIZE = 20;
const COLETAS_STATUS = "aguardando_coleta,coleta_agendada";

const FINAL_STATUSES = new Set(["finalizado", "encerrado_sem_reparo", "encerrado_condenado", "cancelado", "entregue"]);
const CLOSED_FINANCIAL_STATUSES = new Set(["entregue"]);
const HIGH_TOUCH_STATUSES = new Set(["aguardando_aprovacao", "pronto", "aguardando_entrega", "aguardando_peca"]);
const SLA_LIMIT_HOURS: Record<string, number> = {
  solicitado: 4,
  aguardando_coleta: 8,
  coleta_agendada: 24,
  coletado: 8,
  recebido_na_assistencia: 24,
  em_diagnostico: 48,
  aguardando_aprovacao: 24,
  aprovado: 12,
  aguardando_peca: 72,
  em_reparo: 48,
  pronto: 24,
  aguardando_entrega: 24,
  saiu_para_entrega: 8,
};

function moneyToNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: unknown) {
  return moneyToNumber(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toDateOrNull(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hoursBetween(start: Date | null, end: Date) {
  if (!start) return 0;
  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / 36_000)) / 100);
}

function formatRelativeHours(hours: number) {
  if (hours < 1) return "menos de 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours % 24);
  return remaining > 0 ? `${days}d ${remaining}h` : `${days}d`;
}

function formatDate(value: Date | string | null | undefined) {
  const date = toDateOrNull(value);
  return date ? date.toLocaleDateString("pt-BR") : "—";
}

function formatDateTime(value: Date | string | null | undefined) {
  const date = toDateOrNull(value);
  return date ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function buildDeviceLabel(order: Record<string, unknown>) {
  const parts = [order.deviceBrand, order.deviceModel].map((value) => String(value ?? "").trim()).filter(Boolean);
  if (parts.length) return parts.join(" ");
  return String(order.deviceType ?? "Aparelho não informado");
}

function buildSlaSnapshot(order: Record<string, unknown>, now = new Date()) {
  const status = String(order.status ?? "");
  const baseDate = toDateOrNull(order.updatedAt as Date | string | null | undefined) ?? toDateOrNull(order.createdAt as Date | string | null | undefined);
  const estimatedDelivery = toDateOrNull(order.estimatedDelivery as Date | string | null | undefined);
  const hoursInStage = hoursBetween(baseDate, now);
  const limitHours = SLA_LIMIT_HOURS[status] ?? 48;
  const isFinal = FINAL_STATUSES.has(status);
  const isOverdue = !!estimatedDelivery && estimatedDelivery < now && !isFinal;
  const isStageStalled = !isFinal && hoursInStage >= limitHours;
  const remainingHours = isFinal ? null : Math.max(0, Math.round((limitHours - hoursInStage) * 100) / 100);

  return {
    statusAgeHours: hoursInStage,
    limitHours,
    remainingHours,
    isOverdue,
    isStageStalled,
    label: isFinal
      ? "Concluída"
      : isOverdue
        ? "Prazo vencido"
        : isStageStalled
          ? "Etapa parada"
          : "Dentro do SLA",
  };
}

function buildNextBestAction(order: Record<string, unknown>, sla: ReturnType<typeof buildSlaSnapshot>) {
  const status = String(order.status ?? "");
  const totalAmount = moneyToNumber(order.totalAmount);
  const hasDeliveryAuthorization = !!order.deliveryAuthorizedAt;
  const isFinal = FINAL_STATUSES.has(status);

  if (isFinal) return { priority: "baixa", title: "OS concluída", ctaLabel: "Revisar OS" };
  if (sla.isOverdue) return { priority: "alta", title: "Revisar prazo e avisar cliente", ctaLabel: "Atualizar prazo" };
  if (status === "aguardando_aprovacao") return { priority: "alta", title: "Cobrar aprovação do orçamento", ctaLabel: "Enviar lembrete" };
  if (status === "pronto" || status === "aguardando_entrega") {
    return {
      priority: totalAmount > 0 && !hasDeliveryAuthorization ? "alta" : "media",
      title: "Combinar retirada, entrega ou pagamento",
      ctaLabel: "Finalizar entrega",
    };
  }
  if (status === "aguardando_peca") return { priority: "media", title: "Atualizar previsão da peça", ctaLabel: "Atualizar previsão" };
  if (sla.isStageStalled || HIGH_TOUCH_STATUSES.has(status)) return { priority: "media", title: "Atualizar etapa e comunicar cliente", ctaLabel: "Registrar atualização" };
  return { priority: "normal", title: "Acompanhar andamento", ctaLabel: "Abrir OS" };
}

function priorityClasses(priority: string) {
  if (priority === "alta") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "media") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "baixa") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-border bg-muted/40 text-muted-foreground";
}

function slaClasses(sla: ReturnType<typeof buildSlaSnapshot>) {
  if (sla.isOverdue || sla.isStageStalled) return "border-red-200 bg-red-50 text-red-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function ServiceOrdersList() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const initialStatus = new URLSearchParams(searchString).get("status") ?? "all";
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "coletas">(initialStatus === "aguardando_coleta" ? "coletas" : "all");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus === "aguardando_coleta" ? "all" : initialStatus);
  const [period, setPeriod] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [exportingCsv, setExportingCsv] = useExportState(false);
  const [exportingPdf, setExportingPdf] = useExportState(false);

  // Modal de período para exportação
  const [exportModalOpen, setExportModalOpen] = useExportState(false);
  const [exportFormat, setExportFormat] = useExportState<"csv" | "pdf">("csv");
  const [exportPeriod, setExportPeriod] = useExportState<"current" | "today" | "week" | "month" | "custom">("current");
  const [exportCustomFrom, setExportCustomFrom] = useExportState("");
  const [exportCustomTo, setExportCustomTo] = useExportState("");

  function openExportModal(format: "csv" | "pdf") {
    setExportFormat(format);
    setExportPeriod("current");
    setExportCustomFrom("");
    setExportCustomTo("");
    setExportModalOpen(true);
  }

  function buildExportUrl(format: "csv" | "pdf") {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (effectiveStatus) params.set("status", effectiveStatus);

    let from: number | undefined;
    let to: number | undefined;
    const now = new Date();

    if (exportPeriod === "current") {
      from = dateFrom;
      to = dateTo;
    } else if (exportPeriod === "today") {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      from = s.getTime(); to = e.getTime();
    } else if (exportPeriod === "week") {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      from = s.getTime(); to = e.getTime();
    } else if (exportPeriod === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      from = s.getTime(); to = e.getTime();
    } else if (exportPeriod === "custom" && exportCustomFrom) {
      const s = new Date(exportCustomFrom + "T00:00:00");
      const e = exportCustomTo ? new Date(exportCustomTo + "T23:59:59") : new Date(now);
      from = s.getTime(); to = e.getTime();
    }

    if (from) params.set("dateFrom", String(from));
    if (to) params.set("dateTo", String(to));
    return `/api/export/os.${format}?${params.toString()}`;
  }

  async function handleExport() {
    const isExportingCsv = exportFormat === "csv";
    if (isExportingCsv) setExportingCsv(true); else setExportingPdf(true);
    try {
      const url = buildExportUrl(exportFormat);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ordens-de-servico-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setExportModalOpen(false);
    } finally {
      if (isExportingCsv) setExportingCsv(false); else setExportingPdf(false);
    }
  }

  // Calcular dateFrom/dateTo com base no período selecionado
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    if (period === "today") {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      return { dateFrom: start.getTime(), dateTo: end.getTime() };
    }
    if (period === "week") {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      return { dateFrom: start.getTime(), dateTo: end.getTime() };
    }
    if (period === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      return { dateFrom: start.getTime(), dateTo: end.getTime() };
    }
    if (period === "custom" && customFrom) {
      const start = new Date(customFrom + "T00:00:00");
      const end = customTo ? new Date(customTo + "T23:59:59") : new Date(now); end.setHours(23, 59, 59, 999);
      return { dateFrom: start.getTime(), dateTo: end.getTime() };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [period, customFrom, customTo]);

  // Reset para página 1 sempre que os filtros mudarem
  useEffect(() => { setPage(1); }, [search, statusFilter, activeTab, dateFrom, dateTo]);

  // Status efetivo enviado para a query
  const effectiveStatus = activeTab === "coletas" ? COLETAS_STATUS : (statusFilter !== "all" ? statusFilter : undefined);

  const { data, isLoading } = trpc.serviceOrders.list.useQuery({
    search: search || undefined,
    status: effectiveStatus,
    dateFrom,
    dateTo,
    page,
    pageSize: PAGE_SIZE,
  });

  // Contagem de coletas pendentes para o badge da aba
  const { data: coletasCount } = trpc.serviceOrders.list.useQuery({
    status: COLETAS_STATUS,
    pageSize: 1,
  }, { select: (d) => d.totalCount });

  const orders = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const visibleStats = useMemo(() => {
    return orders.reduce(
      (acc, os) => {
        const sla = buildSlaSnapshot(os as Record<string, unknown>);
        const action = buildNextBestAction(os as Record<string, unknown>, sla);
        const total = moneyToNumber(os.totalAmount);
        const paid = moneyToNumber(os.paidAmount);
        acc.total += 1;
        if (action.priority === "alta" || sla.isOverdue || sla.isStageStalled) acc.attention += 1;
        if (total > 0) acc.withValue += 1;
        if (CLOSED_FINANCIAL_STATUSES.has(String(os.status)) && Math.max(total - paid, 0) > 0) acc.withBalance += 1;
        if (os.origin === "coleta") acc.pickups += 1;
        return acc;
      },
      { total: 0, attention: 0, withValue: 0, withBalance: 0, pickups: 0 },
    );
  }, [orders]);

  return (
    <TenantLayout title="Ordens de Serviço">
      <div className="space-y-4">
        {/* Abas de visualização */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("all")}
            className={[
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === "all"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            ].join(" ")}
          >
            <ClipboardList className="h-4 w-4" />
            Todas as OS
          </button>
          <button
            onClick={() => setActiveTab("coletas")}
            className={[
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === "coletas"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            ].join(" ")}
          >
            <Truck className="h-4 w-4" />
            Coletas
            {(coletasCount ?? 0) > 0 && (
              <Badge className="ml-1 h-4 px-1.5 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">
                {coletasCount}
              </Badge>
            )}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº OS, cliente, CPF, IMEI, SN ou defeito..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label="Campos de busca disponíveis"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="max-w-xs">
                <p className="font-semibold text-xs mb-1.5">Campos de busca disponíveis:</p>
                <ul className="space-y-1 text-xs">
                  <li><span className="font-medium">Nº da OS</span> — ex: OS-0042</li>
                  <li><span className="font-medium">Nome do cliente</span></li>
                  <li><span className="font-medium">CPF / CNPJ</span> do cliente</li>
                  <li><span className="font-medium">Telefone</span> do cliente</li>
                  <li><span className="font-medium">IMEI</span> do aparelho</li>
                  <li><span className="font-medium">Número de série (SN)</span></li>
                  <li><span className="font-medium">Defeito relatado</span></li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-52">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-full sm:w-44">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {/* Botões de exportação */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1.5 bg-background">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => openExportModal("csv")}>
                <Download className="h-4 w-4 mr-2 text-green-600" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExportModal("pdf")}>
                <FileText className="h-4 w-4 mr-2 text-red-600" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Modal de período para exportação */}
          <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {exportFormat === "csv" ? (
                    <Download className="h-4 w-4 text-green-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-red-600" />
                  )}
                  Exportar {exportFormat.toUpperCase()}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Filtros ativos */}
                {(effectiveStatus || dateFrom || search) && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                    <p className="font-medium text-muted-foreground mb-1.5">Filtros ativos:</p>
                    {search && <p><span className="font-medium">Busca:</span> {search}</p>}
                    {effectiveStatus && <p><span className="font-medium">Status:</span> {effectiveStatus.split(",").join(", ")}</p>}
                    {(dateFrom || dateTo) && (
                      <p><span className="font-medium">Período:</span> {dateFrom ? new Date(dateFrom).toLocaleDateString("pt-BR") : ""}{dateTo ? " a " + new Date(dateTo).toLocaleDateString("pt-BR") : ""}</p>
                    )}
                  </div>
                )}

                {/* Seleção de período */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Período da exportação</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "current", label: "Período atual" },
                      { value: "today", label: "Hoje" },
                      { value: "week", label: "Esta semana" },
                      { value: "month", label: "Este mês" },
                      { value: "custom", label: "Personalizado" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setExportPeriod(opt.value)}
                        className={[
                          "rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left",
                          exportPeriod === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted/50",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inputs de data personalizada */}
                {exportPeriod === "custom" && (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <Label className="text-xs w-8 shrink-0">De</Label>
                      <Input
                        type="date"
                        value={exportCustomFrom}
                        onChange={(e) => setExportCustomFrom(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <Label className="text-xs w-8 shrink-0">Até</Label>
                      <Input
                        type="date"
                        value={exportCustomTo}
                        onChange={(e) => setExportCustomTo(e.target.value)}
                        min={exportCustomFrom}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancelar</Button>
                <Button
                  onClick={handleExport}
                  disabled={exportingCsv || exportingPdf || (exportPeriod === "custom" && !exportCustomFrom)}
                  className="gap-2"
                >
                  {(exportingCsv || exportingPdf) ? (
                    "Gerando..."
                  ) : (
                    <>
                      {exportFormat === "csv" ? <Download className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      Gerar {exportFormat.toUpperCase()}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => navigate("/painel/os/nova")}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova OS
          </Button>
        </div>

        {/* Inputs de data personalizada */}
        {period === "custom" && (
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 rounded-lg border border-border bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Período personalizado:</span>
            <div className="flex gap-2 flex-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">De</label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  min={customFrom}
                  className="h-8 text-xs w-36"
                />
              </div>
              {(customFrom || customTo) && (
                <button
                  onClick={() => { setCustomFrom(""); setCustomTo(""); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Resumo da página atual */}
        {!isLoading && orders.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="border-border/70 bg-muted/20">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Resultado visível</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{visibleStats.total}</p>
                <p className="text-xs text-muted-foreground">de {totalCount} OS filtradas</p>
              </CardContent>
            </Card>
            <Card className="border-red-200/70 bg-red-50/70">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-red-700/80">Atenção operacional</p>
                <p className="mt-1 text-2xl font-semibold text-red-700">{visibleStats.attention}</p>
                <p className="text-xs text-red-700/75">prazo, etapa parada ou ação alta</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200/70 bg-emerald-50/70">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80">Com valor</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700">{visibleStats.withValue}</p>
                <p className="text-xs text-emerald-700/75">OS com valor informado</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200/70 bg-amber-50/70">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700/80">Saldo devedor</p>
                <p className="mt-1 text-2xl font-semibold text-amber-700">{visibleStats.withBalance}</p>
                <p className="text-xs text-amber-700/75">somente OS entregues com valor aberto</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200/70 bg-blue-50/70">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700/80">Coletas</p>
                <p className="mt-1 text-2xl font-semibold text-blue-700">{visibleStats.pickups}</p>
                <p className="text-xs text-blue-700/75">origem coleta na página</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* List */}
        <Card className="border border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">Nenhuma OS encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || statusFilter !== "all"
                    ? "Tente ajustar os filtros"
                    : "Crie a primeira OS para começar"}
                </p>
                {!search && statusFilter === "all" && (
                  <Button size="sm" className="mt-4" onClick={() => navigate("/painel/os/nova")}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova OS
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                <div className="hidden lg:grid grid-cols-[1.1fr_1.2fr_1.5fr_1.25fr_1.15fr_1.05fr_auto] gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30">
                  <span>OS e cliente</span>
                  <span>Aparelho</span>
                  <span>Próxima ação</span>
                  <span>Status / SLA</span>
                  <span>Financeiro</span>
                  <span>Responsável</span>
                  <span>Abrir</span>
                </div>
                <div className="grid grid-cols-1 gap-3 p-3 lg:block lg:p-0">
                  {orders.map((os) => {
                    const orderRecord = os as Record<string, unknown>;
                    const sla = buildSlaSnapshot(orderRecord);
                    const nextAction = buildNextBestAction(orderRecord, sla);
                    const total = moneyToNumber(os.totalAmount);
                    const paid = moneyToNumber(os.paidAmount);
                    const balance = Math.max(total - paid, 0);
                    const hasFinancialPending = CLOSED_FINANCIAL_STATUSES.has(String(os.status)) && balance > 0.005;
                    const hasPendingPayment = Number(os.pendingPaymentsCount ?? 0) > 0;
                    const deviceLabel = buildDeviceLabel(orderRecord);
                    const technicianName = os.technicianName ?? "Sem técnico";

                    return (
                      <button
                        key={os.id}
                        onClick={() => navigate(`/painel/os/${os.id}`)}
                        className="group w-full rounded-2xl border border-border/70 bg-background p-4 text-left shadow-sm transition-colors hover:bg-muted/25 active:bg-muted/45 lg:grid lg:grid-cols-[1.1fr_1.2fr_1.5fr_1.25fr_1.15fr_1.05fr_auto] lg:items-center lg:gap-4 lg:rounded-none lg:border-0 lg:px-5 lg:py-4 lg:shadow-none"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary lg:h-8 lg:w-8">
                              <Wrench className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{os.osNumber}</p>
                              <p className="truncate text-xs font-medium text-muted-foreground">{os.customerName ?? "Cliente não informado"}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                              {os.origin === "coleta" ? "Coleta" : "Balcão"}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">Criada em {formatDate(os.createdAt)}</span>
                          </div>
                        </div>

                        <div className="mt-4 min-w-0 lg:mt-0">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                            <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{deviceLabel}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{os.reportedDefect || "Defeito não informado"}</p>
                          {(os.deviceImei || os.deviceSerialNumber) && (
                            <p className="mt-1 truncate text-[11px] text-muted-foreground/85">
                              {os.deviceImei ? `IMEI ${os.deviceImei}` : `SN ${os.deviceSerialNumber}`}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 min-w-0 lg:mt-0">
                          <Badge variant="outline" className={`max-w-full justify-start gap-1.5 px-2 py-1 text-[11px] ${priorityClasses(nextAction.priority)}`}>
                            {nextAction.priority === "alta" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{nextAction.title}</span>
                          </Badge>
                          <p className="mt-1 text-[11px] text-muted-foreground">Ação: {nextAction.ctaLabel}</p>
                        </div>

                        <div className="mt-4 min-w-0 lg:mt-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={os.status} size="sm" />
                            <Badge variant="outline" className={`gap-1.5 px-2 py-1 text-[11px] ${slaClasses(sla)}`}>
                              <Clock3 className="h-3.5 w-3.5" />
                              {sla.label}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatRelativeHours(sla.statusAgeHours)} na etapa
                            {sla.remainingHours !== null && !sla.isStageStalled ? ` · ${formatRelativeHours(sla.remainingHours)} restantes` : ""}
                          </p>
                          {os.estimatedDelivery && (
                            <p className="text-[11px] text-muted-foreground">Previsão: {formatDate(os.estimatedDelivery)}</p>
                          )}
                        </div>

                        <div className="mt-4 min-w-0 lg:mt-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <WalletCards className="h-4 w-4 text-muted-foreground" />
                            {total > 0 ? formatMoney(total) : "Sem valor"}
                          </div>
                          <p className={`mt-1 text-[11px] ${hasFinancialPending ? "font-medium text-red-700" : "text-muted-foreground"}`}>
                            Pago {formatMoney(paid)} · {hasFinancialPending ? "Saldo devedor" : "Saldo"} {formatMoney(balance)}
                          </p>
                          {hasFinancialPending && (
                            <Badge variant="outline" className="mt-1 w-fit border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-50">
                              Saldo devedor {formatMoney(balance)}
                            </Badge>
                          )}
                          {hasPendingPayment && (
                            <p className="text-[11px] font-medium text-amber-700">Pagamento solicitado em aberto</p>
                          )}
                        </div>

                        <div className="mt-4 min-w-0 lg:mt-0">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{technicianName}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">Atualizada {formatDateTime(os.updatedAt)}</p>
                          <Badge variant="outline" className="mt-2 hidden h-5 w-fit px-1.5 text-[10px] lg:inline-flex">
                            {os.origin === "coleta" ? "Coleta" : "Balcão"}
                          </Badge>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 lg:mt-0 lg:block lg:border-0 lg:pt-0">
                          <span className="text-xs font-medium text-muted-foreground lg:hidden">Abrir detalhes</span>
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground lg:ml-auto">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paginação */}
        {totalCount > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>
    </TenantLayout>
  );
}
