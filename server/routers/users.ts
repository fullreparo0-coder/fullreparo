import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getUsersByTenant } from "../db";
import { users } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { and, eq } from "drizzle-orm";

const tenantAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowed = ["super_admin", "admin", "tenant_admin"];
  if (!allowed.includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const usersRouter = router({
  // Listar usuários do tenant
  list: tenantAdminProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;
    if (!tenantId) return [];
    return getUsersByTenant(tenantId);
  }),

  // Criar usuário no tenant
  create: tenantAdminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["tenant_admin", "atendente", "tecnico", "entregador"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.insert(users).values({
        ...input,
        openId: `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        tenantId: ctx.user.tenantId,
        loginMethod: "manual",
      });
      return { success: true };
    }),

  // Atualizar usuário
  update: tenantAdminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(["tenant_admin", "atendente", "tecnico", "entregador"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await db
        .update(users)
        .set(data)
        .where(and(eq(users.id, id), eq(users.tenantId, ctx.user.tenantId)));
      return { success: true };
    }),

  // Listar técnicos do tenant
  technicians: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user.tenantId) return [];
    return db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, ctx.user.tenantId), eq(users.role, "tecnico"), eq(users.isActive, true)));
  }),

  // Listar entregadores do tenant
  deliverers: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user.tenantId) return [];
    return db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, ctx.user.tenantId), eq(users.role, "entregador"), eq(users.isActive, true)));
  }),
});
