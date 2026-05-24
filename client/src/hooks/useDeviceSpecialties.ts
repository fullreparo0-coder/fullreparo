/**
 * useDeviceSpecialties
 *
 * Hook centralizado para obter os tipos de aparelhos e marcas filtrados
 * pelas especialidades configuradas pelo tenant.
 *
 * Funciona em dois contextos:
 *  1. Painel do tenant (tenant_admin): usa trpc.tenants.getSpecialties
 *  2. Portal público (cliente): recebe deviceSpecialties como string JSON do tenant
 *
 * Retorna:
 *  - filteredTypes: lista de tipos de aparelhos disponíveis
 *  - getBrandsForType(type): marcas disponíveis para um tipo específico
 *    (null = todas as marcas; [] = nenhuma marca específica configurada)
 *  - hasSpecialties: true quando o tenant configurou ao menos uma especialidade
 */
import { useMemo } from "react";
import { DEVICE_TYPES } from "@shared/const";

const ALL_TYPES = DEVICE_TYPES as unknown as string[];

export interface UseDeviceSpecialtiesOptions {
  /**
   * Mapa de especialidades já parseado (usado no painel do tenant).
   * Quando fornecido, tem prioridade sobre rawJson.
   */
  specialties?: Record<string, string[]> | null;
  /**
   * String JSON de especialidades (usado no portal público via tenant.deviceSpecialties).
   * Ignorado quando `specialties` está presente.
   */
  rawJson?: string | null;
}

export interface UseDeviceSpecialtiesResult {
  /** Lista de tipos de aparelhos disponíveis para seleção */
  filteredTypes: string[];
  /**
   * Retorna as marcas disponíveis para um tipo específico.
   * - null: sem restrição de marca (aceita qualquer marca)
   * - string[]: apenas essas marcas
   */
  getBrandsForType: (type: string) => string[] | null;
  /** True quando o tenant configurou ao menos uma especialidade */
  hasSpecialties: boolean;
}

export function useDeviceSpecialties({
  specialties,
  rawJson,
}: UseDeviceSpecialtiesOptions = {}): UseDeviceSpecialtiesResult {
  return useMemo(() => {
    // Resolve o mapa de especialidades
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

    // Sem especialidades configuradas: retorna todos os tipos e sem restrição de marca
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
      // Lista vazia = aceita qualquer marca nessa categoria
      if (!brands || brands.length === 0) return null;
      return brands;
    };

    return {
      filteredTypes,
      getBrandsForType,
      hasSpecialties: true,
    };
  }, [specialties, rawJson]);
}
