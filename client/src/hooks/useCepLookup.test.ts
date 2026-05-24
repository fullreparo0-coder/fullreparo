import { describe, it, expect } from "vitest";
import { formatCep } from "./useCepLookup";

// ── Testes da função formatCep ────────────────────────────────────────────────
describe("formatCep", () => {
  it("retorna apenas dígitos quando menor que 5", () => {
    expect(formatCep("123")).toBe("123");
    expect(formatCep("1234")).toBe("1234");
  });

  it("formata CEP com 5 dígitos sem traço", () => {
    expect(formatCep("12345")).toBe("12345");
  });

  it("formata CEP com 6 a 8 dígitos com traço", () => {
    expect(formatCep("123456")).toBe("12345-6");
    expect(formatCep("1234567")).toBe("12345-67");
    expect(formatCep("12345678")).toBe("12345-678");
  });

  it("limita a 8 dígitos (9 chars com traço)", () => {
    expect(formatCep("123456789")).toBe("12345-678");
    expect(formatCep("12345678901")).toBe("12345-678");
  });

  it("remove caracteres não-numéricos antes de formatar", () => {
    expect(formatCep("01310-100")).toBe("01310-100");
    expect(formatCep("01310100")).toBe("01310-100");
    expect(formatCep("abc01310100xyz")).toBe("01310-100");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(formatCep("")).toBe("");
  });
});
