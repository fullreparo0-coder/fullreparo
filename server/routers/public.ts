import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getServiceOrderByPublicToken, getOsTimeline, getWarrantyByOs, getBudgetsByOs, getTenantBySlug, getTenantById } from "../db";
import { customers, devices, serviceOrders } from "../../drizzle/schema";
import { publicProcedure, router } from "../_core/trpc";
import { and, eq } from "drizzle-orm";

export const publicRouter = router({
  // Rastrear OS por token público
  trackOs: publicProcedure
    .input(z.object({
      token: z.string(),
      tenantSlug: z.string().min(1).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
    const requestTenant = ctx.tenantFromHost ?? (input.tenantSlug ? await getTenantBySlug(input.tenantSlug) : null);
    const os = await getServiceOrderByPublicToken(input.token);
    if (!os) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });

    // Defesa multi-tenant: quando o portal foi aberto por subdomínio, domínio
    // próprio ou preview com slug, o token precisa pertencer ao mesmo tenant.
    // Isso evita que um link/token de outra assistência seja exibido no portal atual.
    if (requestTenant && os.tenantId !== requestTenant.id) {
      throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [timeline, customer, warranty, tenant] = await Promise.all([
      getOsTimeline(os.tenantId, os.id),
      db.select().from(customers).where(and(eq(customers.id, os.customerId), eq(customers.tenantId, os.tenantId))).limit(1),
      getWarrantyByOs(os.tenantId, os.id),
      requestTenant?.id === os.tenantId ? requestTenant : getTenantById(os.tenantId),
    ]);
    // Buscar orçamentos pendentes para aprovação
    const budgetList = await getBudgetsByOs(os.tenantId, os.id);
    const pendingBudget = budgetList.find((b) => b.status === "pending");
    return {
      osNumber: os.osNumber,
      status: os.status,
      origin: os.origin,
      reportedDefect: os.reportedDefect,
      createdAt: os.createdAt,
      updatedAt: os.updatedAt,
      estimatedDelivery: os.estimatedDelivery,
      customerName: customer[0]?.name ?? "Cliente",
      timeline: timeline.map((t) => ({
        status: t.status,
        notes: t.notes,
        changedByName: t.changedByName,
        createdAt: t.createdAt,
      })),
      pendingBudget: pendingBudget
        ? {
            id: pendingBudget.id,
            totalCost: pendingBudget.totalCost,
            description: pendingBudget.description,
            validUntil: pendingBudget.validUntil,
          }
        : null,
      warranty: warranty
        ? {
            warrantyCode: warranty.warrantyCode,
            warrantyDays: warranty.warrantyDays,
            startsAt: warranty.startsAt,
            expiresAt: warranty.expiresAt,
            isActive: warranty.isActive,
            description: warranty.description,
          }
        : null,
      tenantBranding: tenant
        ? {
            name: tenant.name,
            logoUrl: tenant.logoUrl ?? null,
            primaryColor: tenant.primaryColor ?? "#1e3a5f",
            whatsappNumber: tenant.whatsappNumber ?? null,
          }
        : null,
    };
    }),

  /**
   * Busca o token público de uma OS pelo número (osNumber).
   * Permite ao cliente rastrear a OS digitando o número em vez do token.
   */
  lookupOsToken: publicProcedure
    .input(z.object({
      query: z.string().min(1).max(50),
      tenantSlug: z.string().min(1).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const normalizedOsNumber = input.query.trim().toUpperCase();
      const tenant = ctx.tenantFromHost ?? (input.tenantSlug ? await getTenantBySlug(input.tenantSlug) : null);
      if (!tenant) return null;

      const rows = await db
        .select({ token: serviceOrders.publicToken })
        .from(serviceOrders)
        .where(and(eq(serviceOrders.osNumber, normalizedOsNumber), eq(serviceOrders.tenantId, tenant.id)))
        .limit(1);
      if (!rows[0]?.token) return null;
      return { token: rows[0].token };
    }),

  /**
   * Retorna o tenant resolvido pelo hostname da requisição atual.
   * Usado pelo frontend para detectar automaticamente em qual tenant está
   * quando acessado via subdomínio (ex: rocha.fullreparo.com.br).
   * Retorna null quando acessado pelo domínio raiz ou host ignorado.
   */
  getTenantByHost: publicProcedure.query(async ({ ctx }) => {
    const tenant = ctx.tenantFromHost;
    if (!tenant) return null;
    if (tenant.status === "blocked") throw new TRPCError({ code: "FORBIDDEN", message: "Assistência indisponível" });
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      phone: tenant.phone,
      whatsappNumber: tenant.whatsappNumber,
      businessHours: tenant.businessHours ?? null,
      city: tenant.city,
      state: tenant.state,
      address: (tenant as any).address ?? null,
      serviceTerms: (tenant as any).serviceTerms ?? null,
      coverageZipPrefixes: (tenant as any).coverageZipPrefixes ?? null,
      coverageDeadlines: (tenant as any).coverageDeadlines ?? null,
      welcomeText: (tenant as any).welcomeText ?? null,
      deviceSpecialties: (tenant as any).deviceSpecialties ?? null,
    };
  }),


  getTenantInfo: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const tenant = await getTenantBySlug(input.slug);
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });
    if (tenant.status === "blocked") throw new TRPCError({ code: "FORBIDDEN", message: "Assistência indisponível" });
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      phone: tenant.phone,
      whatsappNumber: tenant.whatsappNumber,
      businessHours: tenant.businessHours ?? null,
      city: tenant.city,
      state: tenant.state,
      address: (tenant as any).address ?? null,
      serviceTerms: (tenant as any).serviceTerms ?? null,
      coverageZipPrefixes: (tenant as any).coverageZipPrefixes ?? null,
      coverageDeadlines: (tenant as any).coverageDeadlines ?? null,
      welcomeText: (tenant as any).welcomeText ?? null,
      deviceSpecialties: (tenant as any).deviceSpecialties ?? null,
    };
  }),
});
