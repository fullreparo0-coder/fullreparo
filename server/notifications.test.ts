import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
};

vi.mock("./db", () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  osNotifications: { tenantId: "tenantId", sentAt: "sentAt", eventType: "eventType", serviceOrderId: "serviceOrderId", message: "message", actorName: "actorName" },
  serviceOrders: { id: "id", osNumber: "osNumber" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ type: "and", args }),
  desc: (col: unknown) => ({ type: "desc", col }),
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  gte: (a: unknown, b: unknown) => ({ type: "gte", a, b }),
  like: (a: unknown, b: unknown) => ({ type: "like", a, b }),
  or: (...args: unknown[]) => ({ type: "or", args }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(tenantId: number) {
  return {
    user: { id: 1, tenantId, role: "tenant_admin", name: "Admin" },
    req: {} as any,
    res: {} as any,
    tenantFromHost: null,
  };
}

function makeChainFor(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => Promise.resolve(rows));
  // Para queries sem limit/offset (countRows e recentCount)
  // where retorna uma promise diretamente quando não há mais chain
  return chain;
}

function makeSimpleChainFor(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(rows));
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("notifications.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista vazia quando não há notificações", async () => {
    const chain = makeChainFor([]);
    const countChain = makeSimpleChainFor([]);
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? chain : countChain;
    });

    const { notificationsRouter } = await import("./routers/notifications");
    const caller = notificationsRouter.createCaller(makeCtx(1) as any);
    const result = await caller.list({ page: 1, pageSize: 30, eventType: "all" });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
  });

  it("retorna notificações do tenant correto", async () => {
    const mockNotifications = [
      {
        id: 1,
        serviceOrderId: 10,
        osNumber: "OS-2024-001",
        status: "aprovado",
        channel: "portal",
        message: "Orçamento aprovado pelo cliente",
        eventType: "budget_approved",
        actorName: "João Silva",
        sentAt: new Date("2024-01-15T10:00:00Z"),
      },
    ];
    const chain = makeChainFor(mockNotifications);
    const countChain = makeSimpleChainFor(mockNotifications);
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? chain : countChain;
    });

    const { notificationsRouter } = await import("./routers/notifications");
    const caller = notificationsRouter.createCaller(makeCtx(1) as any);
    const result = await caller.list({ page: 1, pageSize: 30, eventType: "all" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].eventType).toBe("budget_approved");
    expect(result.items[0].osNumber).toBe("OS-2024-001");
    expect(result.total).toBe(1);
  });

  it("filtra por eventType quando especificado", async () => {
    const chain = makeChainFor([]);
    const countChain = makeSimpleChainFor([]);
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? chain : countChain;
    });

    const { notificationsRouter } = await import("./routers/notifications");
    const caller = notificationsRouter.createCaller(makeCtx(1) as any);
    const result = await caller.list({ page: 1, pageSize: 30, eventType: "budget_approved" });

    // Deve ter chamado where com filtro de eventType
    expect(chain.where).toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });

  it("lança FORBIDDEN para usuário sem tenantId", async () => {
    const { notificationsRouter } = await import("./routers/notifications");
    const ctxNoTenant = { user: { id: 1, tenantId: null, role: "user" }, req: {}, res: {}, tenantFromHost: null };
    const caller = notificationsRouter.createCaller(ctxNoTenant as any);

    await expect(caller.list({ page: 1, pageSize: 30, eventType: "all" })).rejects.toThrow();
  });

  it("pagina corretamente — offset = (page-1) * pageSize", async () => {
    const chain = makeChainFor([]);
    const countChain = makeSimpleChainFor([]);
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? chain : countChain;
    });

    const { notificationsRouter } = await import("./routers/notifications");
    const caller = notificationsRouter.createCaller(makeCtx(1) as any);
    await caller.list({ page: 3, pageSize: 10, eventType: "all" });

    expect(chain.offset).toHaveBeenCalledWith(20); // (3-1) * 10
  });
});

describe("notifications.recentCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 0 quando não há notificações recentes", async () => {
    const chain = makeSimpleChainFor([]);
    mockSelect.mockReturnValue(chain);

    const { notificationsRouter } = await import("./routers/notifications");
    const caller = notificationsRouter.createCaller(makeCtx(1) as any);
    const result = await caller.recentCount();

    expect(result.count).toBe(0);
  });

  it("retorna a contagem correta de notificações das últimas 24h", async () => {
    const recentItems = [{ id: 1 }, { id: 2 }, { id: 3 }];
    // recentCount usa select().from().where() sem limit/offset
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve(recentItems));
    mockSelect.mockReturnValue(chain);

    const { notificationsRouter } = await import("./routers/notifications");
    const caller = notificationsRouter.createCaller(makeCtx(1) as any);
    const result = await caller.recentCount();

    expect(result.count).toBe(3);
  });
});
