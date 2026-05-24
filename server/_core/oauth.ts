import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Tenta decodificar o state JWT/base64 e extrair { origin, returnPath }.
 * Suporta o formato antigo (state = btoa(redirectUri)) e o novo
 * (state = btoa(JSON.stringify({ origin, returnPath }))).
 */
function parseState(state: string): { origin: string; returnPath: string | null } {
  try {
    const decoded = atob(state);
    // Novo formato: JSON com origin + returnPath
    if (decoded.startsWith("{")) {
      const parsed = JSON.parse(decoded) as { origin?: string; returnPath?: string | null };
      const origin = parsed.origin ?? "";
      const returnPath = parsed.returnPath ?? null;
      return { origin, returnPath };
    }
    // Formato legado: state = btoa(redirectUri) → extrai origin da URI
    const url = new URL(decoded);
    return { origin: url.origin, returnPath: null };
  } catch {
    return { origin: "", returnPath: null };
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Determina para onde redirecionar após o login
      const { origin, returnPath } = parseState(state);

      // Se há um returnPath explícito, usa-o (ex: "/minha-conta" vindo do portal público)
      // Caso contrário, redireciona para "/" e o App.tsx decide com base no role
      const destination = returnPath
        ? `${origin}${returnPath}`
        : `${origin || ""}/`;

      res.redirect(302, destination || "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
