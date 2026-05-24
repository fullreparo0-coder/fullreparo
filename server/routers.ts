import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";
import { getUserByEmail, getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.localLoginEnabled || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha inválidos.",
          });
        }

        const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!isPasswordValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha inválidos.",
          });
        }

        const allowedLocalRoles = ["super_admin", "tenant_admin"];
        if (!allowedLocalRoles.includes(user.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso restrito a administradores autorizados.",
          });
        }

        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        // Atualiza o último login
        const db = await getDb();
        if (db) {
          await db
            .update(users)
            .set({ lastSignedIn: new Date() })
            .where(eq(users.id, user.id));
        }

        return { success: true, user };
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
});

export type AppRouter = typeof appRouter;
