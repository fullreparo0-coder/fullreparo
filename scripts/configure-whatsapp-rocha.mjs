#!/usr/bin/env node
import mysql from "mysql2/promise";

const required = ["DATABASE_URL", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Variáveis ausentes: ${missing.join(", ")}`);
  process.exit(1);
}

const tenantSlug = process.env.WHATSAPP_TENANT_SLUG || "rocha";
const displayName = process.env.WHATSAPP_DISPLAY_NAME || "Rocha";
const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const budgetTemplateName = process.env.WHATSAPP_BUDGET_TEMPLATE_NAME || "fullreparo_orcamento_disponivel";
const readyTemplateName = process.env.WHATSAPP_READY_TEMPLATE_NAME || "fullreparo_os_pronta";
const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [tenants] = await connection.execute(
    "SELECT id, name, slug, planId FROM tenants WHERE slug = ? OR customDomain LIKE ? LIMIT 1",
    [tenantSlug, `${tenantSlug}.%`],
  );

  if (!tenants.length) {
    throw new Error(`Tenant não encontrado para slug/domínio: ${tenantSlug}`);
  }

  const tenant = tenants[0];

  const [existing] = await connection.execute(
    "SELECT id FROM whatsapp_integrations WHERE tenantId = ? LIMIT 1",
    [tenant.id],
  );

  const values = [
    1,
    "meta_cloud_api",
    displayName,
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    process.env.WHATSAPP_PHONE_NUMBER_ID,
    process.env.WHATSAPP_PHONE_NUMBER || null,
    process.env.WHATSAPP_ACCESS_TOKEN,
    graphApiVersion,
    budgetTemplateName,
    readyTemplateName,
    templateLanguage,
    "configured",
    "Credenciais Meta Cloud API configuradas. Aguardando validação de envio e webhook.",
    tenant.id,
  ];

  if (existing.length) {
    await connection.execute(
      `UPDATE whatsapp_integrations
       SET enabled = ?, provider = ?, displayName = ?, businessAccountId = ?, phoneNumberId = ?, phoneNumber = ?, accessToken = ?, graphApiVersion = ?, budgetTemplateName = ?, readyTemplateName = ?, templateLanguage = ?, lastHealthStatus = ?, lastHealthMessage = ?, lastCheckedAt = NOW(), updatedAt = NOW()
       WHERE tenantId = ?`,
      values,
    );
  } else {
    await connection.execute(
      `INSERT INTO whatsapp_integrations
       (enabled, provider, displayName, businessAccountId, phoneNumberId, phoneNumber, accessToken, graphApiVersion, budgetTemplateName, readyTemplateName, templateLanguage, lastHealthStatus, lastHealthMessage, lastCheckedAt, tenantId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
      values,
    );
  }

  await connection.execute(
    "UPDATE plans SET hasWhatsapp = 1, updatedAt = NOW() WHERE id = ?",
    [tenant.planId],
  );

  console.log(JSON.stringify({
    ok: true,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    tokenStored: true,
    planWhatsappEnabled: true,
  }, null, 2));
} finally {
  await connection.end();
}
