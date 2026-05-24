import crypto from "crypto";

export type PagarmeEnvironment = "sandbox" | "production";

export type PagarmeTenantConfig = {
  enabled: boolean;
  environment: string | null;
  publicKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
};

export type CreatePagarmeChargeInput = {
  config: PagarmeTenantConfig;
  serviceOrderId: number;
  osNumber: string;
  amount: number;
  method: "pix" | "cartao_credito";
  customer: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    document?: string | null;
  };
  card?: {
    number: string;
    holderName: string;
    expMonth: number;
    expYear: number;
    cvv: string;
    installments?: number;
  };
};

export type PagarmeChargeResult = {
  orderId: string | null;
  chargeId: string | null;
  status: string;
  gatewayPaymentId: string | null;
  pixQrCode: string | null;
  pixQrCodeUrl: string | null;
  pixExpiresAt: Date | null;
  cardLast4: string | null;
  installments: number;
  raw: unknown;
};

const PAGARME_API_BASE = "https://api.pagar.me/core/v5";

export function sanitizePagarmeConfig(config: PagarmeTenantConfig) {
  return {
    enabled: Boolean(config.enabled),
    environment: (config.environment === "production" ? "production" : "sandbox") as PagarmeEnvironment,
    publicKeyConfigured: Boolean(config.publicKey),
    secretKeyConfigured: Boolean(config.secretKey),
    webhookSecretConfigured: Boolean(config.webhookSecret),
    publicKeyPreview: config.publicKey ? `${config.publicKey.slice(0, 8)}••••${config.publicKey.slice(-4)}` : null,
  };
}

export function assertPagarmeReady(config: PagarmeTenantConfig) {
  if (!config.enabled) throw new Error("Pagar.me não está habilitado para esta assistência.");
  if (!config.secretKey) throw new Error("Chave secreta do Pagar.me não configurada.");
}

function digitsOnly(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function buildCustomer(input: CreatePagarmeChargeInput["customer"]) {
  const document = digitsOnly(input.document);
  const phones = digitsOnly(input.phone);
  const mobilePhone = phones.length >= 10 ? {
    country_code: "55",
    area_code: phones.slice(0, 2),
    number: phones.slice(2),
  } : undefined;
  return {
    name: input.name,
    email: input.email || `cliente-${input.id}@fullreparo.local`,
    type: document.length === 14 ? "company" : "individual",
    document: document || undefined,
    phones: mobilePhone ? { mobile_phone: mobilePhone } : undefined,
  };
}

function mapPaymentStatus(gatewayStatus: string | null | undefined) {
  const normalized = String(gatewayStatus || "pending").toLowerCase();
  if (["paid", "captured", "authorized"].includes(normalized)) return "paid";
  if (["failed", "canceled", "cancelled", "refused", "chargedback"].includes(normalized)) return "failed";
  if (["processing", "authorized_pending_capture"].includes(normalized)) return "processing";
  return "pending";
}

export function normalizePagarmeStatus(gatewayStatus: string | null | undefined) {
  return mapPaymentStatus(gatewayStatus);
}

export async function createPagarmeCharge(input: CreatePagarmeChargeInput): Promise<PagarmeChargeResult> {
  assertPagarmeReady(input.config);
  const amountInCents = Math.round(Number(input.amount) * 100);
  if (!Number.isFinite(amountInCents) || amountInCents <= 0) throw new Error("Valor inválido para cobrança.");

  const paymentMethod = input.method === "pix" ? "pix" : "credit_card";
  const payment: Record<string, unknown> = { payment_method: paymentMethod };
  if (paymentMethod === "pix") {
    payment.pix = { expires_in: 24 * 60 * 60 };
  } else {
    if (!input.card) throw new Error("Dados do cartão são obrigatórios para pagamento por cartão de crédito.");
    const installments = Math.max(1, Math.min(12, input.card.installments || 1));
    payment.credit_card = {
      recurrence: false,
      installments,
      statement_descriptor: "FULLREPARO",
      card: {
        number: input.card.number.replace(/\s+/g, ""),
        holder_name: input.card.holderName,
        exp_month: input.card.expMonth,
        exp_year: input.card.expYear,
        cvv: input.card.cvv,
        billing_address: {
          line_1: "Endereco nao informado",
          zip_code: "00000000",
          city: "Nao informado",
          state: "SP",
          country: "BR",
        },
      },
    };
  }

  const payload = {
    items: [
      {
        amount: amountInCents,
        description: `OS ${input.osNumber} - serviço concluído`,
        quantity: 1,
        code: `os-${input.serviceOrderId}`,
      },
    ],
    customer: buildCustomer(input.customer),
    payments: [payment],
    metadata: {
      source: "fullreparo",
      serviceOrderId: String(input.serviceOrderId),
      osNumber: input.osNumber,
      method: input.method,
    },
  };

  const auth = Buffer.from(`${input.config.secretKey}:`).toString("base64");
  const response = await fetch(`${PAGARME_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (raw as any)?.message || (raw as any)?.errors?.[0]?.message || `Falha ao criar cobrança Pagar.me (${response.status}).`;
    throw new Error(message);
  }

  const charge = (raw as any)?.charges?.[0] || {};
  const lastTransaction = charge?.last_transaction || {};
  return {
    orderId: (raw as any)?.id || null,
    chargeId: charge?.id || null,
    status: charge?.status || lastTransaction?.status || "pending",
    gatewayPaymentId: lastTransaction?.id || charge?.id || null,
    pixQrCode: lastTransaction?.qr_code || null,
    pixQrCodeUrl: lastTransaction?.qr_code_url || null,
    pixExpiresAt: lastTransaction?.expires_at ? new Date(lastTransaction.expires_at) : null,
    cardLast4: input.method === "cartao_credito" ? input.card?.number.replace(/\D/g, "").slice(-4) || null : null,
    installments: input.method === "cartao_credito" ? Math.max(1, Math.min(12, input.card?.installments || 1)) : 1,
    raw,
  };
}

export function verifyPagarmeWebhookSignature(rawBody: Buffer, signatureHeader: string | string[] | undefined, secret?: string | null) {
  if (!secret) return true;
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!header) return false;
  const candidates = [
    crypto.createHmac("sha1", secret).update(rawBody).digest("hex"),
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
  ];
  const cleanHeader = header.replace(/^sha\d+=/i, "").trim();
  return candidates.some((candidate) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(cleanHeader);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
