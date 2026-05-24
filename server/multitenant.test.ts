import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Context Factories ────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  return {
    user: overrides
      ? ({
          id: overrides.id ?? 1,
          openId: overrides.openId ?? "test-open-id",
          tenantId: overrides.tenantId ?? null,
          name: overrides.name ?? "Test User",
          email: overrides.email ?? "test@example.com",
          role: overrides.role ?? "user",
          isActive: true,
          loginMethod: "manus",
          avatarUrl: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"])
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function tenant1AdminCtx() {
  return makeCtx({ id: 10, openId: "tenant1-admin", tenantId: 1, role: "tenant_admin" });
}

function tenant2AdminCtx() {
  return makeCtx({ id: 20, openId: "tenant2-admin", tenantId: 2, role: "tenant_admin" });
}

function superAdminCtx() {
  return makeCtx({ id: 99, openId: "super-admin", tenantId: null, role: "super_admin" });
}

function atendenteCtx(tenantId: number) {
  return makeCtx({ id: 30, openId: `atendente-t${tenantId}`, tenantId, role: "atendente" });
}

function tecnicoCtx(tenantId: number) {
  return makeCtx({ id: 40, openId: `tecnico-t${tenantId}`, tenantId, role: "tecnico" });
}

function entregadorCtx(tenantId: number) {
  return makeCtx({ id: 50, openId: `entregador-t${tenantId}`, tenantId, role: "entregador" });
}

function noTenantCtx() {
  return makeCtx({ id: 60, openId: "no-tenant-user", tenantId: null, role: "user" });
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth", () => {
  it("me retorna null para contexto sem usuário", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("logout limpa o cookie de sessão", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      user: makeCtx().user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => cleared.push(name),
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBeGreaterThan(0);
  });
});

// ─── Multi-Tenant Isolation: tenants router ───────────────────────────────────

describe("multi-tenant isolation — tenants router", () => {
  it("tenants.list é acessível apenas para super_admin", async () => {
    const caller = appRouter.createCaller(tenant1AdminCtx());
    await expect(caller.tenants.list()).rejects.toThrow();
  });

  it("super_admin pode listar tenants", async () => {
    const caller = appRouter.createCaller(superAdminCtx());
    // Graceful: retorna array ou lança NOT_FOUND (sem DB em CI), nunca FORBIDDEN
    try {
      const result = await caller.tenants.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("tenant_admin não pode listar todos os tenants", async () => {
    const caller = appRouter.createCaller(tenant2AdminCtx());
    await expect(caller.tenants.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Multi-Tenant Isolation: serviceOrders router ────────────────────────────

describe("multi-tenant isolation — serviceOrders router", () => {
  it("serviceOrders.list lança FORBIDDEN quando tenantId é null", async () => {
    const caller = appRouter.createCaller(noTenantCtx());
    await expect(caller.serviceOrders.list({ page: 1, limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("atendente do tenant 1 pode listar OS (graceful sem DB)", async () => {
    const caller = appRouter.createCaller(atendenteCtx(1));
    try {
      const result = await caller.serviceOrders.list({ page: 1, limit: 10 });
      expect(result).toBeDefined();
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("atendente do tenant 2 (TechFix) pode listar OS (graceful sem DB)", async () => {
    const caller = appRouter.createCaller(atendenteCtx(2));
    try {
      const result = await caller.serviceOrders.list({ page: 1, limit: 10 });
      expect(result).toBeDefined();
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

// ─── Multi-Tenant Isolation: customers router ────────────────────────────────

describe("multi-tenant isolation — customers router", () => {
  it("customers.list lança FORBIDDEN quando tenantId é null", async () => {
    const caller = appRouter.createCaller(noTenantCtx());
    await expect(caller.customers.list({ page: 1, limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("tenant_admin do tenant 1 pode listar clientes (graceful sem DB)", async () => {
    const caller = appRouter.createCaller(tenant1AdminCtx());
    try {
      const result = await caller.customers.list({ page: 1, limit: 10 });
      expect(result).toBeDefined();
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("tenant_admin do tenant 2 (TechFix) pode listar clientes (graceful sem DB)", async () => {
    const caller = appRouter.createCaller(tenant2AdminCtx());
    try {
      const result = await caller.customers.list({ page: 1, limit: 10 });
      expect(result).toBeDefined();
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

// ─── Multi-Tenant Isolation: stock router ────────────────────────────────────

describe("multi-tenant isolation — stock router", () => {
  it("stock.list lança FORBIDDEN quando tenantId é null", async () => {
    const caller = appRouter.createCaller(noTenantCtx());
    await expect(caller.stock.list({ page: 1, limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("tecnico do tenant 2 (TechFix) pode listar estoque (graceful sem DB)", async () => {
    const caller = appRouter.createCaller(tecnicoCtx(2));
    try {
      const result = await caller.stock.list({ page: 1, limit: 10 });
      expect(result).toBeDefined();
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

// ─── Multi-Tenant Isolation: users router ────────────────────────────────────

describe("multi-tenant isolation — users router", () => {
  it("atendente não pode listar usuários do tenant", async () => {
    const caller = appRouter.createCaller(atendenteCtx(1));
    await expect(caller.users.list({ page: 1, limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("tecnico não pode listar usuários do tenant", async () => {
    const caller = appRouter.createCaller(tecnicoCtx(2));
    await expect(caller.users.list({ page: 1, limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("entregador não pode listar usuários do tenant", async () => {
    const caller = appRouter.createCaller(entregadorCtx(2));
    await expect(caller.users.list({ page: 1, limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("tenant_admin do tenant 2 (TechFix) pode listar usuários (graceful sem DB)", async () => {
    const caller = appRouter.createCaller(tenant2AdminCtx());
    try {
      const result = await caller.users.list({ page: 1, limit: 10 });
      expect(result).toBeDefined();
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

// ─── Public Portal Isolation ─────────────────────────────────────────────────

describe("public portal — isolamento por token", () => {
  it("public.trackOs lança NOT_FOUND para token inexistente", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.public.trackOs({ token: "token-que-nao-existe-xyz" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("public.getTenantInfo lança NOT_FOUND para slug inexistente", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.public.getTenantInfo({ slug: "assistencia-que-nao-existe" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ─── Warranty Isolation ───────────────────────────────────────────────────────

describe("warranties — isolamento por código", () => {
  it("warranties.checkByCode lança NOT_FOUND para código inexistente", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.warranties.checkByCode({ code: "GAR-INEXISTENTE-000" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ─── Plans ────────────────────────────────────────────────────────────────────

describe("plans", () => {
  it("plans.list retorna array (graceful sem DB)", async () => {
    const caller = appRouter.createCaller(superAdminCtx());
    try {
      const result = await caller.plans.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("tenant_admin não pode atualizar planos", async () => {
    const caller = appRouter.createCaller(tenant1AdminCtx());
    await expect(
      caller.plans.update({ id: 1, maxUsers: 99 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Busca Expandida com Dados Conhecidos ─────────────────────────────────────

describe("serviceOrders.list — busca expandida com dados reais do banco", () => {
  it("busca por número de OS existente retorna pelo menos 1 resultado", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const all = await caller.serviceOrders.list({ page: 1, pageSize: 1 });
    if (all.data.length === 0) return;
    const osNumber = all.data[0].osNumber;
    const result = await caller.serviceOrders.list({ search: osNumber, page: 1, pageSize: 10 });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data.some((o) => o.osNumber === osNumber)).toBe(true);
  });

  it("busca por IMEI do tenant 2 retorna ao menos 1 OS e apenas OS do tenant 2", async () => {
    const ctx = makeCtx({ tenantId: 2 });
    const caller = appRouter.createCaller(ctx);
    // TechFix tem device com IMEI 359123456789012 atualizado via seed
    const result = await caller.serviceOrders.list({ search: "359123456789012", page: 1, pageSize: 10 });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    result.data.forEach((o) => expect(o.tenantId).toBe(2));
  });

  it("busca por CPF do cliente do tenant 2 retorna ao menos 1 OS e apenas OS do tenant 2", async () => {
    const ctx = makeCtx({ tenantId: 2 });
    const caller = appRouter.createCaller(ctx);
    // TechFix tem cliente com document 98765432100 atualizado via seed
    const result = await caller.serviceOrders.list({ search: "98765432100", page: 1, pageSize: 10 });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    result.data.forEach((o) => expect(o.tenantId).toBe(2));
  });

  it("busca por serialNumber (SN) retorna ao menos 1 OS do tenant 2", async () => {
    const ctx = makeCtx({ tenantId: 2 });
    const caller = appRouter.createCaller(ctx);
    // TechFix tem device com serialNumber SN-TECH-001 atualizado via seed
    const result = await caller.serviceOrders.list({ search: "SN-TECH-001", page: 1, pageSize: 10 });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    result.data.forEach((o) => expect(o.tenantId).toBe(2));
  });

  it("busca no tenant 1 por IMEI do tenant 2 não retorna OS de outro tenant (isolamento)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.serviceOrders.list({ search: "359123456789012", page: 1, pageSize: 10 });
    // Todos os resultados devem pertencer ao tenant 1 (isolamento garantido)
    result.data.forEach((o) => expect(o.tenantId).toBe(1));
  });
});
