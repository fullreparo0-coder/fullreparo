import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock("./db", () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  customers: { id: "customers.id", name: "customers.name", phone: "customers.phone" },
  osNotifications: { tenantId: "osNotifications.tenantId" },
  plans: {
    id: "plans.id",
    name: "plans.name",
    price: "plans.price",
    hasWhatsapp: "plans.hasWhatsapp",
  },
  serviceOrders: {
    id: "serviceOrders.id",
    tenantId: "serviceOrders.tenantId",
    osNumber: "serviceOrders.osNumber",
    publicToken: "serviceOrders.publicToken",
    customerId: "serviceOrders.customerId",
  },
  tenants: {
    id: "tenants.id",
    name: "tenants.name",
    slug: "tenants.slug",
    planId: "tenants.planId",
    status: "tenants.status",
  },
  whatsappIntegrations: {
    id: "whatsappIntegrations.id",
    tenantId: "whatsappIntegrations.tenantId",
    enabled: "whatsappIntegrations.enabled",
    updatedAt: "whatsappIntegrations.updatedAt",
    lastHealthStatus: "whatsappIntegrations.lastHealthStatus",
    lastHealthMessage: "whatsappIntegrations.lastHealthMessage",
    lastCheckedAt: "whatsappIntegrations.lastCheckedAt",
  },
  whatsappMessageLogs: {
    id: "whatsappMessageLogs.id",
    tenantId: "whatsappMessageLogs.tenantId",
    status: "whatsappMessageLogs.status",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ type: "and", args }),
  desc: (col: unknown) => ({ type: "desc", col }),
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
}));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  return chain;
}

function makeInsertChain(result: unknown = [{ insertId: 900 }]) {
  return {
    values: vi.fn(() => Promise.resolve(result)),
  };
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(undefined));
  return chain;
}

const eligiblePlanRow = {
  tenantId: 1,
  tenantName: "Assistência Plano 99",
  tenantStatus: "active",
  planId: 2,
  planName: "Plano 99",
  planPrice: "99.00",
  hasWhatsapp: true,
};

const integrationRow = {
  id: 10,
  tenantId: 1,
  enabled: true,
  provider: "meta_cloud_api",
  phoneNumberId: "123456789",
  accessToken: "EAAB-token",
  graphApiVersion: "v23.0",
  budgetTemplateName: "fullreparo_orcamento_disponivel",
  readyTemplateName: "fullreparo_os_pronta",
  templateLanguage: "pt_BR",
};

const osCustomerRow = {
  tenantName: "FullReparo Centro",
  tenantSlug: "fullreparo-centro",
  osId: 55,
  osNumber: "OS-55",
  publicToken: "public-token-55",
  customerId: 77,
  customerName: "Maria Cliente",
  customerPhone: "(11) 99999-8888",
};

describe("WhatsApp Meta Cloud API multi-tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockImplementation(() => makeInsertChain());
    mockUpdate.mockImplementation(() => makeUpdateChain());
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.test" }] }),
    })));
  });

  it("habilita WhatsApp quando o tenant está em plano com hasWhatsapp", async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([eligiblePlanRow]));

    const { getWhatsappEligibility } = await import("./_core/whatsapp");
    const result = await getWhatsappEligibility(1);

    expect(result.eligible).toBe(true);
    expect(result.planHasWhatsapp).toBe(true);
    expect(result.reason).toBe("WhatsApp habilitado pelo plano");
  });

  it("bloqueia WhatsApp quando o plano não inclui o recurso", async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([{ ...eligiblePlanRow, hasWhatsapp: false }]));

    const { getWhatsappEligibility } = await import("./_core/whatsapp");
    const result = await getWhatsappEligibility(1);

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("Plano sem WhatsApp incluso");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sanitiza a integração sem expor o accessToken bruto ao frontend", async () => {
    const { sanitizeWhatsappIntegration } = await import("./_core/whatsapp");
    const result = sanitizeWhatsappIntegration(integrationRow);

    expect(result).not.toHaveProperty("accessToken");
    expect(result?.hasAccessToken).toBe(true);
    expect(result?.accessTokenPreview).toBe("••••oken");
    expect(result?.phoneNumberId).toBe("123456789");
  });

  it("envia template Utility pela Meta Cloud API e registra log por tenant", async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([eligiblePlanRow]))
      .mockReturnValueOnce(makeSelectChain([integrationRow]))
      .mockReturnValueOnce(makeSelectChain([osCustomerRow]));

    const { triggerWhatsappTransactional } = await import("./_core/whatsapp");
    const result = await triggerWhatsappTransactional({
      tenantId: 1,
      serviceOrderId: 55,
      event: "budget_available",
      actorName: "Atendente",
      origin: "https://app.fullreparo.com.br",
    });

    expect(result.sent).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v23.0/123456789/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer EAAB-token" }),
      })
    );
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
