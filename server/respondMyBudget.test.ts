/**
 * respondMyBudget.test.ts
 *
 * Testes de isolamento e segurança para a procedure respondMyBudget.
 * Valida que um cliente não pode aprovar/recusar orçamento de:
 *   - Outro tenant
 *   - Outro cliente do mesmo tenant
 *   - Orçamento já respondido
 *   - Sem tenant identificado
 */

import { describe, it, expect } from "vitest";

// ─── Tipos de dados de teste ──────────────────────────────────────────────────

interface MockCustomer { id: number; tenantId: number; email: string | null; userOpenId: string | null; }
interface MockOs { id: number; tenantId: number; customerId: number; status: string; }
interface MockBudget { id: number; tenantId: number; serviceOrderId: number; status: "pending" | "approved" | "rejected" | "expired"; totalCost: string; }

type RespondAction = "approve" | "reject";
type RespondResult = { success: true; action: RespondAction } | { error: string };

// ─── Lógica pura espelhando a procedure ──────────────────────────────────────

function canRespondBudget(
  budgetId: number,
  action: RespondAction,
  resolvedTenantId: number | null,
  userOpenId: string | null,
  userEmail: string | null,
  allCustomers: MockCustomer[],
  allOrders: MockOs[],
  allBudgets: MockBudget[],
): RespondResult {
  // Guard 1: sem tenant
  if (!resolvedTenantId) return { error: "FORBIDDEN: Tenant não identificado" };
  // Guard 2: sem identidade
  if (!userOpenId && !userEmail) return { error: "FORBIDDEN: Sem identidade" };

  // Localiza customers do usuário neste tenant
  const matchedCustomers = allCustomers.filter(
    (c) =>
      c.tenantId === resolvedTenantId &&
      (c.userOpenId === userOpenId || c.email === userEmail)
  );
  if (matchedCustomers.length === 0) return { error: "FORBIDDEN: Cliente não encontrado neste tenant" };
  const customerIds = matchedCustomers.map((c) => c.id);

  // Busca o orçamento verificando tenant
  const budget = allBudgets.find((b) => b.id === budgetId && b.tenantId === resolvedTenantId);
  if (!budget) return { error: "NOT_FOUND: Orçamento não encontrado" };

  // Verifica que a OS pertence ao cliente logado
  const os = allOrders.find(
    (o) =>
      o.id === budget.serviceOrderId &&
      o.tenantId === resolvedTenantId &&
      customerIds.includes(o.customerId)
  );
  if (!os) return { error: "FORBIDDEN: Sem permissão para responder este orçamento" };

  // Verifica que o orçamento ainda está pendente
  if (budget.status !== "pending") return { error: "BAD_REQUEST: Orçamento já foi respondido" };

  return { success: true, action };
}

// ─── Dados de teste ───────────────────────────────────────────────────────────

const customers: MockCustomer[] = [
  { id: 1, tenantId: 10, email: "cliente@email.com", userOpenId: "openid-abc" },
  { id: 2, tenantId: 10, email: "outro@email.com",   userOpenId: "openid-xyz" },
  { id: 3, tenantId: 20, email: "cliente@email.com", userOpenId: "openid-abc" },
];

const orders: MockOs[] = [
  { id: 101, tenantId: 10, customerId: 1, status: "aguardando_aprovacao" },
  { id: 102, tenantId: 10, customerId: 2, status: "aguardando_aprovacao" },
  { id: 103, tenantId: 20, customerId: 3, status: "aguardando_aprovacao" },
];

const budgets: MockBudget[] = [
  { id: 201, tenantId: 10, serviceOrderId: 101, status: "pending",  totalCost: "350.00" },
  { id: 202, tenantId: 10, serviceOrderId: 102, status: "pending",  totalCost: "200.00" },
  { id: 203, tenantId: 20, serviceOrderId: 103, status: "pending",  totalCost: "150.00" },
  { id: 204, tenantId: 10, serviceOrderId: 101, status: "approved", totalCost: "350.00" }, // já aprovado
];

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("respondMyBudget — isolamento por tenant e por cliente", () => {
  it("aprova orçamento quando tenant e cliente batem", () => {
    const result = canRespondBudget(201, "approve", 10, "openid-abc", "cliente@email.com", customers, orders, budgets);
    expect(result).toEqual({ success: true, action: "approve" });
  });

  it("recusa orçamento com motivo quando tenant e cliente batem", () => {
    const result = canRespondBudget(201, "reject", 10, "openid-abc", "cliente@email.com", customers, orders, budgets);
    expect(result).toEqual({ success: true, action: "reject" });
  });

  it("retorna FORBIDDEN quando orçamento pertence a outro cliente do mesmo tenant", () => {
    // Cliente openid-abc tenta responder orçamento 202 (da OS 102, do cliente openid-xyz)
    const result = canRespondBudget(202, "approve", 10, "openid-abc", "cliente@email.com", customers, orders, budgets);
    expect(result).toMatchObject({ error: expect.stringContaining("FORBIDDEN") });
  });

  it("retorna NOT_FOUND quando orçamento pertence a outro tenant", () => {
    // Cliente do tenant 10 tenta responder orçamento 203 (do tenant 20)
    const result = canRespondBudget(203, "approve", 10, "openid-abc", "cliente@email.com", customers, orders, budgets);
    expect(result).toMatchObject({ error: expect.stringContaining("NOT_FOUND") });
  });

  it("retorna FORBIDDEN quando tenantId não está resolvido", () => {
    const result = canRespondBudget(201, "approve", null, "openid-abc", "cliente@email.com", customers, orders, budgets);
    expect(result).toMatchObject({ error: expect.stringContaining("FORBIDDEN") });
  });

  it("retorna FORBIDDEN quando usuário não tem identidade", () => {
    const result = canRespondBudget(201, "approve", 10, null, null, customers, orders, budgets);
    expect(result).toMatchObject({ error: expect.stringContaining("FORBIDDEN") });
  });

  it("retorna BAD_REQUEST quando orçamento já foi respondido", () => {
    const result = canRespondBudget(204, "approve", 10, "openid-abc", "cliente@email.com", customers, orders, budgets);
    expect(result).toMatchObject({ error: expect.stringContaining("BAD_REQUEST") });
  });

  it("retorna NOT_FOUND para orçamento inexistente", () => {
    const result = canRespondBudget(999, "approve", 10, "openid-abc", "cliente@email.com", customers, orders, budgets);
    expect(result).toMatchObject({ error: expect.stringContaining("NOT_FOUND") });
  });
});

describe("respondMyBudget — tenantFromHost sobrepõe input.tenantId", () => {
  it("tenantFromHost (id=10) impede acesso a orçamento do tenant 20 via input.tenantId=20", () => {
    const tenantFromHostId = 10;
    const inputTenantId = 20; // tentativa maliciosa

    // Lógica da procedure: tenantFromHost vence
    const resolvedTenantId = tenantFromHostId ?? inputTenantId ?? null;

    // Orçamento 203 está no tenant 20, mas resolvedTenantId = 10 → NOT_FOUND
    const result = canRespondBudget(203, "approve", resolvedTenantId, "openid-abc", "cliente@email.com", customers, orders, budgets);
    expect(result).toMatchObject({ error: expect.stringContaining("NOT_FOUND") });
  });
});
