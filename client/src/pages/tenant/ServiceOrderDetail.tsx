import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, STATUS_LABELS } from "@/components/StatusBadge";
import { OSTimeline } from "@/components/OSTimeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";
import PrintSheet, { type PrintMode } from "@/components/PrintSheet";
import WarrantyVoucher from "@/components/WarrantyVoucher";
import { createPortal } from "react-dom";
import {
  ArrowLeft, QrCode, Printer, MessageSquare, Clock,
  Wrench, User, Smartphone, FileText, DollarSign, Shield,
  Plus, ExternalLink, Copy, CheckSquare, Square, Send, ChevronDown,
  Phone, Mail, MapPin, Truck, CalendarDays, PackageCheck
} from "lucide-react";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS);

export default function ServiceOrderDetail() {
  const [, params] = useRoute("/painel/os/:id");
  const [, navigate] = useLocation();
  const osId = parseInt(params?.id ?? "0");
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [whatsappModal, setWhatsappModal] = useState<{ message: string; whatsappLink: string } | null>(null);
  // Modal de encerramento (status = finalizado)
  const [closeModal, setCloseModal] = useState(false);
  const [closeWarrantyDays, setCloseWarrantyDays] = useState<number>(90);
  const [closeNotes, setCloseNotes] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetItems, setBudgetItems] = useState<{ description: string; quantity: number; unitPrice: number; type: "service" | "part" }[]>([{ description: "", quantity: 1, unitPrice: 0, type: "service" }]);
  const [laborCost, setLaborCost] = useState(0);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [printWarranty, setPrintWarranty] = useState(false);
  // Modal de agendamento de coleta
  const [schedulePickupOpen, setSchedulePickupOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupShift, setPickupShift] = useState<"manha" | "tarde" | "noite" | "">("manha");
  const [pickupNotes, setPickupNotes] = useState("");

  const handlePrintWarranty = () => {
    setPrintWarranty(true);
    setTimeout(() => {
      document.body.classList.remove("print-mode-a4", "print-mode-thermal58", "print-mode-thermal80", "print-mode-argox8040");
      document.body.classList.add("print-mode-warranty");
      window.print();
      setTimeout(() => {
        document.body.classList.remove("print-mode-warranty");
        setPrintWarranty(false);
      }, 500);
    }, 150);
  };

  const handlePrint = (mode: PrintMode) => {
    setPrintMode(mode);
    // Aguarda o portal renderizar antes de chamar window.print()
    setTimeout(() => {
      const modeClass = mode === "a4" ? "print-mode-a4" : mode === "thermal58" ? "print-mode-thermal58" : mode === "thermal80" ? "print-mode-thermal80" : "print-mode-argox8040";
      document.body.classList.remove("print-mode-a4", "print-mode-thermal58", "print-mode-thermal80", "print-mode-argox8040");
      document.body.classList.add(modeClass);
      window.print();
      setTimeout(() => {
        document.body.classList.remove(modeClass);
        setPrintMode(null);
      }, 500);
    }, 150);
  };

  const utils = trpc.useUtils();
  const { data: os, isLoading } = trpc.serviceOrders.getById.useQuery({ id: osId }, { enabled: osId > 0 });
  const { data: budgets } = trpc.budgets.getByOs.useQuery({ serviceOrderId: osId }, { enabled: osId > 0 });
  const { data: payments } = trpc.payments.getByOs.useQuery({ serviceOrderId: osId }, { enabled: osId > 0 });
  const { data: warranty } = trpc.warranties.getByOs.useQuery({ serviceOrderId: osId }, { enabled: osId > 0 });
  const { data: technicians } = trpc.users.technicians.useQuery();
  const { data: tenantInfo } = trpc.tenants.getMine.useQuery();
  const { data: checklistItems, refetch: refetchChecklist } = trpc.osChecklist.getByOs.useQuery(
    { serviceOrderId: osId },
    { enabled: osId > 0 }
  );
  const toggleChecklistItem = trpc.osChecklist.toggleItem.useMutation({
    onSuccess: () => refetchChecklist(),
    onError: () => toast.error("Erro ao atualizar item"),
  });

  const updateStatus = trpc.serviceOrders.updateStatus.useMutation({
    onSuccess: (data) => {
      toast.success("Status atualizado");
      utils.serviceOrders.getById.invalidate({ id: osId });
      utils.warranties.getByOs.invalidate({ serviceOrderId: osId });
      setNewStatus("");
      setStatusNotes("");
      setCloseModal(false);
      setCloseNotes("");
      if (data?.whatsappNotification) {
        setWhatsappModal(data.whatsappNotification);
      }
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // Handler para confirmar agendamento de coleta
  const handleSchedulePickup = () => {
    if (!pickupDate) { toast.error("Selecione uma data para a coleta."); return; }
    const SHIFTS = {
      manha: { label: "Manhã", range: "08h – 12h" },
      tarde: { label: "Tarde", range: "12h – 18h" },
      noite: { label: "Noite", range: "18h – 21h" },
    } as const;
    const shiftInfo = pickupShift ? SHIFTS[pickupShift as keyof typeof SHIFTS] : null;
    const dateLabel = new Date(pickupDate + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
    });
    const preferredTime = shiftInfo
      ? `${dateLabel} – ${shiftInfo.label} (${shiftInfo.range})`
      : dateLabel;
    const notes = [
      `Coleta agendada para: ${preferredTime}`,
      pickupNotes ? `Obs: ${pickupNotes}` : "",
    ].filter(Boolean).join(" | ");
    updateStatus.mutate(
      { id: osId, status: "coleta_agendada", notes },
      {
        onSuccess: () => {
          setSchedulePickupOpen(false);
          setPickupDate("");
          setPickupShift("manha");
          setPickupNotes("");
          toast.success(`Coleta agendada para ${preferredTime}`);
        },
      }
    );
  };

  const createBudget = trpc.budgets.create.useMutation({
    onSuccess: () => {
      toast.success("Orçamento criado e enviado ao cliente");
      setBudgetOpen(false);
      utils.budgets.getByOs.invalidate({ serviceOrderId: osId });
      utils.serviceOrders.getById.invalidate({ id: osId });
    },
    onError: () => toast.error("Erro ao criar orçamento"),
  });

  const registerPayment = trpc.payments.register.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado");
      utils.payments.getByOs.invalidate({ serviceOrderId: osId });
    },
  });

  // Pré-preencher dias de garantia com o valor atual da OS quando ela carregar
  // (useEffect garante que o valor seja atualizado quando os mudar)
  const prevOsId = useState(0);
  if (os && os.id !== prevOsId[0]) {
    prevOsId[1](os.id);
    setCloseWarrantyDays(os.warrantyDays ?? 90);
  }

  const handleStatusChange = (status: string) => {
    if (status === "finalizado") {
      // Interceptar: abrir modal de encerramento em vez de confirmar direto
      setNewStatus(status);
      setCloseWarrantyDays(os?.warrantyDays ?? 90);
      setCloseNotes("");
      setCloseModal(true);
    } else {
      setNewStatus(status);
    }
  };

  const handleConfirmClose = () => {
    updateStatus.mutate({
      id: osId,
      status: "finalizado",
      notes: closeNotes || undefined,
      warrantyDays: closeWarrantyDays,
    });
  };

  // ── Auto-impressão via query param ?print=a4|thermal (vindo da tela de criação) ────────
  useEffect(() => {
    if (!os) return;
    const params = new URLSearchParams(window.location.search);
    const printParam = params.get("print");
    if (!printParam) return;
    // Remove o param da URL sem recarregar a página
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
    // Aguarda um tick para garantir que os dados da OS já estão renderizados
    const timer = setTimeout(() => {
      if (printParam === "thermal") {
        handlePrint("thermal80");
      } else if (printParam === "a4") {
        handlePrint("a4");
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [os?.id]);

  const copyTrackingLink = () => {
    if (!os?.publicToken) return;
    const url = `${window.location.origin}/rastrear/${os.publicToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const openWhatsApp = () => {
    if (!os?.publicToken) return;
    const url = `${window.location.origin}/rastrear/${os.publicToken}`;
    const msg = encodeURIComponent(`Olá! Sua OS *${os.osNumber}* está em andamento. Acompanhe aqui: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleBudgetSubmit = () => {
    createBudget.mutate({
      serviceOrderId: osId,
      laborCost,
      items: budgetItems.filter((i) => i.description),
    });
  };

  if (isLoading) {
    return (
      <TenantLayout title="Carregando...">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </TenantLayout>
    );
  }

  if (!os) {
    return (
      <TenantLayout title="OS não encontrada">
        <div className="text-center py-20">
          <p className="text-muted-foreground">OS não encontrada</p>
          <Button className="mt-4" onClick={() => navigate("/painel/os")}>Voltar</Button>
        </div>
      </TenantLayout>
    );
  }

  const trackingUrl = `${window.location.origin}/rastrear/${os.publicToken}`;
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const pickupPhotos = ((os as any).photos ?? []).filter((photo: any) => photo.type === "coleta");
  const pickupLatitude = Number((os as any).pickupLatitude);
  const pickupLongitude = Number((os as any).pickupLongitude);
  const hasPickupLocation = Number.isFinite(pickupLatitude) && Number.isFinite(pickupLongitude);
  const pickupMapUrl = hasPickupLocation
    ? `https://www.google.com/maps?q=${pickupLatitude},${pickupLongitude}`
    : "";

  const nextBestAction = (os as any).nextBestAction as { code?: string; priority?: string; title?: string; description?: string; ctaLabel?: string } | undefined;
  const sla = (os as any).sla as { statusAgeHours?: number; isOverdue?: boolean; isStageStalled?: boolean; estimatedDelivery?: string | null; overdueDays?: number } | undefined;
  const priorityClass = nextBestAction?.priority === "alta"
    ? "border-red-200 bg-red-50/70 text-red-900 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-100"
    : nextBestAction?.priority === "media"
      ? "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100"
      : "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100";
  const statusAgeLabel = typeof sla?.statusAgeHours === "number"
    ? sla.statusAgeHours >= 24
      ? `${Math.floor(sla.statusAgeHours / 24)} dia(s) nesta etapa`
      : `${Math.max(1, Math.round(sla.statusAgeHours))}h nesta etapa`
    : "Tempo de etapa indisponível";
  const quickActionStatus = nextBestAction?.code === "ready_pickup" ? "pronto" : nextBestAction?.code === "delivery_ready" ? "saiu_para_entrega" : nextBestAction?.code === "diagnosis_needed" ? "em_diagnostico" : nextBestAction?.code === "approved_repair" ? "em_reparo" : null;

  // Monta link e mensagem de WhatsApp para o comprovante de garantia
  const buildWarrantyWhatsApp = () => {
    if (!warranty) return null;
    const verifyUrl = `${window.location.origin}/verificar-garantia?codigo=${encodeURIComponent(warranty.warrantyCode)}`;
    const expiresStr = new Date(warranty.expiresAt).toLocaleDateString("pt-BR");
    const customerName = (os as any).customerName ?? "Cliente";
    const tenantName = tenantInfo?.name ?? "a assistência";
    const msg = [
      `✅ *Comprovante de Garantia*`,
      ``,
      `Olá, ${customerName}!`,
      `Seu aparelho foi reparado por ${tenantName} e está coberto pela nossa garantia.`,
      ``,
      `🛡 *Código:* ${warranty.warrantyCode}`,
      `📅 *Válida até:* ${expiresStr} (${warranty.warrantyDays} dias)`,
      ``,
      `🔗 Verifique sua garantia a qualquer momento:`,
      verifyUrl,
    ].join("\n");
    const phone = ((os as any).customerPhone ?? "").replace(/\D/g, "");
    return `https://wa.me/${phone ? `55${phone}` : ""}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <TenantLayout title={`OS ${os.osNumber}`}>
      <div className="space-y-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/painel/os")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex-1" />
          <StatusBadge status={os.status} size="lg" />
          <Badge variant="outline">{os.origin === "coleta" ? "Coleta" : "Balcão"}</Badge>
          <Button variant="outline" size="sm" onClick={copyTrackingLink}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Link
          </Button>
          <Button variant="outline" size="sm" onClick={openWhatsApp}>
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
          </Button>
          {os.status === "aguardando_coleta" && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
              onClick={() => setSchedulePickupOpen(true)}
            >
              <Truck className="h-3.5 w-3.5 mr-1.5" /> Agendar Coleta
            </Button>
          )}
          {os.status === "coleta_agendada" && (
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm"
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({
                  id: osId,
                  status: "em_reparo",
                  notes: "Aparelho retirado pelo técnico. Iniciando reparo.",
                })
              }
            >
              <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
              {updateStatus.isPending ? "Confirmando..." : "Confirmar Retirada"}
            </Button>
          )}
          {(os.status === "aguardando_entrega" || os.status === "saiu_para_entrega") && (
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm"
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({
                  id: osId,
                  status: "entregue",
                  notes: "Aparelho entregue ao cliente. Ciclo de entrega concluído.",
                })
              }
            >
              <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
              {updateStatus.isPending ? "Confirmando..." : "Confirmar Entrega"}
            </Button>
          )}
          {os.status !== "finalizado" && os.status !== "cancelado" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              onClick={() => {
                setNewStatus("finalizado");
                setCloseWarrantyDays(os.warrantyDays ?? 90);
                setCloseNotes("");
                setCloseModal(true);
              }}
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" /> Encerrar OS
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[210px]">
              <DropdownMenuLabel className="text-xs">Ficha da OS</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePrint("a4")}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Folha A4 (completa)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint("thermal80")}>
                <Printer className="h-3.5 w-3.5 mr-2" /> Bobina Térmica 80mm padrão
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint("thermal58")}>
                <Printer className="h-3.5 w-3.5 mr-2" /> Bobina 58mm legado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint("argox8040")}>
                <QrCode className="h-3.5 w-3.5 mr-2" /> Etiqueta Argox 78×38mm
              </DropdownMenuItem>
              {warranty && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Garantia Digital</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handlePrintWarranty}>
                    <Shield className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Comprovante de Garantia
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const link = buildWarrantyWhatsApp();
                      if (link) window.open(link, "_blank");
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-2 text-green-600" /> Enviar Garantia via WhatsApp
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {nextBestAction && (
          <Card className={`border shadow-sm ${priorityClass}`}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={nextBestAction.priority === "alta" ? "destructive" : "secondary"} className="uppercase tracking-wide">
                      {nextBestAction.priority === "alta" ? "ação crítica" : nextBestAction.priority === "media" ? "atenção" : "próxima ação"}
                    </Badge>
                    <span className="text-xs font-medium opacity-80">{statusAgeLabel}</span>
                    {sla?.isOverdue && <Badge variant="destructive">prazo vencido</Badge>}
                    {sla?.isStageStalled && <Badge variant="outline">etapa parada</Badge>}
                  </div>
                  <h2 className="text-base font-semibold">{nextBestAction.title}</h2>
                  <p className="text-sm opacity-85">{nextBestAction.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button size="sm" variant="secondary" onClick={openWhatsApp}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Avisar cliente
                  </Button>
                  {quickActionStatus && os.status !== quickActionStatus && (
                    <Button
                      size="sm"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: osId, status: quickActionStatus as any, notes: `Ação rápida v19: ${nextBestAction.ctaLabel ?? nextBestAction.title}` })}
                    >
                      <Clock className="h-3.5 w-3.5 mr-1.5" /> {nextBestAction.ctaLabel ?? "Aplicar ação"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={copyTrackingLink}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Link do cliente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-4">
            {/* OS Info */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Informações da OS
                  </CardTitle>
                  {os.status !== "finalizado" && os.status !== "cancelado" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        setNewStatus("finalizado");
                        setCloseWarrantyDays(os.warrantyDays ?? 90);
                        setCloseNotes("");
                        setCloseModal(true);
                      }}
                    >
                      <Shield className="h-3 w-3 mr-1" /> Encerrar OS
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Número</p>
                    <p className="font-semibold">{os.osNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Abertura</p>
                    <p>{new Date(os.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Defeito relatado</p>
                    <p className="font-medium">{os.reportedDefect}</p>
                  </div>
                  {os.physicalCondition && (
                    <div>
                      <p className="text-xs text-muted-foreground">Estado físico</p>
                      <p>{os.physicalCondition}</p>
                    </div>
                  )}
                  {os.accessories && (
                    <div>
                      <p className="text-xs text-muted-foreground">Acessórios</p>
                      <p>{os.accessories}</p>
                    </div>
                  )}
                  {os.internalNotes && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Observações</p>
                      <p className="text-muted-foreground">{os.internalNotes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dados de Coleta — exibido apenas quando origin=coleta */}
            {os.origin === "coleta" && (os.pickupAddress || os.preferredPickupTime) && (
              <Card className="border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Truck className="h-4 w-4" /> Dados de Coleta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {os.pickupAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Endereço de coleta</p>
                        <p className="font-medium">{os.pickupAddress}</p>
                      </div>
                    </div>
                  )}
                  {os.preferredPickupTime && (
                    <div className="flex items-start gap-2">
                      <CalendarDays className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Horário preferido</p>
                        <p className="font-medium">{os.preferredPickupTime}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Update Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" /> SLA e tempo parado
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Tempo na etapa</p>
                  <p className="font-semibold">{statusAgeLabel}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Sinalização</p>
                  <p className="font-semibold">{sla?.isOverdue ? "Prazo vencido" : sla?.isStageStalled ? "Etapa parada" : "Dentro do fluxo"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Entrega prevista</p>
                  <p className="font-semibold">{sla?.estimatedDelivery ? new Date(sla.estimatedDelivery).toLocaleDateString("pt-BR") : os.estimatedDelivery ? new Date(os.estimatedDelivery).toLocaleDateString("pt-BR") : "Não informada"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Atualizar Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={newStatus} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar novo status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Observação só aparece para status que não sejam finalizado (finalizado tem modal próprio) */}
                {newStatus && newStatus !== "finalizado" && (
                  <Textarea
                    placeholder="Observação sobre a mudança (opcional)..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    rows={2}
                  />
                )}
                {newStatus === "finalizado" ? (
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setCloseModal(true)}
                  >
                    <Shield className="h-4 w-4 mr-2" /> Encerrar OS...
                  </Button>
                ) : (
                  <Button
                    disabled={!newStatus || updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: osId, status: newStatus as any, notes: statusNotes })}
                  >
                    {updateStatus.isPending ? "Atualizando..." : "Atualizar Status"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Timeline da OS</CardTitle>
              </CardHeader>
              <CardContent>
                {os.timeline && os.timeline.length > 0 ? (
                  <OSTimeline entries={os.timeline} />
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum registro na timeline</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Dados do Cliente */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="font-semibold">{(os as any).customerName ?? "—"}</p>
                {(os as any).customerPhone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <a href={`tel:${(os as any).customerPhone}`} className="hover:text-foreground transition-colors">
                      {(os as any).customerPhone}
                    </a>
                  </div>
                )}
                {(os as any).customerEmail && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{(os as any).customerEmail}</span>
                  </div>
                )}
                {(os as any).customerDocument && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span>{(os as any).customerDocument}</span>
                  </div>
                )}
                {((os as any).customerAddress || (os as any).customerCity) && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="text-xs leading-relaxed">
                      {[(os as any).customerAddress, (os as any).customerAddressNumber ? `nº ${(os as any).customerAddressNumber}` : null, (os as any).customerNeighborhood, (os as any).customerCity, (os as any).customerState].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  {(os as any).customerPhone && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs bg-green-50 hover:bg-green-100 border-green-200 text-green-700 hover:text-green-800"
                            onClick={() => {
                              const phone = String((os as any).customerPhone).replace(/\D/g, "");
                              window.open(`https://wa.me/55${phone}`, "_blank");
                            }}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">{(os as any).customerPhone}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                    onClick={() => navigate(`/painel/clientes/${os.customerId}`)}
                  >
                    Ver perfil
                  </Button>
                </div>
              </CardContent>
            </Card>

            {(os.origin === "coleta" || pickupPhotos.length > 0 || hasPickupLocation) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" /> Dados da Coleta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {(os as any).pickupAddress && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="text-xs leading-relaxed">{(os as any).pickupAddress}</span>
                    </div>
                  )}

                  {(os as any).preferredPickupTime && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs">{(os as any).preferredPickupTime}</span>
                    </div>
                  )}

                  {hasPickupLocation && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                      <p className="text-xs font-medium text-blue-900">Localização compartilhada pelo cliente</p>
                      <p className="mt-1 text-[11px] text-blue-700">
                        Coordenadas: {pickupLatitude.toFixed(6)}, {pickupLongitude.toFixed(6)}
                        {(os as any).pickupLocationAccuracy ? ` · precisão aprox. ${(os as any).pickupLocationAccuracy}m` : ""}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 border-blue-200 bg-white text-xs text-blue-700 hover:bg-blue-100"
                        onClick={() => window.open(pickupMapUrl, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir no mapa
                      </Button>
                    </div>
                  )}

                  {pickupPhotos.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-foreground">Fotos enviadas pelo cliente</p>
                      <div className="grid grid-cols-2 gap-2">
                        {pickupPhotos.map((photo: any, index: number) => (
                          <a
                            key={photo.id ?? index}
                            href={photo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative block overflow-hidden rounded-lg border border-border bg-muted"
                          >
                            <img src={photo.url} alt={photo.caption ?? `Foto ${index + 1} da coleta`} className="h-28 w-full object-cover transition-transform group-hover:scale-105" />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                              Foto {index + 1}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {pickupPhotos.length === 0 && !hasPickupLocation && (
                    <p className="text-xs text-muted-foreground">Esta coleta não possui fotos ou localização compartilhada.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Checklist de Entrada */}
            {checklistItems && checklistItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-muted-foreground" /> Checklist de Entrada
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {checklistItems.filter((i) => i.isChecked).length}/{checklistItems.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {checklistItems.map((item) => (
                    <button
                      key={item.id}
                      className="flex items-center gap-2.5 w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors group"
                      onClick={() =>
                        toggleChecklistItem.mutate({ itemId: item.id, isChecked: !item.isChecked })
                      }
                      disabled={toggleChecklistItem.isPending}
                    >
                      {item.isChecked ? (
                        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={`text-sm ${
                          item.isChecked ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  ))}
                  {checklistItems.every((i) => i.isChecked) && (
                    <p className="text-xs text-green-600 font-medium pt-1 text-center">
                      Todos os itens verificados
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Orçamento */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" /> Orçamento
                  </CardTitle>
                  <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Novo
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Criar Orçamento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Mão de obra (R$)</Label>
                          <Input
                            type="number"
                            className="mt-1.5"
                            value={laborCost}
                            onChange={(e) => setLaborCost(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label className="mb-2 block">Itens / Peças</Label>
                          {budgetItems.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-[2fr_1fr_1fr] gap-2 mb-2">
                              <Input
                                placeholder="Descrição"
                                value={item.description}
                                onChange={(e) => {
                                  const updated = [...budgetItems];
                                  updated[idx].description = e.target.value;
                                  setBudgetItems(updated);
                                }}
                              />
                              <Input
                                type="number"
                                placeholder="Qtd"
                                value={item.quantity}
                                onChange={(e) => {
                                  const updated = [...budgetItems];
                                  updated[idx].quantity = Number(e.target.value);
                                  setBudgetItems(updated);
                                }}
                              />
                              <Input
                                type="number"
                                placeholder="R$"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const updated = [...budgetItems];
                                  updated[idx].unitPrice = Number(e.target.value);
                                  setBudgetItems(updated);
                                }}
                              />
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBudgetItems([...budgetItems, { description: "", quantity: 1, unitPrice: 0, type: "part" as const }])}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
                          </Button>
                        </div>
                        <div className="flex justify-between font-semibold text-sm border-t pt-3">
                          <span>Total estimado:</span>
                          <span>R$ {(laborCost + budgetItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)).toFixed(2)}</span>
                        </div>
                        <Button className="w-full" onClick={handleBudgetSubmit} disabled={createBudget.isPending}>
                          {createBudget.isPending ? "Enviando..." : "Enviar Orçamento"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {budgets && budgets.length > 0 ? (
                  <div className="space-y-2">
                    {budgets.map((b) => (
                      <div key={b.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold">R$ {Number(b.totalCost).toFixed(2)}</span>
                          <Badge variant={b.status === "approved" ? "default" : b.status === "rejected" ? "destructive" : "secondary"}>
                            {b.status === "approved" ? "Aprovado" : b.status === "rejected" ? "Recusado" : "Pendente"}
                          </Badge>
                        </div>
                        {b.validUntil && (
                          <p className="text-xs text-muted-foreground">
                            Válido até {new Date(b.validUntil).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum orçamento criado</p>
                )}
              </CardContent>
            </Card>

            {/* Pagamentos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" /> Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments && payments.length > 0 ? (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{p.method}</span>
                        <span className="font-semibold text-emerald-600">R$ {Number(p.amount).toFixed(2)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Total pago</span>
                      <span className="text-emerald-600">R$ {totalPaid.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum pagamento registrado</p>
                )}
              </CardContent>
            </Card>

            {/* Garantia */}
            {warranty && (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
                    <Shield className="h-4 w-4" /> Garantia Digital
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-mono text-xs bg-emerald-100 px-2 py-1 rounded">{warranty.warrantyCode}</p>
                  <p className="text-xs text-muted-foreground">
                    Válida até {new Date(warranty.expiresAt).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">{warranty.warrantyDays} dias de garantia</p>
                </CardContent>
              </Card>
            )}

            {/* Link de rastreamento */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" /> Link Público
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground break-all font-mono bg-muted px-2 py-1.5 rounded">
                  {trackingUrl}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={copyTrackingLink}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(trackingUrl, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {/* Modal de Encerramento de OS */}
      <Dialog open={closeModal} onOpenChange={(open) => { if (!open) { setCloseModal(false); setNewStatus(""); } }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {/* DialogTitle oculto para acessibilidade (Radix obrigatório) */}
          <DialogHeader className="sr-only">
            <DialogTitle>Encerrar Ordem de Serviço</DialogTitle>
          </DialogHeader>
          {/* Cabeçalho colorido */}
          <div className="bg-emerald-600 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2.5">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">Encerrar Ordem de Serviço</h2>
                <p className="text-emerald-100 text-xs mt-0.5">OS {os.osNumber} • {(os as any).customerName ?? "Cliente"}</p>
              </div>
            </div>
          </div>

          {/* Corpo */}
          <div className="px-6 py-5 space-y-5">

            {/* Bloco de garantia */}
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">Garantia Digital</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-warranty" className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                  Prazo de Garantia
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="close-warranty"
                    type="number"
                    min={0}
                    max={3650}
                    value={closeWarrantyDays}
                    onChange={(e) => setCloseWarrantyDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 text-center font-bold text-xl h-11 border-emerald-300 focus:border-emerald-500"
                  />
                  <span className="text-sm text-emerald-700 font-medium">dias</span>
                  <div className="flex gap-1 ml-1">
                    {[0, 30, 60, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCloseWarrantyDays(d)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          closeWarrantyDays === d
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {d === 0 ? "Sem" : `${d}d`}
                      </button>
                    ))}
                  </div>
                </div>

                {closeWarrantyDays === 0 ? (
                  <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-xs">⚠ Sem garantia — nenhum comprovante será gerado.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-700 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="text-xs">✓ Válida até <strong>{new Date(Date.now() + closeWarrantyDays * 86400000).toLocaleDateString("pt-BR")}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Observação final */}
            <div className="space-y-1.5">
              <Label htmlFor="close-notes" className="text-sm font-medium">
                Observação final
                <span className="ml-1 text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="close-notes"
                placeholder="Ex: Troca de tela realizada, aparelho testado e funcionando..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Termo de garantia do tenant (colapsável) */}
            {tenantInfo && (tenantInfo as any).warrantyTerms && (
              <details className="group rounded-lg border border-emerald-200 overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer bg-emerald-50 hover:bg-emerald-100 transition-colors list-none">
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Termo de Garantia
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-emerald-600 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-4 py-3 bg-white">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {(tenantInfo as any).warrantyTerms}
                  </p>
                </div>
              </details>
            )}

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                onClick={handleConfirmClose}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending
                  ? <><span className="animate-spin mr-2">⏳</span> Encerrando...</>
                  : <><Shield className="h-4 w-4 mr-2" /> Confirmar Encerramento</>}
              </Button>
              <Button
                variant="outline"
                className="h-11 px-5"
                onClick={() => { setCloseModal(false); setNewStatus(""); }}
                disabled={updateStatus.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Agendamento de Coleta */}
      <Dialog open={schedulePickupOpen} onOpenChange={setSchedulePickupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              Agendar Coleta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina a data e o turno para a coleta do aparelho. O status será atualizado para <strong>Coleta Agendada</strong> e o evento ficará registrado na timeline da OS.
            </p>
            {/* Data */}
            <div className="space-y-1.5">
              <Label htmlFor="pickup-date" className="text-sm font-medium">Data da coleta <span className="text-destructive">*</span></Label>
              <Input
                id="pickup-date"
                type="date"
                value={pickupDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setPickupDate(e.target.value)}
                className="text-sm"
              />
            </div>
            {/* Turno */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Turno preferido</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "manha", label: "Manhã", range: "08h–12h" },
                  { value: "tarde", label: "Tarde", range: "12h–18h" },
                  { value: "noite", label: "Noite", range: "18h–21h" },
                ] as const).map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setPickupShift(s.value)}
                    className={[
                      "flex flex-col items-center justify-center gap-0.5 rounded-lg border py-3 text-sm font-medium transition-colors",
                      pickupShift === s.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    <span>{s.label}</span>
                    <span className="text-xs font-normal opacity-70">{s.range}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Observação */}
            <div className="space-y-1.5">
              <Label htmlFor="pickup-notes" className="text-sm font-medium">
                Observação <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="pickup-notes"
                placeholder="Ex: Portaria bloco B, ligar antes de chegar..."
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11"
                onClick={handleSchedulePickup}
                disabled={!pickupDate || updateStatus.isPending}
              >
                {updateStatus.isPending
                  ? <><span className="animate-spin mr-2">⏳</span> Agendando...</>
                  : <><CalendarDays className="h-4 w-4 mr-2" /> Confirmar Agendamento</>}
              </Button>
              <Button
                variant="outline"
                className="h-11 px-5"
                onClick={() => setSchedulePickupOpen(false)}
                disabled={updateStatus.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de notificação WhatsApp */}
      {whatsappModal && (
        <Dialog open={!!whatsappModal} onOpenChange={() => setWhatsappModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                Notificar Cliente via WhatsApp
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O status foi atualizado. Envie a mensagem abaixo ao cliente pelo WhatsApp:
              </p>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{whatsappModal.message}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    window.open(whatsappModal.whatsappLink, "_blank");
                    setWhatsappModal(null);
                  }}
                >
                  <Send className="h-4 w-4 mr-2" /> Abrir WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setWhatsappModal(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Portal do comprovante de garantia — renderiza em #print-warranty-root */}
      {printWarranty && os && warranty && tenantInfo && createPortal(
        <WarrantyVoucher
          osNumber={os.osNumber}
          publicToken={os.publicToken ?? ""}
          customerName={(os as any).customerName ?? null}
          customerPhone={(os as any).customerPhone ?? null}
          customerDocument={(os as any).customerDocument ?? null}
          customerAddress={[(os as any).customerAddress, (os as any).customerAddressNumber ? `nº ${(os as any).customerAddressNumber}` : null, (os as any).customerNeighborhood, (os as any).customerCity, (os as any).customerState].filter(Boolean).join(", ") || null}
          deviceBrand={(os as any).deviceBrand ?? null}
          deviceModel={(os as any).deviceModel ?? null}
          reportedDefect={os.reportedDefect}
          warrantyCode={warranty.warrantyCode ?? ""}
          warrantyDays={warranty.warrantyDays ?? 0}
          startsAt={(warranty as any).startsAt ?? null}
          expiresAt={warranty.expiresAt}
          tenant={{
            name: tenantInfo.name,
            logoUrl: tenantInfo.logoUrl ?? null,
            primaryColor: tenantInfo.primaryColor ?? null,
            phone: tenantInfo.phone ?? null,
            whatsappNumber: tenantInfo.whatsappNumber ?? null,
            address: tenantInfo.address ?? null,
            cnpj: (tenantInfo as any).cnpj ?? null,
            serviceTerms: tenantInfo.serviceTerms ?? null,
            warrantyTerms: (tenantInfo as any).warrantyTerms ?? null,
          }}
        />,
        (() => {
          let el = document.getElementById("print-warranty-root");
          if (!el) { el = document.createElement("div"); el.id = "print-warranty-root"; document.body.appendChild(el); }
          return el;
        })()
      )}

      {/* Portal de impressão — renderiza fora do DOM do dashboard, em #print-root */}
      {printMode && os && tenantInfo && createPortal(
        <PrintSheet
          mode={printMode}
          os={{
            id: os.id,
            osNumber: os.osNumber,
            status: os.status,
            origin: os.origin ?? "balcao",
            reportedDefect: os.reportedDefect,
            physicalCondition: os.physicalCondition,
            accessories: os.accessories,
            devicePassword: os.devicePassword,
            internalNotes: os.internalNotes,
            estimatedDelivery: os.estimatedDelivery,
            warrantyDays: os.warrantyDays,
            createdAt: os.createdAt,
            publicToken: os.publicToken ?? "",
            deviceBrand: (os as any).deviceBrand ?? null,
            deviceModel: (os as any).deviceModel ?? null,
            deviceImei: (os as any).deviceImei ?? null,
            deviceSerialNumber: (os as any).deviceSerialNumber ?? null,
            customer: {
              name: (os as any).customerName ?? null,
              phone: (os as any).customerPhone ?? null,
              email: (os as any).customerEmail ?? null,
              document: (os as any).customerDocument ?? null,
              address: (os as any).customerAddress ?? null,
              addressNumber: (os as any).customerAddressNumber ?? null,
              neighborhood: (os as any).customerNeighborhood ?? null,
              city: (os as any).customerCity ?? null,
              state: (os as any).customerState ?? null,
              zipCode: (os as any).customerZipCode ?? null,
            },
          }}
          tenant={{
            name: tenantInfo.name,
            logoUrl: tenantInfo.logoUrl ?? null,
            primaryColor: tenantInfo.primaryColor ?? null,
            phone: tenantInfo.phone ?? null,
            whatsappNumber: tenantInfo.whatsappNumber ?? null,
            address: tenantInfo.address ?? null,
            cnpj: (tenantInfo as any).cnpj ?? null,
            serviceTerms: tenantInfo.serviceTerms ?? null,
            warrantyTerms: (tenantInfo as any).warrantyTerms ?? null,
          }}
          budgets={budgets ?? null}
          warranty={warranty ?? null}
          checklist={checklistItems?.map(i => ({ item: i.label, checked: i.isChecked })) ?? null}
        />,
        (() => {
          let el = document.getElementById("print-root");
          if (!el) { el = document.createElement("div"); el.id = "print-root"; document.body.appendChild(el); }
          return el;
        })()
      )}
    </TenantLayout>
  );
}
