import { z } from "zod";
import { getDb, getUsersByTenant } from "../db";
import { users } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { validatePassword } from "../../shared/passwordRules";
import { assertTenantOperational, getTenantSubscriptionSnapshot } from "../_core/subscription";

const tenantAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "tenant_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o administrador da assistência pode gerenciar a equipe." });
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
          email: z.string().email(),
          phone: z.string().optional(),
          role: z.enum(["atendente", "tecnico", "entregador"]),
          password: z.string().min(8),
          confirmPassword: z.string().min(8),
        })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });

      const subscription = await getTenantSubscriptionSnapshot(ctx.user.tenantId);
      assertTenantOperational(subscription);
      const tenantUsers = await getUsersByTenant(ctx.user.tenantId);
      const activeOperationalUsers = tenantUsers.filter((user) => user.isActive && user.role !== "cliente").length;
      const hasUserLimit = typeof subscription?.maxUsers === "number" && subscription.maxUsers > 0;
      if (hasUserLimit && activeOperationalUsers >= subscription.maxUsers) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite de usuários do plano atingido (${subscription.maxUsers}). Altere o plano no Super Admin para adicionar mais membros.`,
        });
      }

      if (input.password !== input.confirmPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A confirmação de senha não confere." });
      }

      const passwordErrors = validatePassword(input.password);
      if (passwordErrors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A senha deve conter: ${passwordErrors.join(", ")}.`,
        });
      }

      const normalizedEmail = input.email.trim().toLowerCase();
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, ctx.user.tenantId), eq(users.email, normalizedEmail)))
        .limit(1);

      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe um membro da equipe com este e-mail nesta assistência." });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      await db.insert(users).values({
        name: input.name.trim(),
        email: normalizedEmail,
        phone: input.phone?.trim() || undefined,
        role: input.role,
        openId: `local_staff_${ctx.user.tenantId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        tenantId: ctx.user.tenantId,
        loginMethod: "local",
        passwordHash,
        localLoginEnabled: true,
        isActive: true,
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
