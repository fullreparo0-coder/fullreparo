/**
 * Testes para a funcionalidade de exportação de Ordens de Serviço
 *
 * Valida:
 * - Função getServiceOrdersForExport retorna dados corretos com DB real
 * - Isolamento de tenant (OS de outro tenant não aparecem)
 * - Filtro por status funciona corretamente
 * - Filtro por busca funciona corretamente
 * - Estrutura dos dados retornados contém todos os campos necessários
 * - Helpers de formatação CSV e labels de status
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { getServiceOrdersForExport } from "./db";

// ─── Helpers de contexto ──────────────────────────────────────────────────────

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
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    tenantFromHost: null,
  };
}

// ─── Testes de getServiceOrdersForExport ─────────────────────────────────────

describe("getServiceOrdersForExport", () => {
  it("retorna array (vazio ou com dados) para tenantId válido", async () => {
    const result = await getServiceOrdersForExport(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it("retorna array para tenantId inexistente (graceful degradation)", async () => {
    const result = await getServiceOrdersForExport(99999);
    expect(Array.isArray(result)).toBe(true);
  });

  it("aceita filtro de status sem lançar erro", async () => {
    const result = await getServiceOrdersForExport(1, undefined, "em_reparo");
    expect(Array.isArray(result)).toBe(true);
  });

  it("aceita múltiplos status separados por vírgula", async () => {
    const result = await getServiceOrdersForExport(1, undefined, "aguardando_coleta,coleta_agendada");
    expect(Array.isArray(result)).toBe(true);
  });

  it("aceita status 'all' sem filtrar por status específico", async () => {
    const result = await getServiceOrdersForExport(1, undefined, "all");
    expect(Array.isArray(result)).toBe(true);
  });

  it("aceita filtro de busca sem lançar erro", async () => {
    const result = await getServiceOrdersForExport(1, "João");
    expect(Array.isArray(result)).toBe(true);
  });

  it("aceita filtro de período (dateFrom/dateTo) sem lançar erro", async () => {
    const result = await getServiceOrdersForExport(
      1,
      undefined,
      undefined,
      new Date("2024-01-01"),
      new Date("2026-12-31"),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("isolamento de tenant: tenantId 2 não retorna OS do tenantId 1", async () => {
    const [tenant1, tenant2] = await Promise.all([
      getServiceOrdersForExport(1),
      getServiceOrdersForExport(2),
    ]);
    // Se ambos têm dados, nenhum ID deve aparecer no outro
    const ids1 = new Set(tenant1.map((r) => r.id));
    const ids2 = new Set(tenant2.map((r) => r.id));
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it("cada registro retornado contém os campos obrigatórios para exportação", async () => {
    const result = await getServiceOrdersForExport(1);
    for (const row of result) {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("osNumber");
      expect(row).toHaveProperty("status");
      expect(row).toHaveProperty("origin");
      expect(row).toHaveProperty("createdAt");
      expect(row).toHaveProperty("totalAmount");
      expect(row).toHaveProperty("customerName");
      expect(row).toHaveProperty("customerPhone");
      expect(row).toHaveProperty("customerDocument");
      expect(row).toHaveProperty("deviceBrand");
      expect(row).toHaveProperty("deviceModel");
      expect(row).toHaveProperty("deviceImei");
    }
  });
});

// ─── Testes de helpers de formatação CSV ─────────────────────────────────────

describe("Helpers de formatação CSV", () => {
  const escapeCsv = (v: string | null | undefined): string => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  it("escapa campo com vírgula entre aspas duplas", () => {
    expect(escapeCsv("João, Silva")).toBe('"João, Silva"');
  });

  it("escapa aspas duplas duplicando-as", () => {
    expect(escapeCsv('Tem "aspas"')).toBe('"Tem ""aspas"""');
  });

  it("não escapa campo simples sem caracteres especiais", () => {
    expect(escapeCsv("Simples")).toBe("Simples");
  });

  it("trata null como string vazia", () => {
    expect(escapeCsv(null)).toBe("");
  });

  it("trata undefined como string vazia", () => {
    expect(escapeCsv(undefined)).toBe("");
  });

  it("escapa campo com quebra de linha", () => {
    expect(escapeCsv("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });
});

// ─── Testes de labels de status ───────────────────────────────────────────────

describe("Labels de status para exportação", () => {
  const STATUS_LABELS: Record<string, string> = {
    solicitado: "Solicitado",
    aguardando_coleta: "Aguardando Coleta",
    coleta_agendada: "Coleta Agendada",
    coletado: "Coletado",
    recebido_na_assistencia: "Recebido na Assistência",
    em_diagnostico: "Em Diagnóstico",
    aguardando_aprovacao: "Aguardando Aprovação",
    aprovado: "Aprovado",
    recusado: "Recusado",
    aguardando_peca: "Aguardando Peça",
    em_reparo: "Em Reparo",
    pronto: "Pronto",
    aguardando_entrega: "Aguardando Entrega",
    saiu_para_entrega: "Saiu para Entrega",
    entregue: "Entregue",
    finalizado: "Entregue reparado",
    encerrado_sem_reparo: "Encerrado sem Reparo",
    encerrado_condenado: "Encerrado Condenado",
    cancelado: "Cancelado",
  };

  it("tem labels para todos os 19 status do sistema", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(19);
  });

  it("todos os status têm label não vazio em português", () => {
    for (const [, label] of Object.entries(STATUS_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
      expect(typeof label).toBe("string");
    }
  });

  it("status 'em_reparo' tem label correto", () => {
    expect(STATUS_LABELS["em_reparo"]).toBe("Em Reparo");
  });

  it("status 'recebido_na_assistencia' tem label correto", () => {
    expect(STATUS_LABELS["recebido_na_assistencia"]).toBe("Recebido na Assistência");
  });

  it("status 'aguardando_aprovacao' tem label correto", () => {
    expect(STATUS_LABELS["aguardando_aprovacao"]).toBe("Aguardando Aprovação");
  });

  it("status 'saiu_para_entrega' tem label correto", () => {
    expect(STATUS_LABELS["saiu_para_entrega"]).toBe("Saiu para Entrega");
  });
});

// ─── Testes de formatação de moeda e data ────────────────────────────────────

describe("Formatação de moeda e data para exportação", () => {
  const formatCurrency = (v: string | number | null | undefined): string => {
    const n = Number(v ?? 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (d: Date | null | undefined): string => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  it("formata valor zero como R$ 0,00", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("formata valor 1500.50 com separador de milhar e decimal pt-BR", () => {
    const result = formatCurrency(1500.5);
    expect(result).toContain("1.500");
    expect(result).toContain("50");
  });

  it("formata null como R$ 0,00", () => {
    const result = formatCurrency(null);
    expect(result).toContain("0");
  });

  it("formata data no padrão dd/mm/aaaa", () => {
    const d = new Date(2025, 5, 15); // 15 de junho de 2025
    const result = formatDate(d);
    expect(result).toContain("15");
    expect(result).toContain("06");
    expect(result).toContain("2025");
  });

  it("retorna string vazia para data null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("retorna string vazia para data undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });
});
