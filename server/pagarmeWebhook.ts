import express from "express";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "./db";
import { payments, tenants } from "../drizzle/schema";
import { normalizePagarmeStatus, verifyPagarmeWebhookSignature } from "./_core/pagarme";
import { notifyOwner } from "./_core/notification";

function pickCharge(payload: any) {
  const data = payload?.data || payload;
  if (data?.charges?.[0]) return data.charges[0];
  if (data?.charge) return data.charge;
  if (data?.id && (data?.code || data?.last_transaction || data?.status)) return data;
  return null;
}

function pickOrder(payload: any) {
  const data = payload?.data || payload;
  return data?.order || data;
}

export function registerPagarmeWebhook(app: express.Express) {
  app.post("/api/webhooks/pagarme", express.raw({ type: "application/json", limit: "2mb" }), async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      const payload = JSON.parse(rawBody.toString("utf8"));
      const db = await getDb();
      if (!db) return res.status(503).json({ ok: false });

      const charge = pickCharge(payload);
      const order = pickOrder(payload);
      const orderId = order?.id || charge?.order?.id || null;
      const chargeId = charge?.id || null;
      const transactionId = charge?.last_transaction?.id || null;

      if (!orderId && !chargeId && !transactionId) {
        return res.status(202).json({ ok: true, ignored: true });
      }

      const conditions = [
        orderId ? eq(payments.gatewayOrderId, orderId) : null,
        chargeId ? eq(payments.gatewayChargeId, chargeId) : null,
        transactionId ? eq(payments.gatewayPaymentId, transactionId) : null,
      ].filter(Boolean) as any[];
      const rows = await db
        .select()
        .from(payments)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .limit(1);
      const payment = rows[0];
      if (!payment) return res.status(202).json({ ok: true, ignored: true });

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, payment.tenantId)).limit(1);
      const signature = req.headers["x-hub-signature"] || req.headers["x-hub-signature-256"] || req.headers["x-pagarme-signature"];
      if (tenant?.pagarmeWebhookSecret && !verifyPagarmeWebhookSignature(rawBody, signature, tenant.pagarmeWebhookSecret)) {
        return res.status(401).json({ ok: false, message: "Assinatura inválida" });
      }

      const gatewayStatus = charge?.status || charge?.last_transaction?.status || payload?.type || payment.gatewayStatus;
      const status = normalizePagarmeStatus(gatewayStatus);
      const updates: any = {
        status,
        gatewayStatus: String(gatewayStatus || status),
        metadata: payload,
      };
      if (status === "paid" && !payment.paidAt) updates.paidAt = new Date();
      await db.update(payments).set(updates).where(and(eq(payments.id, payment.id), eq(payments.tenantId, payment.tenantId)));

      if (status === "paid") {
        await notifyOwner({ title: `Pagamento confirmado na OS #${payment.serviceOrderId}`, content: `O Pagar.me confirmou o pagamento de R$ ${Number(payment.amount).toFixed(2)}.` }).catch(() => undefined);
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error("Erro no webhook Pagar.me", error);
      return res.status(500).json({ ok: false });
    }
  });
}
