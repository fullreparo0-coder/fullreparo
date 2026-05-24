import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTenantNav } from "@/hooks/useTenantNav";
import { ArrowLeft, KeyRound, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useTenantHost } from "@/contexts/TenantHostContext";

export default function ForgotPassword() {
  const { tenant } = useTenantHost();
  const [, navigate] = useLocation();
  const { tenantPath } = useTenantNav();
  const [credential, setCredential] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  const resetMutation = trpc.customerAuth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setWhatsappUrl(data.whatsappUrl ?? null);
    },
  });

  const primaryColor = tenant?.primaryColor ?? "#1e3a5f";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential.trim() || !tenant?.id) return;
    resetMutation.mutate({ credential: credential.trim(), tenantId: tenant.id });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4">
      {/* Header com branding do tenant */}
      <div className="w-full max-w-sm mb-6 text-center">
        {tenant?.logoUrl ? (
          <img
            src={tenant.logoUrl}
            alt={tenant.name}
            className="h-12 w-auto mx-auto mb-3 object-contain"
          />
        ) : (
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-xl"
            style={{ backgroundColor: primaryColor }}
          >
            {tenant?.name?.charAt(0)?.toUpperCase() ?? "A"}
          </div>
        )}
        <p className="text-sm text-muted-foreground font-medium">
          {tenant?.name ?? "Portal do Cliente"}
        </p>
      </div>

      <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-sm p-6">
        {!submitted ? (
          <>
            <div className="mb-5">
              <h1 className="text-lg font-semibold text-foreground">Esqueci minha senha</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Informe seu CPF, e-mail ou telefone cadastrado. Se encontrarmos seu cadastro,
                enviaremos uma nova senha pelo WhatsApp.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="credential" className="text-sm">
                  CPF, e-mail ou telefone
                </Label>
                <Input
                  id="credential"
                  type="text"
                  placeholder="Ex: 123.456.789-00 ou seu@email.com"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={resetMutation.isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full text-white"
                style={{ backgroundColor: primaryColor }}
                disabled={resetMutation.isPending || !credential.trim()}
              >
                {resetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Recuperar acesso
                  </>
                )}
              </Button>
            </form>
          </>
        ) : (
          /* Tela de sucesso — sempre genérica */
          <div className="text-center space-y-4 py-2">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Solicitação recebida</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Se encontrarmos um cadastro com as informações fornecidas, uma nova senha será
                enviada pelo WhatsApp.
              </p>
            </div>

            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Abrir WhatsApp com a nova senha
                </Button>
              </a>
            )}

            {!whatsappUrl && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Entre em contato com a assistência para receber sua nova senha caso não tenha
                telefone cadastrado.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-border text-center">
          <Link href={tenantPath("/entrar")}>
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para o login
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
