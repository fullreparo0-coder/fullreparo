import { useState } from "react";
import { useTenantNav } from "@/hooks/useTenantNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { TenantPublicHeader } from "./Coleta";
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle, Search, ShieldCheck, Wrench } from "lucide-react";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { toast } from "sonner";

/**
 * Página de busca de OS por número ou token público.
 * Acessível em /rastrear (sem token) — permite ao cliente digitar o número
 * da OS ou o token de rastreamento para ser redirecionado.
 */
export default function TrackLookup() {
  const { navigate } = useTenantNav();
  const [query, setQuery] = useState("");
  const { tenant: hostTenant, isHostTenant } = useTenantHost();

  const lookupToken = trpc.public.lookupOsToken.useQuery(
    { query: query.trim(), tenantSlug: hostTenant?.slug },
    { enabled: false }
  );

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;

    // Se parece um token UUID ou começa com "tok_", vai direto
    if (q.length > 20 && !q.includes("-OS-") && !q.toUpperCase().startsWith("OS-")) {
      navigate(`/rastrear/${q}`);
      return;
    }

    // Caso contrário, busca o token pelo número da OS
    const result = await lookupToken.refetch();
    if (result.data?.token) {
      navigate(`/rastrear/${result.data.token}`);
    } else {
      toast.error("OS não encontrada. Verifique o número e tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-background to-background flex flex-col">
      {isHostTenant && hostTenant ? (
        <TenantPublicHeader tenant={hostTenant} subtitle="Rastrear OS" />
      ) : (
        <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <a href="/" className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity" aria-label="Voltar para a home do FullReparo">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                <Wrench className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-foreground">fullreparo</p>
                <p className="text-xs text-muted-foreground">Rastrear OS</p>
              </div>
            </a>
            <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </a>
          </div>
        </header>
      )}

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 sm:py-10 space-y-5">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="h-1.5 bg-primary" />
          <CardContent className="p-5 sm:p-7 space-y-6">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Search className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Rastrear minha OS</h1>
                <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                  Consulte o status do seu aparelho, orçamento, histórico de movimentações e garantia digital em um só lugar.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground" htmlFor="track-query">
                Número da OS ou código de rastreamento
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="track-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex: OS-2026-001 ou código recebido"
                  className="h-12 font-mono text-base"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  autoFocus
                />
                <Button
                  onClick={handleSearch}
                  disabled={!query.trim() || lookupToken.isFetching}
                  className="h-12 px-5 sm:w-auto"
                >
                  {lookupToken.isFetching ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <>
                      Buscar OS <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                O número da OS ou o link de acompanhamento é enviado pela assistência após o registro do atendimento.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/70 bg-background/80 shadow-sm">
            <CardContent className="p-4">
              <Search className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Consulta rápida</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Veja a etapa atual do atendimento pelo celular.</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-background/80 shadow-sm">
            <CardContent className="p-4">
              <CheckCircle2 className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Orçamento digital</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Aprove ou recuse quando a assistência enviar valores.</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-background/80 shadow-sm">
            <CardContent className="p-4">
              <ShieldCheck className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Garantia segura</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Acompanhe sua garantia digital quando disponível.</p>
            </CardContent>
          </Card>
        </div>

        {hostTenant?.whatsappNumber && (
          <a
            href={`https://wa.me/55${hostTenant.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Preciso de ajuda para rastrear minha OS.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/80 px-4 py-3.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/60"
          >
            <MessageCircle className="h-4 w-4" />
            Preciso de ajuda para encontrar minha OS
          </a>
        )}
      </main>

      {/* Botão flutuante WhatsApp */}
      <WhatsAppFAB whatsappNumber={hostTenant?.whatsappNumber} tenantName={hostTenant?.name} />
    </div>
  );
}
