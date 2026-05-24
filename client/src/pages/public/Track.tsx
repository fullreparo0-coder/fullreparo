import { OSTimeline } from "@/components/OSTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { useTenantNav } from "@/hooks/useTenantNav";
import { Wrench, Shield, DollarSign, CheckCircle2, XCircle, Clock, MessageCircle } from "lucide-react";
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

export default function PublicTrack() {
  const [, params] = useRoute("/rastrear/:token");
  const token = params?.token ?? "";
  const { tenant: hostTenant, isHostTenant } = useTenantHost();
  const { tenantPath } = useTenantNav();

  const { data: os, isLoading, error } = trpc.public.trackOs.useQuery(
    { token },
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Wrench className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">OS não encontrada</h1>
          <p className="text-muted-foreground text-sm">Verifique o link ou entre em contato com a assistência.</p>
        </div>
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

  return (
    <div className="min-h-screen bg-background">
      <TenantPublicHeader tenant={brandingTenant} subtitle="Rastreamento de OS" />

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {/* OS Header */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ordem de Serviço</p>
                <h1 className="font-display text-2xl font-bold text-foreground">{os.osNumber}</h1>
              </div>
              <StatusBadge status={os.status} size="lg" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">{os.reportedDefect}</p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Aberta em {new Date(os.createdAt).toLocaleDateString("pt-BR")}
              </span>
              {os.estimatedDelivery && (
                <span className="flex items-center gap-1">
                  Previsão: {new Date(os.estimatedDelivery).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orçamento pendente */}
        {os.pendingBudget && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                <DollarSign className="h-4 w-4" /> Orçamento Aguardando Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor total</span>
                <span className="text-xl font-bold text-foreground">
                  R$ {Number(os.pendingBudget.totalCost).toFixed(2)}
                </span>
              </div>
              {os.pendingBudget.validUntil && (
                <p className="text-xs text-muted-foreground">
                  Válido até {new Date(os.pendingBudget.validUntil).toLocaleDateString("pt-BR")}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
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
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Aprovar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() =>
                    approveBudget.mutate({
                      budgetId: os.pendingBudget!.id,
                      publicToken: token,
                      action: "reject",
                    })
                  }
                  disabled={approveBudget.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1.5" /> Recusar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Garantia Digital — bloco destacado */}
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
            <Card className={isActive ? "border-emerald-300 bg-emerald-50/60" : "border-muted bg-muted/30"}>
              <CardContent className="p-5 space-y-4">
                {/* Cabeçalho */}
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

                {/* Detalhes */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-background/70 rounded-lg p-2.5">
                    <p className="text-muted-foreground mb-0.5">Prazo total</p>
                    <p className="font-semibold text-foreground">{warrantyDays > 0 ? `${warrantyDays} dias` : "Sem garantia"}</p>
                  </div>
                  <div className="bg-background/70 rounded-lg p-2.5">
                    <p className="text-muted-foreground mb-0.5">Válida até</p>
                    <p className="font-semibold text-foreground">{new Date(os.warranty.expiresAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>

                {/* Barra de progresso */}
                {warrantyDays > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Início: {new Date(os.warranty.startsAt).toLocaleDateString("pt-BR")}</span>
                      <span>{progressPct}% consumido</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Botão verificar */}
                <a
                  href={tenantPath(`/garantia?codigo=${encodeURIComponent(os.warranty.warrantyCode)}`)}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
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

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Histórico de Status</CardTitle>
          </CardHeader>
          <CardContent>
            {os.timeline && os.timeline.length > 0 ? (
              <OSTimeline entries={os.timeline} />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum registro ainda</p>
            )}
          </CardContent>
        </Card>

        {/* Contato via WhatsApp */}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor, color: contrastColor }}
          >
            <MessageCircle className="h-4 w-4" />
            Falar com a assistência no WhatsApp
          </a>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-muted-foreground">
        {branding.name !== "fullreparo" ? (
          <>
            {branding.name} · Powered by{" "}
            <span className="font-semibold text-foreground">fullreparo</span>
          </>
        ) : (
          <>Powered by <span className="font-semibold text-foreground">fullreparo</span></>
        )}
      </footer>

      {/* Botão flutuante WhatsApp — mensagem pré-preenchida com número da OS */}
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
    <div className="min-h-screen bg-background">
      <TenantPublicHeader
        tenant={{ name: "fullreparo", logoUrl: null, primaryColor: demoColor }}
        subtitle="Demonstração"
      />
      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <Badge variant="secondary" className="text-xs">Modo Demo</Badge>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ordem de Serviço</p>
                <h1 className="font-display text-2xl font-bold text-foreground">OS-2024-001</h1>
              </div>
              <StatusBadge status="aguardando_aprovacao" size="lg" />
            </div>
            <p className="text-sm text-muted-foreground">Tela quebrada e bateria com problema</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">Orçamento Aguardando Aprovação</p>
            <p className="text-2xl font-bold text-foreground mb-3">R$ 280,00</p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                style={{ backgroundColor: demoColor, color: demoContrast }}
                onClick={() => alert("Em produção, aprovaria o orçamento!")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Aprovar
              </Button>
              <Button variant="outline" className="flex-1 border-red-200 text-red-700">
                <XCircle className="h-4 w-4 mr-1.5" /> Recusar
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Histórico de Status</CardTitle>
          </CardHeader>
          <CardContent>
            <OSTimeline entries={demoTimeline} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
