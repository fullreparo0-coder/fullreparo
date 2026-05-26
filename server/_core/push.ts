import crypto from "crypto";
import webPush, { type PushSubscription } from "web-push";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { ENV } from "./env";
import { getDb } from "../db";
import { pushSubscriptions } from "../../drizzle/schema";

export type PushTargetType = "tenant_user" | "customer";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
};

export type SavePushSubscriptionInput = {
  tenantId: number;
  targetType: PushTargetType;
  userId?: number | null;
  customerId?: number | null;
  subscription: PushSubscription;
  userAgent?: string | null;
};

let webPushConfigured = false;

function configureWebPush() {
  if (webPushConfigured) return;
  if (!ENV.vapidPublicKey || !ENV.vapidPrivateKey) return;

  webPush.setVapidDetails(ENV.vapidSubject, ENV.vapidPublicKey, ENV.vapidPrivateKey);
  webPushConfigured = true;
}

export function isPushConfigured() {
  return Boolean(ENV.vapidPublicKey && ENV.vapidPrivateKey);
}

export function getVapidPublicKey() {
  return ENV.vapidPublicKey || null;
}

export function hashEndpoint(endpoint: string) {
  return crypto.createHash("sha256").update(endpoint).digest("hex");
}

export async function savePushSubscription(input: SavePushSubscriptionInput) {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível");

  const endpoint = input.subscription.endpoint;
  const p256dh = input.subscription.keys?.p256dh;
  const auth = input.subscription.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Assinatura push inválida");
  }

  const endpointHash = hashEndpoint(endpoint);
  const values = {
    tenantId: input.tenantId,
    targetType: input.targetType,
    userId: input.userId ?? null,
    customerId: input.customerId ?? null,
    endpoint,
    endpointHash,
    p256dh,
    auth,
    userAgent: input.userAgent ?? null,
    revokedAt: null,
    lastUsedAt: new Date(),
  };

  await db
    .insert(pushSubscriptions)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        tenantId: values.tenantId,
        targetType: values.targetType,
        userId: values.userId,
        customerId: values.customerId,
        endpoint: values.endpoint,
        p256dh: values.p256dh,
        auth: values.auth,
        userAgent: values.userAgent,
        revokedAt: null,
        lastUsedAt: new Date(),
      },
    });

  return { success: true, endpointHash } as const;
}

export async function revokePushSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível");

  await db
    .update(pushSubscriptions)
    .set({ revokedAt: new Date() })
    .where(eq(pushSubscriptions.endpointHash, hashEndpoint(endpoint)));

  return { success: true } as const;
}

async function sendToSubscriptions(rows: Array<typeof pushSubscriptions.$inferSelect>, payload: PushPayload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0, skipped: rows.length, configured: false };
  configureWebPush();

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag,
    icon: payload.icon ?? "/pwa-icon-192.png",
    badge: payload.badge ?? "/pwa-icon-192.png",
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(rows.map(async (row) => {
    try {
      await webPush.sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }, body);
      sent += 1;
    } catch (error: any) {
      failed += 1;
      const statusCode = Number(error?.statusCode ?? 0);
      if ([404, 410].includes(statusCode)) {
        const db = await getDb();
        await db?.update(pushSubscriptions).set({ revokedAt: new Date() }).where(eq(pushSubscriptions.id, row.id));
      } else {
        console.warn("[push-pwa] Falha ao enviar push", { subscriptionId: row.id, statusCode, error: error?.message });
      }
    }
  }));

  return { sent, failed, skipped: 0, configured: true };
}

export async function sendPushToTenantUsers(tenantId: number, payload: PushPayload, userIds?: number[]) {
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0, skipped: 0, configured: false };

  const conditions = [
    eq(pushSubscriptions.tenantId, tenantId),
    eq(pushSubscriptions.targetType, "tenant_user"),
    isNull(pushSubscriptions.revokedAt),
  ];

  if (userIds && userIds.length > 0) {
    conditions.push(inArray(pushSubscriptions.userId, userIds));
  }

  const rows = await db.select().from(pushSubscriptions).where(and(...conditions));
  return sendToSubscriptions(rows, payload);
}

export async function sendPushToCustomers(tenantId: number, customerIds: number[], payload: PushPayload) {
  const db = await getDb();
  if (!db || customerIds.length === 0) return { sent: 0, failed: 0, skipped: 0, configured: false };

  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.targetType, "customer"),
      inArray(pushSubscriptions.customerId, customerIds),
      isNull(pushSubscriptions.revokedAt),
    ));

  return sendToSubscriptions(rows, payload);
}
