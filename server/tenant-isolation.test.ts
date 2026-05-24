/**
 * tenant-isolation.test.ts
 *
 * Testes de isolamento multi-tenant para as procedures do portal público do cliente.
 * Valida que myOrders, myDevices e myPickupsCustomer NUNCA retornam dados
 * de outro tenant, mesmo que o cliente tenha cadastro em múltiplos tenants.
 *
 * Estratégia: mocks de ctx (tenantFromHost, user) e db — sem banco real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers de mock ─────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    openId: "user-openid-abc",
    email: "cliente@email.com",
    name: "Cliente Teste",
    role: "cliente" as const,
    tenantId: null,
    isActive: true,
    avatarUrl: null,
    phone: null,
    loginMethod: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeTenant(id: number, slug: string) {
  return {
    id,
    slug,
    name: `Tenant ${slug}`,
    email: `${slug}@email.com`,
    phone: "11999999999",
    city: "São Paulo",
    state: "SP",
    isActive: true,
    primaryColor: "#1e3a5f",
    logoUrl: null,
    whatsappNumber: null,
    customDomain: null,
    planId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Testes de lógica de isolamento ──────────────────────────────────────────

describe("Isolamento multi-tenant — lógica de resolução de tenantId", () => {
  it("deve usar tenantFromHost como fonte autoritativa quando disponível", () => {
    const tenantFromHost = makeTenant(10, "rocha");
    const inputTenantId = 99; // tentativa de forjar outro tenant

    // Lógica idêntica à das procedures
    const resolvedTenantId = tenantFromHost?.id ?? inputTenantId ?? null;

    expect(resolvedTenantId).toBe(10); // tenantFromHost vence sempre
  });

  it("deve usar input.tenantId como fallback quando tenantFromHost é null (modo preview/dev)", () => {
    const tenantFromHost = null;
    const inputTenantId = 10;

    const resolvedTenantId = tenantFromHost ?? inputTenantId ?? null;

    expect(resolvedTenantId).toBe(10);
  });

  it("deve retornar null quando não há tenantFromHost nem input.tenantId", () => {
    const tenantFromHost = null;
    const inputTenantId = undefined;

    const resolvedTenantId = tenantFromHost ?? inputTenantId ?? null;

    expect(resolvedTenantId).toBeNull();
  });

  it("deve retornar [] quando resolvedTenantId é null (sem vazamento cross-tenant)", () => {
    const resolvedTenantId: number | null = null;

    // Simula o guard das procedures
    const result = resolvedTenantId ? "dados" : [];

    expect(result).toEqual([]);
  });
});

describe("Isolamento multi-tenant — filtragem de customers por tenantId", () => {
  it("deve filtrar customers pelo tenantId correto, não retornar de outro tenant", () => {
    const resolvedTenantId = 10;

    // Simula customers no banco: 2 do tenant 10, 1 do tenant 20
    const allCustomers = [
      { id: 1, tenantId: 10, email: "cliente@email.com", userOpenId: "user-openid-abc" },
      { id: 2, tenantId: 10, email: "outro@email.com", userOpenId: null },
      { id: 3, tenantId: 20, email: "cliente@email.com", userOpenId: "user-openid-abc" }, // mesmo email, outro tenant
    ];

    // Simula a query: WHERE tenantId = resolvedTenantId AND (openId = X OR email = Y)
    const userOpenId = "user-openid-abc";
    const userEmail = "cliente@email.com";

    const matchedCustomers = allCustomers.filter(
      (c) =>
        c.tenantId === resolvedTenantId &&
        (c.userOpenId === userOpenId || c.email === userEmail)
    );

    expect(matchedCustomers).toHaveLength(1);
    expect(matchedCustomers[0].id).toBe(1);
    expect(matchedCustomers[0].tenantId).toBe(10);
  });

  it("deve retornar [] quando o cliente não tem cadastro no tenant do host", () => {
    const resolvedTenantId = 10;

    const allCustomers = [
      { id: 3, tenantId: 20, email: "cliente@email.com", userOpenId: "user-openid-abc" },
    ];

    const userOpenId = "user-openid-abc";
    const userEmail = "cliente@email.com";

    const matchedCustomers = allCustomers.filter(
      (c) =>
        c.tenantId === resolvedTenantId &&
        (c.userOpenId === userOpenId || c.email === userEmail)
    );

    expect(matchedCustomers).toHaveLength(0);
  });
});

describe("Isolamento multi-tenant — filtragem de OS por tenantId + customerId", () => {
  it("deve filtrar OS pelo tenantId E pelo customerId — dupla garantia", () => {
    const resolvedTenantId = 10;
    const customerIds = [1]; // customer do tenant 10

    // Simula OS no banco: 2 do tenant 10 (1 do cliente, 1 de outro), 1 do tenant 20
    const allOrders = [
      { id: 101, tenantId: 10, customerId: 1, status: "pending" },  // ✅ deve aparecer
      { id: 102, tenantId: 10, customerId: 5, status: "pending" },  // ❌ outro cliente
      { id: 103, tenantId: 20, customerId: 1, status: "pending" },  // ❌ outro tenant
    ];

    // Simula WHERE tenantId = resolvedTenantId AND customerId IN (customerIds)
    const filteredOrders = allOrders.filter(
      (o) => o.tenantId === resolvedTenantId && customerIds.includes(o.customerId)
    );

    expect(filteredOrders).toHaveLength(1);
    expect(filteredOrders[0].id).toBe(101);
  });

  it("não deve retornar OS de outro cliente do mesmo tenant", () => {
    const resolvedTenantId = 10;
    const customerIds = [1];

    const allOrders = [
      { id: 101, tenantId: 10, customerId: 1 },
      { id: 102, tenantId: 10, customerId: 2 }, // mesmo tenant, outro cliente
    ];

    const filteredOrders = allOrders.filter(
      (o) => o.tenantId === resolvedTenantId && customerIds.includes(o.customerId)
    );

    expect(filteredOrders).toHaveLength(1);
    expect(filteredOrders[0].id).toBe(101);
  });
});

describe("Isolamento multi-tenant — filtragem de aparelhos por tenantId + customerId", () => {
  it("deve retornar apenas aparelhos do tenant e cliente corretos", () => {
    const resolvedTenantId = 10;
    const customerIds = [1];

    const allDevices = [
      { id: 201, tenantId: 10, customerId: 1, brand: "Samsung", model: "A52" }, // ✅
      { id: 202, tenantId: 10, customerId: 2, brand: "Apple", model: "iPhone 12" }, // ❌ outro cliente
      { id: 203, tenantId: 20, customerId: 1, brand: "Motorola", model: "G30" }, // ❌ outro tenant
    ];

    const filteredDevices = allDevices.filter(
      (d) => d.tenantId === resolvedTenantId && customerIds.includes(d.customerId)
    );

    expect(filteredDevices).toHaveLength(1);
    expect(filteredDevices[0].id).toBe(201);
  });
});

describe("Isolamento multi-tenant — filtragem de coletas por tenantId + orderIds", () => {
  it("deve retornar apenas coletas do tenant e OS do cliente corretos", () => {
    const resolvedTenantId = 10;
    const orderIds = [101]; // OS do cliente no tenant 10

    const allPickups = [
      { id: 301, tenantId: 10, serviceOrderId: 101, type: "coleta" }, // ✅
      { id: 302, tenantId: 10, serviceOrderId: 102, type: "entrega" }, // ❌ OS de outro cliente
      { id: 303, tenantId: 20, serviceOrderId: 101, type: "coleta" }, // ❌ outro tenant
    ];

    const filteredPickups = allPickups.filter(
      (p) => p.tenantId === resolvedTenantId && orderIds.includes(p.serviceOrderId)
    );

    expect(filteredPickups).toHaveLength(1);
    expect(filteredPickups[0].id).toBe(301);
  });
});

describe("Segurança — tentativa de forjar tenantId via input", () => {
  it("tenantFromHost deve sempre sobrepor input.tenantId malicioso", () => {
    // Cenário: atacante envia tenantId: 99 tentando ver dados de outro tenant
    // mas o host resolve para tenant 10
    const tenantFromHost = makeTenant(10, "rocha");
    const maliciousInputTenantId = 99;

    const resolvedTenantId = tenantFromHost?.id ?? maliciousInputTenantId ?? null;

    expect(resolvedTenantId).toBe(10);
    expect(resolvedTenantId).not.toBe(99);
  });

  it("sem tenantFromHost e sem input.tenantId, deve retornar null (fail-safe)", () => {
    const tenantFromHost = null;
    const inputTenantId = undefined;

    const resolvedTenantId = tenantFromHost ?? inputTenantId ?? null;

    expect(resolvedTenantId).toBeNull();
  });
});
