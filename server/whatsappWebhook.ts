import crypto from "crypto";
import express from "express";
import { eq, or } from "drizzle-orm";
import { getDb } from "./db";
import { whatsappIntegrations, whatsappMessageLogs } from "../drizzle/schema";

function getVerifyToken() {
  return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WHATSAPP_VERIFY_TOKEN || "";
}

function getAppSecret() {
  return process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || "";
}

function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | string[] | undefined, appSecret: string) {
  if (!appSecret) return true;
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const received = Buffer.from(signature, "utf8");
  const target = Buffer.from(expected, "utf8");
  return received.length === target.length && crypto.timingSafeEqual(received, target);
}

function mapMetaStatus(status?: string | null) {
  if (status === "failed") return "failed" as const;
  return "sent" as const;
}

function extractErrorMessage(status: any) {
  const error = status?.errors?.[0];
  if (!error) return null;
  return [error.title, error.message, error.error_data?.details].filter(Boolean).join(" — ") || "Falha retornada pela Meta";
}

async function touchIntegration(phoneNumberId: string | null, businessAccountId: string | null, message: string, status: "ok" | "error" = "ok") {
  if (!phoneNumberId && !businessAccountId) return;
  const db = await getDb();
  if (!db) return;
  const conditions = [
    phoneNumberId ? eq(whatsappIntegrations.phoneNumberId, phoneNumberId) : null,
    businessAccountId ? eq(whatsappIntegrations.businessAccountId, businessAccountId) : null,
  ].filter(Boolean) as any[];
  if (!conditions.length) return;
  await db
    .update(whatsappIntegrations)
    .set({ lastHealthStatus: status, lastHealthMessage: message, lastCheckedAt: new Date() })
    .where(conditions.length === 1 ? conditions[0] : or(...conditions));
}

async function updateMessageStatus(status: any, payload: any) {
  const db = await getDb();
  if (!db || !status?.id) return;
  const mappedStatus = mapMetaStatus(status.status);
  const errorMessage = extractErrorMessage(status);
  await db
    .update(whatsappMessageLogs)
    .set({
      status: mappedStatus,
      responsePayload: payload,
      errorMessage,
      sentAt: mappedStatus === "sent" ? new Date() : undefined,
    })
    .where(eq(whatsappMessageLogs.metaMessageId, status.id));
}

async function processWhatsappWebhook(payload: any) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const businessAccountId = entry?.id ? String(entry.id) : null;
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id ? String(value.metadata.phone_number_id) : null;
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      for (const status of statuses) {
        await updateMessageStatus(status, payload);
        const errorMessage = extractErrorMessage(status);
        await touchIntegration(
          phoneNumberId,
          businessAccountId,
          errorMessage ? `Webhook Meta: ${status.status} — ${errorMessage}` : `Webhook Meta: status ${status.status || "recebido"}`,
          errorMessage ? "error" : "ok",
        );
      }

      if (messages.length > 0) {
        await touchIntegration(
          phoneNumberId,
          businessAccountId,
          `Webhook Meta: ${messages.length} mensagem(ns) de entrada recebida(s)`,
          "ok",
        );
      }
    }
  }
}

export function registerWhatsappWebhook(app: express.Express) {
  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const expectedToken = getVerifyToken();

    if (mode === "subscribe" && expectedToken && token === expectedToken && typeof challenge === "string") {
      return res.status(200).send(challenge);
    }

    return res.status(403).json({ ok: false, message: "Token de verificação inválido" });
  });

  app.post("/api/webhooks/whatsapp", express.raw({ type: "application/json", limit: "2mb" }), async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      const appSecret = getAppSecret();
      if (!verifyMetaSignature(rawBody, req.headers["x-hub-signature-256"], appSecret)) {
        return res.status(401).json({ ok: false, message: "Assinatura inválida" });
      }

      const payload = JSON.parse(rawBody.toString("utf8") || "{}");
      await processWhatsappWebhook(payload);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Erro no webhook WhatsApp", error);
      return res.status(500).json({ ok: false });
    }
  });
}
