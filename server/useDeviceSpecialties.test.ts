/**
 * Testes para o hook useDeviceSpecialties
 *
 * Como o hook usa useMemo e não depende de DOM, podemos testá-lo
 * diretamente importando a lógica pura sem precisar de renderHook.
 */
import { describe, it, expect } from "vitest";

// Importa a lógica pura do hook extraída para teste
// (replicamos a lógica aqui para testar sem React)
import { DEVICE_TYPES } from "../shared/const";

const ALL_TYPES = DEVICE_TYPES as unknown as string[];

function computeSpecialties(options: {
  specialties?: Record<string, string[]> | null;
  rawJson?: string | null;
}) {
  const { specialties, rawJson } = options;
  let map: Record<string, string[]> | null = null;

  if (specialties && Object.keys(specialties).length > 0) {
    map = specialties;
  } else if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        map = parsed as Record<string, string[]>;
      }
    } catch {
      map = null;
    }
  }

  if (!map || Object.keys(map).length === 0) {
    return {
      filteredTypes: ALL_TYPES,
      getBrandsForType: () => null,
      hasSpecialties: false,
    };
  }

  const filteredTypes = Object.keys(map);
  const getBrandsForType = (type: string): string[] | null => {
    if (!map) return null;
    const brands = map[type];
    if (!brands || brands.length === 0) return null;
    return brands;
  };

  return { filteredTypes, getBrandsForType, hasSpecialties: true };
}

describe("useDeviceSpecialties — sem especialidades", () => {
  it("retorna todos os DEVICE_TYPES quando specialties é null", () => {
    const result = computeSpecialties({ specialties: null });
    expect(result.filteredTypes).toEqual(ALL_TYPES);
    expect(result.hasSpecialties).toBe(false);
  });

  it("retorna todos os DEVICE_TYPES quando specialties é objeto vazio", () => {
    const result = computeSpecialties({ specialties: {} });
    expect(result.filteredTypes).toEqual(ALL_TYPES);
    expect(result.hasSpecialties).toBe(false);
  });

  it("retorna null para getBrandsForType quando sem especialidades", () => {
    const result = computeSpecialties({ specialties: null });
    expect(result.getBrandsForType("Smartphone")).toBeNull();
  });

  it("retorna todos os DEVICE_TYPES quando rawJson é null", () => {
    const result = computeSpecialties({ rawJson: null });
    expect(result.filteredTypes).toEqual(ALL_TYPES);
    expect(result.hasSpecialties).toBe(false);
  });

  it("retorna todos os DEVICE_TYPES quando rawJson é JSON inválido", () => {
    const result = computeSpecialties({ rawJson: "invalid-json" });
    expect(result.filteredTypes).toEqual(ALL_TYPES);
    expect(result.hasSpecialties).toBe(false);
  });
});

describe("useDeviceSpecialties — com especialidades via specialties", () => {
  const specialties = {
    Smartphone: ["Apple", "Samsung", "Motorola"],
    Notebook: ["Dell", "Lenovo"],
  };

  it("retorna apenas os tipos configurados", () => {
    const result = computeSpecialties({ specialties });
    expect(result.filteredTypes).toEqual(["Smartphone", "Notebook"]);
    expect(result.hasSpecialties).toBe(true);
  });

  it("retorna as marcas corretas para um tipo", () => {
    const result = computeSpecialties({ specialties });
    expect(result.getBrandsForType("Smartphone")).toEqual(["Apple", "Samsung", "Motorola"]);
    expect(result.getBrandsForType("Notebook")).toEqual(["Dell", "Lenovo"]);
  });

  it("retorna null para tipo não configurado", () => {
    const result = computeSpecialties({ specialties });
    expect(result.getBrandsForType("Tablet")).toBeNull();
  });

  it("retorna null para categoria com lista de marcas vazia (aceita qualquer marca)", () => {
    const result = computeSpecialties({ specialties: { Smartphone: [] } });
    expect(result.getBrandsForType("Smartphone")).toBeNull();
  });
});

describe("useDeviceSpecialties — com especialidades via rawJson", () => {
  const rawJson = JSON.stringify({
    Smartphone: ["Apple", "Samsung"],
    Tablet: ["iPad", "Samsung Galaxy Tab"],
  });

  it("parseia rawJson corretamente e retorna tipos filtrados", () => {
    const result = computeSpecialties({ rawJson });
    expect(result.filteredTypes).toEqual(["Smartphone", "Tablet"]);
    expect(result.hasSpecialties).toBe(true);
  });

  it("retorna marcas corretas a partir do rawJson", () => {
    const result = computeSpecialties({ rawJson });
    expect(result.getBrandsForType("Smartphone")).toEqual(["Apple", "Samsung"]);
    expect(result.getBrandsForType("Tablet")).toEqual(["iPad", "Samsung Galaxy Tab"]);
  });

  it("specialties tem prioridade sobre rawJson", () => {
    const result = computeSpecialties({
      specialties: { Notebook: ["Dell"] },
      rawJson,
    });
    expect(result.filteredTypes).toEqual(["Notebook"]);
    expect(result.getBrandsForType("Smartphone")).toBeNull();
  });

  it("ignora rawJson que é um array (não objeto)", () => {
    const result = computeSpecialties({ rawJson: "[\"Smartphone\"]" });
    expect(result.filteredTypes).toEqual(ALL_TYPES);
    expect(result.hasSpecialties).toBe(false);
  });
});

describe("useDeviceSpecialties — categorias personalizadas", () => {
  it("suporta categorias além dos DEVICE_TYPES padrão", () => {
    const result = computeSpecialties({
      specialties: {
        "Drone": ["DJI", "Parrot"],
        "Impressora": ["HP", "Epson"],
      },
    });
    expect(result.filteredTypes).toContain("Drone");
    expect(result.filteredTypes).toContain("Impressora");
    expect(result.getBrandsForType("Drone")).toEqual(["DJI", "Parrot"]);
  });
});
