/**
 * CustomerLogin — Login unificado para todos os perfis do FullReparo.
 *
 * Rota canônica: /login
 * Funciona para: cliente, atendente, técnico, entregador, tenant_admin
 * Separação por: role + tenant_id no JWT (backend)
 *
 * Após autenticar:
 *   - super_admin           → /superadmin
 *   - tenant_admin / staff  → /painel/dashboard
 *   - cliente / user        → /minha-conta
 *
 * Quando acessado via subdomínio (rochacell.fullreparo.com.br/login) ou
 * modo de teste (?tenant=rocha), exibe o branding da assistência.
 * Quando acessado sem tenant (fullreparo.com.br/login), exibe branding genérico.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useTenantNav } from "@/hooks/useTenantNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wrench, AlertCircle, ArrowLeft, KeyRound } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

const STAFF_ROLES = ["super_admin", "tenant_admin", "atendente", "tecnico", "entregador", "admin"];

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

export default function CustomerLogin() {
  const { tenant, loading: tenantLoading } = useTenantHost();
  const [, navigate] = useLocation();
  const { navigate: tenantNavigate, tenantPath } = useTenantNav();
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth();
  const search = useSearch();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const claimAttempted = useRef(false);

  // Extrai o claimToken da URL (?claim=TOKEN)
  const claimToken = new URLSearchParams(search).get("claim");

  const claimTenantMutation = trpc.tenants.claimTenant.useMutation({
    onSuccess: (data) => {
      setClaimStatus("done");
      toast.success(data.message);
      refreshAuth().then(() => {
        navigate("/painel/dashboard", { replace: true });
      });
    },
    onError: (err) => {
      setClaimStatus("error");
      setErrorMsg(err.message);
    },
  });

  // Quando há claimToken na URL e o usuário está autenticado: ativa automaticamente
  useEffect(() => {
    if (authLoading || !user || !claimToken) return;
    if (claimAttempted.current) return;
    claimAttempted.current = true;
    setClaimStatus("claiming");
    claimTenantMutation.mutate({ claimToken });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, claimToken]);

  // Redirecionamento automático se o usuário já está autenticado — sem claimToken
  useEffect(() => {
    if (authLoading || !user || claimToken) return;
    redirectByRole(user.role);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, claimToken]);

  function redirectByRole(role: string) {
    if (role === "super_admin") {
      navigate("/superadmin", { replace: true });
    } else if (STAFF_ROLES.includes(role)) {
      tenantNavigate("/painel/dashboard");
    } else {
      tenantNavigate("/minha-conta");
    }
  }

  const loginMutation = trpc.customerAuth.loginLocal.useMutation({
    onSuccess: (data) => {
      toast.success(`Bem-vindo, ${data.name}!`);
      if (data.passwordMustChange) {
        tenantNavigate("/trocar-senha");
      } else {
        redirectByRole(data.role ?? "user");
      }
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!tenant) {
      setErrorMsg("Assistência não identificada. Acesse pelo link da sua assistência técnica.");
      return;
    }

    loginMutation.mutate({
      tenantId: tenant.id,
      identifier: identifier.trim(),
      password,
    });
  };

  if (tenantLoading || authLoading || claimStatus === "claiming") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          {claimStatus === "claiming" && (
            <p className="text-sm text-muted-foreground">Ativando sua conta...</p>
          )}
        </div>
      </div>
    );
  }

  const primaryColor = tenant?.primaryColor ?? "#1e3a5f";
  const contrastColor = getContrastColor(primaryColor);
  const hasTenant = !!tenant;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header com branding do tenant (ou genérico quando sem tenant) */}
      <header
        className="px-6 py-4 shadow-sm"
        style={{ backgroundColor: primaryColor }}
      >
        <a href={hasTenant ? tenantPath("/") : "/"} className="inline-flex items-center gap-3 hover:opacity-90 transition-opacity">
          {hasTenant && tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded object-cover" />
          ) : (
            <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center">
              <Wrench className="h-4 w-4" style={{ color: contrastColor }} />
            </div>
          )}
          <span className="font-semibold text-lg" style={{ color: contrastColor }}>
            {hasTenant ? tenant!.name : "FullReparo"}
          </span>
        </a>
      </header>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900">
              {hasTenant ? "Área do Cliente" : "Entrar"}
            </CardTitle>
            <CardDescription className="text-gray-500">
              {hasTenant
                ? "Entre com seu CPF ou e-mail e a senha fornecida pela assistência"
                : "Acesse com suas credenciais"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              {!hasTenant && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Acesse pelo link da sua assistência técnica para fazer login como cliente.
                    <br />
                    <span className="text-xs text-muted-foreground">
                      Ex: rochacell.fullreparo.com.br/login
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="identifier">CPF ou E-mail</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="000.000.000-00 ou email@exemplo.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={!hasTenant}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {hasTenant && (
                    <Link href={tenantPath("/esqueci-senha")}>
                      <span className="text-xs text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer">
                        <KeyRound className="h-3 w-3" />
                        Esqueci minha senha
                      </span>
                    </Link>
                  )}
                </div>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Senha provisória ou sua senha"
                  disabled={!hasTenant}
                  autoComplete="current-password"
                />
                {hasTenant && (
                  <p className="text-xs text-gray-500">
                    Não tem senha? Solicite ao atendente da assistência técnica.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full font-semibold"
                style={{ backgroundColor: primaryColor, color: contrastColor }}
                disabled={loginMutation.isPending || !identifier || !password || !hasTenant}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            {/* Divisor */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400">ou</span>
              </div>
            </div>

            {/* Login com conta Manus — preserva tenant e claim no returnPath */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const params = new URLSearchParams();
                if (tenant?.slug) params.set("tenant", tenant.slug);
                if (claimToken) params.set("claim", claimToken);
                const qs = params.toString();
                const returnPath = qs ? `/login?${qs}` : "/login";
                window.location.href = getLoginUrl(returnPath);
              }}
            >
              Entrar com Google / e-mail (Manus)
            </Button>

            {/* Link para cadastro */}
            {hasTenant && (
              <p className="mt-4 text-center text-sm text-gray-500">
                Não tem conta?{" "}
                <Link href={tenantPath("/register")}>
                  <span className="text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer">
                    Criar conta
                  </span>
                </Link>
              </p>
            )}

            {/* Voltar ao portal — apenas quando há tenant */}
            {hasTenant && (
              <button
                type="button"
                className="mt-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mx-auto"
                onClick={() => tenantNavigate("/")}
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar ao portal
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
