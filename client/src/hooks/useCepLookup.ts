import { useState, useEffect, useRef, useCallback } from "react";

export type CepResult = {
  cep: string;
  address: string;   // logradouro
  neighborhood: string; // bairro
  city: string;      // localidade
  state: string;     // uf
  complement?: string;
};

export type CepStatus = "idle" | "loading" | "found" | "error";

type UseCepLookupOptions = {
  /** Chamado quando o CEP é encontrado com sucesso */
  onFound?: (result: CepResult) => void;
  /** Debounce em ms (padrão: 500) */
  debounceMs?: number;
};

type UseCepLookupReturn = {
  status: CepStatus;
  result: CepResult | null;
  error: string | null;
  /** Formata o CEP enquanto o usuário digita (00000-000) */
  formatCep: (value: string) => string;
};

/** Remove tudo que não é dígito do CEP */
function onlyCepDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

/** Formata CEP: 00000-000 */
export function formatCep(value: string): string {
  const digits = onlyCepDigits(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Hook para busca automática de endereço via ViaCEP.
 *
 * @param cep - Valor do campo CEP (com ou sem formatação)
 * @param options - Opções: onFound callback e debounceMs
 *
 * @example
 * const { status, error } = useCepLookup(form.zipCode, {
 *   onFound: (r) => setForm(f => ({ ...f, address: r.address, city: r.city, state: r.state })),
 * });
 */
export function useCepLookup(
  cep: string,
  options: UseCepLookupOptions = {}
): UseCepLookupReturn {
  const { onFound, debounceMs = 500 } = options;
  const [status, setStatus] = useState<CepStatus>("idle");
  const [result, setResult] = useState<CepResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onFoundRef = useRef(onFound);
  const abortRef = useRef<AbortController | null>(null);

  // Mantém a referência do callback sempre atualizada sem re-disparar o effect
  useEffect(() => {
    onFoundRef.current = onFound;
  }, [onFound]);

  const lookup = useCallback(
    async (digits: string) => {
      // Cancela requisição anterior
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("loading");
      setError(null);

      try {
        const res = await fetch(
          `https://viacep.com.br/ws/${digits}/json/`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          setStatus("error");
          setError("Erro ao consultar CEP.");
          return;
        }

        const data = await res.json();

        if (data.erro) {
          setStatus("error");
          setError("CEP não encontrado.");
          setResult(null);
          return;
        }

        const found: CepResult = {
          cep: data.cep ?? digits,
          address: data.logradouro ?? "",
          neighborhood: data.bairro ?? "",
          city: data.localidade ?? "",
          state: data.uf ?? "",
          complement: data.complemento ?? "",
        };

        setResult(found);
        setStatus("found");
        onFoundRef.current?.(found);
      } catch (err: unknown) {
        // Ignora erros de abort (troca de CEP durante digitação)
        if (err instanceof Error && err.name === "AbortError") return;
        setStatus("error");
        setError("Erro ao consultar CEP.");
      }
    },
    [] // sem dependências — usa refs para callbacks
  );

  useEffect(() => {
    const digits = onlyCepDigits(cep);

    // Só busca quando tiver 8 dígitos
    if (digits.length !== 8) {
      setStatus("idle");
      setError(null);
      setResult(null);
      return;
    }

    const timer = setTimeout(() => {
      lookup(digits);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [cep, debounceMs, lookup]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { status, result, error, formatCep };
}
