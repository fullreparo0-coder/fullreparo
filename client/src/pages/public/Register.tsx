/**
 * Register — Cadastro de clientes no portal do tenant.
 *
 * Rota: /register (com ?tenant=slug em modo dev ou via subdomínio em produção)
 * Vincula automaticamente o novo cliente ao tenant detectado.
 * Após cadastro bem-sucedido: login automático + redirect para /minha-conta.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useTenantNav } from "@/hooks/useTenantNav";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Wrench,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  User,
  Phone,
  Mail,
  CreditCard,
} from "lucide-react";
import { isValidCPF, onlyDigits } from "@shared/cpfCnpj";
import { validatePassword } from "@shared/passwordRules";
import { Link } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return "#ffffff";
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#000000" : "#ffffff";
}

/** Retorna true se o CPF digitado já tem 11 dígitos e é matemáticamente válido */
function cpfStatus(value: string): "empty" | "incomplete" | "valid" | "invalid" {
  const digits = onlyDigits(value);
  if (digits.length === 0) return "empty";
  if (digits.length < 11) return "incomplete";
  return isValidCPF(digits) ? "valid" : "invalid";
}

function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}



// ─── Componente principal ─────────────────────────────────────────────────────

export default function Register() {
  const { tenant, loading: tenantLoading } = useTenantHost();
  const [, navigate] = useLocation();
  const { navigate: tenantNavigate, tenantPath } = useTenantNav();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const registerMutation = trpc.customerAuth.registerLocal.useMutation({
    onSuccess: (data) => {
      setSuccess(true);
      toast.success(`Bem-vindo, ${data.name}! Conta criada com sucesso.`);
      // Pequeno delay para o usuário ver o feedback antes do redirect
      setTimeout(() => tenantNavigate("/minha-conta"), 1500);
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

    // Validação client-side básica
    if (password !== confirmPassword) {
      setErrorMsg("As senhas não conferem.");
      return;
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setErrorMsg("Informe um telefone válido com DDD.");
      return;
    }

    // Valida CPF se preenchido
    if (document.trim()) {
      const status = cpfStatus(document);
      if (status === "incomplete") {
        setErrorMsg("CPF incompleto. Verifique os dígitos informados.");
        return;
      }
      if (status === "invalid") {
        setErrorMsg("CPF inválido. Verifique se os dígitos estão corretos.");
        return;
      }
    }

    // Valida todos os requisitos de senha antes de enviar
    const failedRules = validatePassword(password);
    if (failedRules.length > 0) {
      setErrorMsg(`A senha não atende aos requisitos: ${failedRules.join(", ")}.`);
      return;
    }

    registerMutation.mutate({
      tenantId: tenant.id,
      name: name.trim(),
      email: email.trim() || undefined,
      phone,
      document: document.trim() || undefined,
      password,
      confirmPassword,
    });
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const primaryColor = tenant?.primaryColor ?? "#1e3a5f";
  const contrastColor = getContrastColor(primaryColor);
  const hasTenant = !!tenant;

  // Tela de sucesso
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header
          className="px-6 py-4 flex items-center gap-3 shadow-sm"
          style={{ backgroundColor: primaryColor }}
        >
          <button
            onClick={() => tenantNavigate("/")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center">
                <Wrench className="h-4 w-4" style={{ color: contrastColor }} />
              </div>
            )}
            <span className="font-semibold text-lg" style={{ color: contrastColor }}>
              {tenant?.name ?? "FullReparo"}
            </span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg text-center">
            <CardContent className="pt-10 pb-8 space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Conta criada com sucesso!</h2>
              <p className="text-sm text-gray-500">Redirecionando para sua área de cliente...</p>
              <div className="pt-2">
                <Progress value={100} className="h-1" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header com branding do tenant */}
      <header
        className="px-6 py-4 flex items-center gap-3 shadow-sm"
        style={{ backgroundColor: primaryColor }}
      >
        <button
          onClick={() => tenantNavigate("/")}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
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
        </button>
      </header>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900">Criar conta</CardTitle>
            <CardDescription className="text-gray-500">
              {hasTenant
                ? `Cadastre-se no portal da ${tenant!.name}`
                : "Preencha os dados para criar sua conta"}
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
                    Acesse pelo link da sua assistência técnica para criar uma conta.
                    <br />
                    <span className="text-xs text-muted-foreground">
                      Ex: rochacell.fullreparo.com.br/register
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {/* Nome completo */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nome completo <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9"
                    required
                    disabled={!hasTenant}
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Telefone / WhatsApp <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    className="pl-9"
                    required
                    disabled={!hasTenant}
                    autoComplete="tel"
                    inputMode="numeric"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com (opcional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    disabled={!hasTenant}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* CPF */}
              <div className="space-y-2">
                <Label htmlFor="document">CPF</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="document"
                    type="text"
                    placeholder="000.000.000-00 (opcional)"
                    value={document}
                    onChange={(e) => setDocument(maskCpf(e.target.value))}
                    className={`pl-9 ${
                      cpfStatus(document) === "invalid"
                        ? "border-red-400 focus-visible:ring-red-400"
                        : cpfStatus(document) === "valid"
                        ? "border-green-400 focus-visible:ring-green-400"
                        : ""
                    }`}
                    disabled={!hasTenant}
                    inputMode="numeric"
                  />
                  {cpfStatus(document) === "valid" && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {cpfStatus(document) === "invalid" && (
                    <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                  )}
                </div>
                {cpfStatus(document) === "invalid" && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> CPF inválido. Verifique os dígitos.
                  </p>
                )}
                {cpfStatus(document) === "valid" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> CPF válido.
                  </p>
                )}
                {cpfStatus(document) === "empty" && (
                  <p className="text-xs text-gray-400">
                    Recomendado para facilitar a identificação nas ordens de serviço.
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <Label htmlFor="password">
                  Senha <span className="text-red-500">*</span>
                </Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Crie uma senha forte"
                  disabled={!hasTenant}
                  autoComplete="new-password"
                  showStrength
                />
              </div>

              {/* Confirmar senha */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirmar senha <span className="text-red-500">*</span>
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Repita a senha"
                  disabled={!hasTenant}
                  autoComplete="new-password"
                  confirmOf={password}
                  showMatchIndicator
                />
              </div>

              <Button
                type="submit"
                className="w-full font-semibold mt-2"
                style={{ backgroundColor: primaryColor, color: contrastColor }}
                disabled={
                  registerMutation.isPending ||
                  !name ||
                  !phone ||
                  !password ||
                  !confirmPassword ||
                  password !== confirmPassword ||
                  !hasTenant
                }
              >
                {registerMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Criando conta...
                  </span>
                ) : (
                  "Criar conta"
                )}
              </Button>
            </form>

            {/* Link para login */}
            <p className="mt-5 text-center text-sm text-gray-500">
              Já tem uma conta?{" "}
              <Link href={tenantPath("/login")}>
                <span className="text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer">
                  Fazer login
                </span>
              </Link>
            </p>

            {hasTenant && (
              <button
                type="button"
                className="mt-3 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mx-auto"
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
