import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getStockByTenant } from "../db";
import { stockItems } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { and, eq } from "drizzle-orm";

const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const stockRouter = router({
  list: tenantProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return getStockByTenant(
        ctx.user.tenantId!,
        input?.search,
        input?.page ?? 1,
        input?.pageSize ?? 20
      );
    }),

  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(2),
        sku: z.string().optional(),
        category: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        quantity: z.number().default(0),
        minQuantity: z.number().default(1),
        costPrice: z.number().default(0),
        salePrice: z.number().default(0),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(stockItems).values({
        ...input,
        tenantId: ctx.user.tenantId!,
        costPrice: String(input.costPrice),
        salePrice: String(input.salePrice),
      });
      return { id: Number((result as any)[0]?.insertId ?? (result as any).insertId), success: true };
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        quantity: z.number().optional(),
        minQuantity: z.number().optional(),
        costPrice: z.number().optional(),
        salePrice: z.number().optional(),
        category: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, costPrice, salePrice, ...data } = input;
      await db
        .update(stockItems)
        .set({
          ...data,
          ...(costPrice !== undefined && { costPrice: String(costPrice) }),
          ...(salePrice !== undefined && { salePrice: String(salePrice) }),
        })
        .where(and(eq(stockItems.id, id), eq(stockItems.tenantId, ctx.user.tenantId!)));
      return { success: true };
    }),

  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db
      .delete(stockItems)
      .where(and(eq(stockItems.id, input.id), eq(stockItems.tenantId, ctx.user.tenantId!)));
    return { success: true };
  }),
});
