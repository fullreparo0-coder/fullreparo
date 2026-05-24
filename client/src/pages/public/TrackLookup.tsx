import { useState } from "react";
import { useTenantNav } from "@/hooks/useTenantNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { TenantPublicHeader } from "./Coleta";
import { Search, Wrench, ArrowRight, ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen bg-background flex flex-col">
      {isHostTenant && hostTenant ? (
        <TenantPublicHeader tenant={hostTenant} subtitle="Rastrear OS" />
      ) : (
        <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <a href="/" className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity" aria-label="Voltar para a home do FullReparo">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
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

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-10 space-y-6">
        <div className="text-center">
          <Search className="h-14 w-14 text-primary mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Rastrear Minha OS</h1>
          <p className="text-muted-foreground text-sm">
            Digite o número da OS ou o código de rastreamento que você recebeu.
          </p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: OS-2024-001 ou código de rastreamento"
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                autoFocus
              />
              <Button
                onClick={handleSearch}
                disabled={!query.trim() || lookupToken.isFetching}
              >
                {lookupToken.isFetching ? (
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O número da OS foi enviado por SMS/WhatsApp quando seu aparelho foi registrado.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Botão flutuante WhatsApp */}
      <WhatsAppFAB whatsappNumber={hostTenant?.whatsappNumber} tenantName={hostTenant?.name} />
    </div>
  );
}
