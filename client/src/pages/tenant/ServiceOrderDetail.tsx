import { useState, useEffect, type ReactNode } from "react";
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
  Phone, Mail, MapPin, Truck, CalendarDays, PackageCheck, Pencil
} from "lucide-react";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS);
const CLOSING_PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
] as const;
type ClosingPaymentMethod = typeof CLOSING_PAYMENT_METHODS[number]["value"];

const MANUAL_PAYMENT_METHODS = [
  ...CLOSING_PAYMENT_METHODS,
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
] as const;
type ManualPaymentMethod = typeof MANUAL_PAYMENT_METHODS[number]["value"];

function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function moneyToCents(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

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
  const [closeOutcome, setCloseOutcome] = useState<"finalizado" | "encerrado_sem_reparo" | "encerrado_condenado">("finalizado");
  const [closeNotes, setCloseNotes] = useState("");
  const [closePaymentMethod, setClosePaymentMethod] = useState<ClosingPaymentMethod | "">("");
  const [closePaymentAmount, setClosePaymentAmount] = useState("");
  const [closeApproveBudgetId, setCloseApproveBudgetId] = useState<number | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod | "">("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetItems, setBudgetItems] = useState<{ description: string; quantity: number; unitPrice: number; type: "service" | "part" }[]>([{ description: "", quantity: 1, unitPrice: 0, type: "service" }]);
  const [laborCost, setLaborCost] = useState(0);
  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [editBudgetDescription, setEditBudgetDescription] = useState("");
  const [editBudgetLaborCost, setEditBudgetLaborCost] = useState(0);
  const [editBudgetValidDays, setEditBudgetValidDays] = useState("");
  const [editBudgetItems, setEditBudgetItems] = useState<{ description: string; quantity: number; unitPrice: number; type: "service" | "part" }[]>([]);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [printWarranty, setPrintWarranty] = useState(false);
  // Modal de agendamento de coleta
  const [schedulePickupOpen, setSchedulePickupOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupShift, setPickupShift] = useState<"manha" | "tarde" | "noite" | "">("manha");
  const [pickupNotes, setPickupNotes] = useState("");
  // Modal de edição das informações principais da OS e do aparelho
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editType, setEditType] = useState("");
  const [editImei, setEditImei] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editDeviceNotes, setEditDeviceNotes] = useState("");
  const [editDefect, setEditDefect] = useState("");
  const [editPhysical, setEditPhysical] = useState("");
  const [editAccessories, setEditAccessories] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [warrantyReturnOpen, setWarrantyReturnOpen] = useState(false);
  const [warrantyReturnReason, setWarrantyReturnReason] = useState("");
  const [warrantyReturnNotes, setWarrantyReturnNotes] = useState("");

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
      utils.budgets.getByOs.invalidate({ serviceOrderId: osId });
      utils.warranties.getByOs.invalidate({ serviceOrderId: osId });
      setNewStatus("");
      setStatusNotes("");
      setCloseModal(false);
      setCloseOutcome("finalizado");
      setCloseNotes("");
      setClosePaymentMethod("");
      setClosePaymentAmount("");
      utils.payments.getByOs.invalidate({ serviceOrderId: osId });
      if (data?.whatsappNotification) {
        setWhatsappModal(data.whatsappNotification);
      }
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar status"),
  });

  const updateInfo = trpc.serviceOrders.updateInfo.useMutation({
    onSuccess: () => {
      toast.success("Informações da OS atualizadas");
      setEditInfoOpen(false);
      utils.serviceOrders.getById.invalidate({ id: osId });
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar informações da OS"),
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

  const updateBudget = trpc.budgets.update.useMutation({
    onSuccess: () => {
      toast.success("Orçamento atualizado");
      setEditBudgetOpen(false);
      setEditingBudgetId(null);
      utils.budgets.getByOs.invalidate({ serviceOrderId: osId });
      utils.serviceOrders.getById.invalidate({ id: osId });
    },
    onError: (error) => toast.error(error.message || "Erro ao editar orçamento"),
  });

  const registerPayment = trpc.payments.register.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado");
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentMethod("");
      setPaymentNotes("");
      utils.payments.getByOs.invalidate({ serviceOrderId: osId });
      utils.serviceOrders.getById.invalidate({ id: osId });
    },
    onError: (error) => toast.error(error.message || "Erro ao registrar pagamento"),
  });

  const createWarrantyReturn = trpc.serviceOrders.createWarrantyReturn.useMutation({
    onSuccess: (createdOs) => {
      toast.success("Retorno em garantia aberto com vínculo à OS original");
      setWarrantyReturnOpen(false);
      setWarrantyReturnReason("");
      setWarrantyReturnNotes("");
      utils.serviceOrders.getById.invalidate({ id: osId });
      if ((createdOs as any)?.id) {
        navigate(`/painel/os/${(createdOs as any).id}`);
      }
    },
    onError: (error) => toast.error(error.message || "Erro ao abrir retorno em garantia"),
  });

  const handleCreateWarrantyReturn = () => {
    const reason = warrantyReturnReason.trim();
    if (reason.length < 3) {
      toast.error("Informe o motivo do retorno relatado pelo cliente.");
      return;
    }
    createWarrantyReturn.mutate({
      originalServiceOrderId: osId,
      reason,
      notes: warrantyReturnNotes.trim() || undefined,
    });
  };

  const handleRegisterPayment = () => {
    const amount = Number(paymentAmount.replace(",", "."));
    const amountCents = moneyToCents(amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor de pagamento válido.");
      return;
    }
    if (administrativeBalanceCents > 0 && amountCents > administrativeBalanceCents) {
      toast.error("O valor recebido não pode ser maior que o saldo atual da OS.");
      return;
    }
    if (!paymentMethod) {
      toast.error("Selecione o meio de pagamento.");
      return;
    }
    registerPayment.mutate({
      serviceOrderId: osId,
      amount,
      method: paymentMethod,
      notes: paymentNotes.trim() || undefined,
    });
  };

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
      setCloseOutcome("finalizado");
      setCloseNotes("");
      const totalCents = moneyToCents(os?.totalAmount);
      const paidCents = (payments ?? [])
        .filter((payment: any) => payment.status === "paid")
        .reduce((sum: number, payment: any) => sum + moneyToCents(payment.amount), 0);
      const payableBudgets = Array.isArray(budgets)
        ? budgets.filter((budget: any) => ["pending", "approved"].includes(budget.status) && moneyToCents(budget.totalCost) > 0)
        : [];
      const pendingPayableBudgets = payableBudgets.filter((budget: any) => budget.status === "pending");
      const approvedPayableBudgets = payableBudgets.filter((budget: any) => budget.status === "approved");
      const autoSyncBudget = totalCents === 0 && pendingPayableBudgets.length === 0 && approvedPayableBudgets.length === 1
        ? approvedPayableBudgets[0]
        : null;
      const effectiveTotalCents = autoSyncBudget ? moneyToCents(autoSyncBudget.totalCost) : totalCents;
      const balanceCents = Math.max(0, effectiveTotalCents - paidCents);
      setCloseApproveBudgetId(autoSyncBudget ? Number(autoSyncBudget.id) : null);
      setClosePaymentAmount(balanceCents > 0 ? (balanceCents / 100).toFixed(2) : "");
      setClosePaymentMethod("");
      setCloseModal(true);
    } else {
      setNewStatus(status);
    }
  };

  const handleConfirmClose = () => {
    const outcomeLabels: Record<typeof closeOutcome, string> = {
      finalizado: "Entregue reparado",
      encerrado_sem_reparo: "Encerrado sem reparo",
      encerrado_condenado: "Encerrado condenado",
    };
    const notes = [
      `Resultado do encerramento: ${outcomeLabels[closeOutcome]}.`,
      closeNotes.trim() || null,
    ].filter(Boolean).join(" ");

    const totalCents = moneyToCents(os?.totalAmount);
    const paidCents = (payments ?? [])
      .filter((payment: any) => payment.status === "paid")
      .reduce((sum: number, payment: any) => sum + moneyToCents(payment.amount), 0);
    const payableBudgets = Array.isArray(budgets)
      ? budgets.filter((budget: any) => ["pending", "approved"].includes(budget.status) && moneyToCents(budget.totalCost) > 0)
      : [];
    const pendingPayableBudgets = payableBudgets.filter((budget: any) => budget.status === "pending");
    const selectedClosingBudget = closeApproveBudgetId
      ? payableBudgets.find((budget: any) => Number(budget.id) === closeApproveBudgetId)
      : null;
    const singlePendingBudget = totalCents === 0 && pendingPayableBudgets.length === 1 ? pendingPayableBudgets[0] : null;
    const singlePendingBudgetCents = singlePendingBudget ? moneyToCents(singlePendingBudget.totalCost) : 0;
    const isSinglePendingBudgetAlreadyPaid = singlePendingBudgetCents > 0 && paidCents >= singlePendingBudgetCents;
    const effectiveSelectedClosingBudget = selectedClosingBudget ?? (isSinglePendingBudgetAlreadyPaid ? singlePendingBudget : null);

    if (closeOutcome === "finalizado" && totalCents === 0 && pendingPayableBudgets.length > 1) {
      toast.error("Existe mais de um orçamento pendente. Revise os orçamentos antes de encerrar.");
      return;
    }

    if (closeOutcome === "finalizado" && totalCents === 0 && pendingPayableBudgets.length === 1 && !effectiveSelectedClosingBudget) {
      toast.error("Aprove o orçamento pendente no modal antes de encerrar a OS.");
      return;
    }

    const effectiveTotalCents = totalCents > 0
      ? totalCents
      : effectiveSelectedClosingBudget
        ? moneyToCents(effectiveSelectedClosingBudget.totalCost)
        : 0;
    const balanceCents = Math.max(0, effectiveTotalCents - paidCents);
    const paymentCents = moneyToCents(closePaymentAmount.replace(",", "."));

    if (closeOutcome === "finalizado" && balanceCents > 0) {
      if (!closePaymentMethod) {
        toast.error("Selecione o meio de pagamento do encerramento.");
        return;
      }
      if (paymentCents > balanceCents) {
        toast.error("O pagamento do encerramento não pode ser maior que o saldo em aberto.");
        return;
      }
      if (paymentCents < balanceCents) {
        toast.error("Nesta versão, o encerramento exige pagamento total do saldo em aberto.");
        return;
      }
    }

    updateStatus.mutate({
      id: osId,
      status: closeOutcome as any,
      notes,
      warrantyDays: closeOutcome === "finalizado" ? closeWarrantyDays : 0,
      approveClosingBudgetId: closeOutcome === "finalizado" && effectiveSelectedClosingBudget ? Number(effectiveSelectedClosingBudget.id) : undefined,
      closingPayment: closeOutcome === "finalizado" && balanceCents > 0
        ? { method: closePaymentMethod as ClosingPaymentMethod, amount: balanceCents / 100 }
        : undefined,
    });
  };

  const handleOpenEditInfo = () => {
    if (!os) return;
    setEditBrand((os as any).deviceBrand ?? "");
    setEditModel((os as any).deviceModel ?? "");
    setEditType((os as any).deviceType ?? "");
    setEditImei((os as any).deviceImei ?? "");
    setEditSerialNumber((os as any).deviceSerialNumber ?? "");
    setEditColor((os as any).deviceColor ?? "");
    setEditDeviceNotes((os as any).deviceNotes ?? "");
    setEditDefect(os.reportedDefect ?? "");
    setEditPhysical(os.physicalCondition ?? "");
    setEditAccessories(os.accessories ?? "");
    setEditInternalNotes(os.internalNotes ?? "");
    setEditPassword(os.devicePassword ?? "");
    setEditInfoOpen(true);
  };

  const handleSaveEditInfo = () => {
    const trimmedDefect = editDefect.trim();
    if (trimmedDefect.length < 3) {
      toast.error("Informe o defeito relatado com pelo menos 3 caracteres.");
      return;
    }

    updateInfo.mutate({
      id: osId,
      brand: editBrand,
      model: editModel,
      type: editType,
      imei: editImei,
      serialNumber: editSerialNumber,
      color: editColor,
      deviceNotes: editDeviceNotes,
      reportedDefect: trimmedDefect,
      physicalCondition: editPhysical,
      accessories: editAccessories,
      internalNotes: editInternalNotes,
      devicePassword: editPassword,
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

  const handleOpenEditBudget = (budget: any) => {
    if (budget.status !== "pending") {
      toast.error("Somente orçamentos pendentes podem ser editados.");
      return;
    }

    const currentItems = Array.isArray(budget.items)
      ? budget.items.map((item: any) => ({
          description: item.description ?? "",
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          type: (item.type === "service" ? "service" : "part") as "service" | "part",
        }))
      : [];

    setEditingBudgetId(Number(budget.id));
    setEditBudgetDescription(budget.description ?? "");
    setEditBudgetLaborCost(Number(budget.laborCost) || 0);
    setEditBudgetItems(currentItems.length > 0 ? currentItems : []);
    setEditBudgetValidDays("");
    setEditBudgetOpen(true);
  };

  const handleBudgetUpdateSubmit = () => {
    if (!editingBudgetId) return;
    const validItems = editBudgetItems.filter((item) => item.description.trim().length > 0);

    updateBudget.mutate({
      budgetId: editingBudgetId,
      description: editBudgetDescription.trim() || null,
      laborCost: Number.isFinite(editBudgetLaborCost) ? editBudgetLaborCost : 0,
      validDays: editBudgetValidDays ? Number(editBudgetValidDays) : undefined,
      items: validItems.map((item) => ({
        ...item,
        quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
        unitPrice: Number.isFinite(item.unitPrice) && item.unitPrice >= 0 ? item.unitPrice : 0,
      })),
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
  const paidPayments = (payments ?? []).filter((payment: any) => payment.status === "paid");
  const totalPaid = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const budgetList = Array.isArray(budgets) ? budgets : [];
  const totalAmountCents = moneyToCents(os.totalAmount);
  const totalPaidCents = paidPayments.reduce((sum, payment: any) => sum + moneyToCents(payment.amount), 0);
  const administrativeBudgetCents = moneyToCents(budgetList.find((budget: any) => ["pending", "approved"].includes(budget.status) && moneyToCents(budget.totalCost) > 0)?.totalCost);
  const administrativeTotalCents = totalAmountCents > 0 ? totalAmountCents : administrativeBudgetCents;
  const administrativeBalanceCents = Math.max(0, administrativeTotalCents - totalPaidCents);
  const payableClosingBudgets = budgetList.filter((budget: any) => ["pending", "approved"].includes(budget.status) && moneyToCents(budget.totalCost) > 0);
  const pendingClosingBudgets = payableClosingBudgets.filter((budget: any) => budget.status === "pending");
  const approvedClosingBudgets = payableClosingBudgets.filter((budget: any) => budget.status === "approved");
  const selectedClosingBudget = closeApproveBudgetId
    ? payableClosingBudgets.find((budget: any) => Number(budget.id) === closeApproveBudgetId) ?? null
    : null;
  const selectedClosingBudgetCents = selectedClosingBudget ? moneyToCents(selectedClosingBudget.totalCost) : 0;
  const closingPaymentAmountCents = moneyToCents(closePaymentAmount.replace(",", "."));
  const closingHasSinglePendingBudget = totalAmountCents === 0 && pendingClosingBudgets.length === 1;
  const singlePendingClosingBudgetCents = closingHasSinglePendingBudget ? moneyToCents(pendingClosingBudgets[0].totalCost) : 0;
  const isSinglePendingClosingBudgetPaid = singlePendingClosingBudgetCents > 0 && totalPaidCents >= singlePendingClosingBudgetCents;
  const effectiveClosingTotalCents = totalAmountCents > 0
    ? totalAmountCents
    : selectedClosingBudgetCents > 0
      ? selectedClosingBudgetCents
      : isSinglePendingClosingBudgetPaid
        ? singlePendingClosingBudgetCents
        : 0;
  const closingBalanceCents = Math.max(0, effectiveClosingTotalCents - totalPaidCents);
  const closingBalance = closingBalanceCents / 100;
  const closingHasMultiplePendingBudgets = totalAmountCents === 0 && pendingClosingBudgets.length > 1;
  const closingHasSingleApprovedBudgetToSync = totalAmountCents === 0 && pendingClosingBudgets.length === 0 && approvedClosingBudgets.length === 1;
  const isClosingBudgetReady = closeOutcome !== "finalizado" || totalAmountCents > 0 || !closingHasSinglePendingBudget || !!selectedClosingBudget || isSinglePendingClosingBudgetPaid;
  const isClosingPaymentMethodValid = closeOutcome !== "finalizado" || closingBalanceCents === 0 || !!closePaymentMethod;
  const isClosingFullPaymentValid = closeOutcome !== "finalizado" || closingHasMultiplePendingBudgets === false && isClosingBudgetReady && isClosingPaymentMethodValid && (closingBalanceCents === 0 || closingPaymentAmountCents === closingBalanceCents);
  const displayPrimaryBudget =
    budgetList.find((budget: any) => budget.status === "approved" && moneyToCents(budget.totalCost) > 0) ??
    budgetList.find((budget: any) => ["pending", "approved"].includes(budget.status) && moneyToCents(budget.totalCost) > 0) ??
    budgetList[0] ??
    null;
  const isBudgetEffectivelyApproved = (budget: any) => {
    if (!budget) return false;
    if (budget.status === "approved") return true;
    const budgetCents = moneyToCents(budget.totalCost);
    const matchesOsTotal = administrativeTotalCents > 0 && budgetCents === administrativeTotalCents;
    const osIsClosedOrPaid = os.status === "finalizado" || (administrativeTotalCents > 0 && administrativeBalanceCents === 0);
    return budget.status === "pending" && matchesOsTotal && osIsClosedOrPaid;
  };
  const primaryBudget = displayPrimaryBudget;
  const primaryBudgetTotal = primaryBudget ? Number(primaryBudget.totalCost) : null;
  const primaryBudgetLabel = typeof primaryBudgetTotal === "number" && Number.isFinite(primaryBudgetTotal)
    ? `R$ ${primaryBudgetTotal.toFixed(2)}`
    : "Sem orçamento";
  const isPrimaryBudgetApproved = isBudgetEffectivelyApproved(primaryBudget);
  const primaryBudgetStatusLabel = isPrimaryBudgetApproved
    ? "Aprovado"
    : primaryBudget?.status === "rejected"
      ? "Recusado"
      : primaryBudget
        ? "Pendente de aprovação"
        : "Não lançado";
  const pickupPhotos = ((os as any).photos ?? []).filter((photo: any) => photo.type === "coleta");
  const pickupLatitude = Number((os as any).pickupLatitude);
  const pickupLongitude = Number((os as any).pickupLongitude);
  const hasPickupLocation = Number.isFinite(pickupLatitude) && Number.isFinite(pickupLongitude);
  const pickupMapUrl = hasPickupLocation
    ? `https://www.google.com/maps?q=${pickupLatitude},${pickupLongitude}`
    : "";


  const DetailItem = ({ label, value, className = "" }: { label: string; value?: ReactNode; className?: string }) => (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-medium leading-relaxed text-foreground">{value || "—"}</div>
    </div>
  );

  const SectionNote = ({ label, children, tone = "default" }: { label: string; children?: ReactNode; tone?: "default" | "amber" }) => {
    if (!children) return null;
    const toneClass = tone === "amber"
      ? "border-amber-200 bg-amber-50/60 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100"
      : "border-border bg-muted/30 text-foreground";
    return (
      <div className={`rounded-xl border p-3 ${toneClass}`}>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{children}</p>
      </div>
    );
  };

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
  const isWarrantyReturn = (os as any).orderType === "retorno_garantia";
  const canOpenWarrantyReturn = !isWarrantyReturn && os.status === "finalizado" && (os as any).warrantyActive;
  const originalServiceOrder = (os as any).originalServiceOrder;
  const warrantyReturnReference = originalServiceOrder?.osNumber ?? ((os as any).originalServiceOrderId ? `OS #${(os as any).originalServiceOrderId}` : null);

  // Monta link e mensagem de WhatsApp para o comprovante de garantia
  const buildWarrantyWhatsApp = () => {
    if (!warranty) return null;
    const verifyUrl = `${window.location.origin}/garantia?codigo=${encodeURIComponent(warranty.warrantyCode)}`;
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
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 space-y-3">
              <Button variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground hover:text-foreground" onClick={() => navigate("/painel/os")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para ordens de serviço
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordem de serviço</p>
                  <h1 className="break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{os.osNumber}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={os.status} size="lg" />
                  <Badge variant="outline" className="bg-background">{os.origin === "coleta" ? "Coleta" : "Balcão"}</Badge>
                  {isWarrantyReturn && (
                    <Badge className="bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-100">
                      Retorno Garantia
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Abertura: {new Date(os.createdAt).toLocaleString("pt-BR")}</span>
                <span className="hidden sm:inline">•</span>
                <span>{statusAgeLabel}</span>
                <span className="hidden sm:inline">•</span>
                <span>Orçamento: {primaryBudgetLabel} ({primaryBudgetStatusLabel})</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end xl:max-w-xl">
              {os.status !== "finalizado" && os.status !== "cancelado" && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  onClick={() => {
                    setNewStatus("finalizado");
                    setCloseWarrantyDays(os.warrantyDays ?? 90);
                    setCloseOutcome("finalizado");
                    setCloseNotes("");
                    setCloseModal(true);
                  }}
                >
                  <Shield className="h-3.5 w-3.5 mr-1.5" /> Encerrar OS
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleOpenEditInfo}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
              <Button variant="outline" size="sm" onClick={openWhatsApp}>
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={copyTrackingLink}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Link
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
              {canOpenWarrantyReturn && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-semibold"
                  onClick={() => setWarrantyReturnOpen(true)}
                >
                  <Shield className="h-3.5 w-3.5 mr-1.5" /> Abrir retorno em garantia
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
          </div>
        </div>

        <Dialog open={warrantyReturnOpen} onOpenChange={setWarrantyReturnOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Abrir retorno em garantia</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                <p className="font-semibold">Será criada uma nova OS vinculada à {os.osNumber}.</p>
                <p className="mt-1 text-xs">A OS original continuará encerrada para preservar histórico financeiro, garantia e entrega.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="warranty-return-reason">Motivo informado pelo cliente</Label>
                <Textarea
                  id="warranty-return-reason"
                  value={warrantyReturnReason}
                  onChange={(event) => setWarrantyReturnReason(event.target.value)}
                  placeholder="Ex.: aparelho voltou com o mesmo defeito após o reparo."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warranty-return-notes">Observações internas opcionais</Label>
                <Textarea
                  id="warranty-return-notes"
                  value={warrantyReturnNotes}
                  onChange={(event) => setWarrantyReturnNotes(event.target.value)}
                  placeholder="Ex.: conferir peça substituída e teste de bancada."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setWarrantyReturnOpen(false)} disabled={createWarrantyReturn.isPending}>Cancelar</Button>
                <Button onClick={handleCreateWarrantyReturn} disabled={createWarrantyReturn.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {createWarrantyReturn.isPending ? "Criando..." : "Criar OS de retorno"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {isWarrantyReturn && (
          <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/20">
            <CardContent className="p-4 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-amber-950 dark:text-amber-100">Retorno em garantia</p>
                  <p className="text-amber-800 dark:text-amber-200">
                    Esta OS está vinculada à {warrantyReturnReference ?? "OS original"} e deve ser tratada separadamente da OS comum.
                  </p>
                </div>
                {originalServiceOrder?.id && (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/painel/os/${originalServiceOrder.id}`)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Ver OS original
                  </Button>
                )}
              </div>
              {(os as any).warrantyReturnReason && (
                <p className="mt-3 text-amber-900 dark:text-amber-100"><strong>Motivo:</strong> {(os as any).warrantyReturnReason}</p>
              )}
            </CardContent>
          </Card>
        )}

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

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
          {/* Main info */}
          <div className="space-y-5 lg:col-span-2">
            {/* Aparelho */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" /> Aparelho
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Dados técnicos, relato do cliente e condições registradas na entrada.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={handleOpenEditInfo}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar dados
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailItem label="Marca" value={(os as any).deviceBrand || "Não informada"} />
                  <DetailItem label="Modelo" value={(os as any).deviceModel || "Não informado"} />
                  <DetailItem label="Tipo" value={(os as any).deviceType || "Não informado"} />
                  <DetailItem label="Cor" value={(os as any).deviceColor || "Não informada"} />
                  <DetailItem label="IMEI" value={(os as any).deviceImei || "Não informado"} className="xl:col-span-2" />
                  <DetailItem label="Nº de série" value={(os as any).deviceSerialNumber || "Não informado"} className="xl:col-span-2" />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <SectionNote label="Defeito relatado">{os.reportedDefect}</SectionNote>
                  <SectionNote label="Estado físico">{os.physicalCondition}</SectionNote>
                  <SectionNote label="Acessórios">{os.accessories}</SectionNote>
                  <SectionNote label="Observações do aparelho">{(os as any).deviceNotes}</SectionNote>
                </div>
              </CardContent>
            </Card>

            {os.internalNotes && (
              <Card className="rounded-2xl border-amber-200 bg-amber-50/40 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    <FileText className="h-4 w-4" /> Observação Interna
                  </CardTitle>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80">Visível somente para a equipe interna; não é exibida nas impressões entregues ao cliente.</p>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-950 dark:text-amber-100">{os.internalNotes}</p>
                </CardContent>
              </Card>
            )}

            {/* SLA e atualização de status */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" /> SLA e Status
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Acompanhe o tempo parado e registre a próxima movimentação da OS.</p>
                  </div>
                  <StatusBadge status={os.status} size="md" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Tempo na etapa</p>
                    <p className="font-semibold">{statusAgeLabel}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Sinalização</p>
                    <p className="font-semibold">{sla?.isOverdue ? "Prazo vencido" : sla?.isStageStalled ? "Etapa parada" : "Dentro do fluxo"}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Entrega prevista</p>
                    <p className="font-semibold">{sla?.estimatedDelivery ? new Date(sla.estimatedDelivery).toLocaleDateString("pt-BR") : os.estimatedDelivery ? new Date(os.estimatedDelivery).toLocaleDateString("pt-BR") : "Não informada"}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="space-y-3">
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
                    {newStatus && newStatus !== "finalizado" && (
                      <Textarea
                        placeholder="Observação sobre a mudança (opcional)..."
                        value={statusNotes}
                        onChange={(e) => setStatusNotes(e.target.value)}
                        rows={2}
                      />
                    )}
                  </div>
                  {newStatus === "finalizado" ? (
                    <Button
                      variant="default"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white lg:w-auto"
                      onClick={() => setCloseModal(true)}
                    >
                      <Shield className="h-4 w-4 mr-2" /> Encerrar OS...
                    </Button>
                  ) : (
                    <Button
                      className="w-full lg:w-auto"
                      disabled={!newStatus || updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: osId, status: newStatus as any, notes: statusNotes })}
                    >
                      {updateStatus.isPending ? "Atualizando..." : "Atualizar Status"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Timeline da OS</CardTitle>
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
          <div className="space-y-5">
            {/* Dados do Cliente */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
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
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
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
                  <Dialog open={editBudgetOpen} onOpenChange={setEditBudgetOpen}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Editar Orçamento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Descrição</Label>
                          <Textarea
                            className="mt-1.5 min-h-[70px]"
                            placeholder="Resumo do orçamento para o cliente"
                            value={editBudgetDescription}
                            onChange={(e) => setEditBudgetDescription(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label>Mão de obra (R$)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="mt-1.5"
                              value={editBudgetLaborCost}
                              onChange={(e) => setEditBudgetLaborCost(Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Nova validade em dias</Label>
                            <Input
                              type="number"
                              min="1"
                              className="mt-1.5"
                              placeholder="Manter validade atual"
                              value={editBudgetValidDays}
                              onChange={(e) => setEditBudgetValidDays(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="mb-2 block">Itens / Peças</Label>
                          {editBudgetItems.length === 0 && (
                            <p className="text-xs text-muted-foreground mb-2">Nenhum item adicional. Use mão de obra para orçamento simples.</p>
                          )}
                          {editBudgetItems.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 mb-2">
                              <Input
                                placeholder="Descrição"
                                value={item.description}
                                onChange={(e) => {
                                  const updated = [...editBudgetItems];
                                  updated[idx].description = e.target.value;
                                  setEditBudgetItems(updated);
                                }}
                              />
                              <Input
                                type="number"
                                min="1"
                                placeholder="Qtd"
                                value={item.quantity}
                                onChange={(e) => {
                                  const updated = [...editBudgetItems];
                                  updated[idx].quantity = Number(e.target.value);
                                  setEditBudgetItems(updated);
                                }}
                              />
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="R$"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const updated = [...editBudgetItems];
                                  updated[idx].unitPrice = Number(e.target.value);
                                  setEditBudgetItems(updated);
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => setEditBudgetItems(editBudgetItems.filter((_, itemIndex) => itemIndex !== idx))}
                              >
                                Remover
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditBudgetItems([...editBudgetItems, { description: "", quantity: 1, unitPrice: 0, type: "part" as const }])}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
                          </Button>
                        </div>
                        <div className="flex justify-between font-semibold text-sm border-t pt-3">
                          <span>Total corrigido:</span>
                          <span>R$ {(editBudgetLaborCost + editBudgetItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)).toFixed(2)}</span>
                        </div>
                        <Button className="w-full" onClick={handleBudgetUpdateSubmit} disabled={updateBudget.isPending}>
                          {updateBudget.isPending ? "Salvando..." : "Salvar alteração do orçamento"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {budgetList.length > 0 ? (
                  <div className="space-y-3">
                    {primaryBudget && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Orçamento principal da OS</p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{primaryBudgetLabel}</span>
                          <Badge variant={isPrimaryBudgetApproved ? "default" : primaryBudget.status === "rejected" ? "destructive" : "secondary"}>
                            {primaryBudgetStatusLabel}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/80">
                          {primaryBudget.description || "Orçamento lançado para aprovação do cliente."}
                        </p>
                      </div>
                    )}
                    {budgetList.map((b) => {
                      const isApprovedForDisplay = isBudgetEffectivelyApproved(b);
                      return (
                      <div key={b.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <div>
                            <span className="font-semibold">R$ {Number(b.totalCost).toFixed(2)}</span>
                            {b.description && <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={isApprovedForDisplay ? "default" : b.status === "rejected" ? "destructive" : "secondary"}>
                              {isApprovedForDisplay ? "Aprovado" : b.status === "rejected" ? "Recusado" : "Pendente"}
                            </Badge>
                            {b.status === "pending" && !isApprovedForDisplay && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleOpenEditBudget(b)}
                              >
                                <Pencil className="h-3 w-3 mr-1" /> Editar
                              </Button>
                            )}
                          </div>
                        </div>
                        {b.validUntil && (
                          <p className="text-xs text-muted-foreground">
                            Válido até {new Date(b.validUntil).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum orçamento criado</p>
                )}
              </CardContent>
            </Card>

            {/* Pagamentos */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" /> Pagamentos
                  </CardTitle>
                  <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" disabled={administrativeTotalCents > 0 && administrativeBalanceCents <= 0}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Registrar pagamento
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Registrar pagamento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md bg-muted/40 p-2">
                            <p className="text-muted-foreground">Valor da OS</p>
                            <p className="font-semibold text-foreground">{toCurrency(administrativeTotalCents / 100)}</p>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <p className="text-muted-foreground">Pago</p>
                            <p className="font-semibold text-emerald-700">{toCurrency(totalPaidCents / 100)}</p>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <p className="text-muted-foreground">Saldo</p>
                            <p className="font-semibold text-blue-700">{toCurrency(administrativeBalanceCents / 100)}</p>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="payment-amount">Valor recebido</Label>
                          <Input
                            id="payment-amount"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={paymentAmount}
                            onChange={(event) => setPaymentAmount(event.target.value.replace(/[^0-9,.]/g, ""))}
                          />
                          <p className="text-xs text-muted-foreground">Aceita pagamento parcial ou total antes da entrega.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="payment-method">Meio de pagamento</Label>
                          <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as ManualPaymentMethod)}>
                            <SelectTrigger id="payment-method">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {MANUAL_PAYMENT_METHODS.map((method) => (
                                <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="payment-notes">Observação opcional</Label>
                          <Textarea
                            id="payment-notes"
                            rows={3}
                            placeholder="Ex.: pagamento antecipado no balcão"
                            value={paymentNotes}
                            onChange={(event) => setPaymentNotes(event.target.value)}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancelar</Button>
                          <Button type="button" onClick={handleRegisterPayment} disabled={registerPayment.isPending}>
                            {registerPayment.isPending ? "Registrando..." : "Registrar pagamento"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {payments && payments.length > 0 ? (
                  <div className="space-y-2">
                    {payments.map((p) => {
                      const paymentMethodLabel = MANUAL_PAYMENT_METHODS.find((method) => method.value === p.method)?.label ?? p.method;
                      return (
                        <div key={p.id} className="flex justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">{paymentMethodLabel}</span>
                          <span className="font-semibold text-emerald-600">{toCurrency(Number(p.amount))}</span>
                        </div>
                      );
                    })}
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Total pago</span>
                      <span className="text-emerald-600">{toCurrency(totalPaid)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Saldo atual</span>
                      <span>{toCurrency(administrativeBalanceCents / 100)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Nenhum pagamento registrado</p>
                    {administrativeTotalCents > 0 && (
                      <p className="text-xs text-muted-foreground">Saldo atual: {toCurrency(administrativeBalanceCents / 100)}</p>
                    )}
                  </div>
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
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
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
      {/* Modal de Edição de Informações da OS */}
      <Dialog open={editInfoOpen} onOpenChange={setEditInfoOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Informações da OS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Use esta edição para corrigir erros de digitação nos dados registrados na abertura da OS. As alterações afetam o aparelho vinculado e as informações exibidas na OS.
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" /> Dados do aparelho
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-brand">Marca</Label>
                  <Input id="edit-brand" value={editBrand} onChange={(e) => setEditBrand(e.target.value)} placeholder="Ex: Samsung" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-model">Modelo</Label>
                  <Input id="edit-model" value={editModel} onChange={(e) => setEditModel(e.target.value)} placeholder="Ex: Galaxy A12" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-type">Tipo</Label>
                  <Input id="edit-type" value={editType} onChange={(e) => setEditType(e.target.value)} placeholder="Ex: Celular, notebook, tablet" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-color">Cor</Label>
                  <Input id="edit-color" value={editColor} onChange={(e) => setEditColor(e.target.value)} placeholder="Ex: Preto" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-imei">IMEI</Label>
                  <Input id="edit-imei" value={editImei} onChange={(e) => setEditImei(e.target.value)} placeholder="IMEI do aparelho" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-serial">Nº de série</Label>
                  <Input id="edit-serial" value={editSerialNumber} onChange={(e) => setEditSerialNumber(e.target.value)} placeholder="Número de série" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="edit-device-notes">Observações do aparelho</Label>
                  <Textarea
                    id="edit-device-notes"
                    value={editDeviceNotes}
                    onChange={(e) => setEditDeviceNotes(e.target.value)}
                    rows={2}
                    placeholder="Detalhes específicos do aparelho"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Dados da OS
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-defect">Defeito relatado <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="edit-defect"
                    value={editDefect}
                    onChange={(e) => setEditDefect(e.target.value)}
                    rows={3}
                    placeholder="Descreva o defeito informado pelo cliente"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-physical">Estado físico</Label>
                    <Textarea id="edit-physical" value={editPhysical} onChange={(e) => setEditPhysical(e.target.value)} rows={2} placeholder="Ex: Tela trincada, tampa riscada" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-accessories">Acessórios</Label>
                    <Textarea id="edit-accessories" value={editAccessories} onChange={(e) => setEditAccessories(e.target.value)} rows={2} placeholder="Ex: Carregador, capa, chip" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-password">Senha do aparelho</Label>
                    <Input id="edit-password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Senha, padrão ou PIN informado" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-internal-notes">Observações internas</Label>
                    <Textarea id="edit-internal-notes" value={editInternalNotes} onChange={(e) => setEditInternalNotes(e.target.value)} rows={2} placeholder="Observações internas da assistência" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditInfoOpen(false)} disabled={updateInfo.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEditInfo} disabled={updateInfo.isPending}>
                {updateInfo.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Encerramento de OS */}
      <Dialog open={closeModal} onOpenChange={(open) => { if (!open) { setCloseModal(false); setNewStatus(""); } }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] grid grid-rows-[auto_minmax(0,1fr)_auto]">
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
          <div className="px-4 py-4 space-y-4 overflow-y-auto min-h-0 overscroll-contain sm:px-6 sm:py-5 sm:space-y-5">

            {/* Resultado do encerramento */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Resultado do encerramento</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([
                  { value: "finalizado", label: "Entregue reparado", description: "Aparelho entregue reparado, com opção de garantia." },
                  { value: "encerrado_sem_reparo", label: "Sem reparo", description: "OS encerrada sem executar reparo." },
                  { value: "encerrado_condenado", label: "Condenado", description: "Aparelho inviável para reparo." },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setCloseOutcome(option.value);
                      if (option.value !== "finalizado") setCloseWarrantyDays(0);
                    }}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      closeOutcome === option.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500"
                        : "border-border bg-background hover:bg-muted/60"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground leading-snug">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bloco de garantia */}
            {closeOutcome === "finalizado" ? (
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
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Este encerramento não gera garantia digital automaticamente. O status da OS ficará como <strong>{STATUS_LABELS[closeOutcome]}</strong>.
              </div>
            )}

            {closeOutcome === "finalizado" && (
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-800">Pagamento do encerramento</span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {totalAmountCents === 0 && selectedClosingBudget && (
                      <Badge variant="secondary" className="bg-white text-slate-700 border border-slate-200">
                        Valor da OS: {toCurrency(effectiveClosingTotalCents / 100)}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="bg-white text-emerald-700 border border-emerald-200">
                      Saldo: {toCurrency(closingBalance)}
                    </Badge>
                  </div>
                </div>

                {totalAmountCents === 0 && closingHasSinglePendingBudget && !selectedClosingBudget && !isSinglePendingClosingBudgetPaid && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 space-y-2">
                    <p>
                      Existe um orçamento pendente de <strong>{toCurrency(moneyToCents(pendingClosingBudgets[0].totalCost) / 100)}</strong>. Para encerrar como Entregue reparado, aprove o orçamento e use este valor no fechamento.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => {
                        const budget = pendingClosingBudgets[0];
                        const budgetCents = moneyToCents(budget.totalCost);
                        const balanceCents = Math.max(0, budgetCents - totalPaidCents);
                        setCloseApproveBudgetId(Number(budget.id));
                        setClosePaymentAmount(balanceCents > 0 ? (balanceCents / 100).toFixed(2) : "");
                      }}
                    >
                      Aprovar orçamento agora e usar no fechamento
                    </Button>
                  </div>
                )}

                {totalAmountCents === 0 && selectedClosingBudget && selectedClosingBudget.status === "pending" && (
                  <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-700">
                    O orçamento de <strong>{toCurrency(selectedClosingBudgetCents / 100)}</strong> será aprovado agora, convertido em valor total da OS e usado para calcular o pagamento do encerramento.
                  </div>
                )}

                {closingHasSingleApprovedBudgetToSync && selectedClosingBudget && (
                  <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-700">
                    O orçamento aprovado de <strong>{toCurrency(selectedClosingBudgetCents / 100)}</strong> será sincronizado como valor total da OS antes do encerramento.
                  </div>
                )}

                {closingHasMultiplePendingBudgets && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    Há mais de um orçamento pendente. Revise e aprove o orçamento correto antes de encerrar esta OS.
                  </div>
                )}

                {closingBalanceCents > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="close-payment-method" className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                          Meio de pagamento
                        </Label>
                        <Select
                          value={closePaymentMethod}
                          onValueChange={(value) => setClosePaymentMethod(value as ClosingPaymentMethod)}
                        >
                          <SelectTrigger id="close-payment-method" className="bg-white border-emerald-300 focus:border-emerald-500">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {CLOSING_PAYMENT_METHODS.map((method) => (
                              <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="close-payment-amount" className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                          Valor recebido
                        </Label>
                        <Input
                          id="close-payment-amount"
                          type="number"
                          min={0}
                          step="0.01"
                          max={closingBalance}
                          value={closePaymentAmount}
                          onChange={(e) => setClosePaymentAmount(e.target.value)}
                          className="bg-white border-emerald-300 focus:border-emerald-500 font-semibold"
                        />
                      </div>
                    </div>

                    <div className={`rounded-lg border px-3 py-2 text-xs ${isClosingFullPaymentValid ? "border-emerald-200 bg-white text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      {isClosingFullPaymentValid
                        ? `Será registrado pagamento manual como quitado no valor de ${toCurrency(closingBalance)}.`
                        : `Para esta versão, informe exatamente o saldo em aberto: ${toCurrency(closingBalance)}.`}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-700">
                    Esta OS já está quitada. O encerramento será concluído sem criar novo pagamento.
                  </div>
                )}
              </div>
            )}

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

          </div>

          {/* Ações */}
          <div className="flex gap-2 border-t bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
              onClick={handleConfirmClose}
              disabled={updateStatus.isPending || !isClosingFullPaymentValid}
            >
              {updateStatus.isPending
                ? <><span className="animate-spin mr-2">⏳</span> Encerrando...</>
                : <><Shield className="h-4 w-4 mr-2" /> Confirmar {STATUS_LABELS[closeOutcome]}</>}
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
