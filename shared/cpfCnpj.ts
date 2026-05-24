/**
 * Utilitários de CPF e CNPJ — validação e formatação.
 * Usados tanto no backend (server/) quanto no frontend (client/).
 */

/** Remove tudo que não é dígito */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// ── CPF ──────────────────────────────────────────────────────────────────────

/**
 * Valida CPF pelos dígitos verificadores (módulo 11).
 * Aceita string com ou sem formatação (pontos e traço).
 * Retorna false para sequências repetidas (ex: 111.111.111-11).
 */
export function isValidCPF(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  // Rejeita sequências repetidas
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += parseInt(digits[i]) * (len + 1 - i);
    }
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };

  return calc(9) === parseInt(digits[9]) && calc(10) === parseInt(digits[10]);
}

/** Formata CPF: 000.000.000-00 */
export function formatCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// ── CNPJ ─────────────────────────────────────────────────────────────────────

/**
 * Valida CNPJ pelos dígitos verificadores (módulo 11).
 * Aceita string com ou sem formatação.
 * Retorna false para sequências repetidas (ex: 00.000.000/0000-00).
 */
export function isValidCNPJ(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calcDigit = (w: number[]) => {
    let sum = 0;
    for (let i = 0; i < w.length; i++) {
      sum += parseInt(digits[i]) * w[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  return (
    calcDigit(weights1) === parseInt(digits[12]) &&
    calcDigit(weights2) === parseInt(digits[13])
  );
}

/** Formata CNPJ: 00.000.000/0000-00 */
export function formatCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// ── Detecta tipo e valida ─────────────────────────────────────────────────────

/** Detecta se é CPF (11 dígitos) ou CNPJ (14 dígitos) e valida. */
export function isValidDocument(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

/** Retorna "CPF" | "CNPJ" | null conforme o número de dígitos. */
export function detectDocumentType(value: string): "CPF" | "CNPJ" | null {
  const digits = onlyDigits(value);
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return null;
}

/** Formata CPF ou CNPJ automaticamente. */
export function formatDocument(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length <= 11) return formatCPF(digits);
  return formatCNPJ(digits);
}
