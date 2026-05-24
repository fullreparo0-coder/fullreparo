/**
 * Testes para as procedures tenants.getSpecialties e tenants.updateSpecialties
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

function makeTenantAdminCtx(tenantId = 1): TrpcContext {
  const user: User = {
    id: 1,
    openId: "test-admin",
    tenantId,
    name: "Admin",
    email: "admin@test.com",
    phone: null,
    loginMethod: "manus",
    role: "tenant_admin",
    isActive: true,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function makeNoTenantCtx(): TrpcContext {
  const user: User = {
    id: 99,
    openId: "no-tenant",
    tenantId: null as any,
    name: "No Tenant",
    email: "notenant@test.com",
    phone: null,
    loginMethod: "manus",
    role: "tenant_admin",
    isActive: true,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("tenants.getSpecialties", () => {
  it("retorna objeto vazio quando não há DB (graceful degradation)", async () => {
    const ctx = makeTenantAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tenants.getSpecialties();
    // Sem DB real, retorna {} sem lançar erro
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeNoTenantCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tenants.getSpecialties()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("tenants.updateSpecialties", () => {
  it("lança FORBIDDEN quando tenantId é null", async () => {
    const ctx = makeNoTenantCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateSpecialties({
        specialties: { Smartphone: ["Apple", "Samsung"] },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("aceita objeto vazio (limpar todas as especialidades)", async () => {
    const ctx = makeTenantAdminCtx();
    const caller = appRouter.createCaller(ctx);
    // Sem DB real, o erro será INTERNAL_SERVER_ERROR (não FORBIDDEN nem validação)
    try {
      await caller.tenants.updateSpecialties({ specialties: {} });
    } catch (err: any) {
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });

  it("aceita especialidades com múltiplas categorias e marcas", async () => {
    const ctx = makeTenantAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const specialties = {
      Smartphone: ["Apple", "Samsung", "Motorola"],
      Notebook: ["Dell", "Lenovo"],
      "Categoria Personalizada": ["Marca A", "Marca B"],
    };
    try {
      await caller.tenants.updateSpecialties({ specialties });
    } catch (err: any) {
      // Sem DB real, esperamos INTERNAL_SERVER_ERROR (não erro de validação)
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });

  it("rejeita input com marcas que não são strings (validação Zod)", async () => {
    const ctx = makeTenantAdminCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenants.updateSpecialties({
        specialties: { Smartphone: [123 as any] },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
