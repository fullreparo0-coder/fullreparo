import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { plans, tenantBillingRecords, tenants } from "../../drizzle/schema";
import { storagePut } from "../storage";

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "super_admin" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao super admin" });
  }
  return next({ ctx });
});

const billingStatusSchema = z.enum(["pending", "paid", "overdue", "cancelled"]);
const proofReviewStatusSchema = z.enum(["none", "pending_review", "approved", "rejected"]);

const allowedProofMimeTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

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

const submitProofInputSchema = z.object({
  fileBase64: z.string().min(1, "Informe o comprovante em base64."),
  mimeType: z.enum(allowedProofMimeTypes, { message: "Formato inválido. Envie PNG, JPG, WebP ou PDF." }),
  originalName: z.string().trim().min(1).max(255),
  notes: z.string().trim().max(2000).nullable().optional(),
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

function resolveTenantBillingDueDate(tenant: typeof tenants.$inferSelect) {
  return tenant.subscriptionEndsAt || tenant.trialEndsAt || new Date();
}

function getExtensionForMimeType(mimeType: (typeof allowedProofMimeTypes)[number]) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

function sanitizeOriginalName(originalName: string) {
  return originalName.replace(/[\u0000-\u001f\u007f]+/g, "").replace(/[\\/]+/g, "-").trim().slice(0, 255) || "comprovante";
}

function decodeProofBase64(fileBase64: string, mimeType: (typeof allowedProofMimeTypes)[number]) {
  const dataUrlPrefix = `data:${mimeType};base64,`;
  const base64 = fileBase64.startsWith(dataUrlPrefix)
    ? fileBase64.slice(dataUrlPrefix.length)
    : fileBase64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Comprovante vazio ou inválido." });
  }

  if (buffer.length > MAX_PROOF_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O comprovante deve ter no máximo 10MB." });
  }

  return buffer;
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
          reviewStatus: tenantBillingRecords.reviewStatus,
          dueDate: tenantBillingRecords.dueDate,
          paidAt: tenantBillingRecords.paidAt,
          method: tenantBillingRecords.method,
          notes: tenantBillingRecords.notes,
          proofFileKey: tenantBillingRecords.proofFileKey,
          proofUrl: tenantBillingRecords.proofUrl,
          proofMimeType: tenantBillingRecords.proofMimeType,
          proofOriginalName: tenantBillingRecords.proofOriginalName,
          proofSubmittedAt: tenantBillingRecords.proofSubmittedAt,
          proofSubmittedById: tenantBillingRecords.proofSubmittedById,
          reviewedAt: tenantBillingRecords.reviewedAt,
          reviewedById: tenantBillingRecords.reviewedById,
          reviewNotes: tenantBillingRecords.reviewNotes,
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

  listPendingReviews: superAdminProcedure
    .input(z.object({ limit: z.number().int().positive().max(100).default(50) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });

      const records = await db
        .select({
          id: tenantBillingRecords.id,
          tenantId: tenantBillingRecords.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          tenantEmail: tenants.email,
          tenantStatus: tenants.status,
          tenantSubscriptionEndsAt: tenants.subscriptionEndsAt,
          planId: tenantBillingRecords.planId,
          planName: plans.name,
          amount: tenantBillingRecords.amount,
          status: tenantBillingRecords.status,
          reviewStatus: tenantBillingRecords.reviewStatus,
          dueDate: tenantBillingRecords.dueDate,
          proofUrl: tenantBillingRecords.proofUrl,
          proofMimeType: tenantBillingRecords.proofMimeType,
          proofOriginalName: tenantBillingRecords.proofOriginalName,
          proofSubmittedAt: tenantBillingRecords.proofSubmittedAt,
          proofSubmittedById: tenantBillingRecords.proofSubmittedById,
          notes: tenantBillingRecords.notes,
        })
        .from(tenantBillingRecords)
        .innerJoin(tenants, eq(tenantBillingRecords.tenantId, tenants.id))
        .leftJoin(plans, eq(tenantBillingRecords.planId, plans.id))
        .where(eq(tenantBillingRecords.reviewStatus, "pending_review"))
        .orderBy(desc(tenantBillingRecords.proofSubmittedAt), desc(tenantBillingRecords.id))
        .limit(input?.limit ?? 50);

      return { records, total: records.length };
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
      reviewStatus: "none",
      createdById: ctx.user.id,
    });

    if (input.syncTenant) {
      await syncTenantSubscription(db, { tenantId: input.tenantId, planId: input.planId, status: input.status, dueDate });
    }

    return { success: true, id: Number((result as any)[0]?.insertId ?? (result as any).insertId) };
  }),

  submitProof: protectedProcedure.input(submitProofInputSchema).mutation(async ({ input, ctx }) => {
    const tenantId = ctx.user.tenantId;
    if (!tenantId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem assistência vinculada." });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });

    const tenant = await ensureTenantExists(db, tenantId);
    const [plan] = await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1);
    const buffer = decodeProofBase64(input.fileBase64, input.mimeType);
    const extension = getExtensionForMimeType(input.mimeType);
    const originalName = sanitizeOriginalName(input.originalName);
    const fileKey = `tenants/${tenantId}/billing-proofs/${Date.now()}-${nanoid()}.${extension}`;
    const uploaded = await storagePut(fileKey, buffer, input.mimeType);
    const now = new Date();
    const dueDate = resolveTenantBillingDueDate(tenant);
    const amount = normalizeMoney(String(plan?.price ?? "0.00"));

    const [pendingReview] = await db
      .select()
      .from(tenantBillingRecords)
      .where(and(eq(tenantBillingRecords.tenantId, tenantId), eq(tenantBillingRecords.reviewStatus, "pending_review")))
      .orderBy(desc(tenantBillingRecords.id))
      .limit(1);

    if (pendingReview) {
      await db
        .update(tenantBillingRecords)
        .set({
          planId: tenant.planId,
          amount,
          status: "pending",
          dueDate,
          paidAt: null,
          method: "comprovante",
          notes: input.notes || null,
          reviewStatus: "pending_review",
          proofFileKey: uploaded.key,
          proofUrl: uploaded.url,
          proofMimeType: input.mimeType,
          proofOriginalName: originalName,
          proofSubmittedAt: now,
          proofSubmittedById: ctx.user.id,
          reviewedAt: null,
          reviewedById: null,
          reviewNotes: null,
        })
        .where(eq(tenantBillingRecords.id, pendingReview.id));

      return { success: true, id: pendingReview.id, proofUrl: uploaded.url, reviewStatus: proofReviewStatusSchema.enum.pending_review };
    }

    const result = await db.insert(tenantBillingRecords).values({
      tenantId,
      planId: tenant.planId,
      amount,
      status: "pending",
      dueDate,
      paidAt: null,
      method: "comprovante",
      notes: input.notes || null,
      reviewStatus: "pending_review",
      proofFileKey: uploaded.key,
      proofUrl: uploaded.url,
      proofMimeType: input.mimeType,
      proofOriginalName: originalName,
      proofSubmittedAt: now,
      proofSubmittedById: ctx.user.id,
      createdById: ctx.user.id,
    });

    return {
      success: true,
      id: Number((result as any)[0]?.insertId ?? (result as any).insertId),
      proofUrl: uploaded.url,
      reviewStatus: proofReviewStatusSchema.enum.pending_review,
    };
  }),

  approveProof: superAdminProcedure
    .input(z.object({ id: z.number().int().positive(), reviewNotes: z.string().trim().max(2000).nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });

      const [record] = await db.select().from(tenantBillingRecords).where(eq(tenantBillingRecords.id, input.id)).limit(1);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Comprovante não encontrado." });
      if (record.reviewStatus !== "pending_review") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este comprovante não está pendente de análise." });
      }

      const now = new Date();
      await db
        .update(tenantBillingRecords)
        .set({
          status: "paid",
          reviewStatus: "approved",
          paidAt: now,
          method: record.method || "comprovante",
          reviewedAt: now,
          reviewedById: ctx.user.id,
          reviewNotes: input.reviewNotes || null,
        })
        .where(eq(tenantBillingRecords.id, record.id));

      await syncTenantSubscription(db, {
        tenantId: record.tenantId,
        planId: record.planId,
        status: "paid",
        dueDate: record.dueDate,
      });

      return { success: true };
    }),

  rejectProof: superAdminProcedure
    .input(z.object({ id: z.number().int().positive(), reviewNotes: z.string().trim().max(2000).nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });

      const [record] = await db.select().from(tenantBillingRecords).where(eq(tenantBillingRecords.id, input.id)).limit(1);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Comprovante não encontrado." });
      if (record.reviewStatus !== "pending_review") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este comprovante não está pendente de análise." });
      }

      await db
        .update(tenantBillingRecords)
        .set({
          status: "cancelled",
          reviewStatus: "rejected",
          reviewedAt: new Date(),
          reviewedById: ctx.user.id,
          reviewNotes: input.reviewNotes || null,
        })
        .where(eq(tenantBillingRecords.id, record.id));

      return { success: true };
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
          reviewStatus: input.status === "paid" ? "approved" : record.reviewStatus,
          reviewedAt: input.status === "paid" && record.reviewStatus === "pending_review" ? new Date() : record.reviewedAt,
        })
        .where(and(eq(tenantBillingRecords.id, input.id), eq(tenantBillingRecords.tenantId, input.tenantId)));

      if (input.syncTenant) {
        await syncTenantSubscription(db, { tenantId: input.tenantId, planId: input.planId, status: input.status, dueDate });
      }

      return { success: true };
    }),
});
