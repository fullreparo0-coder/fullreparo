import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { plans, tenantBillingRecords, tenants } from "../../drizzle/schema";

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "super_admin" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao super admin" });
  }
  return next({ ctx });
});

const billingStatusSchema = z.enum(["pending", "paid", "overdue", "cancelled"]);

const billingInputSchema = z.object({
  tenantId: z.number().int().positive(),
  planId: z.number().int().positive().nullable().optional(),
  amount: z.union([z.string(), z.number()]).transform((value) => String(value || "0")).default("0.00"),
  status: billingStatusSchema.default("pending"),
  dueDate: z.number().int().positive(),
  paidAt: z.number().int().positive().nullable().optional(),
  method: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  syncTenant: z.boolean().default(true),
});

function normalizeMoney(value: string) {
  const raw = value.trim();
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  const normalized = hasComma
    ? raw.replace(/\./g, "").replace(",", ".")
    : hasDot
      ? raw
      : raw;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Valor da cobrança inválido." });
  }
  return amount.toFixed(2);
}

function dateFromMillis(value: number, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${field} inválida.` });
  }
  return date;
}

function addOneMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function resolvePaidSubscriptionEndsAt(dueDate: Date) {
  const now = new Date();
  let nextDueDate = new Date(dueDate);

  while (nextDueDate.getTime() <= now.getTime()) {
    nextDueDate = addOneMonth(nextDueDate);
  }

  return nextDueDate;
}

async function ensureTenantExists(db: Awaited<ReturnType<typeof getDb>>, tenantId: number) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Assistência não encontrada." });
  return tenant;
}

async function syncTenantSubscription(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  input: { tenantId: number; planId?: number | null; status: z.infer<typeof billingStatusSchema>; dueDate: Date }
) {
  const updateData: Partial<typeof tenants.$inferInsert> = {
    subscriptionEndsAt: input.status === "paid" ? resolvePaidSubscriptionEndsAt(input.dueDate) : input.dueDate,
  };

  if (input.planId) updateData.planId = input.planId;

  if (input.status === "paid") {
    updateData.status = "active";
    updateData.trialEndsAt = null;
  } else if (input.status === "overdue") {
    updateData.status = "suspended";
  }

  await db.update(tenants).set(updateData).where(eq(tenants.id, input.tenantId));
}

export const tenantBillingRouter = router({
  listByTenant: superAdminProcedure
    .input(z.object({ tenantId: z.number().int().positive(), limit: z.number().int().positive().max(50).default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });
      await ensureTenantExists(db, input.tenantId);

      const records = await db
        .select({
          id: tenantBillingRecords.id,
          tenantId: tenantBillingRecords.tenantId,
          planId: tenantBillingRecords.planId,
          planName: plans.name,
          amount: tenantBillingRecords.amount,
          status: tenantBillingRecords.status,
          dueDate: tenantBillingRecords.dueDate,
          paidAt: tenantBillingRecords.paidAt,
          method: tenantBillingRecords.method,
          notes: tenantBillingRecords.notes,
          createdById: tenantBillingRecords.createdById,
          createdAt: tenantBillingRecords.createdAt,
          updatedAt: tenantBillingRecords.updatedAt,
        })
        .from(tenantBillingRecords)
        .leftJoin(plans, eq(tenantBillingRecords.planId, plans.id))
        .where(eq(tenantBillingRecords.tenantId, input.tenantId))
        .orderBy(desc(tenantBillingRecords.dueDate), desc(tenantBillingRecords.id))
        .limit(input.limit);

      return { records, latest: records[0] ?? null };
    }),

  create: superAdminProcedure.input(billingInputSchema).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });
    await ensureTenantExists(db, input.tenantId);

    const dueDate = dateFromMillis(input.dueDate, "Data de vencimento");
    const paidAt = input.status === "paid" ? new Date(input.paidAt || Date.now()) : input.paidAt ? dateFromMillis(input.paidAt, "Data de pagamento") : null;
    const amount = normalizeMoney(input.amount);

    const result = await db.insert(tenantBillingRecords).values({
      tenantId: input.tenantId,
      planId: input.planId ?? null,
      amount,
      status: input.status,
      dueDate,
      paidAt,
      method: input.method || null,
      notes: input.notes || null,
      createdById: ctx.user.id,
    });

    if (input.syncTenant) {
      await syncTenantSubscription(db, { tenantId: input.tenantId, planId: input.planId, status: input.status, dueDate });
    }

    return { success: true, id: Number((result as any)[0]?.insertId ?? (result as any).insertId) };
  }),

  update: superAdminProcedure
    .input(billingInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });
      await ensureTenantExists(db, input.tenantId);

      const [record] = await db
        .select()
        .from(tenantBillingRecords)
        .where(and(eq(tenantBillingRecords.id, input.id), eq(tenantBillingRecords.tenantId, input.tenantId)))
        .limit(1);

      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento de cobrança não encontrado." });

      const dueDate = dateFromMillis(input.dueDate, "Data de vencimento");
      const paidAt = input.status === "paid" ? new Date(input.paidAt || Date.now()) : input.paidAt ? dateFromMillis(input.paidAt, "Data de pagamento") : null;
      const amount = normalizeMoney(input.amount);

      await db
        .update(tenantBillingRecords)
        .set({
          planId: input.planId ?? null,
          amount,
          status: input.status,
          dueDate,
          paidAt,
          method: input.method || null,
          notes: input.notes || null,
        })
        .where(and(eq(tenantBillingRecords.id, input.id), eq(tenantBillingRecords.tenantId, input.tenantId)));

      if (input.syncTenant) {
        await syncTenantSubscription(db, { tenantId: input.tenantId, planId: input.planId, status: input.status, dueDate });
      }

      return { success: true };
    }),
});
