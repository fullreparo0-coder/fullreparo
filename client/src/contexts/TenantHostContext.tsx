import { createContext, useContext, useEffect, useMemo } from "react";
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
const DEFAULT_APP_NAME = "FullReparo";
const DEFAULT_PRIMARY_COLOR = "#1e3a5f";

function parseSlug(raw: string | null): string | null {
  if (!raw) return null;
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/i.test(raw)) return null;
  return raw.toLowerCase();
}

function normalizeHexColor(color?: string | null): string {
  if (!color) return DEFAULT_PRIMARY_COLOR;
  const trimmed = color.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : DEFAULT_PRIMARY_COLOR;
}

function getTenantInitials(name: string): string {
  const parts = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "FR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createInitialsIconDataUrl(name: string, color: string): string {
  const initials = xmlEscape(getTenantInitials(name));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="112" fill="${xmlEscape(color)}" />
      <circle cx="382" cy="118" r="74" fill="#d4a017" opacity="0.92" />
      <text x="256" y="294" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="178" font-weight="800" fill="#ffffff">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function upsertMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertLink(id: string, rel: string, href: string, type?: string, sizes?: string) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    document.head.appendChild(link);
  }
  link.rel = rel;
  link.href = href;
  if (type) {
    link.type = type;
  } else {
    link.removeAttribute("type");
  }
  if (sizes) {
    link.setAttribute("sizes", sizes);
  } else {
    link.removeAttribute("sizes");
  }
}

function buildPwaAssetHref(path: string, tenant: TenantHostInfo | null, isTestMode: boolean, logoUrl?: string | null): string {
  const params = new URLSearchParams();
  if (tenant && isTestMode) params.set("tenant", tenant.slug);
  if (logoUrl) params.set("v", logoUrl);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function useTenantBranding(value: TenantHostContextValue) {
  const tenant = value.tenant;
  const tenantName = tenant?.name?.trim() || DEFAULT_APP_NAME;
  const themeColor = normalizeHexColor(tenant?.primaryColor);
  const logoUrl = tenant?.logoUrl?.trim();
  const fallbackIconHref = createInitialsIconDataUrl(tenantName, themeColor);
  const iconHref = tenant
    ? buildPwaAssetHref("/pwa-icon-192.png", tenant, value.isTestMode, logoUrl)
    : fallbackIconHref;
  const appleIconHref = tenant
    ? buildPwaAssetHref("/apple-touch-icon-192x192.png", tenant, value.isTestMode, logoUrl)
    : fallbackIconHref;
  const manifestHref = buildPwaAssetHref("/manifest.webmanifest", tenant, value.isTestMode, logoUrl);

  useEffect(() => {
    document.title = tenant ? `${tenantName} | ${DEFAULT_APP_NAME}` : DEFAULT_APP_NAME;
    upsertMeta("application-name", tenantName);
    upsertMeta("apple-mobile-web-app-title", tenantName);
    upsertMeta("apple-mobile-web-app-capable", "yes");
    upsertMeta("mobile-web-app-capable", "yes");
    upsertMeta("apple-mobile-web-app-status-bar-style", "default");
    upsertMeta("theme-color", themeColor);

    upsertLink(
      "fullreparo-dynamic-favicon",
      "icon",
      iconHref,
      tenant ? "image/png" : "image/svg+xml",
      tenant ? "192x192" : undefined,
    );
    upsertLink("fullreparo-dynamic-apple-touch-icon", "apple-touch-icon", appleIconHref, tenant ? "image/png" : "image/svg+xml", tenant ? "192x192" : undefined);
    upsertLink("fullreparo-dynamic-manifest", "manifest", manifestHref, "application/manifest+json");
  }, [appleIconHref, iconHref, manifestHref, tenant, tenantName, themeColor]);
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

  useTenantBranding(value);

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
