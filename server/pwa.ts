import type { Express, Request, Response } from "express";
import { getTenantBySlug } from "./db";
import { storageGetSignedUrl } from "./storage";

const DEFAULT_APP_NAME = "FullReparo";
const DEFAULT_PRIMARY_COLOR = "#1e3a5f";

type TenantLike = {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildInitialsSvg(name: string, color: string): string {
  const initials = xmlEscape(getTenantInitials(name));
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="112" fill="${xmlEscape(color)}" />
      <circle cx="382" cy="118" r="74" fill="#d4a017" opacity="0.92" />
      <text x="256" y="294" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="178" font-weight="800" fill="#ffffff">${initials}</text>
    </svg>
  `.trim();
}

function shortAppName(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim() || DEFAULT_APP_NAME;
  return normalized.length > 12 ? normalized.slice(0, 12).trimEnd() : normalized;
}

async function resolveTenant(req: Request): Promise<TenantLike | null> {
  const fromHost = req.resolvedTenant;
  if (fromHost && fromHost.status !== "blocked") return fromHost;

  const tenantSlug = typeof req.query.tenant === "string" ? req.query.tenant : null;
  if (!tenantSlug || !/^[a-z0-9][a-z0-9-]{0,59}$/i.test(tenantSlug)) return null;

  const tenant = await getTenantBySlug(tenantSlug.toLowerCase());
  if (!tenant || tenant.status === "blocked") return null;
  return tenant;
}

function getAbsoluteUrl(req: Request, path: string): string {
  const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol || "https";
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host") || "";
  return `${protocol}://${host}${path}`;
}

function buildManifest(req: Request, tenant: TenantLike | null) {
  const appName = tenant?.name?.trim() || DEFAULT_APP_NAME;
  const tenantQuery = tenant && !req.resolvedTenant ? `?tenant=${encodeURIComponent(tenant.slug)}` : "";
  const iconPath = `/pwa-icon.png${tenantQuery}`;

  return {
    id: tenant ? `/${tenant.slug}` : "/",
    name: appName,
    short_name: shortAppName(appName),
    description: tenant
      ? `Portal de atendimento da ${appName} no FullReparo.`
      : "Plataforma FullReparo para assistências técnicas.",
    start_url: tenantQuery ? `/${tenantQuery}` : "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: normalizeHexColor(tenant?.primaryColor),
    icons: [
      {
        src: iconPath,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: iconPath,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: tenant
      ? [
          {
            name: "Acompanhar OS",
            short_name: "OS",
            url: `/acompanhar${tenantQuery}`,
            icons: [{ src: iconPath, sizes: "512x512", type: "image/png" }],
          },
        ]
      : [],
  };
}

async function proxyLogoOrSendFallback(req: Request, res: Response, tenant: TenantLike | null) {
  const appName = tenant?.name?.trim() || DEFAULT_APP_NAME;
  const themeColor = normalizeHexColor(tenant?.primaryColor);
  const logoUrl = tenant?.logoUrl?.trim();

  if (logoUrl?.startsWith("/manus-storage/")) {
    try {
      const key = decodeURIComponent(logoUrl.replace(/^\/manus-storage\//, ""));
      const signedUrl = await storageGetSignedUrl(key);
      const upstream = await fetch(signedUrl);
      if (upstream.ok && upstream.body) {
        const contentType = upstream.headers.get("content-type") || "image/png";
        const cacheBust = encodeURIComponent(`${tenant?.id ?? "default"}:${logoUrl}`);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
        res.setHeader("ETag", `W/\"${cacheBust}\"`);
        res.send(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
    } catch (error) {
      console.warn("[pwa] Falha ao carregar logo do storage para ícone PWA", error);
    }
  }

  if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
    try {
      const upstream = await fetch(logoUrl);
      if (upstream.ok && upstream.body) {
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");
        res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
        res.send(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
    } catch (error) {
      console.warn("[pwa] Falha ao carregar logo remoto para ícone PWA", error);
    }
  }

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.send(buildInitialsSvg(appName, themeColor));
}

export function registerPwaRoutes(app: Express) {
  app.get(["/manifest.webmanifest", "/manifest.json"], async (req, res, next) => {
    try {
      const tenant = await resolveTenant(req);
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
      res.send(JSON.stringify(buildManifest(req, tenant)));
    } catch (error) {
      next(error);
    }
  });

  app.get(["/pwa-icon.png", "/apple-touch-icon.png"], async (req, res, next) => {
    try {
      const tenant = await resolveTenant(req);
      await proxyLogoOrSendFallback(req, res, tenant);
    } catch (error) {
      next(error);
    }
  });
}
