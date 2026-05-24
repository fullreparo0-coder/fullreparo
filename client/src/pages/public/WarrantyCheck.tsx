import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Shield, CheckCircle2, XCircle, Search, MessageCircle } from "lucide-react";
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

export default function WarrantyCheck() {
  // Pré-preencher e buscar automaticamente se ?codigo= estiver na URL
  const initialCode = (() => {
    try {
      return new URLSearchParams(window.location.search).get("codigo") ?? "";
    } catch {
      return "";
    }
  })();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [searchCode, setSearchCode] = useState(initialCode.toUpperCase());
  const { tenant: hostTenant, isHostTenant } = useTenantHost();

  const { data: warranty, isLoading, error } = trpc.warranties.checkByCode.useQuery(
    { code: searchCode },
    { enabled: !!searchCode }
  );

  const handleSearch = () => {
    setSearchCode(code.trim().toUpperCase());
  };

  // Branding: prioriza host tenant (subdomínio), depois branding da garantia, depois padrão
  const branding = isHostTenant && hostTenant
    ? {
        name: hostTenant.name,
        logoUrl: hostTenant.logoUrl ?? null,
        primaryColor: hostTenant.primaryColor ?? "#1e3a5f",
        whatsappNumber: hostTenant.whatsappNumber ?? null,
      }
    : warranty?.tenantBranding ?? { name: "fullreparo", logoUrl: null, primaryColor: "#1e3a5f", whatsappNumber: null };

  const primaryColor = branding.primaryColor;
  const contrastColor = getContrastColor(primaryColor);
  const cleanWhatsappNumber = branding.whatsappNumber?.replace(/\D/g, "") ?? "";
  const whatsappUrl = cleanWhatsappNumber && warranty
    ? `https://wa.me/55${cleanWhatsappNumber}?text=${encodeURIComponent(`Olá! Gostaria de informações sobre a garantia ${warranty.warrantyCode}.`)}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <TenantPublicHeader
        tenant={{ name: branding.name, logoUrl: branding.logoUrl, primaryColor }}
        subtitle="Verificar Garantia"
      />

      <main className="max-w-xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
            style={{ backgroundColor: `${primaryColor}1a` }}
          >
            <Shield className="h-7 w-7" style={{ color: primaryColor }} />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Verificar Garantia Digital</h1>
          <p className="text-muted-foreground text-sm">
            Digite o código de garantia que consta no comprovante da sua OS.
          </p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: GAR-OS-2024-001-ABC123"
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button
                onClick={handleSearch}
                disabled={!code || isLoading}
                style={{ backgroundColor: primaryColor, color: contrastColor, borderColor: primaryColor }}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div
              className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: primaryColor, borderTopColor: "transparent" }}
            />
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-5 flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500 shrink-0" />
              <div>
                <p className="font-semibold text-red-800">Garantia não encontrada</p>
                <p className="text-sm text-red-700">Verifique o código e tente novamente.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {warranty && (
          <>
            <Card className={warranty.isValid ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}>
              <CardHeader className="pb-3">
                <CardTitle
                  className={`text-base flex items-center gap-2 ${warranty.isValid ? "text-emerald-800" : "text-red-800"}`}
                >
                  {warranty.isValid ? (
                    <><CheckCircle2 className="h-5 w-5" /> Garantia Válida</>
                  ) : (
                    <><XCircle className="h-5 w-5" /> Garantia Expirada</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-white/70 rounded-lg p-3 font-mono text-sm font-semibold text-center">
                  {warranty.warrantyCode}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="font-medium">{new Date(warranty.startsAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="font-medium">{new Date(warranty.expiresAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Prazo</p>
                    <p className="font-medium">{warranty.warrantyDays} dias</p>
                  </div>
                </div>
                {warranty.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm">{warranty.description}</p>
                  </div>
                )}
                {warranty.conditions && (
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Condições</p>
                    <p className="text-xs text-foreground/80">{warranty.conditions}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Botão WhatsApp com cor primária */}
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
          </>
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

      {/* Botão flutuante WhatsApp */}
      <WhatsAppFAB whatsappNumber={branding.whatsappNumber} tenantName={branding.name} />
    </div>
  );
}
