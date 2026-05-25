import type { Express } from "express";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import {
  getContentTypeFromKey,
  getLocalStoragePath,
  isForgeStorageConfigured,
  normalizeStorageKey,
} from "../storage";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const rawKey = (req.params as Record<string, string>)[0];
    if (!rawKey) {
      res.status(400).send("Missing storage key");
      return;
    }

    let key: string;
    try {
      key = normalizeStorageKey(rawKey);
    } catch {
      res.status(400).send("Invalid storage key");
      return;
    }

    if (!isForgeStorageConfigured()) {
      try {
        const localPath = getLocalStoragePath(key);
        const stat = await fs.stat(localPath);
        if (!stat.isFile()) {
          res.status(404).send("File not found");
          return;
        }

        res.set("Content-Type", getContentTypeFromKey(key));
        res.set("Content-Length", String(stat.size));
        res.set("Cache-Control", "public, max-age=300, must-revalidate");
        createReadStream(localPath).pipe(res);
      } catch (err: any) {
        if (err?.code === "ENOENT") {
          res.status(404).send("File not found");
          return;
        }
        console.error("[StorageProxy] local storage failed:", err);
        res.status(500).send("Storage proxy error");
      }
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
