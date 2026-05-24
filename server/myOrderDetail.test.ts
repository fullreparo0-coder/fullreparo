/**
 * myOrderDetail.test.ts
 *
 * Testes de isolamento e segurança para a procedure myOrderDetail.
 * Valida que o detalhe de uma OS nunca é retornado para:
 *   - Um cliente de outro tenant
 *   - Um cliente do mesmo tenant mas que não é dono da OS
 *   - Quando não há tenantId resolvido
 */

import { describe, it, expect } from "vitest";

// ─── Helpers de lógica pura (espelham a procedure) ───────────────────────────

interface MockCustomer { id: number; tenantId: number; email: string | null; userOpenId: string | null; }
interface MockOs { id: number; tenantId: number; customerId: number; status: string; }

function resolveOrderDetail(
  osId: number,
  resolvedTenantId: number | null,
  userOpenId: string | null,
  userEmail: string | null,
  allCustomers: MockCustomer[],
  allOrders: MockOs[],
): MockOs | null {
  // Guard 1: sem tenant → retorna null
  if (!resolvedTenantId) return null;
  // Guard 2: sem identidade → retorna null
  if (!userOpenId && !userEmail) return null;

  // Localiza customers do usuário neste tenant
  const matchedCustomers = allCustomers.filter(
    (c) =>
      c.tenantId === resolvedTenantId &&
      (c.userOpenId === userOpenId || c.email === userEmail)
  );
  if (matchedCustomers.length === 0) return null;
  const customerIds = matchedCustomers.map((c) => c.id);

  // Busca a OS verificando tenant + customer
  const os = allOrders.find(
    (o) =>
      o.id === osId &&
      o.tenantId === resolvedTenantId &&
      customerIds.includes(o.customerId)
  );
  return os ?? null;
}

// ─── Dados de teste ───────────────────────────────────────────────────────────

const customers: MockCustomer[] = [
  { id: 1, tenantId: 10, email: "cliente@email.com", userOpenId: "openid-abc" },
  { id: 2, tenantId: 10, email: "outro@email.com",   userOpenId: "openid-xyz" },
  { id: 3, tenantId: 20, email: "cliente@email.com", userOpenId: "openid-abc" }, // mesmo usuário, outro tenant
];

const orders: MockOs[] = [
  { id: 101, tenantId: 10, customerId: 1, status: "em_reparo" },   // OS do cliente no tenant 10
  { id: 102, tenantId: 10, customerId: 2, status: "pronto" },      // OS de outro cliente no tenant 10
  { id: 103, tenantId: 20, customerId: 3, status: "finalizado" },  // OS do mesmo usuário no tenant 20
];

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("myOrderDetail — isolamento por tenant e por cliente", () => {
  it("retorna a OS correta quando tenant e cliente batem", () => {
    const result = resolveOrderDetail(101, 10, "openid-abc", "cliente@email.com", customers, orders);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(101);
  });

  it("retorna null quando a OS pertence a outro cliente do mesmo tenant", () => {
    // Cliente openid-abc tenta ver OS 102 (do cliente openid-xyz)
    const result = resolveOrderDetail(102, 10, "openid-abc", "cliente@email.com", customers, orders);
    expect(result).toBeNull();
  });

  it("retorna null quando a OS pertence ao mesmo usuário mas em outro tenant", () => {
    // Usuário openid-abc tenta ver OS 103 (tenant 20) enquanto está no tenant 10
    const result = resolveOrderDetail(103, 10, "openid-abc", "cliente@email.com", customers, orders);
    expect(result).toBeNull();
  });

  it("retorna null quando tenantId não está resolvido (domínio raiz)", () => {
    const result = resolveOrderDetail(101, null, "openid-abc", "cliente@email.com", customers, orders);
    expect(result).toBeNull();
  });

  it("retorna null quando o usuário não tem identidade (sem openId e sem email)", () => {
    const result = resolveOrderDetail(101, 10, null, null, customers, orders);
    expect(result).toBeNull();
  });

  it("retorna null quando a OS não existe no banco", () => {
    const result = resolveOrderDetail(999, 10, "openid-abc", "cliente@email.com", customers, orders);
    expect(result).toBeNull();
  });

  it("encontra o cliente por email quando openId é null", () => {
    // Simula cliente sem openId vinculado, mas com email
    const customersEmailOnly: MockCustomer[] = [
      { id: 5, tenantId: 10, email: "semOpenId@email.com", userOpenId: null },
    ];
    const ordersEmailOnly: MockOs[] = [
      { id: 201, tenantId: 10, customerId: 5, status: "pronto" },
    ];
    const result = resolveOrderDetail(201, 10, null, "semOpenId@email.com", customersEmailOnly, ordersEmailOnly);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(201);
  });

  it("encontra o cliente por openId quando email é null", () => {
    const customersOpenIdOnly: MockCustomer[] = [
      { id: 6, tenantId: 10, email: null, userOpenId: "openid-only" },
    ];
    const ordersOpenIdOnly: MockOs[] = [
      { id: 202, tenantId: 10, customerId: 6, status: "em_reparo" },
    ];
    const result = resolveOrderDetail(202, 10, "openid-only", null, customersOpenIdOnly, ordersOpenIdOnly);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(202);
  });
});

describe("myOrderDetail — tenantFromHost sobrepõe input.tenantId", () => {
  it("tenantFromHost (id=10) impede acesso a OS do tenant 20 via input.tenantId=20", () => {
    // Simula: tenantFromHost.id = 10 (middleware), input.tenantId = 20 (forjado)
    const tenantFromHostId = 10;
    const inputTenantId = 20; // tentativa maliciosa

    // Lógica da procedure: tenantFromHost vence
    const resolvedTenantId = tenantFromHostId ?? inputTenantId ?? null;

    const result = resolveOrderDetail(103, resolvedTenantId, "openid-abc", "cliente@email.com", customers, orders);
    // OS 103 está no tenant 20, mas resolvedTenantId = 10 → deve retornar null
    expect(result).toBeNull();
  });
});
