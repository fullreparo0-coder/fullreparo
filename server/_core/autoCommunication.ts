import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { sendTenantEmail } from "../email";
import { budgets, customers, devices, osNotifications, serviceOrders, tenants } from "../../drizzle/schema";
import { getTenantPortalUrl } from "../../shared/tenantUrl";

type AutoCommunicationEvent = "os_opened" | "budget_available" | "service_completed" | "ready_for_pickup";

type TriggerParams = {
  tenantId: number;
  serviceOrderId: number;
  event: AutoCommunicationEvent;
  actorName?: string | null;
  origin?: string | null;
};

type EventTemplate = {
  status: string;
  title: string;
  emailSubject: (osNumber: string, tenantName: string) => string;
  message: (params: {
    customerName: string;
    tenantName: string;
    osNumber: string;
    trackingUrl: string;
    budgetTotal?: string | null;
  }) => string;
  emailIntro: string;
  ctaLabel: string;
};

const EVENT_TEMPLATES: Record<AutoCommunicationEvent, EventTemplate> = {
  os_opened: {
    status: "os_aberta",
    title: "OS aberta",
    emailSubject: (osNumber, tenantName) => `${tenantName}: OS ${osNumber} aberta`,
    message: ({ customerName, tenantName, osNumber, trackingUrl }) =>
      `Olá, ${customerName}. Sua OS ${osNumber} foi aberta pela ${tenantName}. Acompanhe o andamento pelo link: ${trackingUrl}`,
    emailIntro: "Sua ordem de serviço foi registrada com sucesso.",
    ctaLabel: "Acompanhar OS",
  },
  budget_available: {
    status: "aguardando_aprovacao",
    title: "Orçamento disponível",
    emailSubject: (osNumber, tenantName) => `${tenantName}: orçamento da OS ${osNumber} disponível`,
    message: ({ customerName, tenantName, osNumber, trackingUrl, budgetTotal }) =>
      `Olá, ${customerName}. O orçamento${budgetTotal ? ` de ${budgetTotal}` : ""} da OS ${osNumber} está disponível na ${tenantName}. Acesse para visualizar e responder: ${trackingUrl}`,
    emailIntro: "O orçamento da sua ordem de serviço já está disponível para visualização e resposta.",
    ctaLabel: "Ver orçamento",
  },
  service_completed: {
    status: "finalizado",
    title: "Serviço concluído",
    emailSubject: (osNumber, tenantName) => `${tenantName}: serviço concluído na OS ${osNumber}`,
    message: ({ customerName, tenantName, osNumber, trackingUrl }) =>
      `Olá, ${customerName}. O serviço da OS ${osNumber} foi concluído pela ${tenantName}. Veja os detalhes pelo link: ${trackingUrl}`,
    emailIntro: "O serviço da sua ordem de serviço foi concluído.",
    ctaLabel: "Ver detalhes da OS",
  },
  ready_for_pickup: {
    status: "pronto",
    title: "Pronto para retirada",
    emailSubject: (osNumber, tenantName) => `${tenantName}: OS ${osNumber} pronta para retirada`,
    message: ({ customerName, tenantName, osNumber, trackingUrl }) =>
      `Olá, ${customerName}. Seu aparelho da OS ${osNumber} está pronto para retirada na ${tenantName}. Confira os detalhes pelo link: ${trackingUrl}`,
    emailIntro: "Seu aparelho está pronto para retirada.",
    ctaLabel: "Acompanhar retirada",
  },
};

function isValidEmail(email?: string | null): email is string {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function formatCurrency(value?: string | number | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildCustomerEmailHtml(params: {
  tenantName: string;
  customerName: string;
  osNumber: string;
  title: string;
  intro: string;
  message: string;
  trackingUrl: string;
  ctaLabel: string;
  budgetTotal?: string | null;
}): string {
  const safeTenant = escapeHtml(params.tenantName);
  const safeCustomer = escapeHtml(params.customerName);
  const safeOs = escapeHtml(params.osNumber);
  const safeTitle = escapeHtml(params.title);
  const safeIntro = escapeHtml(params.intro);
  const safeMessage = escapeHtml(params.message);
  const safeUrl = escapeHtml(params.trackingUrl);
  const safeCta = escapeHtml(params.ctaLabel);
  const safeBudget = params.budgetTotal ? escapeHtml(params.budgetTotal) : null;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:#1e3a5f;padding:26px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.25;">${safeTitle}</h1>
              <p style="margin:6px 0 0;color:#cbd5e1;font-size:14px;">${safeTenant}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 14px;font-size:16px;">Olá, <strong>${safeCustomer}</strong>.</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${safeIntro}</p>
              <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:18px 0;">
                <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Ordem de serviço</p>
                <p style="margin:0;font-size:20px;font-weight:700;color:#1e3a5f;">OS ${safeOs}</p>
                ${safeBudget ? `<p style="margin:10px 0 0;font-size:15px;color:#111827;"><strong>Valor do orçamento:</strong> ${safeBudget}</p>` : ""}
              </div>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#4b5563;">${safeMessage}</p>
              <a href="${safeUrl}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;">${safeCta}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 30px;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">Este é um aviso automático enviado pelo FullReparo em nome da assistência. Se você não reconhece esta ordem de serviço, entre em contato diretamente com a assistência.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

async function alreadyRecorded(params: {
  tenantId: number;
  serviceOrderId: number;
  status: string;
  eventType: string;
  channel: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [existing] = await db
    .select({ id: osNotifications.id })
    .from(osNotifications)
    .where(
      and(
        eq(osNotifications.tenantId, params.tenantId),
        eq(osNotifications.serviceOrderId, params.serviceOrderId),
        eq(osNotifications.status, params.status),
        eq(osNotifications.eventType, params.eventType),
        eq(osNotifications.channel, params.channel),
      ),
    )
    .limit(1);
  return Boolean(existing);
}

export async function triggerAutoCommunication(params: TriggerParams): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const template = EVENT_TEMPLATES[params.event];
  if (!template) return;

  try {
    const [osRow] = await db
      .select()
      .from(serviceOrders)
      .where(and(eq(serviceOrders.id, params.serviceOrderId), eq(serviceOrders.tenantId, params.tenantId)))
      .limit(1);
    if (!osRow) return;

    const [[tenantRow], [customerRow], [deviceRow], [latestBudget]] = await Promise.all([
      db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1),
      db
        .select()
        .from(customers)
        .where(and(eq(customers.id, osRow.customerId), eq(customers.tenantId, params.tenantId)))
        .limit(1),
      osRow.deviceId
        ? db
            .select()
            .from(devices)
            .where(and(eq(devices.id, osRow.deviceId), eq(devices.tenantId, params.tenantId)))
            .limit(1)
        : Promise.resolve([]),
      params.event === "budget_available"
        ? db
            .select()
            .from(budgets)
            .where(and(eq(budgets.serviceOrderId, params.serviceOrderId), eq(budgets.tenantId, params.tenantId)))
            .limit(1)
        : Promise.resolve([]),
    ]);

    if (!tenantRow || !customerRow) return;

    const baseUrl = params.origin || getTenantPortalUrl(tenantRow.slug, tenantRow.customDomain ?? null);
    const trackingUrl = osRow.publicToken ? `${baseUrl}/rastrear/${osRow.publicToken}` : `${baseUrl}/painel/os/${osRow.id}`;
    const budgetTotal = params.event === "budget_available" ? formatCurrency(latestBudget?.totalCost) : null;
    const message = template.message({
      customerName: customerRow.name,
      tenantName: tenantRow.name,
      osNumber: osRow.osNumber,
      trackingUrl,
      budgetTotal,
    });
    const actorName = params.actorName || "Sistema";
    const eventType = "auto_communication";

    const pushAlreadyRecorded = await alreadyRecorded({
      tenantId: params.tenantId,
      serviceOrderId: params.serviceOrderId,
      status: template.status,
      eventType,
      channel: "push_pwa",
    });
    if (!pushAlreadyRecorded) {
      await db.insert(osNotifications).values({
        tenantId: params.tenantId,
        serviceOrderId: params.serviceOrderId,
        status: template.status,
        channel: "push_pwa",
        message,
        eventType,
        actorName,
      });
    }

    if (isValidEmail(customerRow.email)) {
      const emailAlreadyRecorded = await alreadyRecorded({
        tenantId: params.tenantId,
        serviceOrderId: params.serviceOrderId,
        status: template.status,
        eventType,
        channel: "email",
      });
      if (!emailAlreadyRecorded) {
        const deviceLabel = [deviceRow?.brand, deviceRow?.model].filter(Boolean).join(" ");
        const html = buildCustomerEmailHtml({
          tenantName: tenantRow.name,
          customerName: customerRow.name,
          osNumber: osRow.osNumber,
          title: template.title,
          intro: deviceLabel ? `${template.emailIntro} Aparelho: ${deviceLabel}.` : template.emailIntro,
          message,
          trackingUrl,
          ctaLabel: template.ctaLabel,
          budgetTotal,
        });
        const sent = await sendTenantEmail({
          to: customerRow.email,
          subject: template.emailSubject(osRow.osNumber, tenantRow.name),
          html,
          text: `${template.title}\n\n${message}`,
        });
        await db.insert(osNotifications).values({
          tenantId: params.tenantId,
          serviceOrderId: params.serviceOrderId,
          status: template.status,
          channel: "email",
          message: sent ? message : `${message} (e-mail não enviado: Resend indisponível ou erro no provedor)`,
          eventType,
          actorName,
        });
      }
    }
  } catch (error) {
    console.warn(`[AutoCommunication] Falha no evento ${params.event}:`, error);
  }
}

export function autoCommunicationEventForStatus(status: string): AutoCommunicationEvent | null {
  if (status === "pronto") return "ready_for_pickup";
  if (status === "finalizado") return "service_completed";
  return null;
}
