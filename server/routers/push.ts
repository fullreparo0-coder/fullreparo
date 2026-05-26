import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getVapidPublicKey, isPushConfigured, revokePushSubscription, savePushSubscription } from "../_core/push";
import { resolveCustomerPortalAccess } from "../_core/customerPortalAuth";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

function requireConfigured() {
  if (!isPushConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Notificações push ainda não foram configuradas no servidor.",
    });
  }
}

export const pushRouter = router({
  config: publicProcedure.query(() => ({
    enabled: isPushConfigured(),
    vapidPublicKey: getVapidPublicKey(),
  })),

  subscribeTenantUser: protectedProcedure
    .input(z.object({ subscription: pushSubscriptionSchema }))
    .mutation(async ({ input, ctx }) => {
      requireConfigured();

      const tenantId = ctx.user.tenantId ?? ctx.tenantFromHost?.id ?? null;
      const tenantRoles = ["tenant_admin", "atendente", "tecnico", "entregador", "admin"];
      if (!tenantId || !tenantRoles.includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Assinatura push permitida apenas para equipe da assistência." });
      }

      return savePushSubscription({
        tenantId,
        targetType: "tenant_user",
        userId: ctx.user.id,
        subscription: input.subscription,
        userAgent: ctx.req.headers["user-agent"] ?? null,
      });
    }),

  subscribeCustomer: publicProcedure
    .input(z.object({ tenantId: z.number().int().positive().optional(), subscription: pushSubscriptionSchema }))
    .mutation(async ({ input, ctx }) => {
      requireConfigured();

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const access = await resolveCustomerPortalAccess(ctx, db, input.tenantId, { throwOnFailure: true });
      if (!access || access.customerIds.length === 0) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Cliente não autenticado." });
      }

      return savePushSubscription({
        tenantId: access.tenantId,
        targetType: "customer",
        customerId: access.customerIds[0],
        subscription: input.subscription,
        userAgent: ctx.req.headers["user-agent"] ?? null,
      });
    }),

  unsubscribe: publicProcedure.input(unsubscribeSchema).mutation(async ({ input }) => revokePushSubscription(input.endpoint)),
});
