import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getWarrantyByOs, getWarrantyByCode, getTenantById } from "../db";
import { warranties } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { and, eq } from "drizzle-orm";

const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const warrantiesRouter = router({
  getByOs: tenantProcedure.input(z.object({ serviceOrderId: z.number() })).query(async ({ ctx, input }) => {
    const warranty = await getWarrantyByOs(ctx.user.tenantId!, input.serviceOrderId);
    return warranty ?? null;
  }),

  // Consulta pública de garantia por código
  checkByCode: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
    const warranty = await getWarrantyByCode(input.code);
    if (!warranty) throw new TRPCError({ code: "NOT_FOUND", message: "Garantia não encontrada" });
    const now = new Date();
    const isValid = warranty.isActive && warranty.expiresAt > now;
    // Carregar branding do tenant para exibir na página pública
    const tenant = await getTenantById(warranty.tenantId);
    return {
      warrantyCode: warranty.warrantyCode,
      description: warranty.description,
      warrantyDays: warranty.warrantyDays,
      startsAt: warranty.startsAt,
      expiresAt: warranty.expiresAt,
      conditions: warranty.conditions,
      isValid,
      isActive: warranty.isActive,
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
});
