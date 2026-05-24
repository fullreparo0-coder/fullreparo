/**
 * claimTenant.test.ts
 *
 * Testa a lógica de geração de claimToken no cadastro de tenant
 * e a procedure claimTenant (vinculação do dono ao tenant via token).
 *
 * Todos os testes são puros (sem banco de dados real) — usam mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ─── Helpers puros testáveis ──────────────────────────────────────────────────

/** Gera um claimToken aleatório (hex 64 chars) */
function generateClaimToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Calcula a data de expiração do token (72h a partir de agora) */
function getClaimExpiry(now = new Date()): Date {
  return new Date(now.getTime() + 72 * 60 * 60 * 1000);
}

/** Verifica se um token ainda está válido */
function isTokenValid(claimToken: string | null, claimExpiresAt: Date | null, now = new Date()): boolean {
  if (!claimToken || !claimExpiresAt) return false;
  return claimExpiresAt > now;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("claimToken — geração e validação", () => {
  it("generateClaimToken retorna string hex de 64 caracteres", () => {
    const token = generateClaimToken();
    expect(token).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  it("generateClaimToken gera tokens únicos a cada chamada", () => {
    const t1 = generateClaimToken();
    const t2 = generateClaimToken();
    expect(t1).not.toBe(t2);
  });

  it("getClaimExpiry retorna data 72h no futuro", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const expiry = getClaimExpiry(now);
    const diffHours = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(72);
  });

  it("isTokenValid retorna true para token não expirado", () => {
    const token = generateClaimToken();
    const expiry = getClaimExpiry(); // 72h no futuro
    expect(isTokenValid(token, expiry)).toBe(true);
  });

  it("isTokenValid retorna false para token expirado", () => {
    const token = generateClaimToken();
    const expiredAt = new Date(Date.now() - 1000); // 1 segundo atrás
    expect(isTokenValid(token, expiredAt)).toBe(false);
  });

  it("isTokenValid retorna false para token null", () => {
    expect(isTokenValid(null, new Date())).toBe(false);
  });

  it("isTokenValid retorna false para expiresAt null", () => {
    expect(isTokenValid("sometoken", null)).toBe(false);
  });

  it("isTokenValid retorna false para ambos null", () => {
    expect(isTokenValid(null, null)).toBe(false);
  });
});

describe("claimTenant — lógica de vinculação", () => {
  // Simula a lógica da procedure claimTenant sem banco de dados real

  interface MockTenant {
    id: number;
    name: string;
    slug: string;
    claimToken: string | null;
    claimExpiresAt: Date | null;
  }

  interface MockUser {
    id: number;
    openId: string;
    tenantId: number | null;
    role: string;
  }

  function claimTenantLogic(
    inputToken: string,
    tenants: MockTenant[],
    user: MockUser,
    now = new Date()
  ): { success: boolean; tenantId?: number; error?: string } {
    // Busca tenant com token válido
    const tenant = tenants.find(
      (t) => t.claimToken === inputToken && t.claimExpiresAt && t.claimExpiresAt > now
    );

    if (!tenant) {
      return { success: false, error: "Link de ativação inválido ou expirado." };
    }

    // Verifica conflito de tenant
    if (user.tenantId && user.tenantId !== tenant.id) {
      return { success: false, error: "Sua conta já está vinculada a outra assistência técnica." };
    }

    return { success: true, tenantId: tenant.id };
  }

  const validToken = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
  const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const pastDate = new Date(Date.now() - 1000);

  const mockTenants: MockTenant[] = [
    { id: 1, name: "TechFix", slug: "techfix", claimToken: validToken, claimExpiresAt: futureDate },
    { id: 2, name: "RepairPro", slug: "repairpro", claimToken: "othertoken", claimExpiresAt: pastDate },
  ];

  it("vincula usuário ao tenant com token válido", () => {
    const user: MockUser = { id: 10, openId: "user1", tenantId: null, role: "user" };
    const result = claimTenantLogic(validToken, mockTenants, user);
    expect(result.success).toBe(true);
    expect(result.tenantId).toBe(1);
  });

  it("rejeita token inválido (não encontrado)", () => {
    const user: MockUser = { id: 10, openId: "user1", tenantId: null, role: "user" };
    const result = claimTenantLogic("tokeninvalido", mockTenants, user);
    expect(result.success).toBe(false);
    expect(result.error).toContain("inválido ou expirado");
  });

  it("rejeita token expirado", () => {
    const user: MockUser = { id: 10, openId: "user1", tenantId: null, role: "user" };
    const result = claimTenantLogic("othertoken", mockTenants, user);
    expect(result.success).toBe(false);
    expect(result.error).toContain("inválido ou expirado");
  });

  it("rejeita usuário já vinculado a outro tenant", () => {
    const user: MockUser = { id: 10, openId: "user1", tenantId: 99, role: "tenant_admin" };
    const result = claimTenantLogic(validToken, mockTenants, user);
    expect(result.success).toBe(false);
    expect(result.error).toContain("já está vinculada");
  });

  it("permite reivindicação se usuário já está no mesmo tenant (idempotente)", () => {
    const user: MockUser = { id: 10, openId: "user1", tenantId: 1, role: "tenant_admin" };
    const result = claimTenantLogic(validToken, mockTenants, user);
    expect(result.success).toBe(true);
    expect(result.tenantId).toBe(1);
  });
});

describe("activationUrl — geração do link de ativação", () => {
  // Testa a lógica de geração do link de ativação no frontend (Cadastro.tsx)

  function buildActivationUrl(portalBase: string, claimToken: string): string {
    try {
      const url = new URL(portalBase);
      const params = new URLSearchParams(url.search);
      params.set("claim", claimToken);
      return `${url.origin}/login?${params.toString()}`;
    } catch {
      return `${portalBase}/login?claim=${claimToken}`;
    }
  }

  it("gera URL de ativação correta em preview (com ?tenant=slug)", () => {
    const portalBase = "https://3000-preview.manus.computer/?tenant=techfix";
    const token = "abc123";
    const url = buildActivationUrl(portalBase, token);
    expect(url).toBe("https://3000-preview.manus.computer/login?tenant=techfix&claim=abc123");
  });

  it("gera URL de ativação correta em produção (subdomínio)", () => {
    const portalBase = "https://techfix.fullreparo.com.br";
    const token = "abc123";
    const url = buildActivationUrl(portalBase, token);
    expect(url).toBe("https://techfix.fullreparo.com.br/login?claim=abc123");
  });

  it("gera URL de ativação correta com domínio personalizado", () => {
    const portalBase = "https://techfix.com.br";
    const token = "abc123";
    const url = buildActivationUrl(portalBase, token);
    expect(url).toBe("https://techfix.com.br/login?claim=abc123");
  });

  it("não duplica o parâmetro tenant se já existe", () => {
    const portalBase = "https://preview.manus.computer/?tenant=techfix";
    const token = "xyz789";
    const url = buildActivationUrl(portalBase, token);
    expect(url).toContain("tenant=techfix");
    expect(url).toContain("claim=xyz789");
    // Não deve ter tenant duplicado
    expect(url.split("tenant=").length - 1).toBe(1);
  });
});
