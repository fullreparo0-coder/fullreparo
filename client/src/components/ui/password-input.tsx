/**
 * PasswordInput — campo de senha reutilizável com:
 *   - Botão mostrar/ocultar
 *   - Indicador de força (barra + label: Muito fraca / Fraca / Média / Forte)
 *   - Checklist de requisitos em tempo real
 *   - Validação de confirmação (opcional)
 *
 * Uso básico (só mostrar/ocultar):
 *   <PasswordInput id="password" value={password} onChange={setPassword} />
 *
 * Com indicador de força:
 *   <PasswordInput id="password" value={password} onChange={setPassword} showStrength />
 *
 * Com confirmação:
 *   <PasswordInput id="confirm" value={confirm} onChange={setConfirm}
 *     confirmOf={password} showMatchIndicator />
 */

import { useState } from "react";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES, getPasswordStrength } from "@shared/passwordRules";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  /** Exibe barra de força + checklist de requisitos */
  showStrength?: boolean;
  /** Valor da senha original para validar confirmação */
  confirmOf?: string;
  /** Exibe ícone de match/mismatch ao lado do campo */
  showMatchIndicator?: boolean;
  /** Ref para o input nativo */
  inputRef?: React.RefObject<HTMLInputElement>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder = "••••••••",
  disabled = false,
  autoComplete = "current-password",
  className,
  showStrength = false,
  confirmOf,
  showMatchIndicator = false,
  inputRef,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  const strength = showStrength ? getPasswordStrength(value) : null;
  const isConfirmMode = confirmOf !== undefined;
  const passwordsMatch = isConfirmMode && value.length > 0 && value === confirmOf;
  const passwordsDiffer = isConfirmMode && value.length > 0 && value !== confirmOf;

  return (
    <div className="space-y-2">
      {/* Campo + botão mostrar/ocultar */}
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={cn(
            "pr-10",
            showMatchIndicator && passwordsMatch && "border-green-400 focus-visible:ring-green-400",
            showMatchIndicator && passwordsDiffer && "border-red-400 focus-visible:ring-red-400",
            className
          )}
        />
        {/* Ícone de match (confirmação) */}
        {showMatchIndicator && passwordsMatch && (
          <CheckCircle2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 pointer-events-none" />
        )}
        {showMatchIndicator && passwordsDiffer && (
          <XCircle className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400 pointer-events-none" />
        )}
        {/* Botão mostrar/ocultar */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          disabled={disabled}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Indicador de força */}
      {showStrength && value && strength && (
        <div className="space-y-2">
          {/* Barra de força */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(strength.score / strength.total) * 100}%`,
                  backgroundColor: strength.barColor,
                }}
              />
            </div>
            {strength.label && (
              <span className={cn("text-xs font-medium shrink-0", strength.color)}>
                {strength.label}
              </span>
            )}
          </div>

          {/* Checklist de requisitos */}
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(value);
              return (
                <li key={rule.id} className="flex items-center gap-1 text-xs">
                  {ok ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-gray-300 shrink-0" />
                  )}
                  <span className={ok ? "text-green-700" : "text-gray-400"}>{rule.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Mensagem de match/mismatch */}
      {showMatchIndicator && passwordsDiffer && (
        <p className="text-xs text-red-500">As senhas não conferem.</p>
      )}
      {showMatchIndicator && passwordsMatch && (
        <p className="text-xs text-green-600">Senhas conferem.</p>
      )}
    </div>
  );
}
