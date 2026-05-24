/**
 * Testes unitários para:
 *   - extractTenantSlug (lógica pura de extração de slug)
 *   - deriveCookieDomain (lógica pura de cookie cross-subdomain)
 *
 * Esses testes não dependem de banco de dados — cobrem apenas as funções
 * determinísticas exportadas pelos módulos.
 */

import { describe, it, expect } from "vitest";
import { extractTenantSlug } from "./_core/tenantResolver";
import { deriveCookieDomain } from "./_core/cookies";

// ─── extractTenantSlug ────────────────────────────────────────────────────────

describe("extractTenantSlug — subdomínios válidos", () => {
  it("extrai slug de subdomínio .com.br (4 labels)", () => {
    expect(extractTenantSlug("rocha.fullreparo.com.br")).toBe("rocha");
  });

  it("extrai slug de subdomínio .com (3 labels)", () => {
    expect(extractTenantSlug("rocha.fullreparo.com")).toBe("rocha");
  });

  it("extrai slug de subdomínio com hífen", () => {
    expect(extractTenantSlug("rocha-celulares.fullreparo.com.br")).toBe("rocha-celulares");
  });

  it("extrai slug de customDomain com subdomínio próprio", () => {
    // O slug é o primeiro label; a resolução por customDomain é feita no db.ts
    expect(extractTenantSlug("assistencia.rochacelulares.com.br")).toBe("assistencia");
  });

  it("normaliza para minúsculas", () => {
    expect(extractTenantSlug("ROCHA.fullreparo.com.br")).toBe("rocha");
  });

  it("ignora porta no hostname", () => {
    expect(extractTenantSlug("rocha.fullreparo.com.br:3000")).toBe("rocha");
  });
});

describe("extractTenantSlug — hosts que devem retornar null", () => {
  it("retorna null para localhost", () => {
    expect(extractTenantSlug("localhost")).toBeNull();
  });

  it("retorna null para 127.0.0.1", () => {
    expect(extractTenantSlug("127.0.0.1")).toBeNull();
  });

  it("retorna null para IPv6 ::1", () => {
    expect(extractTenantSlug("::1")).toBeNull();
  });

  it("retorna null para endereço IPv4 genérico", () => {
    expect(extractTenantSlug("192.168.1.100")).toBeNull();
  });

  it("retorna null para domínio raiz .com.br (3 labels)", () => {
    expect(extractTenantSlug("fullreparo.com.br")).toBeNull();
  });

  it("retorna null para domínio raiz .com (2 labels)", () => {
    expect(extractTenantSlug("fullreparo.com")).toBeNull();
  });

  it("retorna null para label 'www'", () => {
    expect(extractTenantSlug("www.fullreparo.com.br")).toBeNull();
  });

  it("retorna null para label 'app'", () => {
    expect(extractTenantSlug("app.fullreparo.com.br")).toBeNull();
  });

  it("retorna null para label 'api'", () => {
    expect(extractTenantSlug("api.fullreparo.com.br")).toBeNull();
  });

  it("retorna null para label 'admin'", () => {
    expect(extractTenantSlug("admin.fullreparo.com.br")).toBeNull();
  });

  it("retorna null para label 'mail'", () => {
    expect(extractTenantSlug("mail.fullreparo.com.br")).toBeNull();
  });

  it("retorna null para preview .manus.computer", () => {
    expect(extractTenantSlug("3000-abc123.us2.manus.computer")).toBeNull();
  });

  it("retorna null para preview .manus.space", () => {
    expect(extractTenantSlug("myapp.manus.space")).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(extractTenantSlug("")).toBeNull();
  });

  it("retorna null para slug com caracteres inválidos", () => {
    expect(extractTenantSlug("rocha_cel.fullreparo.com.br")).toBeNull();
  });

  it("retorna null para slug que começa com hífen", () => {
    expect(extractTenantSlug("-rocha.fullreparo.com.br")).toBeNull();
  });
});

// ─── deriveCookieDomain ───────────────────────────────────────────────────────

describe("deriveCookieDomain — domínios reais", () => {
  it("retorna .fullreparo.com.br para subdomínio de tenant", () => {
    expect(deriveCookieDomain("rocha.fullreparo.com.br")).toBe(".fullreparo.com.br");
  });

  it("retorna .fullreparo.com.br para o domínio raiz", () => {
    expect(deriveCookieDomain("fullreparo.com.br")).toBe(".fullreparo.com.br");
  });

  it("retorna .fullreparo.com para domínio .com", () => {
    expect(deriveCookieDomain("rocha.fullreparo.com")).toBe(".fullreparo.com");
  });

  it("retorna .fullreparo.com para domínio raiz .com", () => {
    expect(deriveCookieDomain("fullreparo.com")).toBe(".fullreparo.com");
  });

  it("retorna .rochacelulares.com.br para customDomain", () => {
    expect(deriveCookieDomain("rochacelulares.com.br")).toBe(".rochacelulares.com.br");
  });
});

describe("deriveCookieDomain — hosts ignorados", () => {
  it("retorna undefined para localhost", () => {
    expect(deriveCookieDomain("localhost")).toBeUndefined();
  });

  it("retorna undefined para 127.0.0.1", () => {
    expect(deriveCookieDomain("127.0.0.1")).toBeUndefined();
  });

  it("retorna undefined para IPv4 genérico", () => {
    expect(deriveCookieDomain("192.168.1.1")).toBeUndefined();
  });

  it("retorna undefined para preview .manus.computer", () => {
    expect(deriveCookieDomain("3000-abc.us2.manus.computer")).toBeUndefined();
  });

  it("retorna undefined para preview .manus.space", () => {
    expect(deriveCookieDomain("myapp.manus.space")).toBeUndefined();
  });

  it("retorna undefined para string vazia", () => {
    expect(deriveCookieDomain("")).toBeUndefined();
  });
});

// ─── getTenantByDomain — integração com banco (graceful sem DB) ───────────────

import { getTenantByDomain } from "./db";

describe("getTenantByDomain — comportamento sem banco de dados", () => {
  it("retorna undefined para localhost (host ignorado)", async () => {
    const result = await getTenantByDomain("localhost");
    expect(result).toBeUndefined();
  });

  it("retorna undefined para string vazia", async () => {
    const result = await getTenantByDomain("");
    expect(result).toBeUndefined();
  });

  it("retorna undefined para IP", async () => {
    const result = await getTenantByDomain("192.168.1.1");
    expect(result).toBeUndefined();
  });

  it("retorna undefined para preview .manus.computer (sem banco)", async () => {
    const result = await getTenantByDomain("3000-abc.us2.manus.computer");
    // Sem banco, o fallback de customDomain retorna undefined
    expect(result).toBeUndefined();
  });

  it("não lança erro para slug inexistente sem banco (graceful degradation)", async () => {
    // Sem banco disponível, deve retornar undefined silenciosamente
    await expect(getTenantByDomain("inexistente.fullreparo.com.br")).resolves.toBeUndefined();
  });

  it("não lança erro para customDomain raiz inexistente sem banco", async () => {
    // Domínio raiz customizado — sem slug, vai direto para customDomain lookup
    await expect(getTenantByDomain("rochacelulares.com.br")).resolves.toBeUndefined();
  });

  it("não lança erro para www (label reservado) sem banco", async () => {
    await expect(getTenantByDomain("www.fullreparo.com.br")).resolves.toBeUndefined();
  });
});

// ─── tenantResolverMiddleware — comportamento do middleware ───────────────────

import { tenantResolverMiddleware } from "./_core/tenantResolver";

describe("tenantResolverMiddleware — injeção em req.resolvedTenant", () => {
  function makeReq(hostname: string) {
    return {
      hostname,
      headers: { host: hostname },
      resolvedTenant: undefined as unknown,
    } as any;
  }

  it("define req.resolvedTenant = null para localhost (sem banco)", async () => {
    const req = makeReq("localhost");
    const res = {} as any;
    let nextCalled = false;
    await tenantResolverMiddleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.resolvedTenant).toBeNull();
  });

  it("define req.resolvedTenant = null para IP (sem banco)", async () => {
    const req = makeReq("192.168.1.1");
    const res = {} as any;
    await tenantResolverMiddleware(req, res, () => {});
    expect(req.resolvedTenant).toBeNull();
  });

  it("define req.resolvedTenant = null para slug inexistente (sem banco)", async () => {
    const req = makeReq("inexistente.fullreparo.com.br");
    const res = {} as any;
    await tenantResolverMiddleware(req, res, () => {});
    expect(req.resolvedTenant).toBeNull();
  });

  it("sempre chama next() mesmo em caso de erro interno", async () => {
    // Simula hostname que poderia causar erro
    const req = makeReq("!invalid!host!");
    const res = {} as any;
    let nextCalled = false;
    await tenantResolverMiddleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});
