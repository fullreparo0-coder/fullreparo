import { OSTimeline } from "@/components/OSTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { useTenantNav } from "@/hooks/useTenantNav";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  Info,
  MessageCircle,
  Shield,
  Smartphone,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { TenantPublicHeader } from "./Coleta";

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

function formatDate(value?: string | Date | null) {
  if (!value) return "Não informada";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "cliente";
}

function getStatusStep(status: string) {
  const steps = [
    ["solicitado", "aguardando_coleta", "coleta_agendada", "coletado", "recebido_na_assistencia"],
    ["em_diagnostico"],
    ["aguardando_aprovacao", "aprovado", "recusado"],
    ["aguardando_peca", "em_reparo", "pronto"],
    ["aguardando_entrega", "saiu_para_entrega", "entregue", "finalizado", "encerrado_sem_reparo", "encerrado_condenado", "cancelado"],
  ];
  const index = steps.findIndex((group) => group.includes(status));
  return index >= 0 ? index : 0;
}

function getNextStepMessage(status: string, hasPendingBudget: boolean) {
  if (hasPendingBudget || status === "aguardando_aprovacao") {
    return {
      title: "Ação necessária: orçamento aguardando sua resposta",
      description: "Confira o valor e decida se deseja aprovar ou recusar o serviço. A assistência será notificada automaticamente.",
    };
  }

  const messages: Record<string, { title: string; description: string }> = {
    solicitado: {
      title: "Solicitação recebida",
      description: "A assistência já recebeu sua solicitação e seguirá com a organização da coleta ou atendimento.",
    },
    aguardando_coleta: {
      title: "Aguardando coleta",
      description: "Seu aparelho ainda será coletado. Fique atento ao contato da assistência para confirmar o melhor horário.",
    },
    coleta_agendada: {
      title: "Coleta agendada",
      description: "A coleta já foi programada. Após o recebimento, a equipe fará a conferência e o diagnóstico.",
    },
    coletado: {
      title: "Equipamento coletado",
      description: "Seu aparelho foi coletado e seguirá para conferência na assistência.",
    },
    recebido_na_assistencia: {
      title: "Recebido na assistência",
      description: "O equipamento já está com a equipe técnica. O próximo passo é a análise inicial.",
    },
    em_diagnostico: {
      title: "Em diagnóstico técnico",
      description: "A equipe está avaliando o defeito informado para definir orçamento, prazo e necessidade de peças.",
    },
    aprovado: {
      title: "Orçamento aprovado",
      description: "O reparo foi autorizado e seguirá para execução conforme disponibilidade técnica e de peças.",
    },
    aguardando_peca: {
      title: "Aguardando peça",
      description: "A assistência está aguardando a peça necessária para continuar o reparo.",
    },
    em_reparo: {
      title: "Reparo em andamento",
      description: "O serviço está sendo executado pela equipe técnica. Você verá novas atualizações neste acompanhamento.",
    },
    pronto: {
      title: "Equipamento pronto",
      description: "Seu aparelho está pronto. Entre em contato com a assistência para combinar retirada ou entrega.",
    },
    aguardando_entrega: {
      title: "Aguardando entrega",
      description: "O equipamento está pronto para ser entregue ao cliente.",
    },
    saiu_para_entrega: {
      title: "Saiu para entrega",
      description: "Seu equipamento está em rota de entrega. Acompanhe as próximas atualizações.",
    },
    entregue: {
      title: "Equipamento entregue",
      description: "O atendimento foi concluído. Caso exista garantia digital, ela aparecerá nesta página.",
    },
    finalizado: {
      title: "Atendimento finalizado",
      description: "O atendimento foi concluído com reparo entregue ao cliente.",
    },
    recusado: {
      title: "Orçamento recusado",
      description: "O orçamento foi recusado. A assistência poderá orientar os próximos passos sobre retirada ou devolução.",
    },
    encerrado_sem_reparo: {
      title: "Encerrado sem reparo",
      description: "A OS foi encerrada sem execução de reparo. Consulte a assistência se precisar de mais detalhes.",
    },
    encerrado_condenado: {
      title: "Equipamento condenado",
      description: "A análise indicou inviabilidade de reparo. A assistência poderá orientar as alternativas disponíveis.",
    },
    cancelado: {
      title: "Atendimento cancelado",
      description: "Esta ordem de serviço foi cancelada. Em caso de dúvida, fale com a assistência.",
    },
  };

  return messages[status] ?? {
    title: "Acompanhamento atualizado",
    description: "Consulte o histórico abaixo para ver as movimentações registradas pela assistência.",
  };
}

function ProgressOverview({ status, primaryColor }: { status: string; primaryColor: string }) {
  const currentStep = getStatusStep(status);
  const steps = ["Recebido", "Diagnóstico", "Orçamento", "Reparo", "Entrega"];

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progresso da OS</p>
            <p className="text-sm text-muted-foreground">Etapa atual do atendimento</p>
          </div>
          <StatusBadge status={status} size="sm" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {steps.map((step, index) => {
            const isDone = index < currentStep;
            const isCurrent = index === currentStep;
            return (
              <div key={step} className="flex flex-col items-center gap-2 text-center">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold"
                  style={
                    isDone || isCurrent
                      ? { backgroundColor: primaryColor, borderColor: primaryColor, color: getContrastColor(primaryColor) }
                      : undefined
                  }
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span className={`text-[11px] leading-tight ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicTrack() {
  const [, params] = useRoute("/rastrear/:token");
  const token = params?.token ?? "";
  const { tenant: hostTenant, isHostTenant } = useTenantHost();
  const { tenantPath } = useTenantNav();

  const { data: os, isLoading, error } = trpc.public.trackOs.useQuery(
    { token, tenantSlug: hostTenant?.slug },
    { enabled: !!token && token !== "demo" }
  );

  const approveBudget = trpc.budgets.respond.useMutation({
    onSuccess: () => window.location.reload(),
  });

  if (token === "demo") {
    return <DemoPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !os) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border/70 shadow-sm">
          <CardContent className="p-8 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">OS não encontrada</h1>
            <p className="text-muted-foreground text-sm">Verifique o link ou entre em contato com a assistência.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Branding: prioriza host tenant (subdomínio), depois branding da OS, depois padrão
  const branding = isHostTenant && hostTenant
    ? {
        name: hostTenant.name,
        logoUrl: hostTenant.logoUrl ?? null,
        primaryColor: hostTenant.primaryColor ?? "#1e3a5f",
        whatsappNumber: hostTenant.whatsappNumber ?? null,
      }
    : os.tenantBranding ?? { name: "fullreparo", logoUrl: null, primaryColor: "#1e3a5f", whatsappNumber: null };

  const primaryColor = branding.primaryColor;
  const contrastColor = getContrastColor(primaryColor);
  const cleanWhatsappNumber = branding.whatsappNumber?.replace(/\D/g, "") ?? "";
  const whatsappUrl = cleanWhatsappNumber
    ? `https://wa.me/55${cleanWhatsappNumber}?text=${encodeURIComponent(`Olá! Gostaria de informações sobre a OS ${os.osNumber}.`)}`
    : null;

  const brandingTenant = {
    name: branding.name,
    logoUrl: branding.logoUrl,
    primaryColor,
  };
  const nextStep = getNextStepMessage(os.status, !!os.pendingBudget);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-background to-background">
      <TenantPublicHeader tenant={brandingTenant} subtitle="Acompanhamento da OS" />

      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:py-8 space-y-4 pb-24">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="h-1.5" style={{ backgroundColor: primaryColor }} />
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">Olá, {getFirstName(os.customerName)}.</p>
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Acompanhe sua OS
                </h1>
                <p className="text-sm text-muted-foreground">
                  Ordem de Serviço <span className="font-mono font-semibold text-foreground">{os.osNumber}</span>
                </p>
              </div>
              <StatusBadge status={os.status} size="lg" className="w-fit" />
            </div>

            <div className="rounded-2xl bg-muted/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" /> Defeito informado
              </div>
              <p className="text-sm font-medium leading-relaxed text-foreground">{os.reportedDefect || "Não informado"}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <CalendarDays className="mb-2 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Abertura</p>
                <p className="text-sm font-semibold text-foreground">{formatDate(os.createdAt)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <Clock className="mb-2 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Previsão</p>
                <p className="text-sm font-semibold text-foreground">{formatDate(os.estimatedDelivery)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <User className="mb-2 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="truncate text-sm font-semibold text-foreground">{os.customerName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProgressOverview status={os.status} primaryColor={primaryColor} />

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{nextStep.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{nextStep.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {os.pendingBudget && (
          <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                <DollarSign className="h-5 w-5" /> Orçamento aguardando aprovação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-background/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor total do serviço</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                      {formatMoney(os.pendingBudget.totalCost)}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>
                </div>
                {os.pendingBudget.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{os.pendingBudget.description}</p>
                )}
                {os.pendingBudget.validUntil && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Válido até {formatDate(os.pendingBudget.validUntil)}
                  </p>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="h-11 w-full"
                  style={{ backgroundColor: primaryColor, color: contrastColor, borderColor: primaryColor }}
                  onClick={() =>
                    approveBudget.mutate({
                      budgetId: os.pendingBudget!.id,
                      publicToken: token,
                      action: "approve",
                    })
                  }
                  disabled={approveBudget.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Aprovar orçamento
                </Button>
                <Button
                  variant="outline"
                  className="h-11 w-full border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() =>
                    approveBudget.mutate({
                      budgetId: os.pendingBudget!.id,
                      publicToken: token,
                      action: "reject",
                    })
                  }
                  disabled={approveBudget.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1.5" /> Recusar orçamento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {os.warranty && (() => {
          const now = Date.now();
          const start = new Date(os.warranty.startsAt).getTime();
          const end = new Date(os.warranty.expiresAt).getTime();
          const totalMs = end - start;
          const elapsedMs = Math.min(now - start, totalMs);
          const progressPct = totalMs > 0 ? Math.round((elapsedMs / totalMs) * 100) : 100;
          const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
          const isActive = os.warranty.isActive && now < end;
          const warrantyDays = os.warranty.warrantyDays ?? 0;

          return (
            <Card className={isActive ? "border-emerald-300 bg-emerald-50/60 shadow-sm" : "border-muted bg-muted/30 shadow-sm"}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isActive ? "bg-emerald-100" : "bg-muted"}`}>
                      <Shield className={`h-6 w-6 ${isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${isActive ? "text-emerald-800" : "text-muted-foreground"}`}>
                        {isActive ? "Garantia Digital Ativa" : "Garantia Expirada"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{os.warranty.warrantyCode}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {isActive ? `${daysLeft}d restantes` : "Expirada"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-background/70 rounded-lg p-2.5">
                    <p className="text-muted-foreground mb-0.5">Prazo total</p>
                    <p className="font-semibold text-foreground">{warrantyDays > 0 ? `${warrantyDays} dias` : "Sem garantia"}</p>
                  </div>
                  <div className="bg-background/70 rounded-lg p-2.5">
                    <p className="text-muted-foreground mb-0.5">Válida até</p>
                    <p className="font-semibold text-foreground">{formatDate(os.warranty.expiresAt)}</p>
                  </div>
                </div>

                {warrantyDays > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Início: {formatDate(os.warranty.startsAt)}</span>
                      <span>{progressPct}% consumido</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <a
                  href={tenantPath(`/garantia?codigo=${encodeURIComponent(os.warranty.warrantyCode)}`)}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold ${
                    isActive
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Verificar Garantia
                </a>
              </CardContent>
            </Card>
          );
        })()}

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" /> Acompanhamento da OS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {os.timeline && os.timeline.length > 0 ? (
              <OSTimeline entries={os.timeline} />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
            )}
          </CardContent>
        </Card>

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold shadow-sm"
            style={{ backgroundColor: primaryColor, color: contrastColor }}
          >
            <MessageCircle className="h-4 w-4" />
            Falar com a assistência sobre esta OS
          </a>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-muted-foreground">
        {branding.name !== "fullreparo" ? (
          <>
            {branding.name} · Powered by <span className="font-semibold text-foreground">fullreparo</span>
          </>
        ) : (
          <>Powered by <span className="font-semibold text-foreground">fullreparo</span></>
        )}
      </footer>

      <WhatsAppFAB
        whatsappNumber={branding.whatsappNumber}
        tenantName={branding.name}
        message={`Olá, ${branding.name}! Gostaria de informações sobre a minha OS ${os.osNumber}.`}
      />
    </div>
  );
}

function DemoPage() {
  const demoTimeline = [
    {
      status: "recebido_na_assistencia",
      notes: "OS aberta no balcão",
      changedByName: "Atendente",
      createdAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      status: "em_diagnostico",
      notes: "Aparelho em diagnóstico técnico",
      changedByName: "Técnico",
      createdAt: new Date(Date.now() - 86400000),
    },
    {
      status: "aguardando_aprovacao",
      notes: "Orçamento enviado: R$ 280,00",
      changedByName: "Técnico",
      createdAt: new Date(Date.now() - 3600000),
    },
  ];

  const demoColor = "#1e3a5f";
  const demoContrast = getContrastColor(demoColor);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-background to-background">
      <TenantPublicHeader
        tenant={{ name: "fullreparo", logoUrl: null, primaryColor: demoColor }}
        subtitle="Demonstração"
      />
      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:py-8 space-y-4 pb-24">
        <Badge variant="secondary" className="w-fit text-xs">Modo Demo</Badge>
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="h-1.5" style={{ backgroundColor: demoColor }} />
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Olá, cliente.</p>
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Acompanhe sua OS</h1>
                <p className="text-sm text-muted-foreground">Ordem de Serviço <span className="font-mono font-semibold text-foreground">OS-2024-001</span></p>
              </div>
              <StatusBadge status="aguardando_aprovacao" size="lg" className="w-fit" />
            </div>
            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Defeito informado</p>
              <p className="text-sm font-medium text-foreground">Tela quebrada e bateria com problema</p>
            </div>
          </CardContent>
        </Card>
        <ProgressOverview status="aguardando_aprovacao" primaryColor={demoColor} />
        <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <p className="text-base font-semibold text-amber-900">Orçamento aguardando aprovação</p>
            <p className="text-3xl font-bold text-foreground">R$ 280,00</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className="h-11 w-full"
                style={{ backgroundColor: demoColor, color: demoContrast }}
                onClick={() => alert("Em produção, aprovaria o orçamento!")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Aprovar orçamento
              </Button>
              <Button variant="outline" className="h-11 w-full border-red-200 text-red-700">
                <XCircle className="h-4 w-4 mr-1.5" /> Recusar orçamento
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" /> Acompanhamento da OS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OSTimeline entries={demoTimeline} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
