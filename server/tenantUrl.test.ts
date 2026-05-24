// Teste do utilitário getTenantPortalUrl
import { describe, it, expect } from "vitest";
import { getTenantPortalUrl, getRootDomain, isPreviewEnvironment } from "../shared/tenantUrl";

describe("getTenantPortalUrl", () => {
  it("gera subdomínio em produção", () => {
    const url = getTenantPortalUrl("rochacell", null, "https://fullreparo.com.br");
    expect(url).toBe("https://rochacell.fullreparo.com.br");
  });

  it("usa customDomain quando disponível", () => {
    const url = getTenantPortalUrl("rochacell", "rochacelulares.com.br", "https://fullreparo.com.br");
    expect(url).toBe("https://rochacelulares.com.br");
  });

  it("usa fallback ?tenant= em preview do Manus", () => {
    const url = getTenantPortalUrl("rochacell", null, "https://abc.manus.space");
    expect(url).toBe("https://abc.manus.space/?tenant=rochacell");
  });

  it("usa fallback ?tenant= em localhost", () => {
    const url = getTenantPortalUrl("rochacell", null, "http://localhost:3000");
    expect(url).toBe("http://localhost:3000/?tenant=rochacell");
  });
});

describe("getRootDomain", () => {
  it("extrai domínio raiz de .com.br", () => {
    expect(getRootDomain("rochacell.fullreparo.com.br")).toBe("fullreparo.com.br");
  });

  it("extrai domínio raiz de .com", () => {
    expect(getRootDomain("rochacell.fullreparo.com")).toBe("fullreparo.com");
  });

  it("retorna o próprio host para domínio raiz", () => {
    expect(getRootDomain("fullreparo.com.br")).toBe("fullreparo.com.br");
  });
});

describe("isPreviewEnvironment", () => {
  it("detecta manus.space como preview", () => {
    expect(isPreviewEnvironment("https://abc.manus.space")).toBe(true);
  });

  it("detecta localhost como preview", () => {
    expect(isPreviewEnvironment("http://localhost:3000")).toBe(true);
  });

  it("não detecta produção como preview", () => {
    expect(isPreviewEnvironment("https://rochacell.fullreparo.com.br")).toBe(false);
  });
});
