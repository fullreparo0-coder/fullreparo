/**
 * OsDetailSheet.tsx
 *
 * Drawer lateral que exibe o detalhe completo de uma OS para o cliente
 * no portal público (/minha-conta). Inclui:
 *  - Cabeçalho com número da OS, status e data
 *  - Banner de ação quando status = aguardando_aprovacao (aprovar / recusar)
 *  - Dados do aparelho
 *  - Defeito relatado e condição física
 *  - Timeline de status (histórico completo)
 *  - Orçamento (se existir)
 *  - Garantia (se existir)
 *  - Botão de rastreamento público
 */

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Wrench, Smartphone, Clock, CheckCircle2, Package, Truck,
  Calendar, ShieldCheck, DollarSign, ExternalLink, AlertCircle,
  ThumbsUp, ThumbsDown, Bell, CreditCard, QrCode, Loader2, Copy, FileText, MessageSquare,
} from "lucide-react";

// ─── Mapeamento de status ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; dot: string }> = {
  solicitado:              { label: "Solicitado",          icon: Clock,        color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
  aguardando_coleta:       { label: "Aguardando coleta",   icon: Truck,        color: "bg-amber-100 text-amber-800 border-amber-200",   dot: "bg-amber-400" },
  coleta_agendada:         { label: "Coleta agendada",     icon: Calendar,     color: "bg-blue-100 text-blue-800 border-blue-200",      dot: "bg-blue-400" },
  coletado:                { label: "Coletado",            icon: Truck,        color: "bg-blue-100 text-blue-800 border-blue-200",      dot: "bg-blue-400" },
  recebido_na_assistencia: { label: "Recebido",            icon: Package,      color: "bg-indigo-100 text-indigo-800 border-indigo-200",dot: "bg-indigo-400" },
  em_diagnostico:          { label: "Em diagnóstico",      icon: Wrench,       color: "bg-indigo-100 text-indigo-800 border-indigo-200",dot: "bg-indigo-400" },
  aguardando_aprovacao:    { label: "Aguard. aprovação",   icon: Clock,        color: "bg-orange-100 text-orange-800 border-orange-200",dot: "bg-orange-400" },
  aprovado:                { label: "Aprovado",            icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-200",   dot: "bg-green-400" },
  recusado:                { label: "Recusado",            icon: AlertCircle,  color: "bg-red-100 text-red-800 border-red-200",         dot: "bg-red-400" },
  aguardando_peca:         { label: "Aguardando peça",     icon: Package,      color: "bg-orange-100 text-orange-800 border-orange-200",dot: "bg-orange-400" },
  em_reparo:               { label: "Em reparo",           icon: Wrench,       color: "bg-indigo-100 text-indigo-800 border-indigo-200",dot: "bg-indigo-400" },
  pronto:                  { label: "Pronto p/ retirada",  icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-200",   dot: "bg-green-500" },
  aguardando_entrega:      { label: "Aguard. entrega",     icon: Truck,        color: "bg-blue-100 text-blue-800 border-blue-200",      dot: "bg-blue-400" },
  saiu_para_entrega:       { label: "Saiu p/ entrega",     icon: Truck,        color: "bg-blue-100 text-blue-800 border-blue-200",      dot: "bg-blue-500" },
  entregue:                { label: "Entregue",            icon: CheckCircle2, color: "bg-gray-100 text-gray-700 border-gray-200",      dot: "bg-gray-400" },
  finalizado:              { label: "Finalizado",          icon: CheckCircle2, color: "bg-gray-100 text-gray-700 border-gray-200",      dot: "bg-gray-500" },
  cancelado:               { label: "Cancelado",           icon: AlertCircle,  color: "bg-red-100 text-red-800 border-red-200",         dot: "bg-red-400" },
  // legados
  pending:      { label: "Aguardando",    icon: Clock,        color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
  in_progress:  { label: "Em reparo",     icon: Wrench,       color: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-400" },
  ready:        { label: "Pronto",        icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-200",   dot: "bg-green-400" },
  delivered:    { label: "Entregue",      icon: Truck,        color: "bg-gray-100 text-gray-700 border-gray-200",      dot: "bg-gray-400" },
  cancelled:    { label: "Cancelado",     icon: AlertCircle,  color: "bg-red-100 text-red-800 border-red-200",         dot: "bg-red-400" },
};

function getStatus(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, icon: Clock, color: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-400" };
}

const READY_FOR_DELIVERY_PAYMENT = new Set(["pronto", "aguardando_entrega", "saiu_para_entrega", "entregue", "finalizado"]);

const NEXT_STEP_BY_STATUS: Record<string, { title: string; description: string; action: string }> = {
  aguardando_aprovacao: { title: "Sua aprovação está pendente", description: "Revise o orçamento e aprove ou recuse para a assistência continuar.", action: "Responder orçamento" },
  pronto: { title: "Serviço pronto", description: "Confira pagamento, retirada, entrega e garantia disponível.", action: "Organizar retirada" },
  aguardando_entrega: { title: "Entrega em preparação", description: "A entrega está autorizada ou aguardando finalização logística.", action: "Acompanhar entrega" },
  saiu_para_entrega: { title: "Saiu para entrega", description: "Mantenha contato disponível para receber o aparelho.", action: "Acompanhar entrega" },
  em_reparo: { title: "Reparo em andamento", description: "A assistência está executando o serviço aprovado.", action: "Acompanhar evolução" },
  aguardando_peca: { title: "Aguardando peça", description: "O reparo depende de peça; acompanhe a previsão na timeline.", action: "Ver previsão" },
  finalizado: { title: "Atendimento concluído", description: "Comprovantes, garantia e histórico ficam disponíveis para consulta.", action: "Ver documentos" },
  entregue: { title: "Aparelho entregue", description: "Consulte garantia e histórico sempre que precisar.", action: "Ver documentos" },
};

function getNextStep(status?: string | null) {
  return NEXT_STEP_BY_STATUS[String(status ?? "")] ?? { title: "Acompanhamento em andamento", description: "Consulte a timeline, comunicações e documentos desta OS.", action: "Acompanhar OS" };
}

function formatCurrency(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OsDetailSheetProps {
  osId: number | null;
  tenantId?: number;
  primaryColor: string;
  onClose: () => void;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function OsDetailSheet({ osId, tenantId, primaryColor, onClose }: OsDetailSheetProps) {
  const utils = trpc.useUtils();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [payTab, setPayTab] = useState<"pix" | "card">("pix");
  const [pixData, setPixData] = useState<{
    pixQrCode?: string | null;
    pixQrCodeUrl?: string | null;
    pixExpiresAt?: Date | string | null;
    amount?: number;
    status?: string;
  } | null>(null);
  const [cardForm, setCardForm] = useState({
    number: "",
    holderName: "",
    expMonth: "",
    expYear: "",
    cvv: "",
    installments: "1",
  });

  const { data, isLoading } = trpc.serviceOrders.myOrderDetail.useQuery(
    { osId: osId ?? 0, tenantId },
    { enabled: !!osId }
  );

  const { data: paymentSummary, isLoading: isPaymentSummaryLoading } = trpc.payments.getCustomerSummary.useQuery(
    { osId: osId ?? 0, tenantId },
    { enabled: !!osId }
  );

  const authorizeDeliveryMutation = trpc.serviceOrders.authorizeDeliveryByCustomer.useMutation({
    onSuccess: () => {
      toast.success("Entrega autorizada. Se houver valor pendente, o pagamento online está liberado.");
      utils.serviceOrders.myOrderDetail.invalidate({ osId: osId ?? 0, tenantId });
      utils.serviceOrders.myOrders.invalidate();
      utils.payments.getCustomerSummary.invalidate({ osId: osId ?? 0, tenantId });
    },
    onError: (err) => toast.error(err.message ?? "Não foi possível autorizar a entrega."),
  });

  const createPixMutation = trpc.payments.createCustomerPix.useMutation({
    onSuccess: (result) => {
      toast.success("PIX gerado com sucesso. Após o pagamento, a baixa será automática.");
      setPixData(result.payment);
      utils.payments.getCustomerSummary.invalidate({ osId: osId ?? 0, tenantId });
      utils.serviceOrders.myOrderDetail.invalidate({ osId: osId ?? 0, tenantId });
    },
    onError: (err) => toast.error(err.message ?? "Não foi possível gerar o PIX."),
  });

  const createCardMutation = trpc.payments.createCustomerCard.useMutation({
    onSuccess: (result) => {
      const isPaid = result.payment.status === "paid";
      toast.success(isPaid ? "Pagamento por cartão aprovado." : "Pagamento enviado para processamento.");
      setCardForm((prev) => ({ ...prev, number: "", cvv: "" }));
      utils.payments.getCustomerSummary.invalidate({ osId: osId ?? 0, tenantId });
      utils.serviceOrders.myOrderDetail.invalidate({ osId: osId ?? 0, tenantId });
    },
    onError: (err) => toast.error(err.message ?? "Não foi possível processar o cartão."),
  });

  const respondMutation = trpc.budgets.respondMyBudget.useMutation({
    onSuccess: (result) => {
      if (result.action === "approve") {
        toast.success("Orçamento aprovado com sucesso! O reparo será iniciado em breve.");
      } else {
        toast.info("Orçamento recusado. A assistência será notificada.");
        setRejectDialogOpen(false);
        setRejectionReason("");
      }
      // Invalida cache para refletir o novo status
      utils.serviceOrders.myOrderDetail.invalidate({ osId: osId ?? 0, tenantId });
      utils.serviceOrders.myOrders.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Erro ao processar sua resposta. Tente novamente.");
    },
  });

  const handleApprove = () => {
    if (!data?.budget) return;
    respondMutation.mutate({
      budgetId: data.budget.id,
      action: "approve",
      tenantId,
    });
  };

  const handleReject = () => {
    if (!data?.budget) return;
    respondMutation.mutate({
      budgetId: data.budget.id,
      action: "reject",
      rejectionReason: rejectionReason.trim() || undefined,
      tenantId,
    });
  };

  const handleAuthorizeDelivery = () => {
    if (!osId) return;
    authorizeDeliveryMutation.mutate({ osId, tenantId });
  };

  const handleCreatePix = () => {
    if (!osId) return;
    createPixMutation.mutate({ osId, tenantId });
  };

  const handleCardPayment = () => {
    if (!osId) return;
    const number = cardForm.number.replace(/\D/g, "");
    const expMonth = Number(cardForm.expMonth);
    let expYear = Number(cardForm.expYear);
    const cvv = cardForm.cvv.replace(/\D/g, "");
    const installments = Number(cardForm.installments || 1);

    if (number.length < 13) {
      toast.error("Informe um número de cartão válido.");
      return;
    }
    if (!cardForm.holderName.trim()) {
      toast.error("Informe o nome impresso no cartão.");
      return;
    }
    if (!expMonth || expMonth < 1 || expMonth > 12) {
      toast.error("Informe um mês de validade válido.");
      return;
    }
    if (expYear > 0 && expYear < 100) expYear += 2000;
    if (!expYear || expYear < new Date().getFullYear()) {
      toast.error("Informe um ano de validade válido.");
      return;
    }
    if (cvv.length < 3) {
      toast.error("Informe o CVV do cartão.");
      return;
    }

    createCardMutation.mutate({
      osId,
      tenantId,
      card: {
        number,
        holderName: cardForm.holderName.trim(),
        expMonth,
        expYear,
        cvv,
        installments: Number.isFinite(installments) ? Math.max(1, Math.min(12, installments)) : 1,
      },
    });
  };

  const os = data?.os;
  const device = data?.device;
  const timeline = data?.timeline ?? [];
  const warranty = data?.warranty;
  const budget = data?.budget;
  const recentCommunications = data?.recentCommunications ?? [];
  const nextStep = getNextStep(os?.status);

  const currentStatus = os ? getStatus(os.status) : null;
  const StatusIcon = currentStatus?.icon ?? Clock;
  const isAwaitingApproval = os?.status === "aguardando_aprovacao" && budget?.status === "pending";
  const isResponding = respondMutation.isPending;
  const deliveryAuthorizedAt = os?.deliveryAuthorizedAt ? new Date(os.deliveryAuthorizedAt).toLocaleString("pt-BR") : null;
  const isPaymentStage = os ? READY_FOR_DELIVERY_PAYMENT.has(String(os.status)) : false;
  const shouldShowPaymentSection = Boolean(os && (isPaymentStage || deliveryAuthorizedAt || Number(os.totalAmount || 0) > 0));
  const amountDue = paymentSummary?.amountDue ?? Math.max(0, Number(os?.totalAmount || 0));

  return (
    <>
      <Sheet open={!!osId} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          {/* Header colorido com branding do tenant */}
          <div className="sticky top-0 z-10 px-5 py-4" style={{ backgroundColor: primaryColor }}>
            <SheetHeader>
              <SheetTitle className="text-white text-left">
                {isLoading ? (
                  <Skeleton className="h-5 w-32 bg-white/30" />
                ) : os ? (
                  <span>OS #{os.id} — {os.osNumber}</span>
                ) : (
                  <span>Detalhe da OS</span>
                )}
              </SheetTitle>
              {currentStatus && (
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${currentStatus.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {currentStatus.label}
                  </span>
                </div>
              )}
            </SheetHeader>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : !os ? (
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold text-foreground">OS não encontrada</p>
              <p className="text-sm text-muted-foreground">Esta OS não está disponível ou não pertence à sua conta.</p>
            </div>
          ) : (
            <div className="p-5 space-y-6">

              {/* ── Banner de aprovação de orçamento ───────────────────────── */}
              {isAwaitingApproval && budget && (
                <section>
                  <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4 space-y-3">
                    {/* Ícone + título */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center shrink-0">
                        <Bell className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-orange-900 text-sm">Orçamento aguardando sua aprovação</p>
                        <p className="text-xs text-orange-700 mt-0.5">
                          Valor total:{" "}
                          <span className="font-bold text-orange-900">
                            {Number(budget.totalCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Itens do orçamento (resumo) */}
                    {budget.items && budget.items.length > 0 && (
                      <div className="rounded-lg bg-white/70 border border-orange-200 p-2.5 space-y-1">
                        {budget.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <span className="text-orange-900 truncate flex-1 mr-2">
                              {item.quantity > 1 && <span className="text-orange-600 mr-1">{item.quantity}×</span>}
                              {item.description}
                            </span>
                            <span className="text-orange-800 font-medium shrink-0">
                              {Number(item.totalPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </div>
                        ))}
                        {budget.description && (
                          <p className="text-xs text-orange-700 pt-1 border-t border-orange-200">{budget.description}</p>
                        )}
                      </div>
                    )}

                    {/* Botões de ação */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                        size="sm"
                        disabled={isResponding}
                        onClick={handleApprove}
                      >
                        {isResponding && respondMutation.variables?.action === "approve" ? (
                          <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <ThumbsUp className="h-3.5 w-3.5" />
                        )}
                        Aprovar orçamento
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-red-300 text-red-700 hover:bg-red-50 bg-white"
                        size="sm"
                        disabled={isResponding}
                        onClick={() => setRejectDialogOpen(true)}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        Recusar
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Aparelho ───────────────────────────────────────────────── */}
              {device && (
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aparelho</p>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${primaryColor}15` }}>
                      <Smartphone className="h-5 w-5" style={{ color: primaryColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground">{device.brand} {device.model}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {device.type && <span className="text-xs text-muted-foreground">{device.type}</span>}
                        {device.color && <span className="text-xs text-muted-foreground">{device.color}</span>}
                        {device.imei && <span className="text-xs text-muted-foreground font-mono">IMEI: {device.imei}</span>}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Defeito relatado ───────────────────────────────────────── */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Defeito relatado</p>
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <p className="text-sm text-foreground leading-relaxed">{os.reportedDefect}</p>
                  {os.physicalCondition && (
                    <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                      <span className="font-medium">Condição física:</span> {os.physicalCondition}
                    </p>
                  )}
                  {os.accessories && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Acessórios:</span> {os.accessories}
                    </p>
                  )}
                </div>
              </section>

              {/* ── Orçamento (resumo quando não está aguardando aprovação) ── */}
              {budget && !isAwaitingApproval && (
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Orçamento</p>
                  <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Total</span>
                      </div>
                      <span className="text-base font-bold text-foreground">
                        {Number(budget.totalCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    {budget.description && (
                      <p className="text-xs text-muted-foreground border-t border-border pt-2">{budget.description}</p>
                    )}
                    {budget.items && budget.items.length > 0 && (
                      <div className="border-t border-border pt-2 space-y-1.5">
                        {budget.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <span className="text-foreground truncate flex-1 mr-2">
                              {item.quantity > 1 && <span className="text-muted-foreground mr-1">{item.quantity}×</span>}
                              {item.description}
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {Number(item.totalPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-1">
                      <Badge
                        variant="outline"
                        className={
                          budget.status === "approved" ? "border-green-300 text-green-700 bg-green-50" :
                          budget.status === "rejected" ? "border-red-300 text-red-700 bg-red-50" :
                          budget.status === "expired"  ? "border-gray-300 text-gray-600 bg-gray-50" :
                          "border-yellow-300 text-yellow-700 bg-yellow-50"
                        }
                      >
                        {budget.status === "approved" ? "Aprovado" :
                         budget.status === "rejected" ? "Recusado" :
                         budget.status === "expired"  ? "Expirado" : "Aguardando aprovação"}
                      </Badge>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Garantia ───────────────────────────────────────────────── */}
              {warranty && (
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Garantia</p>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">Garantia ativa</span>
                      <Badge variant="outline" className="ml-auto text-xs border-green-300 text-green-700 bg-white font-mono">
                        {warranty.warrantyCode}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-green-700">
                      <p>
                        <span className="font-medium">Válida até:</span>{" "}
                        {new Date(warranty.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                      <p>
                        <span className="font-medium">Duração:</span> {warranty.warrantyDays} dias
                      </p>
                      {warranty.description && (
                        <p className="pt-1 border-t border-green-200">{warranty.description}</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Entrega e pagamento online ─────────────────────────────── */}
              {shouldShowPaymentSection && (
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Entrega e pagamento</p>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center shrink-0">
                        <Truck className="h-4 w-4 text-blue-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-blue-900">Autorização de entrega</p>
                        <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                          {deliveryAuthorizedAt
                            ? `Entrega autorizada em ${deliveryAuthorizedAt}.`
                            : isPaymentStage
                              ? "Autorize a entrega para liberar a opção de pagamento online por PIX ou cartão."
                              : "A autorização ficará disponível quando o serviço estiver concluído."}
                        </p>
                      </div>
                      {deliveryAuthorizedAt ? (
                        <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 shrink-0">Autorizada</Badge>
                      ) : isPaymentStage ? (
                        <Button
                          size="sm"
                          className="bg-blue-700 hover:bg-blue-800 text-white shrink-0"
                          onClick={handleAuthorizeDelivery}
                          disabled={authorizeDeliveryMutation.isPending}
                        >
                          {authorizeDeliveryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Autorizar"}
                        </Button>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-blue-200 bg-white p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-blue-700" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">Pagamento online opcional</p>
                            <p className="text-xs text-muted-foreground">Pague agora se desejar antecipar a quitação.</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-foreground">{formatCurrency(amountDue)}</span>
                      </div>

                      {isPaymentSummaryLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando informações de pagamento...
                        </div>
                      ) : paymentSummary ? (
                        <>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-md bg-muted/40 p-2">
                              <p className="text-muted-foreground">Total</p>
                              <p className="font-semibold text-foreground">{formatCurrency(paymentSummary.total)}</p>
                            </div>
                            <div className="rounded-md bg-muted/40 p-2">
                              <p className="text-muted-foreground">Pago</p>
                              <p className="font-semibold text-green-700">{formatCurrency(paymentSummary.paid)}</p>
                            </div>
                            <div className="rounded-md bg-muted/40 p-2">
                              <p className="text-muted-foreground">Pendente</p>
                              <p className="font-semibold text-blue-700">{formatCurrency(paymentSummary.amountDue)}</p>
                            </div>
                          </div>

                          {paymentSummary.canPay ? (
                            <div className="space-y-3 pt-1">
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  type="button"
                                  variant={payTab === "pix" ? "default" : "outline"}
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => setPayTab("pix")}
                                >
                                  <QrCode className="h-3.5 w-3.5" /> PIX
                                </Button>
                                <Button
                                  type="button"
                                  variant={payTab === "card" ? "default" : "outline"}
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => setPayTab("card")}
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Cartão
                                </Button>
                              </div>

                              {payTab === "pix" ? (
                                <div className="rounded-lg border border-border p-3 space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">PIX copia e cola</p>
                                      <p className="text-xs text-muted-foreground">Gere o QR Code e pague no aplicativo do seu banco.</p>
                                    </div>
                                    <Button size="sm" onClick={handleCreatePix} disabled={createPixMutation.isPending} className="gap-2">
                                      {createPixMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                                      Gerar PIX
                                    </Button>
                                  </div>
                                  {pixData && (
                                    <div className="space-y-2">
                                      {pixData.pixQrCodeUrl && (
                                        <div className="flex justify-center">
                                          <img src={pixData.pixQrCodeUrl} alt="QR Code PIX" className="h-36 w-36 rounded-md border border-border bg-white p-2" />
                                        </div>
                                      )}
                                      {pixData.pixQrCode && (
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Código PIX</Label>
                                          <div className="flex gap-2">
                                            <Input readOnly value={pixData.pixQrCode} className="font-mono text-xs" />
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              onClick={() => {
                                                navigator.clipboard.writeText(pixData.pixQrCode || "");
                                                toast.success("Código PIX copiado");
                                              }}
                                            >
                                              <Copy className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                      {pixData.pixExpiresAt && (
                                        <p className="text-xs text-muted-foreground">Vencimento: {new Date(pixData.pixExpiresAt).toLocaleString("pt-BR")}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-lg border border-border p-3 space-y-3">
                                  <div className="grid grid-cols-1 gap-2">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs">Número do cartão</Label>
                                      <Input
                                        inputMode="numeric"
                                        autoComplete="cc-number"
                                        value={cardForm.number}
                                        onChange={(e) => setCardForm((prev) => ({ ...prev, number: e.target.value.replace(/[^0-9 ]/g, "").slice(0, 23) }))}
                                        placeholder="0000 0000 0000 0000"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs">Nome impresso no cartão</Label>
                                      <Input
                                        autoComplete="cc-name"
                                        value={cardForm.holderName}
                                        onChange={(e) => setCardForm((prev) => ({ ...prev, holderName: e.target.value }))}
                                        placeholder="NOME DO TITULAR"
                                      />
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Mês</Label>
                                        <Input
                                          inputMode="numeric"
                                          autoComplete="cc-exp-month"
                                          value={cardForm.expMonth}
                                          onChange={(e) => setCardForm((prev) => ({ ...prev, expMonth: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                                          placeholder="MM"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Ano</Label>
                                        <Input
                                          inputMode="numeric"
                                          autoComplete="cc-exp-year"
                                          value={cardForm.expYear}
                                          onChange={(e) => setCardForm((prev) => ({ ...prev, expYear: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                                          placeholder="AAAA"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">CVV</Label>
                                        <Input
                                          type="password"
                                          inputMode="numeric"
                                          autoComplete="cc-csc"
                                          value={cardForm.cvv}
                                          onChange={(e) => setCardForm((prev) => ({ ...prev, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                                          placeholder="123"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Parcelas</Label>
                                        <Input
                                          type="number"
                                          min={1}
                                          max={12}
                                          value={cardForm.installments}
                                          onChange={(e) => setCardForm((prev) => ({ ...prev, installments: e.target.value }))}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <Button className="w-full gap-2" onClick={handleCardPayment} disabled={createCardMutation.isPending}>
                                    {createCardMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                                    Pagar {formatCurrency(paymentSummary.amountDue)} no cartão
                                  </Button>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Os dados do cartão são enviados diretamente para criação da cobrança e não ficam armazenados no FullReparo.
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                              {paymentSummary.reason || "Pagamento online indisponível no momento."}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Informações de pagamento indisponíveis no momento.</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Documentos e comprovantes
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {os.publicToken && (
                    <Button variant="outline" className="justify-start gap-2" onClick={() => window.open(`/rastrear/${os.publicToken}`, "_blank")}>
                      <ExternalLink className="h-4 w-4" /> Rastreamento público
                    </Button>
                  )}
                  {warranty && (
                    <Button variant="outline" className="justify-start gap-2" onClick={() => window.open(`/garantia/${warranty.warrantyCode}`, "_blank")}>
                      <ShieldCheck className="h-4 w-4" /> Garantia digital
                    </Button>
                  )}
                  {budget && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                      <div className="flex items-center gap-2 font-semibold"><FileText className="h-3.5 w-3.5" /> Orçamento</div>
                      <p className="mt-1 text-muted-foreground">{formatCurrency(budget.totalCost)} • {budget.status}</p>
                    </div>
                  )}
                  {paymentSummary && Number(paymentSummary.paid ?? 0) > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                      <div className="flex items-center gap-2 font-semibold"><CreditCard className="h-3.5 w-3.5" /> Pagamentos</div>
                      <p className="mt-1 text-muted-foreground">Pago: {formatCurrency(paymentSummary.paid)}</p>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Comunicações recentes
                </p>
                {recentCommunications.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhuma comunicação registrada para esta OS ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {recentCommunications.slice().reverse().map((item) => (
                      <div key={item.id} className="rounded-lg border bg-card p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-semibold"><MessageSquare className="h-3.5 w-3.5" /> {item.channel}</span>
                          <span className="text-muted-foreground">{item.sentAt ? new Date(item.sentAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Agora"}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground line-clamp-2">{item.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Timeline ───────────────────────────────────────────────── */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Histórico de status
                </p>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum histórico registrado ainda.</p>
                ) : (
                  <div className="relative">
                    {/* Linha vertical da timeline */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                    <div className="space-y-0">
                      {[...timeline].reverse().map((entry, idx) => {
                        const cfg = getStatus(entry.status);
                        const EntryIcon = cfg.icon;
                        const isFirst = idx === 0;
                        return (
                          <div key={entry.id} className="relative flex gap-4 pb-5 last:pb-0">
                            {/* Dot */}
                            <div className={`relative z-10 h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 border-background ${isFirst ? cfg.dot : "bg-muted"}`}>
                              <EntryIcon className={`h-3 w-3 ${isFirst ? "text-white" : "text-muted-foreground"}`} />
                            </div>
                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-medium leading-tight ${isFirst ? "text-foreground" : "text-muted-foreground"}`}>
                                  {cfg.label}
                                </p>
                                <time className="text-xs text-muted-foreground shrink-0 tabular-nums">
                                  {new Date(entry.createdAt).toLocaleString("pt-BR", {
                                    day: "2-digit", month: "2-digit", year: "2-digit",
                                    hour: "2-digit", minute: "2-digit",
                                  })}
                                </time>
                              </div>
                              {entry.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.notes}</p>
                              )}
                              {entry.changedByName && (
                                <p className="text-xs text-muted-foreground/60 mt-0.5">{entry.changedByName}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* ── Informações adicionais ─────────────────────────────────── */}
              <section className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Origem</span>
                  <span className="text-foreground capitalize">{os.origin === "balcao" ? "Balcão" : "Coleta"}</span>
                </div>
                {os.estimatedDelivery && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Previsão de entrega</span>
                    <span className="text-foreground">
                      {new Date(os.estimatedDelivery).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Criada em</span>
                  <span className="text-foreground">
                    {new Date(os.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                </div>
                {os.totalAmount && Number(os.totalAmount) > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                    <span className="text-muted-foreground font-medium">Valor total</span>
                    <span className="text-foreground font-semibold">
                      {Number(os.totalAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                )}
              </section>

              {/* ── Botão de rastreamento público ─────────────────────────── */}
              {os.publicToken && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.open(`/rastrear/${os.publicToken}`, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir página de rastreamento
                </Button>
              )}

            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Dialog de confirmação de recusa ──────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectionReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ThumbsDown className="h-5 w-5" />
              Recusar orçamento
            </DialogTitle>
            <DialogDescription>
              Ao recusar, a assistência será notificada. Você pode informar um motivo para ajudar na negociação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {budget && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="text-muted-foreground">Valor do orçamento:</p>
                <p className="font-bold text-foreground text-base mt-0.5">
                  {Number(budget.totalCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Motivo da recusa <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Textarea
                placeholder="Ex: Valor acima do esperado, prefiro buscar outro orçamento..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{rejectionReason.length}/500</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setRejectDialogOpen(false); setRejectionReason(""); }}
              disabled={isResponding}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isResponding}
              className="gap-2"
            >
              {isResponding ? (
                <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <ThumbsDown className="h-3.5 w-3.5" />
              )}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
