/**
 * tenantUrl.ts — Utilitário central para geração de URLs do portal do tenant.
 *
 * Estratégia de resolução por ambiente:
 *
 * 1. PRODUÇÃO com subdomínio configurado:
 *    rochacell.fullreparo.com.br
 *
 * 2. PRODUÇÃO com domínio personalizado (customDomain):
 *    rochacelulares.com.br
 *
 * 3. PREVIEW / DESENVOLVIMENTO (Manus preview, localhost):
 *    https://preview.manus.computer/?tenant=rochacell
 *    http://localhost:3000/?tenant=rochacell
 *
 * Compatibilidade retroativa:
 *    /coleta/:slug continua funcionando como fallback permanente.
 *    Esta função apenas gera o link "canônico" preferido para exibição.
 */

/** Domínio raiz da plataforma em produção. */
const PLATFORM_ROOT_DOMAIN = "fullreparo.com.br";

/**
 * Sufixos de host que indicam ambiente de preview/desenvolvimento.
 * Nesses ambientes, o subdomínio não está disponível — usa-se o fallback ?tenant=.
 */
const PREVIEW_SUFFIXES = [
  ".manus.computer",
  ".manus.space",
  ".vercel.app",
  ".netlify.app",
  ".railway.app",
  ".render.com",
  "localhost",
  "127.0.0.1",
];

/**
 * Verifica se o host atual é um ambiente de preview/desenvolvimento
 * onde subdomínios de tenant não estão disponíveis.
 */
export function isPreviewEnvironment(origin?: string): boolean {
  const host = (origin ?? (typeof window !== "undefined" ? window.location.origin : "")).toLowerCase();
  return PREVIEW_SUFFIXES.some((suffix) => host.includes(suffix));
}

/**
 * Extrai o domínio raiz de um hostname, removendo subdomínios.
 *
 * Exemplos:
 *   "rochacell.fullreparo.com.br" → "fullreparo.com.br"
 *   "app.fullreparo.com.br"       → "fullreparo.com.br"
 *   "fullreparo.com.br"           → "fullreparo.com.br"
 *   "localhost:3000"              → "localhost:3000"
 */
export function getRootDomain(hostname: string): string {
  // Remove porta
  const host = hostname.split(":")[0].toLowerCase();
  const parts = host.split(".");
  // Para TLDs de segundo nível como .com.br, .net.br, .org.br
  // o domínio raiz tem 3 partes: fullreparo.com.br
  const tld = parts.slice(-2).join(".");
  const isSecondLevelTld = /^[a-z]{2,6}\.[a-z]{2}$/.test(tld);
  const rootParts = isSecondLevelTld ? 3 : 2;
  if (parts.length <= rootParts) return host;
  return parts.slice(-rootParts).join(".");
}

/**
 * Gera a URL canônica do portal público de um tenant.
 *
 * @param slug - Slug do tenant (ex: "rochacell")
 * @param customDomain - Domínio personalizado do tenant, se configurado (ex: "rochacelulares.com.br")
 * @param origin - Origem atual do browser (window.location.origin). Se omitido, usa window.location.origin.
 *
 * @returns URL completa do portal do tenant.
 *
 * @example
 * // Em produção:
 * getTenantPortalUrl("rochacell") → "https://rochacell.fullreparo.com.br"
 *
 * // Com domínio personalizado:
 * getTenantPortalUrl("rochacell", "rochacelulares.com.br") → "https://rochacelulares.com.br"
 *
 * // Em preview/desenvolvimento:
 * getTenantPortalUrl("rochacell") → "https://preview.manus.computer/?tenant=rochacell"
 */
export function getTenantPortalUrl(
  slug: string,
  customDomain?: string | null,
  origin?: string
): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : `https://${PLATFORM_ROOT_DOMAIN}`);

  // 1. Domínio personalizado tem prioridade máxima
  if (customDomain) {
    const protocol = base.startsWith("https") ? "https" : "http";
    return `${protocol}://${customDomain}`;
  }

  // 2. Em preview/desenvolvimento: usa fallback ?tenant=slug
  if (isPreviewEnvironment(base)) {
    return `${base}/?tenant=${slug}`;
  }

  // 3. Produção: gera subdomínio no domínio raiz da plataforma
  try {
    const url = new URL(base);
    const rootDomain = getRootDomain(url.hostname);
    url.hostname = `${slug}.${rootDomain}`;
    // Remove porta em produção (HTTPS padrão)
    if (url.port === "443" || url.port === "80") url.port = "";
    return url.origin;
  } catch {
    // Fallback seguro se URL inválida
    return `https://${slug}.${PLATFORM_ROOT_DOMAIN}`;
  }
}

/**
 * Gera a URL de rastreamento de uma OS para um tenant.
 * Usada em notificações por WhatsApp e e-mail.
 *
 * @param token - Token público da OS
 * @param tenantSlug - Slug do tenant
 * @param customDomain - Domínio personalizado do tenant, se configurado
 * @param origin - Origem da requisição (req.headers.origin no backend)
 */
export function getTrackingUrl(
  token: string,
  tenantSlug?: string | null,
  customDomain?: string | null,
  origin?: string | null
): string {
  // Se temos a origem da requisição, usa ela diretamente (mais confiável)
  if (origin) {
    return `${origin}/rastrear/${token}`;
  }

  // Gera a partir do subdomínio/domínio do tenant
  if (tenantSlug) {
    const portalUrl = getTenantPortalUrl(tenantSlug, customDomain);
    return `${portalUrl}/rastrear/${token}`;
  }

  // Fallback final
  return `https://${PLATFORM_ROOT_DOMAIN}/rastrear/${token}`;
}
