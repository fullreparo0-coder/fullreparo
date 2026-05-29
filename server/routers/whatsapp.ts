import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { whatsappIntegrations, whatsappMessageLogs } from "../../drizzle/schema";
import { getWhatsappEligibility, getWhatsappIntegrationForTenant, sanitizeWhatsappIntegration } from "../_core/whatsapp";

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "super_admin" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao super admin" });
  }
  return next({ ctx });
});

const tenantAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowed = ["super_admin", "admin", "tenant_admin"];
  if (!allowed.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
  if (!ctx.user.tenantId && ctx.user.role !== "super_admin" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem tenant vinculado" });
  }
  return next({ ctx });
});

const saveIntegrationInput = z.object({
  tenantId: z.number().int().positive(),
  enabled: z.boolean(),
  displayName: z.string().max(120).optional().nullable(),
  businessAccountId: z.string().max(120).optional().nullable(),
  phoneNumberId: z.string().max(120).optional().nullable(),
  phoneNumber: z.string().max(30).optional().nullable(),
  accessToken: z.string().min(10).optional().nullable(),
  graphApiVersion: z.string().max(20).default("v23.0"),
  budgetTemplateName: z.string().max(120).default("fullreparo_orcamento_disponivel"),
  readyTemplateName: z.string().max(120).default("fullreparo_os_pronta"),
  templateLanguage: z.string().max(20).default("pt_BR"),
});

export const whatsappRouter = router({
  getMine: tenantAdminProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;
    if (!tenantId) throw new TRPCError({ code: "FORBIDDEN" });
    const [eligibility, integration] = await Promise.all([
      getWhatsappEligibility(tenantId),
      getWhatsappIntegrationForTenant(tenantId),
    ]);
    return {
      eligibility,
      integration: sanitizeWhatsappIntegration(integration),
    };
  }),

  getByTenant: superAdminProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ input }) => {
    const [eligibility, integration] = await Promise.all([
      getWhatsappEligibility(input.tenantId),
      getWhatsappIntegrationForTenant(input.tenantId),
    ]);
    return {
      eligibility,
      integration: sanitizeWhatsappIntegration(integration),
    };
  }),

  saveForTenant: superAdminProcedure.input(saveIntegrationInput).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const existing = await getWhatsappIntegrationForTenant(input.tenantId);
    const values = {
      tenantId: input.tenantId,
      enabled: input.enabled,
      displayName: input.displayName ?? null,
      businessAccountId: input.businessAccountId ?? null,
      phoneNumberId: input.phoneNumberId ?? null,
      phoneNumber: input.phoneNumber ?? null,
      ...(input.accessToken ? { accessToken: input.accessToken } : {}),
      graphApiVersion: input.graphApiVersion,
      budgetTemplateName: input.budgetTemplateName,
      readyTemplateName: input.readyTemplateName,
      templateLanguage: input.templateLanguage,
      lastHealthStatus: input.enabled ? "configured" : "disabled",
      lastHealthMessage: input.enabled ? "Configuração salva pelo super admin" : "Integração desativada pelo super admin",
      lastCheckedAt: new Date(),
    };

    if (existing) {
      await db.update(whatsappIntegrations).set(values).where(eq(whatsappIntegrations.id, existing.id));
    } else {
      await db.insert(whatsappIntegrations).values(values);
    }

    const integration = await getWhatsappIntegrationForTenant(input.tenantId);
    return { success: true, integration: sanitizeWhatsappIntegration(integration) };
  }),

  listLogsByTenant: superAdminProcedure
    .input(z.object({ tenantId: z.number().int().positive(), limit: z.number().int().min(1).max(100).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(whatsappMessageLogs)
        .where(eq(whatsappMessageLogs.tenantId, input.tenantId))
        .orderBy(desc(whatsappMessageLogs.createdAt))
        .limit(input.limit);
    }),

  getTenantStats: superAdminProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const countExpr = sql<number>`COUNT(*)`;

      const [totalSent, monthSent, monthFailed, totalFailed, lastSent] = await Promise.all([
        db.select({ count: countExpr }).from(whatsappMessageLogs).where(and(eq(whatsappMessageLogs.tenantId, input.tenantId), eq(whatsappMessageLogs.status, "sent"))),
        db.select({ count: countExpr }).from(whatsappMessageLogs).where(and(eq(whatsappMessageLogs.tenantId, input.tenantId), eq(whatsappMessageLogs.status, "sent"), gte(whatsappMessageLogs.createdAt, startOfMonth))),
        db.select({ count: countExpr }).from(whatsappMessageLogs).where(and(eq(whatsappMessageLogs.tenantId, input.tenantId), eq(whatsappMessageLogs.status, "failed"), gte(whatsappMessageLogs.createdAt, startOfMonth))),
        db.select({ count: countExpr }).from(whatsappMessageLogs).where(and(eq(whatsappMessageLogs.tenantId, input.tenantId), eq(whatsappMessageLogs.status, "failed"))),
        db
          .select({ sentAt: whatsappMessageLogs.sentAt, createdAt: whatsappMessageLogs.createdAt })
          .from(whatsappMessageLogs)
          .where(and(eq(whatsappMessageLogs.tenantId, input.tenantId), eq(whatsappMessageLogs.status, "sent")))
          .orderBy(desc(whatsappMessageLogs.sentAt), desc(whatsappMessageLogs.createdAt))
          .limit(1),
      ]);

      return {
        totalSent: Number(totalSent[0]?.count ?? 0),
        monthSent: Number(monthSent[0]?.count ?? 0),
        monthFailed: Number(monthFailed[0]?.count ?? 0),
        totalFailed: Number(totalFailed[0]?.count ?? 0),
        lastSentAt: lastSent[0]?.sentAt ?? lastSent[0]?.createdAt ?? null,
      };
    }),

  listMineLogs: tenantAdminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      return db
        .select()
        .from(whatsappMessageLogs)
        .where(and(eq(whatsappMessageLogs.tenantId, ctx.user.tenantId)))
        .orderBy(desc(whatsappMessageLogs.createdAt))
        .limit(input.limit);
    }),
});
