import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Building2, ArrowLeft, Save, MapPin, Mail, Phone, 
  FileText, ShieldCheck, Users, Globe, Lock, Unlock, MessageCircle, Activity, DollarSign 
} from "lucide-react";

export default function SuperAdminTenantDetail() {
  const [, params] = useRoute("/superadmin/tenants/:id");
  const [, navigate] = useLocation();
  const tenantId = params?.id ? parseInt(params.id) : null;
  const utils = trpc.useUtils();

  const { data: tenant, isLoading } = trpc.tenants.getById.useQuery(
    { id: tenantId! },
    { enabled: !!tenantId }
  );
  
  const { data: plans } = trpc.plans.list.useQuery();
  const { data: whatsappStatus } = trpc.whatsapp.getByTenant.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId }
  );
  const { data: whatsappLogs } = trpc.whatsapp.listLogsByTenant.useQuery(
    { tenantId: tenantId!, limit: 5 },
    { enabled: !!tenantId }
  );
  const { data: whatsappStats } = trpc.whatsapp.getTenantStats.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId }
  );
  const { data: billing } = trpc.tenantBilling.listByTenant.useQuery(
    { tenantId: tenantId!, limit: 6 },
    { enabled: !!tenantId }
  );

  const update = trpc.tenants.update.useMutation({
    onSuccess: () => {
      toast.success("Informações atualizadas com sucesso");
      utils.tenants.getById.invalidate({ id: tenantId! });
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar informações"),
  });

  const toggleStatus = trpc.tenants.toggleStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado");
      utils.tenants.getById.invalidate({ id: tenantId! });
    },
  });

  const activateBetaPlan = trpc.tenants.activateBetaPlan.useMutation({
    onSuccess: (data) => {
      toast.success(`Assistência ativada no ${data.planName}`);
      setForm((f) => ({ ...f, planId: String(data.planId), status: "active" }));
      utils.tenants.getById.invalidate({ id: tenantId! });
      utils.whatsapp.getByTenant.invalidate({ tenantId: tenantId! });
    },
    onError: (err) => toast.error(err.message || "Erro ao ativar Plano Beta"),
  });

  const saveWhatsapp = trpc.whatsapp.saveForTenant.useMutation({
    onSuccess: () => {
      toast.success("Configuração WhatsApp atualizada");
      utils.whatsapp.getByTenant.invalidate({ tenantId: tenantId! });
      utils.whatsapp.listLogsByTenant.invalidate({ tenantId: tenantId!, limit: 5 });
      utils.whatsapp.getTenantStats.invalidate({ tenantId: tenantId! });
      setWhatsappForm((f) => ({ ...f, accessToken: "" }));
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar WhatsApp"),
  });

  const createBilling = trpc.tenantBilling.create.useMutation({
    onSuccess: () => {
      toast.success("Cobrança manual registrada");
      utils.tenantBilling.listByTenant.invalidate({ tenantId: tenantId!, limit: 6 });
      utils.tenants.getById.invalidate({ id: tenantId! });
    },
    onError: (err) => toast.error(err.message || "Erro ao registrar cobrança"),
  });

  const updateBilling = trpc.tenantBilling.update.useMutation({
    onSuccess: () => {
      toast.success("Cobrança atualizada com sucesso");
      utils.tenantBilling.listByTenant.invalidate({ tenantId: tenantId!, limit: 6 });
      utils.tenants.getById.invalidate({ id: tenantId! });
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar cobrança"),
  });

  const approveProof = trpc.tenantBilling.approveProof.useMutation({
    onSuccess: () => {
      toast.success("Comprovante aprovado e assinatura renovada.");
      utils.tenantBilling.listByTenant.invalidate({ tenantId: tenantId!, limit: 6 });
      utils.tenantBilling.listPendingReviews.invalidate();
      utils.tenants.getById.invalidate({ id: tenantId! });
    },
    onError: (err) => toast.error(err.message || "Erro ao aprovar comprovante"),
  });

  const rejectProof = trpc.tenantBilling.rejectProof.useMutation({
    onSuccess: () => {
      toast.success("Comprovante recusado.");
      utils.tenantBilling.listByTenant.invalidate({ tenantId: tenantId!, limit: 6 });
      utils.tenantBilling.listPendingReviews.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao recusar comprovante"),
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    planId: "",
    status: "",
    trialEndsAt: "",
    subscriptionEndsAt: ""
  });

  const [whatsappForm, setWhatsappForm] = useState({
    enabled: false,
    displayName: "",
    businessAccountId: "",
    phoneNumberId: "",
    phoneNumber: "",
    accessToken: "",
    graphApiVersion: "v23.0",
    budgetTemplateName: "fullreparo_orcamento_disponivel",
    readyTemplateName: "fullreparo_os_pronta",
    templateLanguage: "pt_BR",
  });

  const [billingForm, setBillingForm] = useState({
    amount: "",
    status: "pending",
    dueDate: "",
    paidAt: "",
    method: "",
    notes: "",
    syncTenant: true,
  });

  const toDateTimeLocal = (value?: string | Date | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (whatsappStatus?.integration) {
      setWhatsappForm({
        enabled: Boolean(whatsappStatus.integration.enabled),
        displayName: whatsappStatus.integration.displayName || "",
        businessAccountId: whatsappStatus.integration.businessAccountId || "",
        phoneNumberId: whatsappStatus.integration.phoneNumberId || "",
        phoneNumber: whatsappStatus.integration.phoneNumber || "",
        accessToken: "",
        graphApiVersion: whatsappStatus.integration.graphApiVersion || "v23.0",
        budgetTemplateName: whatsappStatus.integration.budgetTemplateName || "fullreparo_orcamento_disponivel",
        readyTemplateName: whatsappStatus.integration.readyTemplateName || "fullreparo_os_pronta",
        templateLanguage: whatsappStatus.integration.templateLanguage || "pt_BR",
      });
    }
  }, [whatsappStatus?.integration]);

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        document: tenant.document || "",
        address: tenant.address || "",
        city: tenant.city || "",
        state: tenant.state || "",
        zipCode: tenant.zipCode || "",
        planId: String(tenant.planId || "1"),
        status: tenant.status || "active",
        trialEndsAt: toDateTimeLocal((tenant as any).trialEndsAt),
        subscriptionEndsAt: toDateTimeLocal((tenant as any).subscriptionEndsAt)
      });
      setBillingForm((current) => ({
        ...current,
        dueDate: current.dueDate || toDateTimeLocal((tenant as any).subscriptionEndsAt),
      }));
    }
  }, [tenant]);

  useEffect(() => {
    const selectedPlan = plans?.find((p) => String(p.id) === form.planId);
    if (selectedPlan?.price && !billingForm.amount) {
      setBillingForm((current) => ({ ...current, amount: String(selectedPlan.price) }));
    }
  }, [plans, form.planId, billingForm.amount]);

  if (isLoading) {
    return (
      <TenantLayout title="Carregando...">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </TenantLayout>
    );
  }

  if (!tenant) {
    return (
      <TenantLayout title="Erro">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Assistência não encontrada.</p>
          <Button variant="link" onClick={() => navigate("/superadmin/tenants")}>Voltar para a lista</Button>
        </div>
      </TenantLayout>
    );
  }

  const handleSave = () => {
    update.mutate({
      id: tenantId!,
      ...form,
      planId: parseInt(form.planId),
      status: form.status as any,
      trialEndsAt: form.trialEndsAt ? new Date(form.trialEndsAt).getTime() : null,
      subscriptionEndsAt: form.subscriptionEndsAt ? new Date(form.subscriptionEndsAt).getTime() : null
    });
  };

  const handleSaveWhatsapp = () => {
    saveWhatsapp.mutate({
      tenantId: tenantId!,
      ...whatsappForm,
      displayName: whatsappForm.displayName || null,
      businessAccountId: whatsappForm.businessAccountId || null,
      phoneNumberId: whatsappForm.phoneNumberId || null,
      phoneNumber: whatsappForm.phoneNumber || null,
      accessToken: whatsappForm.accessToken || null,
    });
  };

  const handleCreateBilling = () => {
    if (!billingForm.dueDate) {
      toast.error("Informe o vencimento da cobrança.");
      return;
    }

    createBilling.mutate({
      tenantId: tenantId!,
      planId: form.planId ? parseInt(form.planId) : null,
      amount: billingForm.amount || "0.00",
      status: billingForm.status as "pending" | "paid" | "overdue" | "cancelled",
      dueDate: new Date(billingForm.dueDate).getTime(),
      paidAt: billingForm.paidAt ? new Date(billingForm.paidAt).getTime() : null,
      method: billingForm.method || null,
      notes: billingForm.notes || null,
      syncTenant: billingForm.syncTenant,
    });
  };

  const handleMarkBillingPaid = (record: NonNullable<typeof billing>["records"][number]) => {
    if (!window.confirm("Confirmar recebimento e marcar esta cobrança como paga?")) return;

    updateBilling.mutate({
      id: record.id,
      tenantId: tenantId!,
      planId: record.planId ?? (form.planId ? parseInt(form.planId) : null),
      amount: String(record.amount || "0.00"),
      status: "paid",
      dueDate: new Date(record.dueDate).getTime(),
      paidAt: Date.now(),
      method: record.method || billingForm.method || null,
      notes: record.notes || null,
      syncTenant: true,
    });
  };

  const handleCancelBilling = (record: NonNullable<typeof billing>["records"][number]) => {
    if (!window.confirm("Cancelar este lançamento de cobrança?")) return;

    updateBilling.mutate({
      id: record.id,
      tenantId: tenantId!,
      planId: record.planId ?? (form.planId ? parseInt(form.planId) : null),
      amount: String(record.amount || "0.00"),
      status: "cancelled",
      dueDate: new Date(record.dueDate).getTime(),
      paidAt: record.paidAt ? new Date(record.paidAt).getTime() : null,
      method: record.method || null,
      notes: record.notes || null,
      syncTenant: false,
    });
  };

  const handleApproveProof = (record: NonNullable<typeof billing>["records"][number]) => {
    if (!window.confirm("Aprovar este comprovante, marcar a cobrança como paga e renovar a assinatura?")) return;
    approveProof.mutate({ id: record.id, reviewNotes: null });
  };

  const handleRejectProof = (record: NonNullable<typeof billing>["records"][number]) => {
    const reviewNotes = window.prompt("Informe o motivo da recusa para auditoria (opcional):") ?? "";
    if (!window.confirm("Confirmar recusa deste comprovante?")) return;
    rejectProof.mutate({ id: record.id, reviewNotes: reviewNotes.trim() || null });
  };

  const betaPlan = plans?.find((p) => p.slug === "beta" || p.name.toLowerCase() === "beta");
  const isBetaTenant = !!betaPlan && Number(form.planId) === betaPlan.id;
  const whatsappEligible = Boolean(whatsappStatus?.eligibility?.eligible);
  const whatsappConfigured = Boolean(whatsappStatus?.integration?.hasAccessToken && whatsappStatus.integration.phoneNumberId);
  const whatsappTokenPreview = whatsappStatus?.integration?.accessTokenPreview;
  const whatsappHealthLabel = whatsappStatus?.integration?.lastHealthStatus || "não verificado";
  const formatWhatsappDate = (value?: string | Date | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  return (
    <TenantLayout title={`Detalhes: ${tenant.name}`}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin/tenants")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => toggleStatus.mutate({ 
                id: tenant.id, 
                status: tenant.status === "active" ? "blocked" : "active" 
              })}
            >
              {tenant.status === "active" ? (
                <><Lock className="h-4 w-4 mr-2" /> Bloquear</>
              ) : (
                <><Unlock className="h-4 w-4 mr-2" /> Ativar</>
              )}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={update.isPending}>
              <Save className="h-4 w-4 mr-2" /> {update.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna da Esquerda: Resumo e Métricas */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col items-center text-center">
                  <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    {tenant.logoUrl ? (
                      <img src={tenant.logoUrl} alt={tenant.name} className="h-16 w-16 object-contain" />
                    ) : (
                      <Building2 className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <CardTitle className="text-xl">{tenant.name}</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">{tenant.slug}.fullreparo.com.br</CardDescription>
                  <Badge variant={tenant.status === "active" ? "default" : tenant.status === "trial" ? "secondary" : "destructive"} className="mt-3">
                    {tenant.status === "active" ? "Ativo" : tenant.status === "trial" ? "Em teste" : tenant.status === "suspended" ? "Suspenso" : "Bloqueado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="border-t pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">{(tenant as any).metrics?.users || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Usuários</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">{(tenant as any).metrics?.serviceOrders || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Total OS</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-2 text-primary" /> Assinatura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Plano Atual</Label>
                  <Select value={form.planId} onValueChange={(v) => setForm(f => ({ ...f, planId: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {plans?.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant={isBetaTenant ? "secondary" : "outline"}
                    size="sm"
                    className="w-full"
                    disabled={!betaPlan || isBetaTenant || activateBetaPlan.isPending}
                    onClick={() => {
                      if (!betaPlan) {
                        toast.error("Plano Beta não encontrado. Crie o Plano Beta em Super Admin → Planos.");
                        return;
                      }
                      if (window.confirm(`Ativar ${tenant.name} no Plano Beta?`)) {
                        activateBetaPlan.mutate({ id: tenant.id });
                      }
                    }}
                  >
                    {isBetaTenant ? "Plano Beta ativo" : activateBetaPlan.isPending ? "Ativando Beta..." : "Ativar Plano Beta"}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Status da assinatura</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Em teste</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fim do teste grátis</Label>
                  <Input type="datetime-local" value={form.trialEndsAt} onChange={e => setForm(f => ({ ...f, trialEndsAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim da assinatura</Label>
                  <Input type="datetime-local" value={form.subscriptionEndsAt} onChange={e => setForm(f => ({ ...f, subscriptionEndsAt: e.target.value }))} />
                </div>
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground">
                    O super admin pode alterar plano, status e datas. Trocas de plano disparam notificação para a assistência e registro interno.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Criado em: {new Date(tenant.createdAt!).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-primary" /> Cobrança manual
                </CardTitle>
                <CardDescription>Registre vencimento, pagamento e observações da assinatura.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Valor</Label>
                    <Input value={billingForm.amount} onChange={e => setBillingForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={billingForm.status} onValueChange={(status) => setBillingForm(f => ({ ...f, status }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input type="datetime-local" value={billingForm.dueDate} onChange={e => setBillingForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de pagamento</Label>
                  <Input type="datetime-local" value={billingForm.paidAt} onChange={e => setBillingForm(f => ({ ...f, paidAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Método/Referência</Label>
                  <Input value={billingForm.method} onChange={e => setBillingForm(f => ({ ...f, method: e.target.value }))} placeholder="Pix, transferência, dinheiro..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <textarea
                    className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={billingForm.notes}
                    onChange={e => setBillingForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Ex.: combinado com responsável, comprovante recebido, exceção comercial..."
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Sincronizar assinatura</Label>
                    <p className="text-xs text-muted-foreground">Atualiza plano, vencimento e status operacional quando aplicável.</p>
                  </div>
                  <Switch checked={billingForm.syncTenant} onCheckedChange={(syncTenant) => setBillingForm(f => ({ ...f, syncTenant }))} />
                </div>
                <Button className="w-full" size="sm" onClick={handleCreateBilling} disabled={createBilling.isPending}>
                  {createBilling.isPending ? "Registrando..." : "Registrar cobrança"}
                </Button>

                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Histórico recente</p>
                  {billing?.records?.length ? billing.records.map((record) => (
                    <div key={record.id} className="rounded-lg border p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">R$ {record.amount}</span>
                        <Badge variant={record.status === "paid" ? "default" : record.status === "overdue" ? "destructive" : "outline"}>
                          {record.status === "paid" ? "Pago" : record.status === "overdue" ? "Vencido" : record.status === "cancelled" ? "Cancelado" : "Pendente"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Vence em {new Date(record.dueDate).toLocaleDateString("pt-BR")}</p>
                        {record.paidAt && <p className="text-muted-foreground">Pago em {new Date(record.paidAt).toLocaleDateString("pt-BR")}</p>}
                        {record.method && <p className="text-muted-foreground">Método: {record.method}</p>}
                        {record.proofSubmittedAt && <p className="text-muted-foreground">Comprovante enviado em {new Date(record.proofSubmittedAt).toLocaleString("pt-BR")}</p>}
                        {record.notes && <p className="text-muted-foreground">Observação do tenant: {record.notes}</p>}
                        {record.reviewStatus && record.reviewStatus !== "none" && (
                          <Badge variant={record.reviewStatus === "pending_review" ? "destructive" : record.reviewStatus === "approved" ? "default" : "outline"}>
                            {record.reviewStatus === "pending_review" ? "Aguardando análise" : record.reviewStatus === "approved" ? "Comprovante aprovado" : "Comprovante recusado"}
                          </Badge>
                        )}
                        {record.proofUrl && (
                          <a className="block text-primary underline" href={record.proofUrl} target="_blank" rel="noreferrer">
                            Abrir comprovante{record.proofOriginalName ? ` (${record.proofOriginalName})` : ""}
                          </a>
                        )}
                        {record.reviewNotes && <p className="text-muted-foreground">Parecer: {record.reviewNotes}</p>}
                      </div>
                      {record.reviewStatus === "pending_review" && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleApproveProof(record)}
                            disabled={approveProof.isPending || rejectProof.isPending}
                          >
                            Aprovar comprovante
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleRejectProof(record)}
                            disabled={approveProof.isPending || rejectProof.isPending}
                          >
                            Recusar
                          </Button>
                        </div>
                      )}
                      {record.status !== "paid" && record.status !== "cancelled" && record.reviewStatus !== "pending_review" && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleMarkBillingPaid(record)}
                            disabled={updateBilling.isPending}
                          >
                            Marcar pago
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleCancelBilling(record)}
                            disabled={updateBilling.isPending}
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground">Nenhuma cobrança manual registrada ainda.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna da Direita: Dados Cadastrais */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-primary" /> Dados Cadastrais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nome da Assistência</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF ou CNPJ</Label>
                    <Input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail de Contato</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-primary" /> Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 space-y-1.5">
                    <Label>CEP</Label>
                    <Input value={form.zipCode} onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Logradouro / Número / Bairro</Label>
                    <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Cidade</Label>
                    <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado (UF)</Label>
                    <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} maxLength={2} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2 text-primary" /> WhatsApp Meta Cloud API
                </CardTitle>
                <CardDescription>
                  Governança multi-tenant controlada pelo super admin. O envio só dispara para tenants com plano habilitado e configuração válida.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Elegibilidade do plano</p>
                    <Badge variant={whatsappEligible ? "default" : "secondary"} className="mt-2">
                      {whatsappEligible ? "WhatsApp incluso" : "Plano sem WhatsApp"}
                    </Badge>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Configuração</p>
                    <Badge variant={whatsappConfigured ? "default" : "outline"} className="mt-2">
                      {whatsappConfigured ? "Credenciais salvas" : "Pendente"}
                    </Badge>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Saúde</p>
                    <Badge variant={whatsappStatus?.integration?.lastHealthStatus === "error" ? "destructive" : whatsappConfigured ? "default" : "outline"} className="mt-2">
                      {whatsappHealthLabel}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Enviadas no mês</p>
                    <p className="mt-2 text-2xl font-semibold">{whatsappStats?.monthSent ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Total enviadas</p>
                    <p className="mt-2 text-2xl font-semibold">{whatsappStats?.totalSent ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Falhas no mês</p>
                    <p className="mt-2 text-2xl font-semibold">{whatsappStats?.monthFailed ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Último envio</p>
                    <p className="mt-2 text-sm font-semibold">{formatWhatsappDate(whatsappStats?.lastSentAt)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Ativar envios transacionais</Label>
                    <p className="text-xs text-muted-foreground">Orçamento disponível e OS pronta. O backend bloqueia se o plano não tiver WhatsApp ou se a configuração estiver incompleta.</p>
                  </div>
                  <Switch checked={whatsappForm.enabled} disabled={!whatsappEligible} onCheckedChange={(enabled) => setWhatsappForm(f => ({ ...f, enabled }))} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nome exibido</Label>
                    <Input value={whatsappForm.displayName} onChange={e => setWhatsappForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Assistência FullReparo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Número WhatsApp</Label>
                    <Input value={whatsappForm.phoneNumber} onChange={e => setWhatsappForm(f => ({ ...f, phoneNumber: e.target.value }))} placeholder="+55 11 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WABA ID</Label>
                    <Input value={whatsappForm.businessAccountId} onChange={e => setWhatsappForm(f => ({ ...f, businessAccountId: e.target.value }))} placeholder="ID da conta WhatsApp Business" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone Number ID</Label>
                    <Input value={whatsappForm.phoneNumberId} onChange={e => setWhatsappForm(f => ({ ...f, phoneNumberId: e.target.value }))} placeholder="ID do número na Meta" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Access Token da Meta</Label>
                      {whatsappStatus?.integration?.hasAccessToken && (
                        <Badge variant="outline">Token salvo {whatsappTokenPreview ? `(${whatsappTokenPreview})` : ""}</Badge>
                      )}
                    </div>
                    <PasswordInput
                      value={whatsappForm.accessToken}
                      onChange={(accessToken) => setWhatsappForm(f => ({ ...f, accessToken }))}
                      autoComplete="off"
                      placeholder={whatsappStatus?.integration?.hasAccessToken ? "Deixe em branco para manter o token atual" : "Cole o token permanente da Meta"}
                    />
                    <p className="text-xs text-muted-foreground">
                      O token completo nunca é exibido após salvo. Preencha este campo somente para cadastrar ou substituir a credencial do tenant.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Template orçamento</Label>
                    <Input value={whatsappForm.budgetTemplateName} onChange={e => setWhatsappForm(f => ({ ...f, budgetTemplateName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Template OS pronta</Label>
                    <Input value={whatsappForm.readyTemplateName} onChange={e => setWhatsappForm(f => ({ ...f, readyTemplateName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Idioma</Label>
                    <Input value={whatsappForm.templateLanguage} onChange={e => setWhatsappForm(f => ({ ...f, templateLanguage: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Graph API</Label>
                    <Input value={whatsappForm.graphApiVersion} onChange={e => setWhatsappForm(f => ({ ...f, graphApiVersion: e.target.value }))} />
                  </div>
                </div>

                {whatsappStatus?.integration?.lastHealthMessage && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    Último status: {whatsappStatus.integration.lastHealthMessage}
                  </div>
                )}

                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium"><Activity className="h-4 w-4" /> Últimos envios</div>
                  {whatsappLogs?.length ? whatsappLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground border-t pt-2">
                      <span>{log.eventType} · {log.toPhone}</span>
                      <Badge variant={log.status === "failed" ? "destructive" : log.status === "sent" ? "default" : "outline"}>{log.status}</Badge>
                    </div>
                  )) : <p className="text-xs text-muted-foreground">Nenhum envio registrado para este tenant.</p>}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveWhatsapp} disabled={saveWhatsapp.isPending || !whatsappEligible}>
                    <Save className="h-4 w-4 mr-2" /> {saveWhatsapp.isPending ? "Salvando..." : "Salvar WhatsApp"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Globe className="h-5 w-5 mr-2 text-primary" /> Presença Online
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Subdomínio</Label>
                    <div className="flex items-center gap-2">
                      <Input value={tenant.slug} disabled />
                      <span className="text-sm text-muted-foreground">.fullreparo.com.br</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Domínio Customizado</Label>
                    <Input value={tenant.customDomain || "Nenhum configurado"} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
