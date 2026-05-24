import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getPickupsByDeliverer, getPendingPickups } from "../db";
import { pickups, serviceOrders, osStatusHistory } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { storagePut } from "../storage";
import { notifyTenantStatusChange } from "../_core/statusNotification";
import { resolveCustomerPortalAccess } from "../_core/customerPortalAuth";

const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const pickupsRouter = router({
  // Listar coletas/entregas pendentes do tenant
  pending: tenantProcedure.query(async ({ ctx }) => {
    return getPendingPickups(ctx.user.tenantId!);
  }),

  // Listar coletas/entregas do entregador logado (painel interno)
  myPickupsDeliverer: tenantProcedure.query(async ({ ctx }) => {
    return getPickupsByDeliverer(ctx.user.tenantId!, ctx.user.id);
  }),

  // Coletas do cliente logado no portal público — ISOLADO por tenant
  // Aceita cliente OAuth/Manus e cliente com login local (`customer_session`).
  myPickupsCustomer: publicProcedure
    .input(z.object({
      tenantId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const access = await resolveCustomerPortalAccess(ctx, db, input.tenantId);
      if (!access) return [];

      const { inArray } = await import("drizzle-orm");

      const customerOrders = await db
        .select({ id: serviceOrders.id })
        .from(serviceOrders)
        .where(and(
          eq(serviceOrders.tenantId, access.tenantId),
          inArray(serviceOrders.customerId, access.customerIds),
        ));

      if (customerOrders.length === 0) return [];
      const orderIds = customerOrders.map((o) => o.id);

      return db
        .select()
        .from(pickups)
        .where(and(
          eq(pickups.tenantId, access.tenantId),
          inArray(pickups.serviceOrderId, orderIds),
        ))
        .orderBy(pickups.createdAt);
    }),

  // Criar coleta/entrega
  create: tenantProcedure
    .input(
      z.object({
        serviceOrderId: z.number(),
        type: z.enum(["coleta", "entrega"]),
        address: z.string().min(5),
        delivererId: z.number().optional(),
        scheduledAt: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(pickups).values({
        ...input,
        tenantId: ctx.user.tenantId!,
        status: input.delivererId ? "assigned" : "pending",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      });
      // Atualizar status da OS
      const newStatus = input.type === "coleta" ? "coleta_agendada" : "aguardando_entrega";
      await db
        .update(serviceOrders)
        .set({ status: newStatus })
        .where(and(eq(serviceOrders.id, input.serviceOrderId), eq(serviceOrders.tenantId, ctx.user.tenantId!)));
      await db.insert(osStatusHistory).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: input.serviceOrderId,
        status: newStatus,
        notes: `${input.type === "coleta" ? "Coleta" : "Entrega"} agendada`,
        changedById: ctx.user.id,
        changedByName: ctx.user.name ?? "Atendente",
      });
      // Notifica o dono do tenant sobre agendamento — fire-and-forget
      try {
        const { tenants: tenantsTable } = await import("../../drizzle/schema");
        const [tenantRow] = await db.select({ name: tenantsTable.name }).from(tenantsTable).where(eq(tenantsTable.id, ctx.user.tenantId!)).limit(1);
        if (tenantRow) {
          notifyTenantStatusChange({
            osRef: `OS #${input.serviceOrderId}`,
            tenantName: tenantRow.name,
            status: newStatus,
            changedByName: ctx.user.name ?? "Atendente",
            tenantId: ctx.user.tenantId!,
            serviceOrderId: input.serviceOrderId,
          });
        }
      } catch (err) {
        console.warn("[pickups.create] Erro ao notificar tenant:", err);
      }
      return { id: Number((result as any)[0]?.insertId ?? (result as any).insertId), success: true };
    }),

  // Confirmar coleta/entrega com foto e assinatura
  complete: tenantProcedure
    .input(
      z.object({
        pickupId: z.number(),
        photoBase64: z.string(),
        signatureBase64: z.string(),
        recipientName: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const pickup = await db
        .select()
        .from(pickups)
        .where(and(eq(pickups.id, input.pickupId), eq(pickups.tenantId, ctx.user.tenantId!)))
        .limit(1);
      if (!pickup[0]) throw new TRPCError({ code: "NOT_FOUND" });
      // Upload foto
      const photoBuffer = Buffer.from(input.photoBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
      const photoKey = `pickups/${ctx.user.tenantId}/${input.pickupId}/photo_${nanoid()}.jpg`;
      const { url: photoUrl, key: photoFileKey } = await storagePut(photoKey, photoBuffer, "image/jpeg");
      // Upload assinatura
      const sigBuffer = Buffer.from(input.signatureBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
      const sigKey = `pickups/${ctx.user.tenantId}/${input.pickupId}/sig_${nanoid()}.png`;
      const { url: signatureUrl, key: signatureFileKey } = await storagePut(sigKey, sigBuffer, "image/png");
      await db
        .update(pickups)
        .set({
          status: "completed",
          completedAt: new Date(),
          photoUrl,
          photoKey: photoFileKey,
          signatureUrl,
          signatureKey: signatureFileKey,
          recipientName: input.recipientName,
          notes: input.notes,
        })
        .where(eq(pickups.id, input.pickupId));
      // Atualizar status da OS
      const newStatus = pickup[0].type === "coleta" ? "coletado" : "entregue";
      await db
        .update(serviceOrders)
        .set({ status: newStatus })
        .where(and(eq(serviceOrders.id, pickup[0].serviceOrderId), eq(serviceOrders.tenantId, ctx.user.tenantId!)));
      await db.insert(osStatusHistory).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: pickup[0].serviceOrderId,
        status: newStatus,
        notes: `${pickup[0].type === "coleta" ? "Aparelho coletado" : "Aparelho entregue"}. Recebido por: ${input.recipientName ?? "N/A"}`,
        changedById: ctx.user.id,
        changedByName: ctx.user.name ?? "Entregador",
      });
      // Notifica o dono do tenant sobre confirmação de coleta/entrega — fire-and-forget
      try {
        const { tenants: tenantsTable } = await import("../../drizzle/schema");
        const [tenantRow] = await db.select({ name: tenantsTable.name }).from(tenantsTable).where(eq(tenantsTable.id, ctx.user.tenantId!)).limit(1);
        if (tenantRow) {
          notifyTenantStatusChange({
            osRef: `OS #${pickup[0].serviceOrderId}`,
            tenantName: tenantRow.name,
            status: newStatus,
            changedByName: ctx.user.name ?? "Entregador",
            notes: input.recipientName ? `Recebido por: ${input.recipientName}` : undefined,
            tenantId: ctx.user.tenantId!,
            serviceOrderId: pickup[0].serviceOrderId,
          });
        }
      } catch (err) {
        console.warn("[pickups.complete] Erro ao notificar tenant:", err);
      }
      return { success: true };
    }),

  // Atribuir entregador
  assign: tenantProcedure
    .input(z.object({ pickupId: z.number(), delivererId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(pickups)
        .set({ delivererId: input.delivererId, status: "assigned" })
        .where(and(eq(pickups.id, input.pickupId), eq(pickups.tenantId, ctx.user.tenantId!)));
      return { success: true };
    }),
});
