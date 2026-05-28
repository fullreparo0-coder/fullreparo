import { useTenantNav } from "@/hooks/useTenantNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LogOut, User, ArrowLeft, ClipboardList, Wrench, Clock,
  CheckCircle2, Package, Truck, Smartphone, MapPin, Calendar,
  Pencil, Save, X, Search, Shield, AlertTriangle, ArrowRight, CreditCard,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { OsDetailSheet } from "@/components/OsDetailSheet";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

/** Retorna '#ffffff' ou '#000000' com base na luminância WCAG */
function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return "#ffffff";
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#000000" : "#ffffff";
}

const STATUS_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:      { label: "Aguardando",     icon: Clock,        color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  diagnosed:    { label: "Diagnosticado",  icon: Wrench,       color: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress:  { label: "Em reparo",      icon: Wrench,       color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  waiting_part: { label: "Aguard. peça",   icon: Package,      color: "bg-orange-100 text-orange-800 border-orange-200" },
  ready:        { label: "Pronto",         icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-200" },
  delivered:    { label: "Entregue",       icon: Truck,        color: "bg-gray-100 text-gray-700 border-gray-200" },
  cancelled:    { label: "Cancelado",      icon: ClipboardList,color: "bg-red-100 text-red-800 border-red-200" },
  // Status do novo fluxo
  solicitado:           { label: "Solicitado",         icon: Clock,        color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  aguardando_coleta:    { label: "Aguard. coleta",     icon: Truck,        color: "bg-amber-100 text-amber-800 border-amber-200" },
  coleta_agendada:      { label: "Coleta agendada",    icon: Calendar,     color: "bg-blue-100 text-blue-800 border-blue-200" },
  coletado:             { label: "Coletado",           icon: Truck,        color: "bg-blue-100 text-blue-800 border-blue-200" },
  recebido_na_assistencia: { label: "Recebido",        icon: Package,      color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  em_diagnostico:       { label: "Em diagnóstico",     icon: Wrench,       color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  aguardando_aprovacao: { label: "Aguard. aprovação",  icon: Clock,        color: "bg-orange-100 text-orange-800 border-orange-200" },
  aprovado:             { label: "Aprovado",           icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-200" },
  recusado:             { label: "Recusado",           icon: ClipboardList,color: "bg-red-100 text-red-800 border-red-200" },
  aguardando_peca:      { label: "Aguard. peça",       icon: Package,      color: "bg-orange-100 text-orange-800 border-orange-200" },
  em_reparo:            { label: "Em reparo",          icon: Wrench,       color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  pronto:               { label: "Pronto",             icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-200" },
  aguardando_entrega:   { label: "Aguard. entrega",    icon: Truck,        color: "bg-blue-100 text-blue-800 border-blue-200" },
  saiu_para_entrega:    { label: "Saiu p/ entrega",    icon: Truck,        color: "bg-blue-100 text-blue-800 border-blue-200" },
  entregue:             { label: "Entregue",           icon: CheckCircle2, color: "bg-gray-100 text-gray-700 border-gray-200" },
  finalizado:           { label: "Entregue reparado",  icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-200" },
  encerrado_sem_reparo: { label: "Encerrado sem Reparo", icon: ClipboardList, color: "bg-slate-100 text-slate-700 border-slate-200" },
  encerrado_condenado:  { label: "Encerrado Condenado", icon: ClipboardList, color: "bg-red-100 text-red-800 border-red-200" },
  cancelado:            { label: "Cancelado",          icon: ClipboardList,color: "bg-red-100 text-red-800 border-red-200" },
};


const NEXT_STEP_BY_STATUS: Record<string, { title: string; description: string; action: string; tone: string }> = {
  solicitado: { title: "Solicitação recebida", description: "A assistência vai revisar os dados e confirmar os próximos passos.", action: "Acompanhar solicitação", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  aguardando_coleta: { title: "Coleta pendente", description: "A equipe precisa combinar ou confirmar a retirada do aparelho.", action: "Ver coleta", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  coleta_agendada: { title: "Coleta agendada", description: "Confira endereço e horário combinado para evitar remarcações.", action: "Conferir agendamento", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  recebido_na_assistencia: { title: "Aparelho recebido", description: "O aparelho já está na assistência e seguirá para diagnóstico.", action: "Ver detalhes", tone: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  em_diagnostico: { title: "Diagnóstico em andamento", description: "A equipe está avaliando o defeito e preparará uma orientação.", action: "Acompanhar diagnóstico", tone: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  aguardando_aprovacao: { title: "Orçamento aguardando sua aprovação", description: "Aprove ou recuse o orçamento para destravar o andamento do reparo.", action: "Responder orçamento", tone: "bg-orange-50 text-orange-800 border-orange-200" },
  aprovado: { title: "Orçamento aprovado", description: "A assistência já pode seguir com o reparo conforme aprovado.", action: "Acompanhar reparo", tone: "bg-green-50 text-green-800 border-green-200" },
  aguardando_peca: { title: "Aguardando peça", description: "O reparo depende de peça ou insumo; acompanhe a previsão informada.", action: "Ver previsão", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  em_reparo: { title: "Reparo em execução", description: "O serviço está em bancada. Você será avisado quando ficar pronto.", action: "Acompanhar reparo", tone: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  pronto: { title: "Pronto para retirada", description: "Seu aparelho está pronto. Combine retirada, entrega ou pagamento pendente.", action: "Ver retirada/pagamento", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  aguardando_entrega: { title: "Aguardando entrega", description: "A entrega está liberada ou em preparação pela assistência.", action: "Ver entrega", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  saiu_para_entrega: { title: "Saiu para entrega", description: "Acompanhe a entrega e mantenha seus contatos atualizados.", action: "Acompanhar entrega", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  entregue: { title: "Aparelho entregue", description: "Consulte garantia, comprovantes e histórico sempre que precisar.", action: "Ver documentos", tone: "bg-slate-50 text-slate-700 border-slate-200" },
  finalizado: { title: "Aparelho entregue reparado", description: "Seu histórico, garantia e comprovantes permanecem disponíveis no portal.", action: "Ver histórico", tone: "bg-green-50 text-green-700 border-green-200" },
  encerrado_sem_reparo: { title: "OS encerrada sem reparo", description: "O atendimento foi encerrado sem execução de reparo. Consulte o histórico para detalhes.", action: "Ver histórico", tone: "bg-slate-50 text-slate-700 border-slate-200" },
  encerrado_condenado: { title: "Aparelho condenado", description: "A assistência registrou inviabilidade de reparo. Consulte o histórico para detalhes.", action: "Ver histórico", tone: "bg-red-50 text-red-700 border-red-200" },
  recusado: { title: "Orçamento recusado", description: "A assistência pode orientar retirada, novo orçamento ou encerramento.", action: "Falar com assistência", tone: "bg-red-50 text-red-800 border-red-200" },
};

function getNextStep(status?: string | null) {
  return NEXT_STEP_BY_STATUS[String(status ?? "")] ?? { title: "Acompanhamento disponível", description: "Abra a OS para consultar timeline, orçamento, pagamentos e documentos.", action: "Ver detalhes", tone: "bg-slate-50 text-slate-700 border-slate-200" };
}

function getOrderDate(value?: string | Date | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function getActionPriorityTone(priority?: string | null) {
  if (priority === "alta") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "media") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getActionPriorityLabel(priority?: string | null) {
  if (priority === "alta") return "Prioridade alta";
  if (priority === "media") return "Prioridade média";
  return "Ação sugerida";
}

function getSlaTone(sla?: { isOverdue?: boolean | null; isStageStalled?: boolean | null } | null) {
  if (sla?.isOverdue) return "bg-red-50 text-red-700 border-red-200";
  if (sla?.isStageStalled) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function getSlaLabel(sla?: { isOverdue?: boolean | null; isStageStalled?: boolean | null; statusAgeHours?: number | null } | null) {
  const hours = Number(sla?.statusAgeHours ?? 0);
  const humanAge = hours >= 24 ? `${Math.floor(hours / 24)}d na etapa` : `${Math.max(0, Math.round(hours))}h na etapa`;
  if (sla?.isOverdue) return `SLA vencido · ${humanAge}`;
  if (sla?.isStageStalled) return `Etapa parada · ${humanAge}`;
  return `No prazo · ${humanAge}`;
}

const PICKUP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pendente",     color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  assigned:    { label: "Atribuído",    color: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress: { label: "Em andamento", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  completed:   { label: "Concluído",    color: "bg-green-100 text-green-800 border-green-200" },
  failed:      { label: "Falhou",       color: "bg-red-100 text-red-800 border-red-200" },
};

/** Formata string de CEP para 00000-000 */
function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

export default function MinhaContaPortal() {
  const { navigate: tenantNavigate } = useTenantNav();
  const { user, loading: oauthLoading, logout: oauthLogout } = useAuth();
  const { tenant, isHostTenant } = useTenantHost();

  const primaryColor = tenant?.primaryColor ?? "#1e3a5f";
  const contrastColor = getContrastColor(primaryColor);

  // OS selecionada para exibir no drawer de detalhe
  const [selectedOsId, setSelectedOsId] = useState<number | null>(null);

  // ── Sessão local do cliente (customer_session cookie) ──────────────────────
  const { data: localCustomer, isLoading: localLoading, refetch: refetchLocalCustomer } =
    trpc.customerAuth.meLocal.useQuery(undefined, {
      retry: false,
      refetchOnWindowFocus: false,
    });

  const logoutLocalMutation = trpc.customerAuth.logoutLocal.useMutation({
    onSuccess: () => {
      tenantNavigate("/");
    },
  });

  // Logout unificado: usa o sistema correto dependendo de como o usuário está logado
  const handleLogout = async () => {
    if (localCustomer) {
      logoutLocalMutation.mutate();
    } else {
      await oauthLogout();
      tenantNavigate("/");
    }
  };

  // Dados do usuário exibidos no header — prioriza cliente local, depois OAuth
  const displayName = localCustomer?.name ?? user?.name ?? "Cliente";
  const displayEmail = localCustomer?.email ?? user?.email ?? null;
  const displayAvatarUrl = user?.avatarUrl ?? null;

  const authLoading = oauthLoading || localLoading;
  // Autenticado se: tem sessão OAuth OU tem sessão local de cliente
  const isAuthenticated = Boolean(user) || Boolean(localCustomer);

  // ── Perfil editável ─────────────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "", email: "", phone: "", document: "",
    zipCode: "", address: "", addressNumber: "", complement: "",
    neighborhood: "", city: "", state: "", addressReference: "",
  });
  const [cepLoading, setCepLoading] = useState(false);

  const { data: myProfile, refetch: refetchProfile } = trpc.customerAuth.meLocal.useQuery(
    undefined,
    { retry: false, refetchOnWindowFocus: false }
  );

  // Inicializa o form com os dados do perfil
  useEffect(() => {
    if (!myProfile) return;
    setProfileForm({
      name: myProfile.name ?? "",
      email: myProfile.email ?? "",
      phone: myProfile.phone ?? "",
      document: myProfile.document ?? "",
      zipCode: formatCep(myProfile.zipCode ?? ""),
      address: myProfile.address ?? "",
      addressNumber: myProfile.addressNumber ?? "",
      complement: "",
      neighborhood: myProfile.neighborhood ?? "",
      city: myProfile.city ?? "",
      state: myProfile.state ?? "",
      addressReference: myProfile.addressReference ?? "",
    });
  }, [myProfile]);

  const updateProfile = trpc.customerAuth.updateMyProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      setEditingProfile(false);
      refetchProfile();
    },
    onError: (err) => toast.error(err.message ?? "Erro ao atualizar perfil."),
  });

  const handleCepBlur = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setProfileForm((f) => ({
          ...f,
          address: data.logradouro || f.address,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
      }
    } catch { /* silencioso */ } finally { setCepLoading(false); }
  };

  const handleSaveProfile = () => {
    if (!profileForm.name.trim()) { toast.error("Informe seu nome."); return; }
    if (!profileForm.phone.trim()) { toast.error("Informe seu telefone."); return; }
    updateProfile.mutate({
      name: profileForm.name,
      email: profileForm.email || undefined,
      phone: profileForm.phone,
      document: profileForm.document || undefined,
      address: profileForm.address || undefined,
      addressNumber: profileForm.addressNumber || undefined,
      addressReference: profileForm.addressReference || undefined,
      neighborhood: profileForm.neighborhood || undefined,
      city: profileForm.city || undefined,
      state: profileForm.state || undefined,
      zipCode: profileForm.zipCode || undefined,
    });
  };

  // tenantId para passar como fallback quando não há resolução por host (modo preview/dev)
  const tenantIdInput = tenant?.id ? { tenantId: tenant.id } : undefined;

  // ── Queries de dados do cliente ────────────────────────────────────────────
  // Habilitadas se o cliente estiver autenticado (OAuth ou local) e o tenant estiver disponível
  const queriesEnabled = isAuthenticated && !!tenant;

  const { data: myOrdersData, isLoading: ordersLoading } = trpc.serviceOrders.myOrders.useQuery(
    tenantIdInput ?? {},
    { enabled: queriesEnabled }
  );
  const myOrders = Array.isArray(myOrdersData) ? [] : (myOrdersData?.orders ?? []);

  // Toast de vinculação lazy — exibido apenas uma vez quando histórico é vinculado automaticamente
  const lazyToastShown = useRef(false);
  useEffect(() => {
    const count = Array.isArray(myOrdersData) ? 0 : (myOrdersData?.lazyLinkedCount ?? 0);
    if (!lazyToastShown.current && count > 0) {
      lazyToastShown.current = true;
      toast.success("Histórico vinculado com sucesso!", {
        description: "Suas ordens de serviço anteriores foram conectadas à sua conta.",
        duration: 5000,
      });
    }
  }, [myOrdersData]);

  const { data: myDevices, isLoading: devicesLoading } = trpc.customers.myDevices.useQuery(
    tenantIdInput ?? {},
    { enabled: queriesEnabled }
  );

  const { data: myPickups, isLoading: pickupsLoading } = trpc.pickups.myPickupsCustomer.useQuery(
    tenantIdInput ?? {},
    { enabled: queriesEnabled }
  );

  // Redireciona para painel se for funcionário/admin do tenant (apenas para usuários OAuth)
  useEffect(() => {
    if (!oauthLoading && user) {
      const staffRoles = ["super_admin", "tenant_admin", "atendente", "tecnico", "entregador", "admin"];
      if (staffRoles.includes(user.role)) {
        tenantNavigate("/painel/dashboard");
      }
    }
  }, [oauthLoading, user, tenantNavigate]);

  // Enquanto carrega, mostra skeleton
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  // Se não autenticado, o CustomerGuard já redireciona — mas por segurança:
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  const activeOrders = myOrders.filter((order) => !["entregue", "finalizado", "encerrado_sem_reparo", "encerrado_condenado", "cancelado", "delivered", "cancelled"].includes(String(order.status)));
  const priorityOrder = activeOrders.find((order) => ["aguardando_aprovacao", "pronto", "aguardando_entrega", "saiu_para_entrega"].includes(String(order.status))) ?? activeOrders[0] ?? myOrders[0];
  const priorityStep = getNextStep(priorityOrder?.status);
  const pendingApprovalCount = myOrders.filter((order) => String(order.status) === "aguardando_aprovacao").length;
  const readyCount = myOrders.filter((order) => ["pronto", "aguardando_entrega", "saiu_para_entrega"].includes(String(order.status))).length;
  const finishedCount = myOrders.filter((order) => ["entregue", "finalizado", "encerrado_sem_reparo", "encerrado_condenado", "delivered"].includes(String(order.status))).length;

  const initials = tenant?.name
    ?.split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "FR";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header com branding do tenant */}
      <header className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-3">
          {/* Logo/iniciais */}
          <button
            onClick={() => tenantNavigate("/")}
            className="h-9 w-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-white/20 hover:opacity-80 transition-opacity"
          >
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs font-bold" style={{ color: contrastColor }}>{initials}</span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => tenantNavigate("/")}
              className="font-display text-sm font-bold truncate hover:opacity-90 transition-opacity block text-left"
              style={{ color: contrastColor }}
            >
              {tenant?.name ?? "Portal"}
            </button>
            <p className="text-xs" style={{ color: contrastColor, opacity: 0.75 }}>Minha Conta</p>
          </div>
          {/* Botão sair */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/20 shrink-0"
            style={{ color: contrastColor, opacity: 0.85 }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6 space-y-5">
        <Card className={`border ${priorityStep.tone}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-75">Próximo passo</p>
                <h2 className="mt-1 text-base font-bold">{priorityStep.title}</h2>
                <p className="mt-1 text-sm opacity-85">{priorityStep.description}</p>
              </div>
              <AlertTriangle className="h-5 w-5 shrink-0 opacity-70" />
            </div>
            {priorityOrder ? (
              <Button className="w-full justify-between" variant="outline" onClick={() => setSelectedOsId(priorityOrder.id)}>
                <span>{priorityStep.action} • OS #{priorityOrder.osNumber}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <p className="rounded-lg bg-white/60 p-3 text-sm">Nenhuma OS encontrada para acompanhamento no momento.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{pendingApprovalCount}</p><p className="text-[11px] text-muted-foreground">Orçamentos</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{readyCount}</p><p className="text-[11px] text-muted-foreground">Prontos</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{finishedCount}</p><p className="text-[11px] text-muted-foreground">Histórico</p></CardContent></Card>
        </div>
        {/* Perfil do usuário */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-base overflow-hidden"
              style={{ backgroundColor: primaryColor }}
            >
              {displayAvatarUrl ? (
                <img src={displayAvatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <User className="h-5 w-5" style={{ color: contrastColor }} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">{displayName}</p>
              {displayEmail && (
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Abas: OS | Aparelhos | Coletas | Perfil */}
        <Tabs defaultValue="os">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="os" className="flex items-center gap-1 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ordens</span>
              {myOrders.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 ml-0.5">{myOrders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="aparelhos" className="flex items-center gap-1 text-xs">
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Aparelhos</span>
              {myDevices && myDevices.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 ml-0.5">{myDevices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="coletas" className="flex items-center gap-1 text-xs">
              <Truck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Coletas</span>
              {myPickups && myPickups.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 ml-0.5">{myPickups.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="perfil" className="flex items-center gap-1 text-xs">
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Aba OS ─────────────────────────────────────────────────────── */}
          <TabsContent value="os" className="mt-4 space-y-3">
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : myOrders.length === 0 ? (
              <Card>
                <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <ClipboardList className="h-7 w-7" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Nenhuma OS encontrada</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Quando você solicitar um reparo, suas ordens de serviço aparecerão aqui.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-2">
                    <Button variant="outline" className="gap-2" onClick={() => tenantNavigate("/rastrear")}>
                      <Search className="h-4 w-4" /> Rastrear OS
                    </Button>
                    <Button className="gap-2" style={{ backgroundColor: primaryColor, color: contrastColor }} onClick={() => tenantNavigate("/coleta")}>
                      <Truck className="h-4 w-4" /> Solicitar coleta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              myOrders.map((os: typeof myOrders[0]) => {
                const statusInfo = STATUS_LABELS[os.status] ?? STATUS_LABELS["pending"]!;
                const StatusIcon = statusInfo.icon;
                const needsAction = os.status === "aguardando_aprovacao";
                const nextAction = os.nextBestAction ?? getNextStep(os.status);
                const actionPriority = os.nextBestAction?.priority ?? (needsAction ? "alta" : "normal");
                const isSlaAttention = Boolean(os.sla?.isOverdue || os.sla?.isStageStalled);
                return (
                  <Card
                    key={os.id}
                    className={`cursor-pointer transition-all duration-200 active:scale-[0.99] ${
                      needsAction || isSlaAttention
                        ? "hover:shadow-orange-200 hover:shadow-md ring-2 ring-orange-400 ring-offset-1"
                        : "hover:shadow-md"
                    }`}
                    onClick={() => setSelectedOsId(os.id)}
                  >
                    <CardContent className="p-4 flex items-start gap-4">
                      {/* Ícone do aparelho com ponto pulsante quando há ação crítica */}
                      <div className="relative shrink-0 pt-0.5">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: needsAction || isSlaAttention ? "#fff7ed" : `${primaryColor}15` }}
                        >
                          <Wrench className="h-5 w-5" style={{ color: needsAction || isSlaAttention ? "#f97316" : primaryColor }} />
                        </div>
                        {(needsAction || isSlaAttention) && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-500" />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              OS #{os.osNumber ?? os.id} — {os.deviceBrand ?? ""} {os.deviceModel ?? ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {os.reportedDefect ?? "Sem descrição"}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                            needsAction ? "bg-orange-100 text-orange-700 border-orange-300" : statusInfo.color
                          }`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </span>
                        </div>

                        <div className={`rounded-xl border p-3 ${getActionPriorityTone(actionPriority)}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide">
                              {getActionPriorityLabel(actionPriority)}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getSlaTone(os.sla)}`}>
                              <Clock className="h-3 w-3" />
                              {getSlaLabel(os.sla)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-semibold">{nextAction.title}</p>
                          <p className="mt-0.5 text-xs opacity-80 line-clamp-2">{nextAction.description}</p>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold">
                            {os.nextBestAction?.ctaLabel ?? getNextStep(os.status).action}
                            <ArrowRight className="h-3 w-3" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ── Aba Aparelhos ───────────────────────────────────────────────── */}
          <TabsContent value="aparelhos" className="mt-4 space-y-3">
            {devicesLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : !myDevices || myDevices.length === 0 ? (
              <Card>
                <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <Smartphone className="h-7 w-7" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Nenhum aparelho cadastrado</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seus aparelhos registrados nesta assistência aparecerão aqui.
                    </p>
                  </div>
                  <Button className="gap-2 mt-2" style={{ backgroundColor: primaryColor, color: contrastColor }} onClick={() => tenantNavigate("/coleta")}>
                    <Truck className="h-4 w-4" /> Solicitar atendimento
                  </Button>
                </CardContent>
              </Card>
            ) : (
              myDevices.map((device) => (
                <Card key={device.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <Smartphone className="h-5 w-5" style={{ color: primaryColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {device.brand} {device.model}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {device.type && (
                          <span className="text-xs text-muted-foreground">{device.type}</span>
                        )}
                        {device.color && (
                          <span className="text-xs text-muted-foreground">{device.color}</span>
                        )}
                        {device.imei && (
                          <span className="text-xs text-muted-foreground font-mono">IMEI: {device.imei}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── Aba Coletas ─────────────────────────────────────────────────── */}
          <TabsContent value="coletas" className="mt-4 space-y-3">
            {pickupsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : !myPickups || myPickups.length === 0 ? (
              <Card>
                <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <Truck className="h-7 w-7" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Nenhuma coleta encontrada</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Suas solicitações de coleta e entrega aparecerão aqui.
                    </p>
                  </div>
                  <Button className="gap-2 mt-2" style={{ backgroundColor: primaryColor, color: contrastColor }} onClick={() => tenantNavigate("/coleta")}>
                    <Truck className="h-4 w-4" /> Solicitar coleta
                  </Button>
                </CardContent>
              </Card>
            ) : (
              myPickups.map((pickup) => {
                const statusInfo = PICKUP_STATUS_LABELS[pickup.status] ?? PICKUP_STATUS_LABELS["pending"]!;
                return (
                  <Card key={pickup.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          pickup.type === "coleta" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        <Truck className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {pickup.type === "coleta" ? "Coleta" : "Entrega"} — OS #{pickup.serviceOrderId}
                        </p>
                        {pickup.address && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {pickup.address}
                          </p>
                        )}
                        {pickup.scheduledAt && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {new Date(pickup.scheduledAt).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ── Aba Perfil ──────────────────────────────────────────────────── */}
          <TabsContent value="perfil" className="mt-4 space-y-4">
            {tenant?.id && <PushNotificationButton target="customer" tenantId={tenant.id} variant="banner" />}
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Dados Pessoais</h3>
                  {!editingProfile ? (
                    <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingProfile(false); }} className="gap-1.5">
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveProfile} disabled={updateProfile.isPending}
                        style={{ backgroundColor: primaryColor, color: contrastColor }} className="gap-1.5">
                        {updateProfile.isPending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: contrastColor }} /> : <Save className="h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Nome e Telefone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome completo *</Label>
                    <Input value={profileForm.name} disabled={!editingProfile}
                      onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                      className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone / WhatsApp *</Label>
                    <Input value={profileForm.phone} disabled={!editingProfile}
                      onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="(11) 99999-9999" className="h-9 text-sm" />
                  </div>
                </div>

                {/* E-mail e CPF */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail</Label>
                    <Input value={profileForm.email} disabled={!editingProfile} type="email"
                      onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CPF</Label>
                    <Input value={profileForm.document} disabled={!editingProfile}
                      onChange={(e) => setProfileForm((f) => ({ ...f, document: e.target.value }))}
                      placeholder="000.000.000-00" className="h-9 text-sm" />
                  </div>
                </div>

                {/* Endereço */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Endereço de coleta
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">CEP</Label>
                        <Input value={profileForm.zipCode} disabled={!editingProfile}
                          onChange={(e) => setProfileForm((f) => ({ ...f, zipCode: formatCep(e.target.value) }))}
                          onBlur={(e) => editingProfile && handleCepBlur(e.target.value)}
                          placeholder="00000-000" className="h-9 text-sm" />
                        {cepLoading && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Número</Label>
                        <Input value={profileForm.addressNumber} disabled={!editingProfile}
                          onChange={(e) => setProfileForm((f) => ({ ...f, addressNumber: e.target.value }))}
                          placeholder="123" className="h-9 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rua / Logradouro</Label>
                      <Input value={profileForm.address} disabled={!editingProfile}
                        onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))}
                        className="h-9 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bairro</Label>
                        <Input value={profileForm.neighborhood} disabled={!editingProfile}
                          onChange={(e) => setProfileForm((f) => ({ ...f, neighborhood: e.target.value }))}
                          className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cidade</Label>
                        <Input value={profileForm.city} disabled={!editingProfile}
                          onChange={(e) => setProfileForm((f) => ({ ...f, city: e.target.value }))}
                          className="h-9 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estado (UF)</Label>
                      <Input value={profileForm.state} disabled={!editingProfile}
                        maxLength={2}
                        onChange={(e) => setProfileForm((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
                        placeholder="SP" className="h-9 text-sm uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ponto de referência</Label>
                      <Input value={profileForm.addressReference} disabled={!editingProfile}
                        onChange={(e) => setProfileForm((f) => ({ ...f, addressReference: e.target.value }))}
                        placeholder="Ex: próximo ao mercado" className="h-9 text-sm" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Voltar ao portal */}
        <button
          onClick={() => tenantNavigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao portal
        </button>
      </main>

      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border">
        {tenant?.name} · Powered by{" "}
        <a href="/" className="font-semibold text-foreground hover:underline">fullreparo</a>
      </footer>

      <WhatsAppFAB whatsappNumber={tenant?.whatsappNumber} tenantName={tenant?.name ?? ""} />

      {/* Drawer de detalhe da OS */}
      <OsDetailSheet
        osId={selectedOsId}
        tenantId={tenant?.id}
        primaryColor={primaryColor}
        onClose={() => setSelectedOsId(null)}
      />
    </div>
  );
}
