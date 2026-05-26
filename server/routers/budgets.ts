import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getBudgetsByOs, getBudgetItems } from "../db";
import { budgets, budgetItems, serviceOrders, osStatusHistory, osNotifications } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { and, eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { triggerAutoCommunication } from "../_core/autoCommunication";
import { triggerWhatsappTransactional } from "../_core/whatsapp";
import { resolveCustomerPortalAccess } from "../_core/customerPortalAuth";
import { sendPushToTenantUsers } from "../_core/push";

const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const budgetsRouter = router({
  getByOs: tenantProcedure.input(z.object({ serviceOrderId: z.number() })).query(async ({ ctx, input }) => {
    const list = await getBudgetsByOs(ctx.user.tenantId!, input.serviceOrderId);
    const result = await Promise.all(
      list.map(async (b) => ({
        ...b,
        items: await getBudgetItems(ctx.user.tenantId!, b.id),
      }))
    );
    return result;
  }),

  create: tenantProcedure
    .input(
      z.object({
        serviceOrderId: z.number(),
        description: z.string().optional(),
        laborCost: z.number().default(0),
        validDays: z.number().default(7),
        items: z.array(
          z.object({
            description: z.string(),
            quantity: z.number().default(1),
            unitPrice: z.number(),
            type: z.enum(["service", "part"]).default("service"),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const partsCost = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      const totalCost = input.laborCost + partsCost;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + input.validDays);
      const result = await db.insert(budgets).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: input.serviceOrderId,
        description: input.description,
        laborCost: String(input.laborCost),
        partsCost: String(partsCost),
        totalCost: String(totalCost),
        validUntil,
        createdById: ctx.user.id,
      });
      const budgetId = Number((result as any)[0]?.insertId ?? (result as any).insertId);
      if (input.items.length > 0) {
        await db.insert(budgetItems).values(
          input.items.map((item) => ({
            tenantId: ctx.user.tenantId!,
            budgetId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
            totalPrice: String(item.unitPrice * item.quantity),
            type: item.type,
          }))
        );
      }
      // Atualizar status da OS para aguardando_aprovacao
      await db
        .update(serviceOrders)
        .set({ status: "aguardando_aprovacao" })
        .where(and(eq(serviceOrders.id, input.serviceOrderId), eq(serviceOrders.tenantId, ctx.user.tenantId!)));
      await db.insert(osStatusHistory).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: input.serviceOrderId,
        status: "aguardando_aprovacao",
        notes: `Orçamento enviado: R$ ${totalCost.toFixed(2)}`,
        changedById: ctx.user.id,
        changedByName: ctx.user.name ?? "Atendente",
      });
      const origin = ctx.req?.headers?.origin ?? null;
      triggerAutoCommunication({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: input.serviceOrderId,
        event: "budget_available",
        actorName: ctx.user.name ?? "Atendente",
        origin,
      }).catch((err) => console.warn("[budgets.create] Falha na comunicação automática de orçamento:", err));
      triggerWhatsappTransactional({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: input.serviceOrderId,
        event: "budget_available",
        actorName: ctx.user.name ?? "Atendente",
        origin,
      }).catch((err) => console.warn("[budgets.create] Falha no WhatsApp de orçamento:", err));
      return { id: budgetId, totalCost, success: true };
    }),

  update: tenantProcedure
    .input(
      z.object({
        budgetId: z.number().int().positive(),
        description: z.string().optional(),
        laborCost: z.number().min(0).default(0),
        validDays: z.number().int().positive().optional(),
        items: z.array(
          z.object({
            description: z.string().min(1),
            quantity: z.number().int().positive().default(1),
            unitPrice: z.number().min(0),
            type: z.enum(["service", "part"]).default("part"),
          })
        ).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [currentBudget] = await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.id, input.budgetId), eq(budgets.tenantId, ctx.user.tenantId!)))
        .limit(1);

      if (!currentBudget) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Orçamento não encontrado" });
      }

      if (currentBudget.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Somente orçamentos pendentes podem ser editados" });
      }

      const partsCost = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      const totalCost = input.laborCost + partsCost;
      const updateData: Partial<typeof budgets.$inferInsert> = {
        description: input.description,
        laborCost: totalCost > 0 ? String(input.laborCost) : "0.00",
        partsCost: String(partsCost),
        totalCost: String(totalCost),
      };

      if (typeof input.validDays === "number") {
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + input.validDays);
        updateData.validUntil = validUntil;
      }

      await db
        .update(budgets)
        .set(updateData)
        .where(and(eq(budgets.id, input.budgetId), eq(budgets.tenantId, ctx.user.tenantId!)));

      await db
        .delete(budgetItems)
        .where(and(eq(budgetItems.budgetId, input.budgetId), eq(budgetItems.tenantId, ctx.user.tenantId!)));

      const normalizedItems = input.items.filter((item) => item.description.trim().length > 0);
      if (normalizedItems.length > 0) {
        await db.insert(budgetItems).values(
          normalizedItems.map((item) => ({
            tenantId: ctx.user.tenantId!,
            budgetId: input.budgetId,
            description: item.description.trim(),
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
            totalPrice: String(item.unitPrice * item.quantity),
            type: item.type,
          }))
        );
      }

      await db.insert(osStatusHistory).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: currentBudget.serviceOrderId,
        status: "aguardando_aprovacao",
        notes: `Orçamento editado antes da aprovação: R$ ${totalCost.toFixed(2)}`,
        changedById: ctx.user.id,
        changedByName: ctx.user.name ?? "Atendente",
      });

      return { success: true, totalCost };
    }),

  // Aprovar/recusar orçamento pelo cliente autenticado no portal público — ISOLADO por tenant
  // Segurança:
  //   1. tenantId resolvido pelo middleware de host (não pode ser forjado)
  //   2. Verifica que o orçamento pertence a uma OS do cliente logado neste tenant
  //   3. Impede que cliente aprove orçamento de outro cliente ou de outro tenant
  respondMyBudget: publicProcedure
    .input(
      z.object({
        budgetId: z.number().int().positive(),
        action: z.enum(["approve", "reject"]),
        rejectionReason: z.string().max(500).optional(),
        tenantId: z.number().int().positive().optional(), // fallback para modo preview
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const access = await resolveCustomerPortalAccess(ctx, db, input.tenantId, { throwOnFailure: true });
      if (!access) throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não autenticado" });

      const { inArray } = await import("drizzle-orm");

      // 2. Busca o orçamento e verifica que pertence ao tenant
      const [budget] = await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.id, input.budgetId), eq(budgets.tenantId, access.tenantId)))
        .limit(1);

      if (!budget) throw new TRPCError({ code: "NOT_FOUND", message: "Orçamento não encontrado" });

      // 3. Verifica que a OS pertence ao cliente logado
      const [os] = await db
        .select()
        .from(serviceOrders)
        .where(and(
          eq(serviceOrders.id, budget.serviceOrderId),
          eq(serviceOrders.tenantId, access.tenantId),
          inArray(serviceOrders.customerId, access.customerIds),
        ))
        .limit(1);

      if (!os) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para responder este orçamento" });

      // 4. Verifica que o orçamento ainda está pendente
      if (budget.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este orçamento já foi respondido" });
      }

      const now = new Date();
      const clientName = access.displayName;

      // Busca nome da assistência para enriquecer a notificação
      const { tenants } = await import("../../drizzle/schema");
      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, access.tenantId))
        .limit(1);
      const tenantName = tenant?.name ?? "Assistência";

      const osRef = `OS #${os.id}${os.osNumber ? ` (${os.osNumber})` : ""}`;
      const totalFormatted = Number(budget.totalCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      if (input.action === "approve") {
        await db.update(budgets).set({ status: "approved", approvedAt: now }).where(and(eq(budgets.id, input.budgetId), eq(budgets.tenantId, access.tenantId)));
        await db.update(serviceOrders).set({ status: "aprovado" }).where(and(eq(serviceOrders.id, os.id), eq(serviceOrders.tenantId, access.tenantId)));
        await db.insert(osStatusHistory).values({
          tenantId: access.tenantId,
          serviceOrderId: os.id,
          status: "aprovado",
          notes: "Orçamento aprovado pelo cliente via portal",
          changedByName: clientName,
        });
        // Registra evento no histórico de notificações do tenant
        db.insert(osNotifications).values({
          tenantId: access.tenantId,
          serviceOrderId: os.id,
          status: "aprovado",
          channel: "portal",
          message: `Orçamento aprovado pelo cliente ${clientName} via portal. Valor: ${totalFormatted}`,
          eventType: "budget_approved",
          actorName: clientName,
        }).catch((err) => console.warn("[Notification] Erro ao registrar aprovação:", err));
        // Notifica o dono da assistência — fire-and-forget (não bloqueia resposta ao cliente)
        notifyOwner({
          title: `✅ Orçamento aprovado — ${osRef}`,
          content:
            `O cliente **${clientName}** aprovou o orçamento da ${osRef} em ${tenantName}.\n\n` +
            `**Valor aprovado:** ${totalFormatted}\n` +
            `**Data:** ${now.toLocaleString("pt-BR")}\n\n` +
            `O reparo pode ser iniciado.`,
        }).catch((err) => console.warn("[Notification] Falha ao notificar aprovação:", err));
        sendPushToTenantUsers(access.tenantId, {
          title: "Orçamento aprovado",
          body: `${clientName} aprovou ${osRef}. Valor: ${totalFormatted}.`,
          url: "/painel/os",
          tag: `budget-approved-${os.id}`,
        }).catch((err) => console.warn("[push-pwa] Falha ao enviar push de aprovação:", err));
      } else {
        await db
          .update(budgets)
          .set({ status: "rejected", rejectedAt: now, rejectionReason: input.rejectionReason })
          .where(and(eq(budgets.id, input.budgetId), eq(budgets.tenantId, access.tenantId)));
        await db.update(serviceOrders).set({ status: "recusado" }).where(and(eq(serviceOrders.id, os.id), eq(serviceOrders.tenantId, access.tenantId)));
        await db.insert(osStatusHistory).values({
          tenantId: access.tenantId,
          serviceOrderId: os.id,
          status: "recusado",
          notes: `Orçamento recusado pelo cliente via portal. Motivo: ${input.rejectionReason ?? "Não informado"}`,
          changedByName: clientName,
        });
        // Registra evento no histórico de notificações do tenant
        db.insert(osNotifications).values({
          tenantId: access.tenantId,
          serviceOrderId: os.id,
          status: "recusado",
          channel: "portal",
          message: `Orçamento recusado pelo cliente ${clientName} via portal. Motivo: ${input.rejectionReason?.trim() || "Não informado"}. Valor: ${totalFormatted}`,
          eventType: "budget_rejected",
          actorName: clientName,
        }).catch((err) => console.warn("[Notification] Erro ao registrar recusa:", err));
        // Notifica o dono da assistência — fire-and-forget (não bloqueia resposta ao cliente)
        notifyOwner({
          title: `❌ Orçamento recusado — ${osRef}`,
          content:
            `O cliente **${clientName}** recusou o orçamento da ${osRef} em ${tenantName}.\n\n` +
            `**Valor recusado:** ${totalFormatted}\n` +
            `**Motivo informado:** ${input.rejectionReason?.trim() || "Não informado"}\n` +
            `**Data:** ${now.toLocaleString("pt-BR")}\n\n` +
            `Entre em contato com o cliente para negociar.`,
        }).catch((err) => console.warn("[Notification] Falha ao notificar recusa:", err));
        sendPushToTenantUsers(access.tenantId, {
          title: "Orçamento recusado",
          body: `${clientName} recusou ${osRef}. Motivo: ${input.rejectionReason?.trim() || "não informado"}.`,
          url: "/painel/os",
          tag: `budget-rejected-${os.id}`,
        }).catch((err) => console.warn("[push-pwa] Falha ao enviar push de recusa:", err));
      }

      return { success: true, action: input.action };
    }),

  // Aprovar/recusar orçamento (via link público com token)
  respond: publicProcedure
    .input(
      z.object({
        budgetId: z.number(),
        publicToken: z.string(),
        action: z.enum(["approve", "reject"]),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const budget = await db.select().from(budgets).where(eq(budgets.id, input.budgetId)).limit(1);
      if (!budget[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (budget[0].status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este orçamento já foi respondido" });
      }
      const os = await db
        .select()
        .from(serviceOrders)
        .where(and(eq(serviceOrders.id, budget[0].serviceOrderId), eq(serviceOrders.publicToken, input.publicToken)))
        .limit(1);
      if (!os[0]) throw new TRPCError({ code: "FORBIDDEN" });
      const now = new Date();

      // Busca nome da assistência para enriquecer a notificação
      const { tenants } = await import("../../drizzle/schema");
      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, os[0].tenantId))
        .limit(1);
      const tenantName = tenant?.name ?? "Assistência";
      const osRef = `OS #${os[0].id}${os[0].osNumber ? ` (${os[0].osNumber})` : ""}`;
      const totalFormatted = Number(budget[0].totalCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      if (input.action === "approve") {
        await db.update(budgets).set({ status: "approved", approvedAt: now }).where(and(eq(budgets.id, input.budgetId), eq(budgets.tenantId, os[0].tenantId)));
        await db.update(serviceOrders).set({ status: "aprovado" }).where(and(eq(serviceOrders.id, os[0].id), eq(serviceOrders.tenantId, os[0].tenantId)));
        await db.insert(osStatusHistory).values({
          tenantId: os[0].tenantId,
          serviceOrderId: os[0].id,
          status: "aprovado",
          notes: "Orçamento aprovado pelo cliente",
          changedByName: "Cliente",
        });
        // Registra evento no histórico de notificações do tenant
        db.insert(osNotifications).values({
          tenantId: os[0].tenantId,
          serviceOrderId: os[0].id,
          status: "aprovado",
          channel: "rastreamento",
          message: `Orçamento aprovado pelo cliente via link de rastreamento. Valor: ${totalFormatted}`,
          eventType: "budget_approved",
          actorName: "Cliente (link público)",
        }).catch((err) => console.warn("[Notification] Erro ao registrar aprovação pública:", err));
        // Notifica o dono da assistência — fire-and-forget
        notifyOwner({
          title: `✅ Orçamento aprovado — ${osRef}`,
          content:
            `O cliente aprovou o orçamento da ${osRef} em ${tenantName} via link de rastreamento.\n\n` +
            `**Valor aprovado:** ${totalFormatted}\n` +
            `**Data:** ${now.toLocaleString("pt-BR")}\n\n` +
            `O reparo pode ser iniciado.`,
        }).catch((err) => console.warn("[Notification] Falha ao notificar aprovação pública:", err));
        sendPushToTenantUsers(os[0].tenantId, {
          title: "Orçamento aprovado",
          body: `${osRef} foi aprovado pelo cliente. Valor: ${totalFormatted}.`,
          url: "/painel/os",
          tag: `budget-approved-${os[0].id}`,
        }).catch((err) => console.warn("[push-pwa] Falha ao enviar push de aprovação pública:", err));
      } else {
        await db
          .update(budgets)
          .set({ status: "rejected", rejectedAt: now, rejectionReason: input.rejectionReason })
          .where(and(eq(budgets.id, input.budgetId), eq(budgets.tenantId, os[0].tenantId)));
        await db.update(serviceOrders).set({ status: "recusado" }).where(and(eq(serviceOrders.id, os[0].id), eq(serviceOrders.tenantId, os[0].tenantId)));
        await db.insert(osStatusHistory).values({
          tenantId: os[0].tenantId,
          serviceOrderId: os[0].id,
          status: "recusado",
          notes: `Orçamento recusado pelo cliente. Motivo: ${input.rejectionReason ?? "Não informado"}`,
          changedByName: "Cliente",
        });
        // Registra evento no histórico de notificações do tenant
        db.insert(osNotifications).values({
          tenantId: os[0].tenantId,
          serviceOrderId: os[0].id,
          status: "recusado",
          channel: "rastreamento",
          message: `Orçamento recusado pelo cliente via link de rastreamento. Motivo: ${input.rejectionReason?.trim() || "Não informado"}. Valor: ${totalFormatted}`,
          eventType: "budget_rejected",
          actorName: "Cliente (link público)",
        }).catch((err) => console.warn("[Notification] Erro ao registrar recusa pública:", err));
        // Notifica o dono da assistência — fire-and-forget
        notifyOwner({
          title: `❌ Orçamento recusado — ${osRef}`,
          content:
            `O cliente recusou o orçamento da ${osRef} em ${tenantName} via link de rastreamento.\n\n` +
            `**Valor recusado:** ${totalFormatted}\n` +
            `**Motivo informado:** ${input.rejectionReason?.trim() || "Não informado"}\n` +
            `**Data:** ${now.toLocaleString("pt-BR")}\n\n` +
            `Entre em contato com o cliente para negociar.`,
        }).catch((err) => console.warn("[Notification] Falha ao notificar recusa pública:", err));
        sendPushToTenantUsers(os[0].tenantId, {
          title: "Orçamento recusado",
          body: `${osRef} foi recusado pelo cliente. Motivo: ${input.rejectionReason?.trim() || "não informado"}.`,
          url: "/painel/os",
          tag: `budget-rejected-${os[0].id}`,
        }).catch((err) => console.warn("[push-pwa] Falha ao enviar push de recusa pública:", err));
      }
      return { success: true };
    }),
});
