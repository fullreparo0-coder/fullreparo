import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { canUseTenantLoginInput, TENANT_STAFF_ROLES } from "./_core/authIsolation";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { tenantsRouter, plansRouter } from "./routers/tenants";
import { usersRouter } from "./routers/users";
import { customersRouter } from "./routers/customers";
import { serviceOrdersRouter } from "./routers/serviceOrders";
import { budgetsRouter } from "./routers/budgets";
import { pickupsRouter } from "./routers/pickups";
import { stockRouter } from "./routers/stock";
import { paymentsRouter } from "./routers/payments";
import { warrantiesRouter } from "./routers/warranties";
import { publicRouter } from "./routers/public";
import { checklistTemplatesRouter } from "./routers/checklistTemplates";
import { tenantChecklistRouter } from "./routers/tenantChecklist";
import { osChecklistRouter } from "./routers/osChecklist";
import { notificationsRouter } from "./routers/notifications";
import { customerAuthRouter } from "./routers/customerAuth";
import { whatsappRouter } from "./routers/whatsapp";
import { pushRouter } from "./routers/push";
import { tenantBillingRouter } from "./routers/tenantBilling";

function sanitizeAuthUser<T extends { passwordHash?: unknown } | null | undefined>(user: T) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => sanitizeAuthUser(opts.ctx.user)),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
          tenantId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });
        }

        const normalizedEmail = input.email.trim().toLowerCase();
        const tenantIdFromHost = ctx.tenantFromHost?.id;
        const hasTenantIdInput = typeof input.tenantId === "number";
        const tenantId = tenantIdFromHost ?? input.tenantId;
        const isTenantLogin = typeof tenantId === "number";

        if (hasTenantIdInput && !canUseTenantLoginInput(ctx.req, ctx.tenantFromHost)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesse a assistência pelo link próprio para entrar como equipe.",
          });
        }

        const loginCandidates = isTenantLogin
          ? await db
              .select()
              .from(users)
              .where(and(eq(users.email, normalizedEmail), eq(users.tenantId, tenantId)))
              .orderBy(sql`field(${users.role}, 'tenant_admin', 'admin', 'super_admin', 'atendente', 'tecnico', 'entregador', 'cliente', 'user')`, users.id)
          : await db
              .select()
              .from(users)
              .where(eq(users.email, normalizedEmail))
              .orderBy(sql`field(${users.role}, 'super_admin', 'admin', 'tenant_admin', 'atendente', 'tecnico', 'entregador', 'cliente', 'user')`, users.id);

        let user = null;
        for (const candidate of loginCandidates) {
          if (!candidate.localLoginEnabled || !candidate.passwordHash || !candidate.isActive) continue;
          const isPasswordValid = await bcrypt.compare(input.password, candidate.passwordHash);
          if (isPasswordValid) {
            user = candidate;
            break;
          }
        }

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha inválidos.",
          });
        }

        if (isTenantLogin) {
          if (!(TENANT_STAFF_ROLES as readonly string[]).includes(user.role) || user.tenantId !== tenantId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Acesso permitido apenas para a equipe desta assistência.",
            });
          }
        } else if (user.role !== "super_admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito ao administrador do FullReparo.",
          });
        }

        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        await db
          .update(users)
          .set({ lastSignedIn: new Date() })
          .where(eq(users.id, user.id));

        return { success: true, user: sanitizeAuthUser(user) };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  tenants: tenantsRouter,
  plans: plansRouter,
  users: usersRouter,
  customers: customersRouter,
  serviceOrders: serviceOrdersRouter,
  budgets: budgetsRouter,
  pickups: pickupsRouter,
  stock: stockRouter,
  payments: paymentsRouter,
  warranties: warrantiesRouter,
  public: publicRouter,
  checklistTemplates: checklistTemplatesRouter,
  tenantChecklist: tenantChecklistRouter,
  osChecklist: osChecklistRouter,
  notifications: notificationsRouter,
  customerAuth: customerAuthRouter,
  whatsapp: whatsappRouter,
  push: pushRouter,
  tenantBilling: tenantBillingRouter,
});

export type AppRouter = typeof appRouter;
