// Storage helpers.
// Preferem o storage externo Forge quando configurado. Quando as variáveis
// BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY não existem no ambiente de
// produção, usam armazenamento local no servidor e mantêm a mesma URL pública
// /manus-storage/{key}, evitando falha no upload de logos e fotos.

import { promises as fs } from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "uploads");

function hasForgeConfig() {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

export function isForgeStorageConfigured(): boolean {
  return hasForgeConfig();
}

export function normalizeStorageKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "").replace(/\\/g, "/");
  const parts = key.split("/").filter(Boolean);

  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    throw new Error("Invalid storage key");
  }

  return parts.join("/");
}

export function getLocalStoragePath(relKey: string): string {
  const key = normalizeStorageKey(relKey);
  const fullPath = path.resolve(LOCAL_STORAGE_DIR, key);
  const storageRoot = path.resolve(LOCAL_STORAGE_DIR);

  if (!fullPath.startsWith(storageRoot + path.sep) && fullPath !== storageRoot) {
    throw new Error("Invalid storage path");
  }

  return fullPath;
}

export function getContentTypeFromKey(relKey: string): string {
  const ext = path.extname(relKey).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".pdf":
      return "application/pdf";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

async function putLocalStorage(
  relKey: string,
  data: Buffer | Uint8Array | string,
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeStorageKey(relKey));
  const fullPath = getLocalStoragePath(key);
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  return { key, url: `/manus-storage/${key}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  if (!hasForgeConfig()) {
    return putLocalStorage(relKey, data);
  }

  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeStorageKey(relKey));

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeStorageKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeStorageKey(relKey);

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}

export async function storageReadBuffer(relKey: string): Promise<{ key: string; buffer: Buffer; contentType: string }> {
  const key = normalizeStorageKey(relKey);

  if (!hasForgeConfig()) {
    const fullPath = getLocalStoragePath(key);
    const buffer = await fs.readFile(fullPath);
    return { key, buffer, contentType: getContentTypeFromKey(key) };
  }

  const signedUrl = await storageGetSignedUrl(key);
  const upstream = await fetch(signedUrl);
  if (!upstream.ok) {
    throw new Error(`Storage download failed (${upstream.status})`);
  }

  const contentType = upstream.headers.get("content-type") || getContentTypeFromKey(key);
  return { key, buffer: Buffer.from(await upstream.arrayBuffer()), contentType };
}
