import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { checklistTemplates, tenantChecklistOverrides } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { asc, eq, and, or, isNull } from "drizzle-orm";

/** Middleware: requer tenantId no contexto */
const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem tenant." });
  }
  return next({ ctx: { ...ctx, tenantId: ctx.user.tenantId } });
});

/** Middleware: apenas admin/tenant_admin podem gerenciar o checklist */
const tenantAdminProcedure = tenantProcedure.use(({ ctx, next }) => {
  const adminRoles = ["admin", "tenant_admin", "super_admin"] as const;
  if (!adminRoles.includes(ctx.user.role as typeof adminRoles[number])) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o checklist." });
  }
  return next({ ctx });
});

export const tenantChecklistRouter = router({
  /**
   * Retorna o checklist efetivo do tenant para uso na criação de OS.
   * Lógica de merge:
   *  1. Carrega todos os templates globais ativos (filtrado por deviceType se informado)
   *  2. Carrega os overrides do tenant
   *  3. Para cada template global: verifica se há override que o desativa (isActive=false)
   *  4. Adiciona os itens exclusivos do tenant (isCustom=true)
   *  5. Ordena por sortOrder do override (se existir) ou do template
   */
  list: tenantProcedure
    .input(z.object({ deviceType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;

      // 1. Templates globais ativos (global + específicos do tipo)
      const templatesQuery = db
        .select()
        .from(checklistTemplates)
        .where(
          input?.deviceType
            ? or(isNull(checklistTemplates.deviceType), eq(checklistTemplates.deviceType, input.deviceType))
            : undefined
        )
        .orderBy(asc(checklistTemplates.sortOrder), asc(checklistTemplates.id));
      const templates = await templatesQuery;

      // 2. Overrides do tenant
      const overrides = await db
        .select()
        .from(tenantChecklistOverrides)
        .where(eq(tenantChecklistOverrides.tenantId, tenantId))
        .orderBy(asc(tenantChecklistOverrides.sortOrder), asc(tenantChecklistOverrides.id));

      // Mapa de overrides por templateId para lookup rápido
      const overrideByTemplateId = new Map(
        overrides.filter((o) => o.templateId !== null).map((o) => [o.templateId!, o])
      );

      // 3. Mesclar templates com overrides
      type ChecklistEntry = {
        id: number;
        label: string;
        sortOrder: number;
        isActive: boolean;
        deviceType: string | null;
        isCustom: boolean;
        templateId: number | null;
        overrideId: number | null;
      };

      const merged: ChecklistEntry[] = [];

      for (const tpl of templates) {
        if (!tpl.isActive) continue; // template desativado globalmente
        const override = overrideByTemplateId.get(tpl.id);
        merged.push({
          id: override ? override.id : tpl.id,
          label: override ? override.label : tpl.label,
          sortOrder: override ? override.sortOrder : tpl.sortOrder,
          isActive: override ? override.isActive : true,
          deviceType: tpl.deviceType,
          isCustom: false,
          templateId: tpl.id,
          overrideId: override ? override.id : null,
        });
      }

      // 4. Itens exclusivos do tenant
      const customItems = overrides.filter((o) => o.isCustom);
      for (const item of customItems) {
        if (input?.deviceType && item.deviceType && item.deviceType !== input.deviceType) continue;
        merged.push({
          id: item.id,
          label: item.label,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          deviceType: item.deviceType,
          isCustom: true,
          templateId: null,
          overrideId: item.id,
        });
      }

      // 5. Ordenar
      merged.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

      return merged;
    }),

  /**
   * Retorna o checklist completo para a tela de configuração (inclui inativos).
   * Inclui todos os templates globais + itens exclusivos do tenant.
   */
  listForAdmin: tenantAdminProcedure
    .input(z.object({ deviceType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;

      const templates = await db
        .select()
        .from(checklistTemplates)
        .orderBy(asc(checklistTemplates.sortOrder), asc(checklistTemplates.id));

      const overrides = await db
        .select()
        .from(tenantChecklistOverrides)
        .where(eq(tenantChecklistOverrides.tenantId, tenantId))
        .orderBy(asc(tenantChecklistOverrides.sortOrder), asc(tenantChecklistOverrides.id));

      const overrideByTemplateId = new Map(
        overrides.filter((o) => o.templateId !== null).map((o) => [o.templateId!, o])
      );

      type AdminEntry = {
        id: number;
        label: string;
        sortOrder: number;
        isActive: boolean;
        deviceType: string | null;
        isCustom: boolean;
        templateId: number | null;
        overrideId: number | null;
        isGloballyActive: boolean;
      };

      const result: AdminEntry[] = [];

      for (const tpl of templates) {
        if (input?.deviceType && tpl.deviceType && tpl.deviceType !== input.deviceType) continue;
        const override = overrideByTemplateId.get(tpl.id);
        result.push({
          id: override ? override.id : tpl.id,
          label: override ? override.label : tpl.label,
          sortOrder: override ? override.sortOrder : tpl.sortOrder,
          isActive: override ? override.isActive : tpl.isActive,
          deviceType: tpl.deviceType,
          isCustom: false,
          templateId: tpl.id,
          overrideId: override ? override.id : null,
          isGloballyActive: tpl.isActive,
        });
      }

      // Itens exclusivos do tenant
      for (const item of overrides.filter((o) => o.isCustom)) {
        if (input?.deviceType && item.deviceType && item.deviceType !== input.deviceType) continue;
        result.push({
          id: item.id,
          label: item.label,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          deviceType: item.deviceType,
          isCustom: true,
          templateId: null,
          overrideId: item.id,
          isGloballyActive: true,
        });
      }

      result.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      return result;
    }),

  /**
   * Ativa ou desativa um item global para o tenant.
   * Cria um override se não existir; atualiza se já existir.
   */
  toggleTemplate: tenantAdminProcedure
    .input(z.object({
      templateId: z.number().int().positive(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;

      // Verificar que o template existe
      const [tpl] = await db
        .select()
        .from(checklistTemplates)
        .where(eq(checklistTemplates.id, input.templateId));
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado." });

      // Verificar se já há override
      const [existing] = await db
        .select()
        .from(tenantChecklistOverrides)
        .where(
          and(
            eq(tenantChecklistOverrides.tenantId, tenantId),
            eq(tenantChecklistOverrides.templateId, input.templateId)
          )
        );

      if (existing) {
        await db
          .update(tenantChecklistOverrides)
          .set({ isActive: input.isActive })
          .where(eq(tenantChecklistOverrides.id, existing.id));
        return { ...existing, isActive: input.isActive };
      } else {
        // Criar override
        const [res] = await db.insert(tenantChecklistOverrides).values({
          tenantId,
          templateId: input.templateId,
          label: tpl.label,
          sortOrder: tpl.sortOrder,
          isActive: input.isActive,
          isCustom: false,
          deviceType: tpl.deviceType,
        });
        const [inserted] = await db
          .select()
          .from(tenantChecklistOverrides)
          .where(eq(tenantChecklistOverrides.id, (res as { insertId: number }).insertId));
        return inserted;
      }
    }),

  /** Cria um item exclusivo do tenant */
  createCustom: tenantAdminProcedure
    .input(z.object({
      label: z.string().min(1).max(200),
      deviceType: z.string().nullable().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;

      // Calcular próximo sortOrder
      const existing = await db
        .select({ sortOrder: tenantChecklistOverrides.sortOrder })
        .from(tenantChecklistOverrides)
        .where(eq(tenantChecklistOverrides.tenantId, tenantId));
      const maxOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder)) : 0;

      const [res] = await db.insert(tenantChecklistOverrides).values({
        tenantId,
        templateId: null,
        label: input.label.trim(),
        sortOrder: maxOrder + 1,
        isActive: input.isActive,
        isCustom: true,
        deviceType: input.deviceType ?? null,
      });
      const [inserted] = await db
        .select()
        .from(tenantChecklistOverrides)
        .where(eq(tenantChecklistOverrides.id, (res as { insertId: number }).insertId));
      return inserted;
    }),

  /** Atualiza label, isActive de um item exclusivo do tenant */
  updateCustom: tenantAdminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      label: z.string().min(1).max(200).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;
      const [item] = await db
        .select()
        .from(tenantChecklistOverrides)
        .where(
          and(
            eq(tenantChecklistOverrides.id, input.id),
            eq(tenantChecklistOverrides.tenantId, tenantId),
            eq(tenantChecklistOverrides.isCustom, true)
          )
        );
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado." });

      const updateData: Partial<{ label: string; isActive: boolean }> = {};
      if (input.label !== undefined) updateData.label = input.label.trim();
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db
        .update(tenantChecklistOverrides)
        .set(updateData)
        .where(eq(tenantChecklistOverrides.id, input.id));

      const [updated] = await db
        .select()
        .from(tenantChecklistOverrides)
        .where(eq(tenantChecklistOverrides.id, input.id));
      return updated;
    }),

  /** Remove um item exclusivo do tenant */
  deleteCustom: tenantAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;
      const [item] = await db
        .select()
        .from(tenantChecklistOverrides)
        .where(
          and(
            eq(tenantChecklistOverrides.id, input.id),
            eq(tenantChecklistOverrides.tenantId, tenantId),
            eq(tenantChecklistOverrides.isCustom, true)
          )
        );
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado ou não é exclusivo do tenant." });

      await db
        .delete(tenantChecklistOverrides)
        .where(eq(tenantChecklistOverrides.id, input.id));
      return { success: true };
    }),

  /** Reordena itens do tenant (overrides e itens exclusivos) */
  reorder: tenantAdminProcedure
    .input(z.array(z.object({
      id: z.number().int().positive(),
      sortOrder: z.number().int().min(0),
      isOverride: z.boolean(), // true = override de template, false = item exclusivo
      templateId: z.number().int().positive().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;

      await Promise.all(
        input.map(async ({ id, sortOrder, isOverride, templateId }) => {
          if (isOverride && templateId) {
            // Verificar se já há override; se não, criar
            const [existing] = await db
              .select()
              .from(tenantChecklistOverrides)
              .where(
                and(
                  eq(tenantChecklistOverrides.tenantId, tenantId),
                  eq(tenantChecklistOverrides.templateId, templateId)
                )
              );
            if (existing) {
              return db
                .update(tenantChecklistOverrides)
                .set({ sortOrder })
                .where(eq(tenantChecklistOverrides.id, existing.id));
            } else {
              // Buscar o template para criar override
              const [tpl] = await db
                .select()
                .from(checklistTemplates)
                .where(eq(checklistTemplates.id, templateId));
              if (tpl) {
                return db.insert(tenantChecklistOverrides).values({
                  tenantId,
                  templateId,
                  label: tpl.label,
                  sortOrder,
                  isActive: true,
                  isCustom: false,
                  deviceType: tpl.deviceType,
                });
              }
            }
          } else {
            // Item exclusivo: atualizar sortOrder
            return db
              .update(tenantChecklistOverrides)
              .set({ sortOrder })
              .where(
                and(
                  eq(tenantChecklistOverrides.id, id),
                  eq(tenantChecklistOverrides.tenantId, tenantId)
                )
              );
          }
        })
      );

      return { success: true };
    }),

  /**
   * Salva em lote o checklist de um tipo de aparelho (ou global) para o tenant.
   * Recebe a lista completa de itens do estado local e:
   *  - Cria/atualiza overrides de templates globais (isActive, sortOrder)
   *  - Cria/atualiza/deleta itens exclusivos do tenant
   */
  saveForType: tenantAdminProcedure
    .input(z.object({
      deviceType: z.string().nullable(), // null = global
      items: z.array(z.object({
        templateId: z.number().int().positive().optional().nullable(), // null = item exclusivo
        overrideId: z.number().int().positive().optional().nullable(), // id existente no banco
        label: z.string().min(1).max(200),
        isActive: z.boolean(),
        isCustom: z.boolean(),
        sortOrder: z.number().int().min(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;
      const { deviceType, items } = input;

      // IDs de overrides que devem existir após o save
      const keepOverrideIds = new Set<number>();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sortOrder = i; // usa a posição na lista como sortOrder

        if (!item.isCustom && item.templateId) {
          // Override de template global
          if (item.overrideId) {
            // Atualizar override existente
            await db
              .update(tenantChecklistOverrides)
              .set({ isActive: item.isActive, sortOrder, label: item.label })
              .where(
                and(
                  eq(tenantChecklistOverrides.id, item.overrideId),
                  eq(tenantChecklistOverrides.tenantId, tenantId)
                )
              );
            keepOverrideIds.add(item.overrideId);
          } else {
            // Criar novo override (apenas se diferente do padrão)
            const [tpl] = await db
              .select()
              .from(checklistTemplates)
              .where(eq(checklistTemplates.id, item.templateId));
            if (tpl && (!item.isActive || sortOrder !== tpl.sortOrder || item.label !== tpl.label)) {
              const [res] = await db.insert(tenantChecklistOverrides).values({
                tenantId,
                templateId: item.templateId,
                label: item.label,
                sortOrder,
                isActive: item.isActive,
                isCustom: false,
                deviceType: tpl.deviceType,
              });
              keepOverrideIds.add((res as { insertId: number }).insertId);
            }
          }
        } else if (item.isCustom) {
          // Item exclusivo do tenant
          if (item.overrideId) {
            // Atualizar existente
            await db
              .update(tenantChecklistOverrides)
              .set({ isActive: item.isActive, sortOrder, label: item.label })
              .where(
                and(
                  eq(tenantChecklistOverrides.id, item.overrideId),
                  eq(tenantChecklistOverrides.tenantId, tenantId)
                )
              );
            keepOverrideIds.add(item.overrideId);
          } else {
            // Criar novo item exclusivo
            const [res] = await db.insert(tenantChecklistOverrides).values({
              tenantId,
              templateId: null,
              label: item.label,
              sortOrder,
              isActive: item.isActive,
              isCustom: true,
              deviceType: deviceType,
            });
            keepOverrideIds.add((res as { insertId: number }).insertId);
          }
        }
      }

      // Deletar itens exclusivos do tipo que foram removidos da lista
      const existingCustom = await db
        .select()
        .from(tenantChecklistOverrides)
        .where(
          and(
            eq(tenantChecklistOverrides.tenantId, tenantId),
            eq(tenantChecklistOverrides.isCustom, true),
            deviceType
              ? eq(tenantChecklistOverrides.deviceType, deviceType)
              : isNull(tenantChecklistOverrides.deviceType)
          )
        );

      for (const existing of existingCustom) {
        if (!keepOverrideIds.has(existing.id)) {
          await db
            .delete(tenantChecklistOverrides)
            .where(eq(tenantChecklistOverrides.id, existing.id));
        }
      }

      return { success: true };
    }),
});
