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
import { Plus, Search, ClipboardList, Wrench, Filter, HelpCircle, Truck, Calendar, X, Download, FileText } from "lucide-react";
import { useState as useExportState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS);
const PAGE_SIZE = 20;
const COLETAS_STATUS = "aguardando_coleta,coleta_agendada";

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
                {/* Header */}
                <div className="hidden sm:grid grid-cols-[1fr_1.4fr_2fr_1.5fr_1fr_auto] gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30">
                  <span>Número</span>
                  <span>Cliente</span>
                  <span>Defeito</span>
                  <span>Status</span>
                  <span>Data</span>
                  <span>Origem</span>
                </div>
                {orders.map((os) => (
                  <button
                    key={os.id}
                    onClick={() => navigate(`/painel/os/${os.id}`)}
                    className="group w-full grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_2fr_1.5fr_1fr_auto] gap-1.5 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-muted/35 active:bg-muted/60 transition-colors text-left sm:items-center"
                  >
                    <div className="flex items-start sm:items-center gap-2 min-w-0">
                      <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 w-full sm:w-auto">
                        <div className="flex items-center justify-between gap-2 sm:block">
                          <span className="block text-[13px] sm:text-sm font-semibold text-foreground tracking-tight truncate">{os.osNumber}</span>
                          <StatusBadge
                            status={os.status}
                            size="sm"
                            className="sm:hidden max-w-[52%] px-2 py-0.5 text-[10px] leading-4 shadow-none truncate"
                          />
                        </div>
                        <span className="block sm:hidden text-[13px] font-semibold text-foreground/85 leading-5 truncate mt-0.5">
                          {os.customerName ?? "Cliente não informado"}
                        </span>
                      </div>
                    </div>
                    <p className="hidden sm:block text-sm font-medium text-foreground/80 truncate">{os.customerName ?? "Cliente não informado"}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-5 sm:leading-normal truncate">{os.reportedDefect}</p>
                    <StatusBadge status={os.status} size="sm" className="hidden sm:inline-flex" />
                    <span className="hidden sm:inline text-xs text-muted-foreground">
                      {new Date(os.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    <Badge variant="outline" className="hidden sm:inline-flex text-[10px] h-5 px-1.5 w-fit">
                      {os.origin === "coleta" ? "Coleta" : "Balcão"}
                    </Badge>
                    <div className="sm:hidden flex items-center gap-2 text-[11px] leading-4 text-muted-foreground">
                      <span>{new Date(os.createdAt).toLocaleDateString("pt-BR")}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/35" />
                      <span>{os.origin === "coleta" ? "Coleta" : "Balcão"}</span>
                    </div>
                  </button>
                ))}
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
