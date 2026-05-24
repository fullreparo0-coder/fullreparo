/**
 * Regras de senha compartilhadas entre frontend e backend.
 * Importar de "@shared/passwordRules" em ambos os lados.
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (p: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "Mínimo 8 caracteres",
    test: (p) => p.length >= 8,
  },
  {
    id: "uppercase",
    label: "Letra maiúscula (A–Z)",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "number",
    label: "Número (0–9)",
    test: (p) => /\d/.test(p),
  },
  {
    id: "special",
    label: "Caractere especial (!@#$%...)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export interface PasswordStrengthResult {
  score: number; // 0–4
  label: string;
  color: string;
  barColor: string;
  passed: number;
  total: number;
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const total = PASSWORD_RULES.length;
  if (!password) return { score: 0, label: "", color: "", barColor: "", passed: 0, total };
  if (passed <= 1) return { score: 1, label: "Muito fraca", color: "text-red-500", barColor: "#ef4444", passed, total };
  if (passed === 2) return { score: 2, label: "Fraca", color: "text-orange-500", barColor: "#f97316", passed, total };
  if (passed === 3) return { score: 3, label: "Média", color: "text-yellow-600", barColor: "#ca8a04", passed, total };
  return { score: 4, label: "Forte", color: "text-green-600", barColor: "#16a34a", passed, total };
}

/**
 * Valida a senha contra todas as regras.
 * Retorna array de mensagens de erro (vazio = válida).
 */
export function validatePassword(password: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label.toLowerCase());
}
