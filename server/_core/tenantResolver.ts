/**
 * tenantResolver.ts
 *
 * Middleware Express que resolve o tenant a partir do hostname da requisição.
 * O tenant resolvido é injetado em `req.resolvedTenant` para uso posterior
 * no contexto tRPC e nas rotas públicas do portal do tenant.
 *
 * Estratégia de resolução:
 *   1. Extrai o slug do primeiro label do subdomínio
 *      (ex: "rocha.fullreparo.com.br" → "rocha")
 *   2. Busca o tenant pelo slug na tabela `tenants`
 *   3. Se não encontrar por slug, tenta o campo `customDomain` exato
 *
 * Hosts ignorados (req.resolvedTenant = null):
 *   - localhost / 127.0.0.1 / ::1
 *   - Endereços IP (IPv4 e IPv6)
 *   - Labels reservados: www, app, api, admin, mail, smtp, ftp
 *   - Domínio raiz sem subdomínio (ex: "fullreparo.com.br")
 *   - Ambientes de preview do Manus (*.manus.computer, *.manus.space)
 */

import type { Request, Response, NextFunction } from "express";
import type { InferSelectModel } from "drizzle-orm";
import type { tenants } from "../../drizzle/schema";
import { getTenantByDomain } from "../db";

export type ResolvedTenant = InferSelectModel<typeof tenants>;

// Augment Express Request to carry the resolved tenant
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      resolvedTenant?: ResolvedTenant | null;
    }
  }
}

/** Labels de subdomínio que devem ser ignorados na resolução de tenant. */
const RESERVED_LABELS = new Set([
  "www", "app", "api", "admin", "mail", "smtp", "ftp", "cdn", "static",
  "assets", "media", "dev", "staging", "beta", "test",
]);

/** Sufixos de domínio de preview/deploy que devem ser ignorados. */
const IGNORED_SUFFIXES = [
  ".manus.computer",
  ".manus.space",
  ".vercel.app",
  ".netlify.app",
  ".railway.app",
  ".render.com",
];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

/**
 * Extrai o slug do tenant a partir de um hostname.
 * Retorna `null` quando o host deve ser ignorado.
 *
 * Exemplos:
 *   "rocha.fullreparo.com.br"   → "rocha"
 *   "rocha.celulares.com.br"    → "rocha" (customDomain fallback no db)
 *   "fullreparo.com.br"         → null (domínio raiz — sem subdomínio de tenant)
 *   "www.fullreparo.com.br"     → null (label reservado)
 *   "app.fullreparo.com.br"     → null (label reservado)
 *   "localhost"                 → null
 *   "192.168.1.1"               → null
 */
export function extractTenantSlug(hostname: string): string | null {
  // Remove porta, se houver (ex: "rocha.fullreparo.com.br:3000")
  const host = hostname.split(":")[0].toLowerCase().trim();

  if (!host) return null;
  if (LOCAL_HOSTS.has(host)) return null;
  if (isIpAddress(host)) return null;

  // Ignora sufixos de ambientes de preview
  for (const suffix of IGNORED_SUFFIXES) {
    if (host.endsWith(suffix)) return null;
  }

  const labels = host.split(".");

  // Domínio raiz (sem subdomínio): "fullreparo.com.br" → 3 labels, mas o
  // primeiro é o domínio principal, não um tenant.
  // Considera que o domínio raiz tem ≤ 3 labels para .com.br e ≤ 2 para .com.
  // Heurística: se o primeiro label for o mesmo que o "produto" (fullreparo),
  // não há subdomínio de tenant. Usamos a regra: precisa ter ao menos 4 labels
  // para .com.br (rocha.fullreparo.com.br) ou 3 para .com (rocha.fullreparo.com).
  if (labels.length < 3) return null;

  // Para domínios .com.br, .net.br, .org.br etc. (second-level TLD de 2 partes)
  // precisamos de ao menos 4 labels para ter subdomínio de tenant.
  const tld = labels.slice(-2).join(".");
  const isSecondLevelTld = tld.length <= 6 && tld.includes("."); // ex: "com.br"
  const minLabels = isSecondLevelTld ? 4 : 3;
  if (labels.length < minLabels) return null;

  const slug = labels[0];

  if (RESERVED_LABELS.has(slug)) return null;
  // Slug deve ser alfanumérico com hífens (sem caracteres especiais)
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) return null;

  return slug;
}

/**
 * Middleware Express que resolve o tenant pelo hostname e injeta em `req.resolvedTenant`.
 * Nunca lança erro — em caso de falha, `req.resolvedTenant` fica `null`.
 */
export async function tenantResolverMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hostname = req.hostname ?? req.headers.host ?? "";
    req.resolvedTenant = (await getTenantByDomain(hostname)) ?? null;
  } catch {
    req.resolvedTenant = null;
  }
  next();
}
