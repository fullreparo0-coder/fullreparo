import type { Express, Request, Response } from "express";
import sharp from "sharp";
import { getTenantBySlug } from "./db";
import { storageGetSignedUrl } from "./storage";

const DEFAULT_APP_NAME = "FullReparo";
const DEFAULT_PRIMARY_COLOR = "#1e3a5f";
const SUPPORTED_ICON_SIZES = [180, 192, 256, 384, 512] as const;
const DEFAULT_ICON_SIZE = 192;

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

function buildInitialsSvg(name: string, color: string, size: number): string {
  const initials = xmlEscape(getTenantInitials(name));
  const radius = Math.round(size * 0.22);
  const accentCenter = Math.round(size * 0.746);
  const accentTop = Math.round(size * 0.23);
  const accentRadius = Math.round(size * 0.145);
  const fontSize = Math.round(size * 0.348);
  const textY = Math.round(size * 0.574);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${radius}" fill="${xmlEscape(color)}" />
      <circle cx="${accentCenter}" cy="${accentTop}" r="${accentRadius}" fill="#d4a017" opacity="0.92" />
      <text x="${size / 2}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff">${initials}</text>
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

function buildTenantQuery(req: Request, tenant: TenantLike | null): string {
  return tenant && !req.resolvedTenant ? `?tenant=${encodeURIComponent(tenant.slug)}` : "";
}

function buildIconPath(size: number, tenantQuery: string): string {
  return `/pwa-icon-${size}.png${tenantQuery}`;
}

function buildManifest(req: Request, tenant: TenantLike | null) {
  const appName = tenant?.name?.trim() || DEFAULT_APP_NAME;
  const tenantQuery = buildTenantQuery(req, tenant);
  const icons = SUPPORTED_ICON_SIZES.flatMap((size) => [
    {
      src: buildIconPath(size, tenantQuery),
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    },
    {
      src: buildIconPath(size, tenantQuery),
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "maskable",
    },
  ]);

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
    icons,
    shortcuts: tenant
      ? [
          {
            name: "Acompanhar OS",
            short_name: "OS",
            url: `/acompanhar${tenantQuery}`,
            icons: [{ src: buildIconPath(192, tenantQuery), sizes: "192x192", type: "image/png" }],
          },
        ]
      : [],
  };
}

function resolveRequestedIconSize(req: Request): number {
  const fromPath = req.path.match(/(?:pwa-icon|apple-touch-icon)-(\d+)(?:x\d+)?\.png$/i)?.[1];
  const fromQuery = typeof req.query.size === "string" ? req.query.size : null;
  const parsed = Number.parseInt(fromPath || fromQuery || "", 10);

  if (SUPPORTED_ICON_SIZES.includes(parsed as (typeof SUPPORTED_ICON_SIZES)[number])) {
    return parsed;
  }

  if (req.path.includes("apple-touch-icon")) return 192;
  return DEFAULT_ICON_SIZE;
}

async function fetchLogoBuffer(logoUrl?: string | null): Promise<Buffer | null> {
  const normalizedLogoUrl = logoUrl?.trim();
  if (!normalizedLogoUrl) return null;

  if (normalizedLogoUrl.startsWith("/manus-storage/")) {
    const key = decodeURIComponent(normalizedLogoUrl.replace(/^\/manus-storage\//, ""));
    const signedUrl = await storageGetSignedUrl(key);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) return null;
    return Buffer.from(await upstream.arrayBuffer());
  }

  if (/^https?:\/\//i.test(normalizedLogoUrl)) {
    const upstream = await fetch(normalizedLogoUrl);
    if (!upstream.ok) return null;
    return Buffer.from(await upstream.arrayBuffer());
  }

  return null;
}

async function createPngIconFromBuffer(input: Buffer, size: number): Promise<Buffer> {
  return sharp(input, { animated: false })
    .rotate()
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function createFallbackPngIcon(appName: string, themeColor: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(buildInitialsSvg(appName, themeColor, size))).png().toBuffer();
}

async function sendPwaIcon(req: Request, res: Response, tenant: TenantLike | null) {
  const size = resolveRequestedIconSize(req);
  const appName = tenant?.name?.trim() || DEFAULT_APP_NAME;
  const themeColor = normalizeHexColor(tenant?.primaryColor);
  const logoUrl = tenant?.logoUrl?.trim();
  const cacheBust = encodeURIComponent(`${tenant?.id ?? "default"}:${logoUrl ?? "fallback"}:${size}`);

  try {
    const logoBuffer = await fetchLogoBuffer(logoUrl);
    const icon = logoBuffer
      ? await createPngIconFromBuffer(logoBuffer, size)
      : await createFallbackPngIcon(appName, themeColor, size);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    res.setHeader("ETag", `W/\"${cacheBust}\"`);
    res.send(icon);
  } catch (error) {
    console.warn("[pwa] Falha ao gerar ícone PWA; usando fallback", error);
    const fallback = await createFallbackPngIcon(appName, themeColor, size);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    res.setHeader("ETag", `W/\"${cacheBust}:fallback\"`);
    res.send(fallback);
  }
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

  app.get(
    [
      "/pwa-icon.png",
      "/pwa-icon-180.png",
      "/pwa-icon-192.png",
      "/pwa-icon-256.png",
      "/pwa-icon-384.png",
      "/pwa-icon-512.png",
      "/apple-touch-icon.png",
      "/apple-touch-icon-180x180.png",
      "/apple-touch-icon-192x192.png",
    ],
    async (req, res, next) => {
      try {
        const tenant = await resolveTenant(req);
        await sendPwaIcon(req, res, tenant);
      } catch (error) {
        next(error);
      }
    },
  );
}
