import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  customers,
  osNotifications,
  plans,
  serviceOrders,
  tenants,
  whatsappIntegrations,
  whatsappMessageLogs,
} from "../../drizzle/schema";

export type WhatsappTransactionalEvent = "budget_available" | "service_order_ready";

const UTILITY_MESSAGE_COST_USD = "0.0068";

const EVENT_STATUS: Record<WhatsappTransactionalEvent, string> = {
  budget_available: "aguardando_aprovacao",
  service_order_ready: "pronto",
};

const EVENT_LABEL: Record<WhatsappTransactionalEvent, string> = {
  budget_available: "Orçamento disponível",
  service_order_ready: "OS pronta",
};

function normalizePhoneToE164(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 ? digits : null;
}

function maskTokenPreview(token?: string | null): string | null {
  if (!token) return null;
  if (token.length <= 8) return "••••••••";
  return `••••${token.slice(-4)}`;
}

function buildTemplateComponents(params: {
  event: WhatsappTransactionalEvent;
  tenantName: string;
  customerName: string;
  osNumber: string;
  publicUrl?: string | null;
}) {
  const serviceLabel = params.event === "budget_available" ? "orçamento" : "serviço";
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: params.customerName },
        { type: "text", text: params.tenantName },
        { type: "text", text: params.osNumber },
        { type: "text", text: serviceLabel },
      ],
    },
    ...(params.publicUrl
      ? [
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: params.publicUrl }],
          },
        ]
      : []),
  ];
}

function buildFallbackMessage(params: {
  event: WhatsappTransactionalEvent;
  tenantName: string;
  osNumber: string;
  publicUrl?: string | null;
}) {
  if (params.event === "budget_available") {
    return `Seu orçamento da OS ${params.osNumber} está disponível em ${params.tenantName}.${params.publicUrl ? ` Acesse: ${params.publicUrl}` : ""}`;
  }
  return `Seu equipamento da OS ${params.osNumber} está pronto em ${params.tenantName}.${params.publicUrl ? ` Acompanhe: ${params.publicUrl}` : ""}`;
}

export async function getWhatsappEligibility(tenantId: number) {
  const db = await getDb();
  if (!db) return { eligible: false, reason: "Banco de dados indisponível", planHasWhatsapp: false };

  const [row] = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
      planId: plans.id,
      planName: plans.name,
      planPrice: plans.price,
      hasWhatsapp: plans.hasWhatsapp,
    })
    .from(tenants)
    .innerJoin(plans, eq(tenants.planId, plans.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!row) return { eligible: false, reason: "Tenant não encontrado", planHasWhatsapp: false };
  if (row.tenantStatus === "blocked" || row.tenantStatus === "suspended") {
    return { eligible: false, reason: "Tenant bloqueado ou suspenso", planHasWhatsapp: Boolean(row.hasWhatsapp), plan: row };
  }
  if (!row.hasWhatsapp) {
    return { eligible: false, reason: "Plano sem WhatsApp incluso", planHasWhatsapp: false, plan: row };
  }
  return { eligible: true, reason: "WhatsApp habilitado pelo plano", planHasWhatsapp: true, plan: row };
}

export async function getWhatsappIntegrationForTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const [integration] = await db
    .select()
    .from(whatsappIntegrations)
    .where(eq(whatsappIntegrations.tenantId, tenantId))
    .orderBy(desc(whatsappIntegrations.updatedAt))
    .limit(1);
  return integration ?? null;
}

export function sanitizeWhatsappIntegration<T extends { accessToken?: string | null } | null>(integration: T) {
  if (!integration) return null;
  const { accessToken: _accessToken, ...safeIntegration } = integration;
  return {
    ...safeIntegration,
    hasAccessToken: Boolean(_accessToken),
    accessTokenPreview: maskTokenPreview(_accessToken),
  };
}

export async function triggerWhatsappTransactional(params: {
  tenantId: number;
  serviceOrderId: number;
  event: WhatsappTransactionalEvent;
  actorName?: string | null;
  origin?: string | null;
}) {
  const db = await getDb();
  if (!db) return { sent: false, skipped: true, reason: "Banco de dados indisponível" };

  const eligibility = await getWhatsappEligibility(params.tenantId);
  if (!eligibility.eligible) {
    return { sent: false, skipped: true, reason: eligibility.reason };
  }

  const integration = await getWhatsappIntegrationForTenant(params.tenantId);
  if (!integration?.enabled) {
    return { sent: false, skipped: true, reason: "Integração WhatsApp desativada" };
  }

  const [row] = await db
    .select({
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      osId: serviceOrders.id,
      osNumber: serviceOrders.osNumber,
      publicToken: serviceOrders.publicToken,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(serviceOrders)
    .innerJoin(tenants, eq(serviceOrders.tenantId, tenants.id))
    .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
    .where(and(eq(serviceOrders.id, params.serviceOrderId), eq(serviceOrders.tenantId, params.tenantId)))
    .limit(1);

  if (!row) return { sent: false, skipped: true, reason: "OS não encontrada" };

  const toPhone = normalizePhoneToE164(row.customerPhone);
  const templateName = params.event === "budget_available" ? integration.budgetTemplateName : integration.readyTemplateName;
  const templateLanguage = integration.templateLanguage || "pt_BR";
  const publicUrl = row.publicToken ? `/acompanhar/${row.publicToken}` : null;
  const displayUrl = publicUrl && params.origin ? `${params.origin}${publicUrl}` : publicUrl;
  const message = buildFallbackMessage({ event: params.event, tenantName: row.tenantName, osNumber: row.osNumber, publicUrl: displayUrl });

  if (!toPhone) {
    await db.insert(whatsappMessageLogs).values({
      tenantId: params.tenantId,
      serviceOrderId: params.serviceOrderId,
      customerId: row.customerId,
      eventType: params.event,
      templateName,
      templateLanguage,
      toPhone: row.customerPhone || "sem_telefone",
      status: "skipped",
      errorMessage: "Telefone do cliente ausente ou inválido",
      estimatedCostUsd: UTILITY_MESSAGE_COST_USD,
    });
    return { sent: false, skipped: true, reason: "Telefone do cliente ausente ou inválido" };
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: buildTemplateComponents({
        event: params.event,
        tenantName: row.tenantName,
        customerName: row.customerName,
        osNumber: row.osNumber,
        publicUrl,
      }),
    },
  };

  const insertResult = await db.insert(whatsappMessageLogs).values({
    tenantId: params.tenantId,
    serviceOrderId: params.serviceOrderId,
    customerId: row.customerId,
    eventType: params.event,
    templateName,
    templateLanguage,
    toPhone,
    status: "queued",
    requestPayload: payload,
    estimatedCostUsd: UTILITY_MESSAGE_COST_USD,
  });
  const logId = Number((insertResult as any)[0]?.insertId ?? (insertResult as any).insertId);

  if (!integration.phoneNumberId || !integration.accessToken) {
    await db
      .update(whatsappMessageLogs)
      .set({ status: "failed", errorMessage: "Integração sem phoneNumberId ou accessToken configurado" })
      .where(eq(whatsappMessageLogs.id, logId));
    return { sent: false, skipped: false, reason: "Integração sem phoneNumberId ou accessToken configurado" };
  }

  const graphVersion = integration.graphApiVersion || "v23.0";
  const endpoint = `https://graph.facebook.com/${graphVersion}/${integration.phoneNumberId}/messages`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const responsePayload = await response.json().catch(() => ({ raw: "Resposta sem JSON" }));
    const metaMessageId = responsePayload?.messages?.[0]?.id ?? null;

    if (!response.ok) {
      const errorMessage = responsePayload?.error?.message ?? `Falha HTTP ${response.status}`;
      await db
        .update(whatsappMessageLogs)
        .set({ status: "failed", responsePayload, errorMessage })
        .where(eq(whatsappMessageLogs.id, logId));
      await db
        .update(whatsappIntegrations)
        .set({ lastHealthStatus: "error", lastHealthMessage: errorMessage, lastCheckedAt: new Date() })
        .where(eq(whatsappIntegrations.id, integration.id));
      return { sent: false, skipped: false, reason: errorMessage };
    }

    await db
      .update(whatsappMessageLogs)
      .set({ status: "sent", responsePayload, metaMessageId, sentAt: new Date() })
      .where(eq(whatsappMessageLogs.id, logId));
    await db.insert(osNotifications).values({
      tenantId: params.tenantId,
      serviceOrderId: params.serviceOrderId,
      status: EVENT_STATUS[params.event],
      channel: "whatsapp",
      message,
      eventType: params.event === "budget_available" ? "whatsapp_budget_available" : "whatsapp_service_order_ready",
      actorName: params.actorName ?? "Sistema",
    });
    await db
      .update(whatsappIntegrations)
      .set({ lastHealthStatus: "ok", lastHealthMessage: `${EVENT_LABEL[params.event]} enviado`, lastCheckedAt: new Date() })
      .where(eq(whatsappIntegrations.id, integration.id));

    return { sent: true, skipped: false, messageId: metaMessageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao chamar Meta Cloud API";
    await db
      .update(whatsappMessageLogs)
      .set({ status: "failed", errorMessage })
      .where(eq(whatsappMessageLogs.id, logId));
    await db
      .update(whatsappIntegrations)
      .set({ lastHealthStatus: "error", lastHealthMessage: errorMessage, lastCheckedAt: new Date() })
      .where(eq(whatsappIntegrations.id, integration.id));
    return { sent: false, skipped: false, reason: errorMessage };
  }
}
