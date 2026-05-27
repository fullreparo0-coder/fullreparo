import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import type { ResolvedTenant } from "./tenantResolver";

export const TENANT_STAFF_ROLES = ["tenant_admin", "atendente", "tecnico", "entregador", "admin"] as const;
export const PLATFORM_ROOT_DOMAIN = "fullreparo.com.br";

const PREVIEW_OR_LOCAL_SUFFIXES = [
  ".manus.computer",
  ".manus.space",
  ".vercel.app",
  ".netlify.app",
  ".railway.app",
  ".render.com",
];

function normalizeHostname(rawHost?: string | null): string {
  const raw = (rawHost ?? "").trim().toLowerCase();
  if (!raw) return "";
  return raw.split(":")[0];
}

export function getRequestHostname(req: Request): string {
  const forwardedHost = req.headers["x-forwarded-host"];
  const firstForwardedHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost?.split(",")[0];

  return normalizeHostname(firstForwardedHost || req.hostname || req.headers.host);
}

export function isPreviewOrLocalHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return PREVIEW_OR_LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function isPlatformRootHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return host === PLATFORM_ROOT_DOMAIN || host === `www.${PLATFORM_ROOT_DOMAIN}`;
}

export function isTenantStaffRole(role?: string | null): boolean {
  return !!role && (TENANT_STAFF_ROLES as readonly string[]).includes(role);
}

export function isUserAllowedForRequestHost(
  user: User | null,
  tenantFromHost: ResolvedTenant | null,
  req: Request
): boolean {
  if (!user) return false;

  const hostname = getRequestHostname(req);

  // Em ambientes locais/preview, preserva o modo de teste por ?tenant= para não quebrar QA.
  if (isPreviewOrLocalHost(hostname)) return true;

  // Host de tenant real ou domínio personalizado: somente equipe daquele tenant.
  if (tenantFromHost) {
    return isTenantStaffRole(user.role) && user.tenantId === tenantFromHost.id;
  }

  // Domínio raiz da plataforma: somente super admin.
  if (isPlatformRootHost(hostname)) {
    return user.role === "super_admin";
  }

  // Hosts desconhecidos sem tenant resolvido não devem reaproveitar sessão de staff/superadmin.
  return false;
}

export function canUseTenantLoginInput(req: Request, tenantFromHost: ResolvedTenant | null): boolean {
  const hostname = getRequestHostname(req);

  // Em produção, o login de equipe deve vir de host real do tenant, nunca do domínio raiz com tenantId forjado.
  if (tenantFromHost) return true;

  // Mantém o fallback ?tenant= apenas para desenvolvimento/preview controlado.
  return isPreviewOrLocalHost(hostname);
}
