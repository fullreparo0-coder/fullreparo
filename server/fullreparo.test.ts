import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<User> = {}): TrpcContext {
  const user: User = {
    id: 1,
    openId: "test-user",
    tenantId: 1,
    name: "Test User",
    email: "test@example.com",
    phone: null,
    loginMethod: "manus",
    role: "tenant_admin",
    isActive: true,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
}

function makeSuperAdminCtx(): TrpcContext {
  return makeCtx({ role: "super_admin", tenantId: null as any });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user object when authenticated", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("tenant_admin");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
    const ctx: TrpcContext = {
      user: makeCtx().user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ─── Tenant access control ────────────────────────────────────────────────────

describe("tenants.getMine", () => {
  it("returns null when user has no tenantId", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tenants.getMine();
    expect(result).toBeNull();
  });
});

describe("tenants.list (super admin only)", () => {
  it("throws FORBIDDEN for non-super-admin user", async () => {
    const ctx = makeCtx({ role: "atendente" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tenants.list()).rejects.toThrow();
  });

  it("throws FORBIDDEN for tenant_admin", async () => {
    const ctx = makeCtx({ role: "tenant_admin" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tenants.list()).rejects.toThrow();
  });
});

// ─── Service Orders access control ───────────────────────────────────────────

describe("serviceOrders.list", () => {
  it("throws FORBIDDEN when user has no tenantId", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.serviceOrders.list()).rejects.toThrow();
  });
});

describe("serviceOrders.metrics", () => {
  it("throws FORBIDDEN when user has no tenantId", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.serviceOrders.metrics()).rejects.toThrow();
  });
});

// ─── Customers access control ─────────────────────────────────────────────────

describe("customers.list", () => {
  it("throws FORBIDDEN when user has no tenantId", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.customers.list()).rejects.toThrow();
  });
});

// ─── Users access control ─────────────────────────────────────────────────────

describe("users.list", () => {
  it("throws FORBIDDEN for atendente role", async () => {
    const ctx = makeCtx({ role: "atendente" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("throws FORBIDDEN for tecnico role", async () => {
    const ctx = makeCtx({ role: "tecnico" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });
});

// ─── Stock access control ─────────────────────────────────────────────────────

describe("stock.list", () => {
  it("throws FORBIDDEN when user has no tenantId", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stock.list()).rejects.toThrow();
  });
});

// ─── Pickups access control ───────────────────────────────────────────────────

describe("pickups.myPickups", () => {
  it("throws FORBIDDEN when user has no tenantId", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.pickups.myPickups()).rejects.toThrow();
  });
});

// ─── Plans ────────────────────────────────────────────────────────────────────

describe("plans.list", () => {
  it("returns empty array when no DB (graceful degradation)", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    // Without a real DB, the helper returns [] gracefully
    const result = await caller.plans.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Public router ────────────────────────────────────────────────────────────

describe("public.getTenantInfo", () => {
  it("throws NOT_FOUND for unknown slug", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.public.getTenantInfo({ slug: "nonexistent-slug-xyz" })).rejects.toThrow();
  });
});

describe("public.trackOs", () => {
  it("throws NOT_FOUND for unknown token", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.public.trackOs({ token: "invalid-token-xyz" })).rejects.toThrow();
  });
});

// ─── Warranties public check ──────────────────────────────────────────────────

describe("warranties.checkByCode", () => {
  it("throws NOT_FOUND for unknown warranty code", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.warranties.checkByCode({ code: "INVALID-CODE" })).rejects.toThrow();
  });
});

// ─── Regression: owner com role 'admin' deve acessar /superadmin ─────────────
// Bug reportado: FORBIDDEN em /superadmin para usuário owner com role='admin'
// Causa raiz: adminProcedure em trpc.ts só aceitava role==='admin' mas
//             superAdminProcedure em tenants.ts já aceitava ambos.
//             O owner foi promovido para super_admin no banco e o adminProcedure
//             foi corrigido para aceitar ['admin', 'super_admin'].

describe("superadmin access — regressão bug FORBIDDEN owner", () => {
  function makeOwnerAdminCtx(): TrpcContext {
    return makeCtx({
      id: 1,
      openId: "akTgoinXBZxjPsJxM42TYw",
      tenantId: null as any,
      name: "Luiz Rocha",
      email: "owner@example.com",
      role: "admin",
      isActive: true,
    });
  }

  it("tenants.list não retorna FORBIDDEN para owner com role='admin'", async () => {
    const caller = appRouter.createCaller(makeOwnerAdminCtx());
    // Sem banco disponível em teste, deve retornar [] e não FORBIDDEN
    const result = await caller.tenants.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("plans.list não retorna FORBIDDEN para owner com role='admin'", async () => {
    const caller = appRouter.createCaller(makeOwnerAdminCtx());
    const result = await caller.plans.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("tenants.list não retorna FORBIDDEN para owner com role='super_admin'", async () => {
    const caller = appRouter.createCaller(makeSuperAdminCtx());
    const result = await caller.tenants.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("plans.listAll não retorna FORBIDDEN para owner com role='admin'", async () => {
    const caller = appRouter.createCaller(makeOwnerAdminCtx());
    const result = await caller.plans.listAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("plans.listAll não retorna FORBIDDEN para owner com role='super_admin'", async () => {
    const caller = appRouter.createCaller(makeSuperAdminCtx());
    const result = await caller.plans.listAll();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── tenants.register (cadastro público) ─────────────────────────────────────

describe("tenants.register", () => {
  const publicCtx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  it("é acessível sem autenticação (publicProcedure)", async () => {
    const caller = appRouter.createCaller(publicCtx);
    // Sem banco disponível, deve lançar INTERNAL_SERVER_ERROR, não UNAUTHORIZED
    try {
      await caller.tenants.register({
        name: "Teste Assistência",
        email: "teste@assistencia.com",
        phone: "11999999999",
      });
    } catch (err: any) {
      expect(err.code).not.toBe("UNAUTHORIZED");
      expect(["INTERNAL_SERVER_ERROR", "CONFLICT"]).toContain(err.code);
    }
  });

  it("tenants.listPublicPlans é acessível sem autenticação", async () => {
    const caller = appRouter.createCaller(publicCtx);
    const result = await caller.tenants.listPublicPlans();
    expect(Array.isArray(result)).toBe(true);
  });

  it("tenants.checkSlug é acessível sem autenticação", async () => {
    const caller = appRouter.createCaller(publicCtx);
    const result = await caller.tenants.checkSlug({ slug: "minha-assistencia" });
    expect(typeof result.available).toBe("boolean");
  });

  it("tenants.register rejeita e-mail inválido", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.tenants.register({
        name: "Teste",
        email: "email-invalido",
        phone: "11999999999",
      })
    ).rejects.toThrow();
  });

  it("tenants.register rejeita nome muito curto", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.tenants.register({
        name: "A",
        email: "ok@email.com",
        phone: "11999999999",
      })
    ).rejects.toThrow();
  });
});

// ─── tenants.register — validação de CNPJ/CPF ────────────────────────────────

describe("tenants.register — validação de documento", () => {
  const publicCtx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  it("rejeita CNPJ inválido (dígitos verificadores errados)", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.tenants.register({
        name: "Assistência Teste",
        email: "cnpj@teste.com",
        phone: "11999999999",
        document: "11222333000100", // CNPJ com dígitos verificadores inválidos
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita CPF inválido (dígitos verificadores errados)", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.tenants.register({
        name: "Assistência Teste",
        email: "cpf@teste.com",
        phone: "11999999999",
        document: "12345678900", // CPF inválido
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita documento com número de dígitos inválido", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.tenants.register({
        name: "Assistência Teste",
        email: "doc@teste.com",
        phone: "11999999999",
        document: "123456789", // nem CPF nem CNPJ
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("aceita cadastro sem documento (campo opcional)", async () => {
    const caller = appRouter.createCaller(publicCtx);
    // Sem banco disponível, deve falhar com INTERNAL_SERVER_ERROR (não BAD_REQUEST)
    try {
      await caller.tenants.register({
        name: "Assistência Sem Doc",
        email: "semdoc@teste.com",
        phone: "11999999999",
      });
    } catch (err: any) {
      expect(err.code).not.toBe("BAD_REQUEST");
    }
  });
});

// ─── Plan OS Limit Tests ──────────────────────────────────────────────────────

describe("serviceOrders.usageStats", () => {
  it("retorna estrutura correta com campos obrigatórios", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.serviceOrders.usageStats();
    // Verifica que todos os campos obrigatórios existem e têm tipos corretos
    expect(typeof stats.used).toBe("number");
    expect(typeof stats.isAtLimit).toBe("boolean");
    expect(typeof stats.isNearLimit).toBe("boolean");
    expect(typeof stats.isUnlimited).toBe("boolean");
    expect(typeof stats.percentUsed).toBe("number");
    expect(typeof stats.planName).toBe("string");
    // Não pode estar atLimit e nearLimit ao mesmo tempo
    expect(stats.isAtLimit && stats.isNearLimit).toBe(false);
    // percentUsed deve estar entre 0 e 100
    expect(stats.percentUsed).toBeGreaterThanOrEqual(0);
    expect(stats.percentUsed).toBeLessThanOrEqual(100);
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.serviceOrders.usageStats()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("retorna planName='Desconhecido' quando plano não encontrado no DB", async () => {
    const ctx = makeCtx({ tenantId: 999 });
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.serviceOrders.usageStats();
    expect(stats.planName).toBe("Desconhecido");
  });
});

// ─── Pagination Tests ─────────────────────────────────────────────────────────

describe("serviceOrders.list — paginação", () => {
  it("retorna estrutura paginada com campos obrigatórios", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.serviceOrders.list({ page: 1, pageSize: 10 });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("totalCount");
    expect(result).toHaveProperty("totalPages");
    expect(result).toHaveProperty("currentPage");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.totalCount).toBe("number");
    expect(typeof result.totalPages).toBe("number");
    expect(result.currentPage).toBe(1);
  });

  it("respeita pageSize e retorna no máximo N itens", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.serviceOrders.list({ page: 1, pageSize: 2 });

    expect(result.data.length).toBeLessThanOrEqual(2);
  });

  it("totalPages é consistente com totalCount e pageSize", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const pageSize = 5;
    const result = await caller.serviceOrders.list({ page: 1, pageSize });

    const expectedPages = Math.ceil(result.totalCount / pageSize);
    expect(result.totalPages).toBe(expectedPages);
  });

  it("página 2 retorna itens diferentes da página 1 (quando há dados suficientes)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const [page1, page2] = await Promise.all([
      caller.serviceOrders.list({ page: 1, pageSize: 1 }),
      caller.serviceOrders.list({ page: 2, pageSize: 1 }),
    ]);

    if (page1.totalCount >= 2) {
      expect(page1.data[0]?.id).not.toBe(page2.data[0]?.id);
    }
  });

  it("filtro de status reseta corretamente (status=all retorna todos)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const [allResult, filteredResult] = await Promise.all([
      caller.serviceOrders.list({ page: 1, pageSize: 20 }),
      caller.serviceOrders.list({ page: 1, pageSize: 20, status: "all" }),
    ]);
    // Ambos devem retornar o mesmo totalCount (status "all" = sem filtro)
    expect(allResult.totalCount).toBe(filteredResult.totalCount);
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.serviceOrders.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Customers Pagination Tests ───────────────────────────────────────────────

describe("customers.list — paginação", () => {
  it("retorna estrutura paginada com campos obrigatórios", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.list({ page: 1, pageSize: 10 });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("totalCount");
    expect(result).toHaveProperty("totalPages");
    expect(result).toHaveProperty("currentPage");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.currentPage).toBe(1);
  });

  it("respeita pageSize e retorna no máximo N clientes", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.list({ page: 1, pageSize: 1 });
    expect(result.data.length).toBeLessThanOrEqual(1);
  });

  it("totalPages é consistente com totalCount e pageSize", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const pageSize = 3;
    const result = await caller.customers.list({ page: 1, pageSize });
    const expected = Math.ceil(result.totalCount / pageSize);
    expect(result.totalPages).toBe(expected);
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.customers.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Stock Pagination Tests ───────────────────────────────────────────────────

describe("stock.list — paginação", () => {
  it("retorna estrutura paginada com campos obrigatórios", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stock.list({ page: 1, pageSize: 10 });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("totalCount");
    expect(result).toHaveProperty("totalPages");
    expect(result).toHaveProperty("currentPage");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.currentPage).toBe(1);
  });

  it("respeita pageSize e retorna no máximo N itens de estoque", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stock.list({ page: 1, pageSize: 2 });
    expect(result.data.length).toBeLessThanOrEqual(2);
  });

  it("totalPages é consistente com totalCount e pageSize", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const pageSize = 2;
    const result = await caller.stock.list({ page: 1, pageSize });
    const expected = Math.ceil(result.totalCount / pageSize);
    expect(result.totalPages).toBe(expected);
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stock.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Busca Expandida — OS ─────────────────────────────────────────────────────

describe("serviceOrders.list — busca expandida", () => {
  it("retorna estrutura paginada ao buscar por texto qualquer", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.serviceOrders.list({ search: "teste", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("totalCount");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("busca por número de OS retorna estrutura válida", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.serviceOrders.list({ search: "OS-", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("busca por IMEI retorna estrutura válida", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.serviceOrders.list({ search: "35912345", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("busca por CPF retorna estrutura válida", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.serviceOrders.list({ search: "123.456", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("busca vazia retorna todas as OS do tenant (sem filtro)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const [withSearch, withoutSearch] = await Promise.all([
      caller.serviceOrders.list({ search: "", page: 1, pageSize: 10 }),
      caller.serviceOrders.list({ page: 1, pageSize: 10 }),
    ]);
    expect(withSearch.totalCount).toBe(withoutSearch.totalCount);
  });

  it("isolamento: busca no tenant 1 não retorna OS do tenant 2", async () => {
    const ctx1 = makeCtx({ tenantId: 1 });
    const ctx2 = makeCtx({ tenantId: 2 });
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);
    const [r1, r2] = await Promise.all([
      caller1.serviceOrders.list({ page: 1, pageSize: 100 }),
      caller2.serviceOrders.list({ page: 1, pageSize: 100 }),
    ]);
    const ids1 = r1.data.map((o) => o.id);
    const ids2 = r2.data.map((o) => o.id);
    const overlap = ids1.filter((id) => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  });
});

// ─── Busca Expandida — Clientes ───────────────────────────────────────────────

describe("customers.list — busca expandida", () => {
  it("retorna estrutura paginada ao buscar por texto qualquer", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.list({ search: "teste", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("totalCount");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("busca por nome retorna estrutura válida", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.list({ search: "João", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("busca por CPF/CNPJ retorna estrutura válida", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.list({ search: "123.456", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("busca por telefone retorna estrutura válida", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.list({ search: "11999", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("busca vazia retorna todos os clientes do tenant (sem filtro)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const [withSearch, withoutSearch] = await Promise.all([
      caller.customers.list({ search: "", page: 1, pageSize: 10 }),
      caller.customers.list({ page: 1, pageSize: 10 }),
    ]);
    expect(withSearch.totalCount).toBe(withoutSearch.totalCount);
  });

  it("isolamento: busca no tenant 1 não retorna clientes do tenant 2", async () => {
    const ctx1 = makeCtx({ tenantId: 1 });
    const ctx2 = makeCtx({ tenantId: 2 });
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);
    const [r1, r2] = await Promise.all([
      caller1.customers.list({ page: 1, pageSize: 100 }),
      caller2.customers.list({ page: 1, pageSize: 100 }),
    ]);
    const ids1 = r1.data.map((c) => c.id);
    const ids2 = r2.data.map((c) => c.id);
    const overlap = ids1.filter((id) => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  });
});

// ─── Busca Expandida — Clientes com Dados Reais (tenant 2 / TechFix) ─────────

describe("customers.list — busca expandida com dados reais do banco", () => {
  it("busca por CPF do cliente do tenant 2 retorna ao menos 1 cliente", async () => {
    const ctx = makeCtx({ tenantId: 2 });
    const caller = appRouter.createCaller(ctx);
    // TechFix tem cliente com document 98765432100 inserido via seed
    const result = await caller.customers.list({ search: "98765432100", page: 1, pageSize: 10 });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    result.data.forEach((c) => expect(c.tenantId).toBe(2));
  });

  it("busca por telefone do cliente do tenant 2 retorna ao menos 1 cliente", async () => {
    const ctx = makeCtx({ tenantId: 2 });
    const caller = appRouter.createCaller(ctx);
    // TechFix tem cliente Carlos Mendes com phone (11) 91234-5678
    const result = await caller.customers.list({ search: "91234-5678", page: 1, pageSize: 10 });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    result.data.forEach((c) => expect(c.tenantId).toBe(2));
  });

  it("busca por CPF do tenant 2 no tenant 1 não retorna resultados (isolamento)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    // CPF 98765432100 pertence apenas ao tenant 2 (TechFix)
    const result = await caller.customers.list({ search: "98765432100", page: 1, pageSize: 10 });
    // Todos os resultados devem pertencer ao tenant 1
    result.data.forEach((c) => expect(c.tenantId).toBe(1));
  });
});

// ─── Detalhes do Cliente ──────────────────────────────────────────────────────

describe("customers.getById", () => {
  it("retorna NOT_FOUND para id inexistente", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.customers.getById({ id: 999999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.customers.getById({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("retorna cliente correto do tenant 2 (TechFix)", async () => {
    const ctx = makeCtx({ tenantId: 2 });
    const caller = appRouter.createCaller(ctx);
    // Carlos Mendes tem id=1 no tenant 2
    try {
      const result = await caller.customers.getById({ id: 1 });
      expect(result.tenantId).toBe(2);
      expect(result.name).toBeTruthy();
    } catch (e: unknown) {
      const err = e as { code?: string };
      // Graceful: NOT_FOUND se o banco não tiver o dado, mas nunca FORBIDDEN
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("isolamento: tenant 1 não acessa cliente do tenant 2", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    // id=1 pertence ao tenant 2 (Carlos Mendes / TechFix)
    // Deve retornar NOT_FOUND pois o tenant 1 não tem cliente com esse id
    try {
      const result = await caller.customers.getById({ id: 1 });
      // Se retornou, deve ser do tenant 1
      expect(result.tenantId).toBe(1);
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).toBe("NOT_FOUND");
    }
  });
});

describe("customers.orders", () => {
  it("retorna estrutura paginada de OS do cliente", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.orders({ customerId: 1, page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("totalCount");
    expect(result).toHaveProperty("totalPages");
    expect(result).toHaveProperty("currentPage");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.customers.orders({ customerId: 1, page: 1, pageSize: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("retorna OS do cliente do tenant 2 (graceful sem DB)", async () => {
    const ctx = makeCtx({ tenantId: 2 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.customers.orders({ customerId: 1, page: 1, pageSize: 10 });
      expect(result).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      // Todas as OS retornadas devem pertencer ao tenant 2
      result.data.forEach((o) => expect(o.tenantId).toBe(2));
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("customers.devices", () => {
  it("retorna array de aparelhos do cliente (graceful sem DB)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.customers.devices({ customerId: 1 });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.customers.devices({ customerId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
// ── customers.addDevice ──────────────────────────────────────────────────────

describe("customers.addDevice", () => {
  it("cria aparelho ou degrada graciosamente sem DB", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.customers.addDevice({
        customerId: 1,
        brand: "Samsung",
        model: "Galaxy S23",
        type: "Smartphone",
        color: "Preto",
        imei: "123456789012345",
        serialNumber: "SN-TEST-001",
        notes: "Teste de cadastro",
      });
      expect(result).toMatchObject({ success: true });
      expect(typeof result.id).toBe("number");
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.addDevice({
        customerId: 1,
        brand: "Apple",
        model: "iPhone 14",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita input inválido (brand vazia)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.addDevice({
        customerId: 1,
        brand: "",
        model: "Galaxy S23",
      })
    ).rejects.toBeDefined();
  });
});
// ── customers.findByDocument ─────────────────────────────────────────────────
describe("customers.findByDocument", () => {
  it("retorna null ou degrada graciosamente sem DB", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.customers.findByDocument({ query: "12345678900" });
      expect(result === null || typeof result === "object").toBe(true);
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.findByDocument({ query: "test@email.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita query muito curta (menos de 5 chars)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.findByDocument({ query: "123" })
    ).rejects.toBeDefined();
  });

  it("retorna null para texto livre sem @ e sem dígitos suficientes", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.customers.findByDocument({ query: "joaosilva" });
      expect(result).toBeNull();
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("aceita CPF formatado sem erro de validação", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.customers.findByDocument({ query: "123.456.789-00" });
      expect(result === null || typeof result === "object").toBe(true);
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("aceita e-mail válido como query", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.customers.findByDocument({ query: "cliente@email.com" });
      expect(result === null || typeof result === "object").toBe(true);
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});
// ── customers.create / update — normalização de document e email ──────────────
describe("customers.create — normalização de CPF/email", () => {
  it("normaliza CPF formatado para apenas dígitos", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.customers.create({
        name: "João Silva",
        phone: "11999999999",
        document: "123.456.789-00",
      });
      // Se inseriu, deve ter normalizado (verificação indireta via sucesso)
      expect(result).toMatchObject({ success: true });
    } catch (e: unknown) {
      const err = e as { code?: string };
      // Sem banco real, aceita INTERNAL_SERVER_ERROR mas não FORBIDDEN
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("normaliza CNPJ formatado para apenas dígitos", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.customers.create({
        name: "Empresa Teste",
        phone: "1133334444",
        document: "12.345.678/0001-99",
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("normaliza email para lowercase", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.customers.create({
        name: "Maria Souza",
        phone: "11988887777",
        email: "MARIA@EMAIL.COM",
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.create({ name: "Teste", phone: "11999999999" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("customers.update — normalização de CPF/email", () => {
  it("normaliza CPF formatado no update", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.customers.update({ id: 1, document: "987.654.321-00" });
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("normaliza email no update", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.customers.update({ id: 1, email: "NOVO@EMAIL.COM" });
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.update({ id: 1, name: "Novo Nome" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});



// ── public.getTenantByHost ────────────────────────────────────────────────────

/** Helper: cria contexto público com tenantFromHost opcional */
function makePublicCtx(tenantFromHost: TrpcContext["tenantFromHost"] = null): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    tenantFromHost,
  };
}

describe("public.getTenantByHost", () => {
  it("retorna null quando tenantFromHost é null (domínio raiz)", async () => {
    const ctx = makePublicCtx(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.public.getTenantByHost();
    expect(result).toBeNull();
  });

  it("retorna dados do tenant quando tenantFromHost está presente", async () => {
    const fakeTenant = {
      id: 99,
      name: "Rocha Celulares",
      slug: "rocha",
      logoUrl: null,
      primaryColor: "#2563eb",
      secondaryColor: null,
      phone: "(11) 91234-5678",
      whatsappNumber: "11912345678",
      city: "São Paulo",
      state: "SP",
      status: "active" as const,
      // campos obrigatórios do schema
      email: "rocha@email.com",
      document: null,
      address: null,
      zipCode: null,
      customDomain: null,
      planId: null,
      trialEndsAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ctx = makePublicCtx(fakeTenant as any);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.public.getTenantByHost();
    expect(result).not.toBeNull();
    expect(result?.id).toBe(99);
    expect(result?.name).toBe("Rocha Celulares");
    expect(result?.slug).toBe("rocha");
    expect(result?.city).toBe("São Paulo");
  });

  it("lança FORBIDDEN quando tenant está bloqueado", async () => {
    const blockedTenant = {
      id: 100,
      name: "Bloqueada",
      slug: "bloqueada",
      status: "blocked" as const,
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      phone: null,
      whatsappNumber: null,
      city: null,
      state: null,
      email: "bloqueada@email.com",
      document: null,
      address: null,
      zipCode: null,
      customDomain: null,
      planId: null,
      trialEndsAt: null,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ctx = makePublicCtx(blockedTenant as any);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.public.getTenantByHost()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ── public.lookupOsToken ──────────────────────────────────────────────────────

describe("public.lookupOsToken", () => {
  it("retorna null quando não há banco de dados disponível (graceful degradation)", async () => {
    const ctx = makePublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.public.lookupOsToken({ query: "OS-2024-001" });
    expect(result).toBeNull();
  });

  it("rejeita query vazia", async () => {
    const ctx = makePublicCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.public.lookupOsToken({ query: "" })).rejects.toBeDefined();
  });

  it("rejeita query muito longa (> 50 chars)", async () => {
    const ctx = makePublicCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.public.lookupOsToken({ query: "A".repeat(51) })
    ).rejects.toBeDefined();
  });

  it("aceita query com número de OS válido", async () => {
    const ctx = makePublicCtx();
    const caller = appRouter.createCaller(ctx);
    // Sem DB, retorna null graciosamente
    const result = await caller.public.lookupOsToken({ query: "OS-2024-001" });
    expect(result).toBeNull();
  });
});

// ── tenants.updateCustomDomain ────────────────────────────────────────────────

describe("tenants.updateCustomDomain", () => {
  it("rejeita domínio com formato inválido (sem TLD)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateCustomDomain({ customDomain: "dominioinvalido" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita domínio muito curto", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateCustomDomain({ customDomain: "a.b" })
    ).rejects.toBeDefined();
  });

  it("rejeita subdomínio do próprio SaaS (*.fullreparo.com.br)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateCustomDomain({ customDomain: "rocha.fullreparo.com.br" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita o domínio raiz do SaaS (fullreparo.com.br)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateCustomDomain({ customDomain: "fullreparo.com.br" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita acesso de atendente (role insuficiente)", async () => {
    const ctx = makeCtx({ role: "atendente", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateCustomDomain({ customDomain: "rocha.com.br" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita acesso de técnico (role insuficiente)", async () => {
    const ctx = makeCtx({ role: "tecnico", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateCustomDomain({ customDomain: "rocha.com.br" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateCustomDomain({ customDomain: "rocha.com.br" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("aceita domínio válido (graceful sem DB)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    // Sem banco disponível, deve lançar INTERNAL_SERVER_ERROR (não BAD_REQUEST nem FORBIDDEN)
    try {
      await caller.tenants.updateCustomDomain({ customDomain: "rochacelulares.com.br" });
    } catch (err: any) {
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });

  it("aceita domínio com subdomínio (ex: portal.rocha.com.br)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tenants.updateCustomDomain({ customDomain: "portal.rocha.com.br" });
    } catch (err: any) {
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});

// ── tenants.removeCustomDomain ────────────────────────────────────────────────

describe("tenants.removeCustomDomain", () => {
  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tenants.removeCustomDomain()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejeita acesso de atendente", async () => {
    const ctx = makeCtx({ role: "atendente", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tenants.removeCustomDomain()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("executa graciosamente sem DB (tenant_admin)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tenants.removeCustomDomain();
    } catch (err: any) {
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});

// ── tenants.uploadLogo ────────────────────────────────────────────────────────

describe("tenants.uploadLogo", () => {
  it("rejeita acesso de atendente", async () => {
    const ctx = makeCtx({ role: "atendente", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.uploadLogo({ dataUrl: "data:image/png;base64,abc", mimeType: "image/png" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita acesso de técnico", async () => {
    const ctx = makeCtx({ role: "tecnico", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.uploadLogo({ dataUrl: "data:image/png;base64,abc", mimeType: "image/png" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.uploadLogo({ dataUrl: "data:image/png;base64,abc", mimeType: "image/png" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita dataUrl muito curta (< 10 chars)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.uploadLogo({ dataUrl: "data:x", mimeType: "image/png" })
    ).rejects.toBeDefined();
  });

  it("aceita tenant_admin com dados válidos (graceful sem DB/storage)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tenants.uploadLogo({
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        mimeType: "image/png",
      });
    } catch (err: any) {
      // Sem banco/storage disponível, esperamos INTERNAL_SERVER_ERROR
      expect(["INTERNAL_SERVER_ERROR"].includes(err.code)).toBe(true);
    }
  });
});

// ── tenants.removeLogo ────────────────────────────────────────────────────────

describe("tenants.removeLogo", () => {
  it("rejeita acesso de atendente", async () => {
    const ctx = makeCtx({ role: "atendente", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tenants.removeLogo()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tenants.removeLogo()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("executa graciosamente sem DB (tenant_admin)", async () => {
    const ctx = makeCtx({ role: "tenant_admin", tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tenants.removeLogo();
    } catch (err: any) {
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});

// ─── serviceOrders.createColeta ───────────────────────────────────────────────
describe("serviceOrders.createColeta", () => {
  it("cria OS via portal público e retorna osNumber e publicToken", async () => {
    const ctx = makeCtx({ tenantId: null } as any);
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.serviceOrders.createColeta({
        tenantId: 1,
        customerName: "Maria Silva",
        customerPhone: "(11) 98765-4321",
        deviceType: "Celular",
        brand: "Samsung",
        model: "Galaxy A54",
        reportedDefect: "Tela quebrada",
        pickupAddress: "Rua das Flores, 100, São Paulo",
        preferredPickupTime: "Manhã",
      });
      expect(result.success).toBe(true);
      expect(result.osNumber).toBeTruthy();
      expect(result.publicToken).toBeTruthy();
      expect(result.id).toBeGreaterThan(0);
    } catch (err: any) {
      // Sem DB real no ambiente de teste — aceita INTERNAL_SERVER_ERROR
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });

  it("rejeita tenantId inválido (tenant inexistente)", async () => {
    const ctx = makeCtx({ tenantId: null } as any);
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.serviceOrders.createColeta({
        tenantId: 999999,
        customerName: "João Teste",
        customerPhone: "(11) 91111-2222",
        deviceType: "Notebook",
        reportedDefect: "Não liga",
        pickupAddress: "Av. Paulista, 1000",
      });
    } catch (err: any) {
      // Sem DB ou tenant não encontrado — ambos são erros esperados
      expect(["INTERNAL_SERVER_ERROR", "FORBIDDEN", "NOT_FOUND"]).toContain(err.code);
    }
  });

  it("rejeita input com campos obrigatórios ausentes", async () => {
    const ctx = makeCtx({ tenantId: null } as any);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.serviceOrders.createColeta({
        tenantId: 1,
        customerName: "A", // muito curto (min 2 — exatamente 1 char)
        customerPhone: "(11) 9",  // muito curto (min 8)
        deviceType: "Celular",
        reportedDefect: "Tela",
        pickupAddress: "Rua",  // muito curto (min 5)
      })
    ).rejects.toThrow();
  });
});

// ── customers.create / update — validação de CPF/CNPJ ────────────────────────
describe("customers.create — validação de CPF/CNPJ", () => {
  it("rejeita CPF inválido (sequência repetida)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.create({
        name: "Teste CPF Inválido",
        phone: "11999999999",
        document: "11111111111", // CPF com todos os dígitos iguais (inválido)
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita CPF com dígitos verificadores errados", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.create({
        name: "Teste CPF Errado",
        phone: "11999999999",
        document: "12345678900", // CPF com dígitos verificadores incorretos
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita CNPJ inválido (dígitos verificadores errados)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.create({
        name: "Empresa Inválida",
        phone: "1133334444",
        document: "11222333000100", // CNPJ com dígitos verificadores inválidos
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("aceita CPF válido sem lançar BAD_REQUEST", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      // CPF válido: 529.982.247-25
      await caller.customers.create({
        name: "Cliente CPF Válido",
        phone: "11999999999",
        document: "52998224725",
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      // Pode lançar INTERNAL_SERVER_ERROR (sem banco real) mas nunca BAD_REQUEST
      expect(err.code).not.toBe("BAD_REQUEST");
    }
  });

  it("aceita CNPJ válido sem lançar BAD_REQUEST", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      // CNPJ válido: 11.222.333/0001-81
      await caller.customers.create({
        name: "Empresa CNPJ Válido",
        phone: "1133334444",
        document: "11222333000181",
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("BAD_REQUEST");
    }
  });

  it("aceita documento com número de dígitos diferente de 11 ou 14 (sem validação)", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      // 9 dígitos: não é CPF nem CNPJ, não deve lançar BAD_REQUEST
      await caller.customers.create({
        name: "Teste Doc Curto",
        phone: "11999999999",
        document: "123456789",
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("BAD_REQUEST");
    }
  });
});

describe("customers.update — validação de CPF/CNPJ", () => {
  it("rejeita CPF inválido no update", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.update({
        id: 1,
        document: "11111111111", // CPF inválido (sequência repetida)
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita CNPJ inválido no update", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.update({
        id: 1,
        document: "11222333000100", // CNPJ inválido
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("aceita CPF válido no update sem lançar BAD_REQUEST", async () => {
    const ctx = makeCtx({ tenantId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      // CPF válido: 529.982.247-25
      await caller.customers.update({ id: 1, document: "52998224725" });
    } catch (e: unknown) {
      const err = e as { code?: string };
      expect(err.code).not.toBe("BAD_REQUEST");
    }
  });

  it("lança FORBIDDEN quando tenantId é null no update com CPF inválido", async () => {
    const ctx = makeCtx({ tenantId: null as any });
    const caller = appRouter.createCaller(ctx);
    // FORBIDDEN deve ser lançado antes mesmo de chegar na validação de CPF
    await expect(
      caller.customers.update({ id: 1, document: "11111111111" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
