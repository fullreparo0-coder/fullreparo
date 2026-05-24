import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { checklistTemplates } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { asc, eq, or, isNull } from "drizzle-orm";

/** Middleware: apenas super_admin pode gerenciar os templates */
const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas super_admin pode gerenciar o checklist padrão." });
  }
  return next({ ctx });
});

export const checklistTemplatesRouter = router({
  /**
   * Lista itens do checklist.
   * - Sem filtro: retorna todos os itens (usado pelo super_admin).
   * - Com deviceType: retorna itens globais (deviceType = null) + itens do tipo informado.
   */
  list: protectedProcedure
    .input(z.object({ deviceType: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const base = db
        .select()
        .from(checklistTemplates)
        .orderBy(asc(checklistTemplates.sortOrder), asc(checklistTemplates.id));

      if (input?.deviceType) {
        return base.where(
          or(
            isNull(checklistTemplates.deviceType),
            eq(checklistTemplates.deviceType, input.deviceType)
          )
        );
      }
      return base;
    }),

  /** Cria um novo item */
  create: superAdminProcedure
    .input(
      z.object({
        label: z.string().min(1).max(200),
        isActive: z.boolean().default(true),
        deviceType: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db
        .select({ sortOrder: checklistTemplates.sortOrder })
        .from(checklistTemplates)
        .orderBy(asc(checklistTemplates.sortOrder));
      const maxOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder)) : 0;
      const [result] = await db.insert(checklistTemplates).values({
        label: input.label.trim(),
        isActive: input.isActive,
        sortOrder: maxOrder + 1,
        deviceType: input.deviceType ?? null,
      });
      const inserted = await db
        .select()
        .from(checklistTemplates)
        .where(eq(checklistTemplates.id, (result as { insertId: number }).insertId));
      return inserted[0];
    }),

  /** Atualiza label, isActive ou deviceType de um item */
  update: superAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        label: z.string().min(1).max(200).optional(),
        isActive: z.boolean().optional(),
        deviceType: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, label, isActive, deviceType } = input;
      const updateData: Partial<{ label: string; isActive: boolean; deviceType: string | null }> = {};
      if (label !== undefined) updateData.label = label.trim();
      if (isActive !== undefined) updateData.isActive = isActive;
      if (deviceType !== undefined) updateData.deviceType = deviceType;
      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum campo para atualizar." });
      }
      await db.update(checklistTemplates).set(updateData).where(eq(checklistTemplates.id, id));
      const [updated] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado." });
      return updated;
    }),

  /** Remove um item */
  delete: superAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(checklistTemplates).where(eq(checklistTemplates.id, input.id));
      return { success: true };
    }),

  /** Atualiza sortOrder em lote */
  reorder: superAdminProcedure
    .input(z.array(z.object({ id: z.number().int().positive(), sortOrder: z.number().int().min(0) })))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(
        input.map(({ id, sortOrder }) =>
          db!.update(checklistTemplates).set({ sortOrder }).where(eq(checklistTemplates.id, id))
        )
      );
      return { success: true };
    }),
});
