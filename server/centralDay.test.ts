import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockDb = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  };
  const mockGetDb = vi.fn(async () => mockDb);
  return { mockSelect, mockInsert, mockUpdate, mockDelete, mockDb, mockGetDb };
});

vi.mock("./db", () => ({
  getDb: mocks.mockGetDb,
  getServiceOrdersByTenant: vi.fn(),
  getServiceOrderById: vi.fn(),
  getOsTimeline: vi.fn(),
  generateOsNumber: vi.fn(async () => "OS-TESTE-001"),
  getPhotosByOs: vi.fn(),
  getChecklistByOs: vi.fn(),
  countOsThisMonth: vi.fn(async () => 0),
  getFinancialReport: vi.fn(),
}));

function makeTable(name: string, columns: string[]) {
  return Object.fromEntries(columns.map((column) => [column, `${name}.${column}`]));
}

vi.mock("../drizzle/schema", () => ({
  serviceOrders: makeTable("serviceOrders", [
    "id", "tenantId", "osNumber", "status", "reportedDefect", "estimatedDelivery", "totalAmount", "createdAt",
    "customerId", "deviceId", "technicianId", "budgetStatus", "warrantyDays", "updatedAt", "description", "notes",
  ]),
  customers: makeTable("customers", ["id", "tenantId", "name", "email", "phone", "address", "createdAt"]),
  devices: makeTable("devices", ["id", "tenantId", "customerId", "brand", "model", "serial", "createdAt"]),
  payments: makeTable("payments", ["id", "tenantId", "serviceOrderId", "amount", "status", "paidAt", "createdAt"]),
  osNotifications: makeTable("osNotifications", [
    "id", "tenantId", "serviceOrderId", "status", "channel", "message", "eventType", "actorName", "sentAt", "createdAt",
  ]),
  osStatusHistory: makeTable("osStatusHistory", ["id", "tenantId", "serviceOrderId", "fromStatus", "toStatus", "createdAt"]),
  osChecklist: makeTable("osChecklist", ["id", "tenantId", "serviceOrderId", "item", "checked", "createdAt"]),
  photos: makeTable("photos", ["id", "tenantId", "serviceOrderId", "url", "type", "caption", "createdAt"]),
  budgets: makeTable("budgets", ["id", "tenantId", "serviceOrderId", "status", "createdAt"]),
  budgetItems: makeTable("budgetItems", ["id", "tenantId", "budgetId", "description", "amount"]),
  tenants: makeTable("tenants", ["id", "slug", "name", "customDomain", "planId", "status", "trialEndsAt"]),
  plans: makeTable("plans", ["id", "name", "maxOsPerMonth"]),
  users: makeTable("users", ["id", "tenantId", "role", "name", "email", "passwordHash"]),
  checklistTemplates: makeTable("checklistTemplates", ["id", "tenantId", "name", "isDefault", "createdAt"]),
  osChecklistState: makeTable("osChecklistState", ["id", "tenantId", "serviceOrderId", "templateId", "checked"]),
  tenantChecklistOverrides: makeTable("tenantChecklistOverrides", ["id", "tenantId", "templateId", "enabled"]),
  pickups: makeTable("pickups", ["id", "tenantId", "serviceOrderId", "status", "createdAt"]),
  stockItems: makeTable("stockItems", ["id", "tenantId", "name", "quantity", "createdAt"]),
  warranties: makeTable("warranties", ["id", "tenantId", "serviceOrderId", "expiresAt", "createdAt"]),
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ type: "and", args }),
  or: (...args: unknown[]) => ({ type: "or", args }),
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  gt: (a: unknown, b: unknown) => ({ type: "gt", a, b }),
  gte: (a: unknown, b: unknown) => ({ type: "gte", a, b }),
  like: (a: unknown, b: unknown) => ({ type: "like", a, b }),
  isNull: (a: unknown) => ({ type: "isNull", a }),
  inArray: (a: unknown, b: unknown[]) => ({ type: "inArray", a, b }),
  asc: (col: unknown) => ({ type: "asc", col }),
  desc: (col: unknown) => ({ type: "desc", col }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings: Array.from(strings), values }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

vi.mock("./_core/statusNotification", () => ({
  prepareStatusNotification: vi.fn(),
  notifyTenantStatusChange: vi.fn(),
}));

vi.mock("./_core/autoCommunication", () => ({
  autoCommunicationEventForStatus: vi.fn(),
  triggerAutoCommunication: vi.fn(),
}));

vi.mock("./email", () => ({
  sendTenantEmail: vi.fn(),
  buildNewOsEmailHtml: vi.fn(),
}));

vi.mock("./_core/customerPortalAuth", () => ({
  resolveCustomerPortalAccess: vi.fn(),
}));

vi.mock("./_core/subscription", () => ({
  assertTenantOperational: vi.fn(),
  getTenantSubscriptionSnapshot: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(tenantId: number | null = 1) {
  return {
    user: { id: 1, tenantId, role: "tenant_admin", name: "Admin" },
    req: { headers: {} } as any,
    res: {} as any,
    tenantFromHost: null,
  };
}

function makeSimpleChainFor(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(rows));
  return chain;
}

function makeJoinedChainFor(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  return chain;
}

function makeGroupedChainFor(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => Promise.resolve(rows));
  return chain;
}

type CentralDayRows = {
  newOrdersToday?: unknown[];
  pendingBudgets?: unknown[];
  overdueOrders?: unknown[];
  readyForPickup?: unknown[];
  pendingPayments?: unknown[];
  failedCommunications?: unknown[];
  paidToday?: unknown[];
  paidMonth?: unknown[];
  pendingAmount?: unknown[];
  actionRows?: unknown[];
  recentCommunications?: unknown[];
  statusDistribution?: unknown[];
  technicianMetrics?: unknown[];
};

function mockCentralDayQueries(rows: CentralDayRows = {}) {
  const chains = [
    makeSimpleChainFor(rows.newOrdersToday ?? [{ count: 0 }]),
    makeSimpleChainFor(rows.pendingBudgets ?? [{ count: 0 }]),
    makeSimpleChainFor(rows.overdueOrders ?? [{ count: 0 }]),
    makeSimpleChainFor(rows.readyForPickup ?? [{ count: 0 }]),
    makeSimpleChainFor(rows.pendingPayments ?? [{ count: 0 }]),
    makeSimpleChainFor(rows.failedCommunications ?? [{ count: 0 }]),
    makeSimpleChainFor(rows.paidToday ?? [{ total: 0 }]),
    makeSimpleChainFor(rows.paidMonth ?? [{ total: 0 }]),
    makeSimpleChainFor(rows.pendingAmount ?? [{ total: 0 }]),
    makeJoinedChainFor(rows.actionRows ?? []),
    makeJoinedChainFor(rows.recentCommunications ?? []),
    makeGroupedChainFor(rows.statusDistribution ?? []),
    makeJoinedChainFor(rows.technicianMetrics ?? []),
  ];
  let callCount = 0;
  mocks.mockSelect.mockImplementation(() => chains[callCount++]);
  return chains;
}

async function callCentralDay() {
  const { serviceOrdersRouter } = await import("./routers/serviceOrders");
  const caller = serviceOrdersRouter.createCaller(makeCtx(1) as any);
  return caller.centralDay();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("serviceOrders.centralDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetDb.mockResolvedValue(mocks.mockDb as any);
  });

  it("retorna estrutura zerada quando o banco não está disponível", async () => {
    mocks.mockGetDb.mockResolvedValueOnce(null);

    const result = await callCentralDay();

    expect(result.cards).toEqual({
      newOrdersToday: 0,
      pendingBudgets: 0,
      overdueOrders: 0,
      readyForPickup: 0,
      pendingPayments: 0,
      failedCommunications: 0,
    });
    expect(result.financial).toEqual({ paidToday: 0, paidMonth: 0, pendingAmount: 0, pendingCount: 0 });
    expect(result.actionQueue).toEqual([]);
    expect(result.alerts).toEqual([]);
    expect(result.recentCommunications).toEqual([]);
    expect(result.statusDistribution).toEqual([]);
    expect(result.technicianMetrics).toEqual([]);
  });

  it("retorna cards zerados e alerta de operação em dia quando não há OS acionável", async () => {
    mockCentralDayQueries();

    const result = await callCentralDay();

    expect(result.cards).toEqual({
      newOrdersToday: 0,
      pendingBudgets: 0,
      overdueOrders: 0,
      readyForPickup: 0,
      pendingPayments: 0,
      failedCommunications: 0,
    });
    expect(result.actionQueue).toEqual([]);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]).toMatchObject({ type: "success", title: "Operação em dia" });
    expect(result.statusDistribution).toEqual([]);
    expect(result.technicianMetrics).toEqual([]);
  });

  it("prioriza OS atrasada na fila e gera alerta danger", async () => {
    const overdueDate = new Date("2000-01-10T10:00:00Z");
    mockCentralDayQueries({
      overdueOrders: [{ count: 1 }],
      actionRows: [
        {
          id: 101,
          osNumber: "OS-ATRASADA-001",
          status: "em_reparo",
          reportedDefect: "Sem imagem",
          estimatedDelivery: overdueDate,
          totalAmount: "350.50",
          createdAt: new Date("2000-01-01T10:00:00Z"),
          customerName: "Cliente A",
          deviceBrand: "Samsung",
          deviceModel: "A54",
        },
      ],
    });

    const result = await callCentralDay();

    expect(result.cards.overdueOrders).toBe(1);
    expect(result.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ type: "danger", title: "OS atrasadas" })]));
    expect(result.actionQueue[0]).toMatchObject({
      id: 101,
      priority: "alta",
      reason: "Prazo vencido",
      href: "/painel/os/101",
      deviceLabel: "Samsung A54",
      totalAmount: 350.5,
    });
    expect(result.actionQueue[0].estimatedDelivery).toBe(overdueDate.toISOString());
  });

  it("gera alerta warning e prioridade média para orçamento pendente", async () => {
    mockCentralDayQueries({
      pendingBudgets: [{ count: 1 }],
      actionRows: [
        {
          id: 202,
          osNumber: "OS-ORCAMENTO-001",
          status: "aguardando_aprovacao",
          reportedDefect: "Tela quebrada",
          estimatedDelivery: null,
          totalAmount: 500,
          createdAt: new Date("2024-01-10T12:00:00Z"),
          customerName: "Cliente B",
          deviceBrand: "Apple",
          deviceModel: "iPhone 12",
        },
      ],
    });

    const result = await callCentralDay();

    expect(result.cards.pendingBudgets).toBe(1);
    expect(result.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ type: "warning", title: "Orçamentos pendentes" })]));
    expect(result.actionQueue[0]).toMatchObject({
      id: 202,
      priority: "media",
      reason: "Aguardando aprovação de orçamento",
      deviceLabel: "Apple iPhone 12",
    });
  });

  it("gera alerta success e prioridade média para OS pronta para retirada", async () => {
    mockCentralDayQueries({
      readyForPickup: [{ count: 1 }],
      actionRows: [
        {
          id: 303,
          osNumber: "OS-PRONTA-001",
          status: "pronto",
          reportedDefect: "Bateria viciada",
          estimatedDelivery: null,
          totalAmount: "189.90",
          createdAt: new Date("2024-02-01T08:00:00Z"),
          customerName: "Cliente C",
          deviceBrand: "Motorola",
          deviceModel: "G84",
        },
      ],
    });

    const result = await callCentralDay();

    expect(result.cards.readyForPickup).toBe(1);
    expect(result.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ type: "success", title: "Prontos para retirada" })]));
    expect(result.actionQueue[0]).toMatchObject({
      id: 303,
      priority: "media",
      reason: "Pronto para retirada/entrega",
      deviceLabel: "Motorola G84",
      totalAmount: 189.9,
    });
  });

  it("calcula financeiro rápido e preserva comunicações recentes", async () => {
    const sentAt = new Date("2024-03-05T14:30:00Z");
    mockCentralDayQueries({
      pendingPayments: [{ count: 2 }],
      paidToday: [{ total: "120.75" }],
      paidMonth: [{ total: "900.10" }],
      pendingAmount: [{ total: "450.25" }],
      recentCommunications: [
        {
          id: 1,
          serviceOrderId: 404,
          osNumber: "OS-COM-001",
          status: "sent",
          channel: "email",
          message: "Orçamento disponível",
          eventType: "auto_communication",
          actorName: "Sistema",
          sentAt,
        },
      ],
      statusDistribution: [{ status: "em_reparo", count: "3" }, { status: "pronto", count: 1 }],
      technicianMetrics: [
        {
          technicianId: 7,
          technicianName: "Técnica Ana",
          total: "4",
          openCount: "3",
          finishedCount: "1",
          overdueCount: "1",
        },
      ],
    });

    const result = await callCentralDay();

    expect(result.financial).toEqual({
      paidToday: 120.75,
      paidMonth: 900.1,
      pendingAmount: 450.25,
      pendingCount: 2,
    });
    expect(result.cards.pendingPayments).toBe(2);
    expect(result.recentCommunications).toHaveLength(1);
    expect(result.recentCommunications[0]).toMatchObject({
      id: 1,
      osNumber: "OS-COM-001",
      channel: "email",
      eventType: "auto_communication",
      sentAt: sentAt.toISOString(),
    });
    expect(result.statusDistribution).toEqual([
      { status: "em_reparo", count: 3 },
      { status: "pronto", count: 1 },
    ]);
    expect(result.technicianMetrics).toEqual([
      { technicianId: 7, technicianName: "Técnica Ana", total: 4, openCount: 3, finishedCount: 1, overdueCount: 1 },
    ]);
  });
});
