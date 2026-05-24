/**
 * useTenantNav — navegação com preservação automática do slug de tenant.
 *
 * No modo de teste (?tenant=slug), o wouter não propaga o query param
 * automaticamente ao navegar entre rotas. Este hook retorna um `navigate`
 * que injeta `?tenant=<slug>` em todas as rotas públicas quando necessário.
 *
 * Uso:
 *   const { navigate, tenantPath } = useTenantNav();
 *   navigate("/entrar");          // → /entrar?tenant=techfix (em modo de teste)
 *   tenantPath("/minha-conta")    // → "/minha-conta?tenant=techfix"
 */

import { useCallback } from "react";
import { useLocation } from "wouter";
import { useTenantHost } from "@/contexts/TenantHostContext";

const SESSION_KEY = "__tenant_slug__";

function getPersistedSlug(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function useTenantNav() {
  const [, rawNavigate] = useLocation();
  const { isTestMode, tenant } = useTenantHost();

  /**
   * Retorna o caminho com ?tenant= injetado quando em modo de teste.
   * Se o caminho já tiver o param, não duplica.
   */
  const tenantPath = useCallback(
    (path: string): string => {
      // Slug vem do contexto (já resolvido) ou do sessionStorage (fallback)
      const slug = tenant?.slug ?? getPersistedSlug();
      if (!slug) return path;

      // Só injeta se estiver em modo de teste (não em subdomínio real)
      if (!isTestMode) return path;

      try {
        // Separa path de hash
        const [pathPart, hash] = path.split("#");
        const [pathname, existingSearch] = pathPart.split("?");
        const params = new URLSearchParams(existingSearch ?? "");

        // Não duplica se já tiver o param
        if (!params.has("tenant")) {
          params.set("tenant", slug);
        }

        const search = params.toString();
        return `${pathname}?${search}${hash ? `#${hash}` : ""}`;
      } catch {
        return path;
      }
    },
    [isTestMode, tenant]
  );

  /**
   * Navigate que preserva o ?tenant= automaticamente.
   */
  const navigate = useCallback(
    (path: string, opts?: { replace?: boolean }) => {
      rawNavigate(tenantPath(path), opts);
    },
    [rawNavigate, tenantPath]
  );

  return { navigate, tenantPath };
}
