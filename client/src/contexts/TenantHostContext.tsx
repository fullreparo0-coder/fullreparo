import { createContext, useContext, useMemo } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";

export interface TenantHostInfo {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  businessHours?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  deviceSpecialties?: string | null;
}

interface TenantHostContextValue {
  /** Dados do tenant resolvido pelo host atual. Null quando no domínio raiz. */
  tenant: TenantHostInfo | null;
  /** True enquanto a query ainda não retornou */
  loading: boolean;
  /** True quando o host atual pertence a um tenant (subdomínio, customDomain ou ?tenant=slug) */
  isHostTenant: boolean;
  /** True quando o tenant foi resolvido via query param ?tenant=slug (modo de teste) */
  isTestMode: boolean;
}

const TenantHostContext = createContext<TenantHostContextValue>({
  tenant: null,
  loading: false,
  isHostTenant: false,
  isTestMode: false,
});

const SESSION_KEY = "__tenant_slug__";

function parseSlug(raw: string | null): string | null {
  if (!raw) return null;
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/i.test(raw)) return null;
  return raw.toLowerCase();
}

export function TenantHostProvider({ children }: { children: React.ReactNode }) {
  // Usa useSearch() do wouter para reagir a mudanças de URL (navegação interna)
  const search = useSearch();

  // Slug de teste: lê da URL atual ou do sessionStorage (persistência entre rotas)
  const testSlug = useMemo(() => {
    const fromUrl = parseSlug(new URLSearchParams(search).get("tenant"));
    if (fromUrl) {
      // Persiste para que outras rotas sem ?tenant= ainda consigam resolver
      try { sessionStorage.setItem(SESSION_KEY, fromUrl); } catch {}
      return fromUrl;
    }
    // Fallback: slug salvo na sessão (navegação interna sem query param)
    try {
      return parseSlug(sessionStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }, [search]);

  // Query 1: resolução por host (subdomínio / customDomain)
  const { data: hostData, isLoading: hostLoading } = trpc.public.getTenantByHost.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000,
      retry: false,
    }
  );

  // Query 2: resolução por slug (modo de teste via ?tenant=slug)
  // Só ativa quando não há resolução por host E há um slug de teste
  const { data: slugData, isLoading: slugLoading } = trpc.public.getTenantInfo.useQuery(
    { slug: testSlug! },
    {
      enabled: !hostData && !!testSlug,
      staleTime: 5 * 60 * 1000,
      retry: false,
    }
  );

  const value = useMemo<TenantHostContextValue>(() => {
    // Prioridade: host > slug de teste
    const resolved = hostData ?? slugData ?? null;
    const isTestMode = !hostData && !!slugData;
    return {
      tenant: resolved,
      loading: hostLoading || (!!testSlug && !hostData && slugLoading),
      isHostTenant: !!resolved,
      isTestMode,
    };
  }, [hostData, slugData, hostLoading, slugLoading, testSlug]);

  return (
    <TenantHostContext.Provider value={value}>
      {children}
    </TenantHostContext.Provider>
  );
}

/**
 * Retorna informações do tenant detectado automaticamente pelo host atual
 * ou pelo query param ?tenant=slug (modo de teste).
 * Deve ser usado dentro de `TenantHostProvider`.
 *
 * @example
 * const { tenant, isHostTenant, isTestMode } = useTenantHost();
 * if (isHostTenant) {
 *   // Exibir branding do tenant
 * }
 */
export function useTenantHost(): TenantHostContextValue {
  return useContext(TenantHostContext);
}
