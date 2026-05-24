/**
 * ChangePassword — Fase 3 (revisado)
 *
 * Tela de troca de senha obrigatória para clientes locais.
 * Exibida automaticamente após o primeiro login com senha provisória.
 * Usa o componente PasswordInput reutilizável para consistência.
 */

import { useState } from "react";
import { useTenantNav } from "@/hooks/useTenantNav";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";
import { validatePassword } from "@shared/passwordRules";
import { ShieldCheck, AlertCircle, Lock } from "lucide-react";

export default function ChangePassword() {
  const { tenant } = useTenantHost();
  const { navigate: tenantNavigate } = useTenantNav();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const meLocalQuery = trpc.customerAuth.meLocal.useQuery();
  const utils = trpc.useUtils();

  const changePasswordMutation = trpc.customerAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha criada com sucesso! Bem-vindo ao portal.");
      utils.customerAuth.meLocal.invalidate();
      tenantNavigate("/minha-conta");
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const allRulesPassed = validatePassword(newPassword).length === 0;
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === newPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!allRulesPassed) {
      setErrorMsg("A senha não atende a todos os requisitos obrigatórios.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMsg("A nova senha deve ser diferente da senha provisória.");
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const primaryColor = tenant?.primaryColor ?? "#1e3a5f";
  const customerName = meLocalQuery.data?.name;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header com branding */}
      <header
        className="px-6 py-4 flex items-center gap-3 shadow-sm"
        style={{ backgroundColor: primaryColor }}
      >
        <ShieldCheck className="h-6 w-6 text-white" />
        <span className="text-white font-semibold text-lg">
          {tenant?.name ?? "Assistência Técnica"}
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Cabeçalho do card */}
          <div className="text-center mb-6">
            <div
              className="mx-auto mb-4 h-14 w-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Lock className="h-7 w-7" style={{ color: primaryColor }} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Crie sua senha pessoal</h1>
            <p className="text-sm text-gray-500 mt-1">
              {customerName
                ? `Olá, ${customerName.split(" ")[0]}! Por segurança, crie uma senha pessoal para substituir a senha provisória.`
                : "Por segurança, crie uma senha pessoal para substituir a senha provisória."}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Senha provisória */}
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword" className="text-sm font-medium">
                  Senha provisória recebida
                </Label>
                <PasswordInput
                  id="currentPassword"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Digite a senha que você recebeu"
                  autoComplete="current-password"
                />
              </div>

              {/* Nova senha com indicador de força */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-sm font-medium">
                  Nova senha
                </Label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Crie uma senha segura"
                  autoComplete="new-password"
                  showStrength
                />
              </div>

              {/* Confirmar nova senha */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirmar nova senha
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  confirmOf={newPassword}
                  showMatchIndicator
                />
              </div>

              <Button
                type="submit"
                className="w-full font-semibold text-white mt-1"
                style={{ backgroundColor: primaryColor }}
                disabled={
                  changePasswordMutation.isPending ||
                  !currentPassword ||
                  !allRulesPassed ||
                  !passwordsMatch
                }
              >
                {changePasswordMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Salvando...
                  </span>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Criar minha senha
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Sua senha é criptografada e nunca é armazenada em texto claro.
          </p>
        </div>
      </div>
    </div>
  );
}
