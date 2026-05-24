import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getPaymentsByOs } from "../db";
import { customers, payments, serviceOrders, tenants } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { and, desc, eq } from "drizzle-orm";
import { resolveCustomerPortalAccess } from "../_core/customerPortalAuth";
import { createPagarmeCharge, normalizePagarmeStatus, sanitizePagarmeConfig } from "../_core/pagarme";
import { notifyOwner } from "../_core/notification";

const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

const readyForCustomerPayment = new Set(["pronto", "aguardando_entrega", "saiu_para_entrega", "entregue", "finalizado"]);

function toNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function getCustomerOsForPayment(ctx: any, input: { osId: number; tenantId?: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const access = await resolveCustomerPortalAccess(ctx, db, input.tenantId);
  if (!access) throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesse sua conta para pagar esta OS." });

  const [os] = await db.select().from(serviceOrders).where(and(
    eq(serviceOrders.id, input.osId),
    eq(serviceOrders.tenantId, access.tenantId),
  )).limit(1);
  if (!os || !access.customerIds.includes(os.customerId)) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada." });

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, access.tenantId)).limit(1);
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, os.customerId), eq(customers.tenantId, access.tenantId))).limit(1);
  if (!tenant || !customer) throw new TRPCError({ code: "NOT_FOUND" });
  return { db, os, tenant, customer, tenantId: access.tenantId };
}

async function summarizePayments(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, tenantId: number, serviceOrderId: number) {
  const rows = await db.select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.serviceOrderId, serviceOrderId))).orderBy(desc(payments.createdAt));
  const paid = rows.filter((p) => p.status === "paid").reduce((sum, p) => sum + toNumber(p.amount), 0);
  const pending = rows.filter((p) => ["pending", "processing"].includes(String(p.status))).reduce((sum, p) => sum + toNumber(p.amount), 0);
  return { rows, paid, pending };
}

export const paymentsRouter = router({
  getByOs: tenantProcedure.input(z.object({ serviceOrderId: z.number() })).query(async ({ ctx, input }) => {
    return getPaymentsByOs(ctx.user.tenantId!, input.serviceOrderId);
  }),

  register: tenantProcedure
    .input(
      z.object({
        serviceOrderId: z.number(),
        amount: z.number().positive(),
        method: z.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "outro"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [os] = await db.select().from(serviceOrders).where(and(eq(serviceOrders.id, input.serviceOrderId), eq(serviceOrders.tenantId, ctx.user.tenantId!))).limit(1);
      if (!os) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });
      const result = await db.insert(payments).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: input.serviceOrderId,
        amount: String(input.amount),
        method: input.method,
        status: "paid",
        paidAt: new Date(),
        gateway: "manual",
        notes: input.notes,
        receivedById: ctx.user.id,
      } as any);
      return { id: Number((result as any)[0]?.insertId ?? (result as any).insertId), success: true };
    }),

  getCustomerSummary: protectedProcedure
    .input(z.object({ osId: z.number().int().positive(), tenantId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      const { db, os, tenant, tenantId } = await getCustomerOsForPayment(ctx, input);
      const summary = await summarizePayments(db, tenantId, os.id);
      const total = toNumber(os.totalAmount);
      const amountDue = Math.max(0, total - summary.paid);
      return {
        canPay: Boolean(tenant.pagarmeEnabled && os.deliveryAuthorizedAt && readyForCustomerPayment.has(String(os.status)) && amountDue > 0),
        reason: !tenant.pagarmeEnabled ? "Pagamento online indisponível nesta assistência." : !os.deliveryAuthorizedAt ? "Autorize a entrega para liberar o pagamento." : !readyForCustomerPayment.has(String(os.status)) ? "Pagamento liberado quando o serviço estiver concluído." : amountDue <= 0 ? "Pagamento já quitado." : null,
        total,
        paid: summary.paid,
        pending: summary.pending,
        amountDue,
        config: sanitizePagarmeConfig({
          enabled: Boolean(tenant.pagarmeEnabled),
          environment: tenant.pagarmeEnvironment,
          publicKey: tenant.pagarmePublicKey,
          secretKey: tenant.pagarmeSecretKey,
          webhookSecret: tenant.pagarmeWebhookSecret,
        }),
        payments: summary.rows,
      };
    }),

  createCustomerPix: protectedProcedure
    .input(z.object({ osId: z.number().int().positive(), tenantId: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { db, os, tenant, customer, tenantId } = await getCustomerOsForPayment(ctx, input);
      const summary = await summarizePayments(db, tenantId, os.id);
      const amountDue = Math.max(0, toNumber(os.totalAmount) - summary.paid);
      if (!os.deliveryAuthorizedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Autorize a entrega antes de pagar." });
      if (!readyForCustomerPayment.has(String(os.status))) throw new TRPCError({ code: "BAD_REQUEST", message: "Pagamento disponível apenas após conclusão do serviço." });
      if (amountDue <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "OS já está quitada." });
      try {
        const charge = await createPagarmeCharge({
          config: { enabled: Boolean(tenant.pagarmeEnabled), environment: tenant.pagarmeEnvironment, publicKey: tenant.pagarmePublicKey, secretKey: tenant.pagarmeSecretKey, webhookSecret: tenant.pagarmeWebhookSecret },
          serviceOrderId: os.id,
          osNumber: os.osNumber,
          amount: amountDue,
          method: "pix",
          customer,
        });
        const mappedStatus = normalizePagarmeStatus(charge.status) as any;
        const result = await db.insert(payments).values({
          tenantId,
          serviceOrderId: os.id,
          amount: String(amountDue),
          method: "pix",
          status: mappedStatus,
          paidAt: mappedStatus === "paid" ? new Date() : null,
          gateway: "pagarme",
          gatewayPaymentId: charge.gatewayPaymentId,
          gatewayOrderId: charge.orderId,
          gatewayChargeId: charge.chargeId,
          gatewayStatus: charge.status,
          pixQrCode: charge.pixQrCode,
          pixQrCodeUrl: charge.pixQrCodeUrl,
          pixExpiresAt: charge.pixExpiresAt,
          metadata: charge.raw,
          notes: "Cobrança PIX criada pelo cliente via Pagar.me",
        } as any);
        await db.update(serviceOrders).set({ paymentRequestedAt: new Date() } as any).where(and(eq(serviceOrders.id, os.id), eq(serviceOrders.tenantId, tenantId)));
        await notifyOwner({ title: `Cliente iniciou pagamento PIX da OS ${os.osNumber}`, content: `Valor: R$ ${amountDue.toFixed(2)}. A confirmação será atualizada pelo webhook Pagar.me.` }).catch(() => undefined);
        return { success: true, id: Number((result as any)[0]?.insertId ?? (result as any).insertId), payment: { ...charge, status: mappedStatus, amount: amountDue } };
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "Falha ao criar PIX no Pagar.me." });
      }
    }),

  createCustomerCard: protectedProcedure
    .input(z.object({
      osId: z.number().int().positive(),
      tenantId: z.number().int().positive().optional(),
      card: z.object({
        number: z.string().min(13).max(22),
        holderName: z.string().min(3).max(120),
        expMonth: z.number().int().min(1).max(12),
        expYear: z.number().int().min(2024).max(2100),
        cvv: z.string().min(3).max(4),
        installments: z.number().int().min(1).max(12).default(1),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, os, tenant, customer, tenantId } = await getCustomerOsForPayment(ctx, input);
      const summary = await summarizePayments(db, tenantId, os.id);
      const amountDue = Math.max(0, toNumber(os.totalAmount) - summary.paid);
      if (!os.deliveryAuthorizedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Autorize a entrega antes de pagar." });
      if (!readyForCustomerPayment.has(String(os.status))) throw new TRPCError({ code: "BAD_REQUEST", message: "Pagamento disponível apenas após conclusão do serviço." });
      if (amountDue <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "OS já está quitada." });
      try {
        const charge = await createPagarmeCharge({
          config: { enabled: Boolean(tenant.pagarmeEnabled), environment: tenant.pagarmeEnvironment, publicKey: tenant.pagarmePublicKey, secretKey: tenant.pagarmeSecretKey, webhookSecret: tenant.pagarmeWebhookSecret },
          serviceOrderId: os.id,
          osNumber: os.osNumber,
          amount: amountDue,
          method: "cartao_credito",
          customer,
          card: input.card,
        });
        const mappedStatus = normalizePagarmeStatus(charge.status) as any;
        const result = await db.insert(payments).values({
          tenantId,
          serviceOrderId: os.id,
          amount: String(amountDue),
          method: "cartao_credito",
          status: mappedStatus,
          paidAt: mappedStatus === "paid" ? new Date() : null,
          gateway: "pagarme",
          gatewayPaymentId: charge.gatewayPaymentId,
          gatewayOrderId: charge.orderId,
          gatewayChargeId: charge.chargeId,
          gatewayStatus: charge.status,
          cardLast4: charge.cardLast4,
          installments: charge.installments,
          metadata: charge.raw,
          notes: "Cobrança cartão criada pelo cliente via Pagar.me",
        } as any);
        await db.update(serviceOrders).set({ paymentRequestedAt: new Date() } as any).where(and(eq(serviceOrders.id, os.id), eq(serviceOrders.tenantId, tenantId)));
        await notifyOwner({ title: `Cliente pagou por cartão a OS ${os.osNumber}`, content: `Valor: R$ ${amountDue.toFixed(2)}. Status Pagar.me: ${charge.status}.` }).catch(() => undefined);
        return { success: true, id: Number((result as any)[0]?.insertId ?? (result as any).insertId), payment: { status: mappedStatus, gatewayStatus: charge.status, amount: amountDue, cardLast4: charge.cardLast4 } };
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "Falha ao processar cartão no Pagar.me." });
      }
    }),
});
