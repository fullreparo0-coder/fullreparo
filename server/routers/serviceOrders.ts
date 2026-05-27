import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getServiceOrdersByTenant, getServiceOrderById, getOsTimeline, generateOsNumber, getPhotosByOs, getChecklistByOs, countOsThisMonth, getFinancialReport } from "../db";
import { serviceOrders, osStatusHistory, osChecklist, photos, devices, payments, customers, osNotifications, users, budgets } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { storagePut } from "../storage";
import { notifyOwner } from "../_core/notification";
import { prepareStatusNotification, notifyTenantStatusChange } from "../_core/statusNotification";
import { autoCommunicationEventForStatus, triggerAutoCommunication } from "../_core/autoCommunication";
import { triggerWhatsappTransactional } from "../_core/whatsapp";
import { getTenantPortalUrl } from "../../shared/tenantUrl";
import { sendTenantEmail, buildNewOsEmailHtml } from "../email";
import { resolveCustomerPortalAccess } from "../_core/customerPortalAuth";
import { assertTenantOperational, getTenantSubscriptionSnapshot } from "../_core/subscription";
import { sendPushToCustomers, sendPushToTenantUsers } from "../_core/push";

const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});



type SmartActionContext = {
  id?: number;
  status?: string | null;
  estimatedDelivery?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  totalAmount?: string | number | null;
  paymentRequestedAt?: Date | string | null;
  deliveryAuthorizedAt?: Date | string | null;
};

const FINAL_STATUSES = new Set(["finalizado", "encerrado_sem_reparo", "encerrado_condenado", "cancelado", "entregue"]);
const HIGH_TOUCH_STATUSES = new Set(["aguardando_aprovacao", "pronto", "aguardando_entrega", "aguardando_peca"]);
const CUSTOMER_PUSH_STATUSES = new Set([
  "aguardando_aprovacao",
  "coleta_agendada",
  "coletado",
  "pronto",
  "aguardando_entrega",
  "saiu_para_entrega",
  "entregue",
  "finalizado",
  "encerrado_sem_reparo",
  "encerrado_condenado",
]);

const SLA_LIMIT_HOURS: Record<string, number> = {
  solicitado: 4,
  aguardando_coleta: 8,
  coleta_agendada: 24,
  coletado: 8,
  recebido_na_assistencia: 24,
  em_diagnostico: 48,
  aguardando_aprovacao: 24,
  aprovado: 12,
  aguardando_peca: 72,
  em_reparo: 48,
  pronto: 24,
  aguardando_entrega: 24,
  saiu_para_entrega: 8,
};

function toDateOrNull(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hoursBetween(start: Date | null, end: Date) {
  if (!start) return 0;
  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / 36_000) ) / 100);
}

function buildSlaSnapshot(order: SmartActionContext, now = new Date()) {
  const status = String(order.status ?? "");
  const baseDate = toDateOrNull(order.updatedAt) ?? toDateOrNull(order.createdAt);
  const estimatedDelivery = toDateOrNull(order.estimatedDelivery);
  const hoursInStage = hoursBetween(baseDate, now);
  const limitHours = SLA_LIMIT_HOURS[status] ?? 48;
  const isFinal = FINAL_STATUSES.has(status);
  const isOverdue = !!estimatedDelivery && estimatedDelivery < now && !isFinal;
  const isStageStalled = !isFinal && hoursInStage >= limitHours;
  const remainingHours = isFinal ? null : Math.max(0, Math.round((limitHours - hoursInStage) * 100) / 100);

  return {
    status,
    statusAgeHours: hoursInStage,
    limitHours,
    remainingHours,
    isOverdue,
    isStageStalled,
    dueAt: estimatedDelivery ? estimatedDelivery.toISOString() : null,
    label: isFinal
      ? "Concluída"
      : isOverdue
        ? "Prazo vencido"
        : isStageStalled
          ? "Etapa parada"
          : "Dentro do SLA",
  };
}

function buildNextBestAction(order: SmartActionContext, audience: "tenant" | "customer" = "tenant", now = new Date()) {
  const status = String(order.status ?? "");
  const sla = buildSlaSnapshot(order, now);
  const totalAmount = Number(order.totalAmount ?? 0);
  const hasDeliveryAuthorization = !!order.deliveryAuthorizedAt;
  const isFinal = FINAL_STATUSES.has(status);

  if (isFinal) {
    return {
      code: "completed",
      priority: "baixa",
      title: audience === "customer" ? "Serviço concluído" : "OS concluída",
      description: audience === "customer" ? "Consulte a garantia, documentos e histórico desta ordem." : "Revise garantia, pagamento e documentação se necessário.",
      ctaLabel: audience === "customer" ? "Ver documentos" : "Revisar OS",
    };
  }

  if (sla.isOverdue) {
    return {
      code: "overdue_followup",
      priority: "alta",
      title: audience === "customer" ? "Prazo em revisão" : "Revisar prazo e avisar cliente",
      description: audience === "customer" ? "A assistência precisa atualizar a previsão desta ordem." : "A OS passou do prazo estimado. Atualize a previsão e registre uma comunicação.",
      ctaLabel: audience === "customer" ? "Falar com assistência" : "Atualizar prazo",
    };
  }

  if (status === "aguardando_aprovacao") {
    return {
      code: "budget_waiting",
      priority: "alta",
      title: audience === "customer" ? "Orçamento aguardando sua aprovação" : "Cobrar aprovação do orçamento",
      description: audience === "customer" ? "Revise valores, itens e autorize ou recuse o orçamento." : "Cliente ainda não respondeu ao orçamento. Envie lembrete ou faça contato ativo.",
      ctaLabel: audience === "customer" ? "Ver orçamento" : "Enviar lembrete",
    };
  }

  if (status === "pronto" || status === "aguardando_entrega") {
    return {
      code: "ready_for_delivery",
      priority: totalAmount > 0 && !hasDeliveryAuthorization ? "alta" : "media",
      title: audience === "customer" ? "Seu equipamento está pronto" : "Combinar retirada, entrega ou pagamento",
      description: audience === "customer" ? "Autorize a entrega, combine retirada e veja opções de pagamento quando liberadas." : "A OS está pronta. Confirme retirada/entrega, autorização e pendências financeiras.",
      ctaLabel: audience === "customer" ? "Autorizar entrega" : "Finalizar entrega",
    };
  }

  if (status === "aguardando_peca") {
    return {
      code: "parts_waiting",
      priority: "media",
      title: audience === "customer" ? "Aguardando peça" : "Atualizar previsão da peça",
      description: audience === "customer" ? "A assistência acompanha a chegada da peça necessária para o reparo." : "Registre previsão da peça e comunique o cliente para reduzir ansiedade.",
      ctaLabel: audience === "customer" ? "Ver andamento" : "Atualizar previsão",
    };
  }

  if (sla.isStageStalled || HIGH_TOUCH_STATUSES.has(status)) {
    return {
      code: "stage_followup",
      priority: "media",
      title: audience === "customer" ? "Acompanhamento em andamento" : "Atualizar etapa e comunicar cliente",
      description: audience === "customer" ? "A próxima atualização aparecerá no histórico desta OS." : "A etapa atual já merece atualização operacional ou comunicação preventiva.",
      ctaLabel: audience === "customer" ? "Ver histórico" : "Registrar atualização",
    };
  }

  return {
    code: "monitor",
    priority: "normal",
    title: audience === "customer" ? "Serviço em andamento" : "Acompanhar andamento",
    description: audience === "customer" ? "Acompanhe a linha do tempo e as comunicações da assistência." : "Continue acompanhando a OS e mantenha o cliente informado em mudanças relevantes.",
    ctaLabel: audience === "customer" ? "Ver detalhes" : "Abrir OS",
  };
}

const OS_STATUSES = [
  "solicitado", "aguardando_coleta", "coleta_agendada", "coletado",
  "recebido_na_assistencia", "em_diagnostico", "aguardando_aprovacao",
  "aprovado", "recusado", "aguardando_peca", "em_reparo", "pronto",
  "aguardando_entrega", "saiu_para_entrega", "entregue", "finalizado", "encerrado_sem_reparo", "encerrado_condenado", "cancelado",
] as const;

export const serviceOrdersRouter = router({
  // Listar OS do tenant com paginação server-side
  list: tenantProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      dateFrom: z.number().optional(), // timestamp UTC ms
      dateTo: z.number().optional(),   // timestamp UTC ms
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return getServiceOrdersByTenant(
        ctx.user.tenantId!,
        input?.search,
        input?.status,
        input?.page ?? 1,
        input?.pageSize ?? 20,
        input?.dateFrom ? new Date(input.dateFrom) : undefined,
        input?.dateTo ? new Date(input.dateTo) : undefined,
      );
    }),

  // Obter OS por ID
  getById: tenantProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const os = await getServiceOrderById(ctx.user.tenantId!, input.id);
    if (!os) throw new TRPCError({ code: "NOT_FOUND" });
    const [timeline, checklistItems, photoList] = await Promise.all([
      getOsTimeline(ctx.user.tenantId!, input.id),
      getChecklistByOs(ctx.user.tenantId!, input.id),
      getPhotosByOs(ctx.user.tenantId!, input.id),
    ]);
    return {
      ...os,
      timeline,
      checklist: checklistItems,
      photos: photoList,
      sla: buildSlaSnapshot(os as SmartActionContext),
      nextBestAction: buildNextBestAction(os as SmartActionContext, "tenant"),
    };
  }),

  // Consultar uso de OS do mês atual vs limite do plano
  usageStats: tenantProcedure.query(async ({ ctx }) => {
    const [plan, used] = await Promise.all([
      getTenantSubscriptionSnapshot(ctx.user.tenantId!),
      countOsThisMonth(ctx.user.tenantId!),
    ]);
    assertTenantOperational(plan);
    const limit = plan?.maxOsPerMonth ?? null;
    return {
      used,
      limit,
      planName: plan?.planName ?? "Desconhecido",
      isUnlimited: limit === null || limit <= 0,
      isAtLimit: limit !== null && limit > 0 && used >= limit,
      isNearLimit: limit !== null && limit > 0 && used >= Math.floor(limit * 0.8) && used < limit,
      percentUsed: limit !== null && limit > 0 ? Math.round((used / limit) * 100) : 0,
    };
  }),

  // Abrir OS no balcão
  createBalcao: tenantProcedure
    .input(
      z.object({
        customerId: z.number(),
        deviceId: z.number().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        imei: z.string().optional(),
        serialNumber: z.string().optional(),
        deviceType: z.string().optional(),
        reportedDefect: z.string().min(3),
        physicalCondition: z.string().optional(),
        accessories: z.string().optional(),
        devicePassword: z.string().optional(),
        internalNotes: z.string().optional(),
        technicianId: z.number().optional(),
        estimatedDelivery: z.string().optional(),
        warrantyDays: z.number().default(90),
        initialBudgetValue: z.number().min(0).optional(),
        checklist: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verifica limite de OS por plano
      const [plan, used] = await Promise.all([
        getTenantSubscriptionSnapshot(ctx.user.tenantId!),
        countOsThisMonth(ctx.user.tenantId!),
      ]);
      assertTenantOperational(plan);
      if (plan && plan.maxOsPerMonth > 0 && used >= plan.maxOsPerMonth) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite do plano ${plan.planName} atingido: ${used}/${plan.maxOsPerMonth} OS este mês. Faça upgrade para continuar.`,
        });
      }
      const osNumber = await generateOsNumber(ctx.user.tenantId!);
      const publicToken = nanoid(32);
      const { checklist, brand, model, imei, serialNumber, deviceType, deviceId, initialBudgetValue, ...osData } = input;
      const hasInitialBudget = typeof initialBudgetValue === "number" && initialBudgetValue > 0;
      const initialBudgetAmount = hasInitialBudget ? initialBudgetValue.toFixed(2) : null;
      const initialStatus = hasInitialBudget ? "aguardando_aprovacao" : "recebido_na_assistencia";

      let resolvedDeviceId = deviceId ?? null;
      if (resolvedDeviceId) {
        const [existingDevice] = await db
          .select({ id: devices.id })
          .from(devices)
          .where(and(
            eq(devices.id, resolvedDeviceId),
            eq(devices.tenantId, ctx.user.tenantId!),
            eq(devices.customerId, input.customerId)
          ))
          .limit(1);
        if (!existingDevice) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Aparelho selecionado não encontrado para este cliente." });
        }
      } else {
        const deviceBrand = brand?.trim();
        const deviceModel = model?.trim();
        const normalizedType = deviceType?.trim() || "Smartphone";
        const normalizedImei = imei?.trim() || undefined;
        const normalizedSerialNumber = serialNumber?.trim() || undefined;

        if (deviceBrand || deviceModel || normalizedImei || normalizedSerialNumber) {
          const deviceResult = await db.insert(devices).values({
            tenantId: ctx.user.tenantId!,
            customerId: input.customerId,
            brand: deviceBrand || normalizedType,
            model: deviceModel || "Não informado",
            type: normalizedType,
            imei: normalizedImei,
            serialNumber: normalizedSerialNumber,
          });
          resolvedDeviceId = Number((deviceResult as any)[0]?.insertId ?? (deviceResult as any).insertId);
        }
      }

      const result = await db.insert(serviceOrders).values({
        ...osData,
        deviceId: resolvedDeviceId ?? undefined,
        tenantId: ctx.user.tenantId!,
        osNumber,
        publicToken,
        origin: "balcao",
        status: initialStatus,
        attendantId: ctx.user.id,
        estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : undefined,
      });
      const osId = Number((result as any)[0]?.insertId ?? (result as any).insertId);
      // Registrar na timeline
      await db.insert(osStatusHistory).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: osId,
        status: initialStatus,
        notes: hasInitialBudget && initialBudgetAmount
          ? `OS aberta no balcão com orçamento inicial: R$ ${initialBudgetAmount.replace(".", ",")}`
          : "OS aberta no balcão",
        changedById: ctx.user.id,
        changedByName: ctx.user.name ?? "Atendente",
      });
      if (hasInitialBudget && initialBudgetAmount) {
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 7);
        await db.insert(budgets).values({
          tenantId: ctx.user.tenantId!,
          serviceOrderId: osId,
          description: "Orçamento informado na abertura da OS no balcão.",
          laborCost: initialBudgetAmount,
          partsCost: "0.00",
          totalCost: initialBudgetAmount,
          status: "pending",
          validUntil,
          createdById: ctx.user.id,
        });

        await db.insert(osStatusHistory).values({
          tenantId: ctx.user.tenantId!,
          serviceOrderId: osId,
          status: "aguardando_aprovacao",
          notes: `Orçamento inicial enviado para aprovação: R$ ${initialBudgetAmount.replace(".", ",")}`,
          changedById: ctx.user.id,
          changedByName: ctx.user.name ?? "Atendente",
        });
      }

      // Salvar checklist
      if (checklist && checklist.length > 0) {
        await db.insert(osChecklist).values(
          checklist.map((item) => ({
            tenantId: ctx.user.tenantId!,
            serviceOrderId: osId,
            item,
            checked: true,
          }))
        );
      }
      triggerAutoCommunication({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: osId,
        event: "os_opened",
        actorName: ctx.user.name ?? "Atendente",
        origin: ctx.req?.headers?.origin ?? null,
      }).catch((err) => console.warn("[createBalcao] Falha na comunicação automática da OS aberta:", err));

      if (hasInitialBudget) {
        triggerAutoCommunication({
          tenantId: ctx.user.tenantId!,
          serviceOrderId: osId,
          event: "budget_available",
          actorName: ctx.user.name ?? "Atendente",
          origin: ctx.req?.headers?.origin ?? null,
        }).catch((err) => console.warn("[createBalcao] Falha na comunicação automática do orçamento inicial:", err));
      }

      // Vinculação automática: se o customer não tem userOpenId ainda,
      // tenta encontrar um user cadastrado com o mesmo e-mail e vincula.
      // Isso permite que o cliente acompanhe a OS no portal sem nenhuma ação manual.
      try {
        const { customers: customersTable, users: usersTable } = await import("../../drizzle/schema");
        const [customer] = await db
          .select({ id: customersTable.id, email: customersTable.email, userOpenId: customersTable.userOpenId })
          .from(customersTable)
          .where(and(eq(customersTable.id, input.customerId), eq(customersTable.tenantId, ctx.user.tenantId!)))
          .limit(1);

        if (customer && !customer.userOpenId && customer.email) {
          // Procura user com o mesmo e-mail
          const [matchedUser] = await db
            .select({ openId: usersTable.openId })
            .from(usersTable)
            .where(eq(usersTable.email, customer.email))
            .limit(1);

          if (matchedUser) {
            await db
              .update(customersTable)
              .set({ userOpenId: matchedUser.openId })
              .where(and(
                eq(customersTable.id, customer.id),
                eq(customersTable.tenantId, ctx.user.tenantId!)
              ));
          }
        }
      } catch {
        // Vinculação automática é best-effort: falha não bloqueia a criação da OS
      }

      return { id: osId, osNumber, publicToken, success: true };
    }),

  // Criar OS por solicitação de coleta (público)
  createColeta: publicProcedure
    .input(
      z.object({
        tenantId: z.number(),
        customerName: z.string().min(2),
        customerPhone: z.string().min(8),
        customerEmail: z.string().email().optional().or(z.literal("")),
        deviceType: z.string().min(1),
        brand: z.string().optional(),
        model: z.string().optional(),
        reportedDefect: z.string().min(3),
        pickupAddress: z.string().min(5),
        preferredPickupTime: z.string().optional(),
        notes: z.string().optional(),
        photoBase64s: z.array(z.string()).max(2).optional(),
        pickupLatitude: z.number().min(-90).max(90).optional(),
        pickupLongitude: z.number().min(-180).max(180).optional(),
        pickupLocationAccuracy: z.number().int().min(0).optional(),
        termsAccepted: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verifica limite de OS por plano (mesmo para portal público)
      const [plan, used] = await Promise.all([
        getTenantSubscriptionSnapshot(input.tenantId),
        countOsThisMonth(input.tenantId),
      ]);
      assertTenantOperational(plan, true);
      if (plan && plan.maxOsPerMonth > 0 && used >= plan.maxOsPerMonth) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Esta assistência atingiu o limite de OS do plano ${plan.planName} este mês. Entre em contato diretamente com a assistência.`,
        });
      }
      // Criar ou encontrar cliente com dados normalizados para evitar duplicidade por máscara
      const { customers: customersTable } = await import("../../drizzle/schema");
      const normalizedPhone = input.customerPhone.replace(/\D/g, "");
      const normalizedEmail = input.customerEmail?.trim().toLowerCase() || undefined;
      const existingCustomer = await db
        .select()
        .from(customersTable)
        .where(and(eq(customersTable.tenantId, input.tenantId), eq(customersTable.phone, normalizedPhone)))
        .limit(1);
      let customerId: number;
      if (existingCustomer.length > 0) {
        customerId = existingCustomer[0].id;
      } else {
        const custResult = await db.insert(customersTable).values({
          tenantId: input.tenantId,
          name: input.customerName.trim(),
          phone: normalizedPhone,
          email: normalizedEmail,
        });
        customerId = Number((custResult as any)[0]?.insertId ?? (custResult as any).insertId);
      }

      // Salvar o aparelho informado na coleta para que a OS chegue completa ao painel
      const deviceBrand = input.brand?.trim() || input.deviceType.trim();
      const deviceModel = input.model?.trim() || "Não informado";
      const deviceResult = await db.insert(devices).values({
        tenantId: input.tenantId,
        customerId,
        brand: deviceBrand,
        model: deviceModel,
        type: input.deviceType.trim(),
      });
      const deviceId = Number((deviceResult as any)[0]?.insertId ?? (deviceResult as any).insertId);

      const osNumber = await generateOsNumber(input.tenantId);
      const publicToken = nanoid(32);
      const now = new Date();
      // Tentar extrair IP do cliente (pode ser undefined em ambiente de desenvolvimento)
      const clientIp = (ctx as any)?.req?.headers?.["x-forwarded-for"]?.toString()?.split(",")?.[0]?.trim()
        ?? (ctx as any)?.req?.socket?.remoteAddress
        ?? null;
      const result = await db.insert(serviceOrders).values({
        tenantId: input.tenantId,
        osNumber,
        customerId,
        deviceId,
        origin: "coleta",
        status: "aguardando_coleta",
        reportedDefect: input.reportedDefect,
        pickupAddress: input.pickupAddress,
        preferredPickupTime: input.preferredPickupTime,
        pickupLatitude: input.pickupLatitude !== undefined ? input.pickupLatitude.toFixed(7) : undefined,
        pickupLongitude: input.pickupLongitude !== undefined ? input.pickupLongitude.toFixed(7) : undefined,
        pickupLocationAccuracy: input.pickupLocationAccuracy,
        internalNotes: input.notes,
        publicToken,
        termsAcceptedAt: input.termsAccepted ? now : undefined,
        termsAcceptedIp: input.termsAccepted && clientIp ? clientIp : undefined,
      });
      const osId = Number((result as any)[0]?.insertId ?? (result as any).insertId);
      await db.insert(osStatusHistory).values({
        tenantId: input.tenantId,
        serviceOrderId: osId,
        status: "aguardando_coleta",
        notes: input.pickupLatitude !== undefined && input.pickupLongitude !== undefined
          ? "Solicitação de coleta recebida pelo portal do cliente com localização compartilhada"
          : "Solicitação de coleta recebida pelo portal do cliente",
        changedByName: input.customerName,
      });

      // Persistir até duas fotos enviadas pelo cliente, sempre vinculadas ao tenant e à OS criada.
      if (input.photoBase64s?.length) {
        const validPhotos = input.photoBase64s.slice(0, 2).filter((value) => value.startsWith("data:image/"));
        for (let index = 0; index < validPhotos.length; index += 1) {
          const photoBase64 = validPhotos[index];
          const match = photoBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (!match) continue;
          const contentType = match[1];
          const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
          const buffer = Buffer.from(match[2], "base64");
          if (buffer.length > 8 * 1024 * 1024) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Cada foto deve ter no máximo 8MB." });
          }
          const uploaded = await storagePut(
            `tenants/${input.tenantId}/service-orders/${osId}/coleta-foto-${index + 1}.${extension}`,
            buffer,
            contentType,
          );
          await db.insert(photos).values({
            tenantId: input.tenantId,
            serviceOrderId: osId,
            url: uploaded.url,
            fileKey: uploaded.key,
            type: "coleta",
            caption: `Foto ${index + 1} enviada pelo cliente na solicitação de coleta`,
          });
        }
      }
      triggerAutoCommunication({
        tenantId: input.tenantId,
        serviceOrderId: osId,
        event: "os_opened",
        actorName: input.customerName,
        origin: ctx.req?.headers?.origin ?? null,
      }).catch((err) => console.warn("[createColeta] Falha na comunicação automática da OS aberta:", err));

      // Notificar o tenant sobre nova solicitação de coleta (fire-and-forget)
      const tenantInfo = await db
        .select({
          name: (await import("../../drizzle/schema")).tenants.name,
          slug: (await import("../../drizzle/schema")).tenants.slug,
          customDomain: (await import("../../drizzle/schema")).tenants.customDomain,
          notificationEmail: (await import("../../drizzle/schema")).tenants.notificationEmail,
        })
        .from((await import("../../drizzle/schema")).tenants)
        .where(eq((await import("../../drizzle/schema")).tenants.id, input.tenantId))
        .limit(1)
        .then(r => r[0]);
      const panelUrl = tenantInfo
        ? `${getTenantPortalUrl(tenantInfo.slug, tenantInfo.customDomain ?? null)}/painel/os/${osId}`
        : `https://fullreparo.com.br/painel/os/${osId}`;
      // 1. Notificação interna (painel Manus)
      notifyOwner({
        title: `Nova coleta: ${osNumber} — ${tenantInfo?.name ?? "Assistência"}`,
        content: [
          `**OS:** ${osNumber}`,
          `**Cliente:** ${input.customerName} | ${normalizedPhone}`,
          `**Aparelho:** ${[deviceBrand, deviceModel, input.deviceType].filter(Boolean).join(" ")}`,
          `**Defeito:** ${input.reportedDefect}`,
          `**Endereço de coleta:** ${input.pickupAddress}`,
          input.preferredPickupTime ? `**Horário preferido:** ${input.preferredPickupTime}` : "",
          input.notes ? `**Observações:** ${input.notes}` : "",
          input.pickupLatitude !== undefined && input.pickupLongitude !== undefined
            ? `**Localização compartilhada:** https://www.google.com/maps?q=${input.pickupLatitude},${input.pickupLongitude}`
            : "",
          input.photoBase64s?.length ? `**Fotos enviadas:** ${Math.min(input.photoBase64s.length, 2)}` : "",
        ].filter(Boolean).join("\n"),
      }).catch(() => { /* notificação não bloqueia a OS */ });
      // 2. E-mail ao tenant (se notificationEmail estiver configurado)
      if (tenantInfo?.notificationEmail) {
        const emailHtml = buildNewOsEmailHtml({
          tenantName: tenantInfo.name ?? "Assistência",
          osNumber,
          customerName: input.customerName,
          customerPhone: normalizedPhone,
          deviceBrand,
          deviceModel,
          defect: input.reportedDefect,
          origin: "coleta",
          createdAt: now,
          panelUrl,
        });
        sendTenantEmail({
          to: tenantInfo.notificationEmail,
          subject: `[FullReparo] Nova OS ${osNumber} — ${input.customerName}`,
          html: emailHtml,
          text: `Nova OS ${osNumber} recebida pelo portal público.\nCliente: ${input.customerName} | ${normalizedPhone}\nAparelho: ${[deviceBrand, deviceModel, input.deviceType].filter(Boolean).join(" ")}\nDefeito: ${input.reportedDefect}\nVer no painel: ${panelUrl}`,
        }).catch(() => { /* e-mail não bloqueia a OS */ });
      }
      sendPushToTenantUsers(input.tenantId, {
        title: "Nova solicitação de coleta",
        body: `${input.customerName} solicitou coleta para ${[deviceBrand, deviceModel].filter(Boolean).join(" ")}.`,
        url: "/painel/os",
        tag: `pickup-request-${osId}`,
      }).catch((err) => console.warn("[push-pwa] Falha ao enviar push de nova coleta:", err));
      return { id: osId, osNumber, publicToken, success: true };
    }),

  // Atualizar status da OS
  updateStatus: tenantProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(OS_STATUSES),
        notes: z.string().optional(),
        /** Dias de garantia a aplicar quando o encerramento for Feito (status=finalizado). Sobrescreve o valor da OS. */
        warrantyDays: z.number().int().min(0).max(3650).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const os = await getServiceOrderById(ctx.user.tenantId!, input.id);
      if (!os) throw new TRPCError({ code: "NOT_FOUND" });

      // Se for encerramento e warrantyDays foi informado, atualiza o campo na OS
      const updatePayload: Record<string, unknown> = { status: input.status };
      if (input.status === "finalizado" && input.warrantyDays !== undefined) {
        updatePayload.warrantyDays = input.warrantyDays;
      }

      await db
        .update(serviceOrders)
        .set(updatePayload as any)
        .where(and(eq(serviceOrders.id, input.id), eq(serviceOrders.tenantId, ctx.user.tenantId!)));
      await db.insert(osStatusHistory).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: input.id,
        status: input.status,
        notes: input.notes,
        changedById: ctx.user.id,
        changedByName: ctx.user.name ?? "Usuário",
      });
      const autoEvent = os.status !== input.status ? autoCommunicationEventForStatus(input.status) : null;
      const origin = ctx.req?.headers?.origin ?? null;
      if (autoEvent) {
        triggerAutoCommunication({
          tenantId: ctx.user.tenantId!,
          serviceOrderId: input.id,
          event: autoEvent,
          actorName: ctx.user.name ?? "Atendente",
          origin,
        }).catch((err) => console.warn(`[updateStatus] Falha na comunicação automática ${autoEvent}:`, err));
      }
      if (os.status !== input.status && input.status === "pronto") {
        triggerWhatsappTransactional({
          tenantId: ctx.user.tenantId!,
          serviceOrderId: input.id,
          event: "service_order_ready",
          actorName: ctx.user.name ?? "Atendente",
          origin,
        }).catch((err) => console.warn("[updateStatus] Falha no WhatsApp de OS pronta:", err));
      }

      // Preparar notificação ao cliente (WhatsApp)
      let whatsappNotification: { message: string; whatsappLink: string } | null = null;
      try {
        const { tenants: tenantsTable, customers: customersTable } = await import("../../drizzle/schema");
        const [tenantRow] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, ctx.user.tenantId!)).limit(1);
        const [customerRow] = await db.select().from(customersTable).where(eq(customersTable.id, os.customerId)).limit(1);
        if (tenantRow && customerRow) {
          const notifyStatuses: string[] | null = tenantRow.notifyStatuses
            ? JSON.parse(tenantRow.notifyStatuses)
            : null;
          const notifyMessages: Record<string, string> | null = tenantRow.notifyMessages
            ? JSON.parse(tenantRow.notifyMessages)
            : null;
          const origin = (ctx.req?.headers?.origin ?? ctx.req?.headers?.referer) as string | undefined;
          // Usa o utilitário central: prioridade origin > subdomínio do tenant > fallback
          const trackingBaseUrl = origin ?? getTenantPortalUrl(tenantRow.slug, tenantRow.customDomain ?? null);
          whatsappNotification = await prepareStatusNotification({
            tenantId: ctx.user.tenantId!,
            serviceOrderId: input.id,
            notifyStatuses,
            notifyMessages,
            ctx: {
              osNumber: os.osNumber,
              customerName: customerRow.name,
              customerPhone: customerRow.phone ?? null,
              tenantName: tenantRow.name,
              tenantWhatsapp: tenantRow.whatsappNumber ?? null,
              publicToken: os.publicToken ?? null,
              trackingBaseUrl,
              status: input.status,
              notes: input.notes,
            },
          });
          if (os.status !== input.status && CUSTOMER_PUSH_STATUSES.has(input.status)) {
            const trackingUrl = os.publicToken ? `${trackingBaseUrl.replace(/\/$/, "")}/rastrear/${os.publicToken}` : "/minha-conta";
            sendPushToCustomers(ctx.user.tenantId!, [customerRow.id], {
              title: `Atualização da OS ${os.osNumber ?? `#${input.id}`}`,
              body: input.notes?.trim() || whatsappNotification?.message || `Status atualizado para ${input.status.replace(/_/g, " ")}.`,
              url: trackingUrl,
              tag: `os-status-${input.id}-${input.status}`,
            }).catch((err) => console.warn("[push-pwa] Falha ao enviar push de status ao cliente:", err));
          }
        }
      } catch (err) {
        console.warn("[updateStatus] Erro ao preparar notificação:", err);
      }

      // Notifica o dono do tenant sobre mudança de status crítica — fire-and-forget
      try {
        const { tenants: tenantsForNotif } = await import("../../drizzle/schema");
        const [tenantForNotif] = await db
          .select({ name: tenantsForNotif.name })
          .from(tenantsForNotif)
          .where(eq(tenantsForNotif.id, ctx.user.tenantId!))
          .limit(1);
        if (tenantForNotif) {
          notifyTenantStatusChange({
            osRef: `OS #${input.id}${os.osNumber ? ` (${os.osNumber})` : ""}`,
            tenantName: tenantForNotif.name,
            status: input.status,
            changedByName: ctx.user.name ?? "Atendente",
            notes: input.notes,
            tenantId: ctx.user.tenantId!,
            serviceOrderId: input.id,
          });
        }
      } catch (err) {
        console.warn("[updateStatus] Erro ao disparar notificação ao tenant:", err);
      }

      // Se finalizado, gerar garantia automaticamente
      if (input.status === "finalizado") {
        const { warranties: warrantiesTable } = await import("../../drizzle/schema");
        const existing = await db
          .select()
          .from(warrantiesTable)
          .where(eq(warrantiesTable.serviceOrderId, input.id))
          .limit(1);
        if (existing.length === 0) {
          // Usa warrantyDays do input (informado no encerramento) ou o valor salvo na OS
          const effectiveWarrantyDays = input.warrantyDays ?? os.warrantyDays ?? 90;
          const warrantyCode = `GAR-${os.osNumber}-${nanoid(6).toUpperCase()}`;
          const startsAt = new Date();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + effectiveWarrantyDays);
          await db.insert(warrantiesTable).values({
            tenantId: ctx.user.tenantId!,
            serviceOrderId: input.id,
            warrantyCode,
            warrantyDays: effectiveWarrantyDays,
            startsAt,
            expiresAt,
            description: effectiveWarrantyDays > 0
              ? `Garantia de ${effectiveWarrantyDays} dias para o serviço realizado`
              : "Serviço realizado sem garantia",
            conditions: effectiveWarrantyDays > 0
              ? "Garantia cobre defeitos relacionados ao serviço executado. Não cobre danos físicos, líquidos ou mau uso."
              : null,
          });
        }
      }
      return { success: true, whatsappNotification };
    }),

  // Atualizar dados da OS
  update: tenantProcedure
    .input(
      z.object({
        id: z.number(),
        technicianId: z.number().optional().nullable(),
        internalNotes: z.string().optional(),
        estimatedDelivery: z.string().optional().nullable(),
        warrantyDays: z.number().optional(),
        totalAmount: z.string().optional(),
        physicalCondition: z.string().optional(),
        accessories: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, estimatedDelivery, ...data } = input;
      await db
        .update(serviceOrders)
        .set({
          ...data,
          estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
        })
        .where(and(eq(serviceOrders.id, id), eq(serviceOrders.tenantId, ctx.user.tenantId!)));
      return { success: true };
    }),

  // Atualizar informações principais da OS e do aparelho vinculado
  updateInfo: tenantProcedure
    .input(
      z.object({
        id: z.number(),
        brand: z.string().optional(),
        model: z.string().optional(),
        type: z.string().optional().nullable(),
        imei: z.string().optional().nullable(),
        serialNumber: z.string().optional().nullable(),
        color: z.string().optional().nullable(),
        deviceNotes: z.string().optional().nullable(),
        reportedDefect: z.string().min(3),
        physicalCondition: z.string().optional().nullable(),
        accessories: z.string().optional().nullable(),
        internalNotes: z.string().optional().nullable(),
        devicePassword: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [os] = await db
        .select({
          id: serviceOrders.id,
          tenantId: serviceOrders.tenantId,
          customerId: serviceOrders.customerId,
          deviceId: serviceOrders.deviceId,
        })
        .from(serviceOrders)
        .where(and(eq(serviceOrders.id, input.id), eq(serviceOrders.tenantId, ctx.user.tenantId!)))
        .limit(1);

      if (!os) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });

      const normalized = (value: string | null | undefined) => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : null;
      };

      const brand = normalized(input.brand);
      const model = normalized(input.model);
      const type = normalized(input.type);
      const imei = normalized(input.imei);
      const serialNumber = normalized(input.serialNumber);
      const color = normalized(input.color);
      const deviceNotes = normalized(input.deviceNotes);

      let resolvedDeviceId = os.deviceId;
      const hasDeviceData = Boolean(brand || model || type || imei || serialNumber || color || deviceNotes);

      if (resolvedDeviceId) {
        await db
          .update(devices)
          .set({
            brand: brand ?? "Não informada",
            model: model ?? "Não informado",
            type,
            imei,
            serialNumber,
            color,
            notes: deviceNotes,
          })
          .where(and(
            eq(devices.id, resolvedDeviceId),
            eq(devices.tenantId, ctx.user.tenantId!),
            eq(devices.customerId, os.customerId)
          ));
      } else if (hasDeviceData) {
        const insertResult = await db.insert(devices).values({
          tenantId: ctx.user.tenantId!,
          customerId: os.customerId,
          brand: brand ?? type ?? "Não informada",
          model: model ?? "Não informado",
          type,
          imei,
          serialNumber,
          color,
          notes: deviceNotes,
        } as any);

        resolvedDeviceId = Number((insertResult as any).insertId ?? (insertResult as any)[0]?.insertId ?? 0) || null;
      }

      await db
        .update(serviceOrders)
        .set({
          deviceId: resolvedDeviceId ?? undefined,
          reportedDefect: input.reportedDefect.trim(),
          physicalCondition: normalized(input.physicalCondition),
          accessories: normalized(input.accessories),
          internalNotes: normalized(input.internalNotes),
          devicePassword: normalized(input.devicePassword),
        })
        .where(and(eq(serviceOrders.id, input.id), eq(serviceOrders.tenantId, ctx.user.tenantId!)));

      return { success: true };
    }),

  // Upload de foto
  addPhoto: tenantProcedure
    .input(
      z.object({
        serviceOrderId: z.number(),
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
        type: z.enum(["entrada", "coleta", "entrega", "diagnostico", "outro"]).default("entrada"),
        caption: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const buffer = Buffer.from(input.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
      const fileKey = `photos/${ctx.user.tenantId}/${input.serviceOrderId}/${nanoid()}.jpg`;
      const { key, url } = await storagePut(fileKey, buffer, input.mimeType);
      await db.insert(photos).values({
        tenantId: ctx.user.tenantId!,
        serviceOrderId: input.serviceOrderId,
        url,
        fileKey: key,
        type: input.type,
        caption: input.caption,
        uploadedById: ctx.user.id,
      });
      return { url, key, success: true };
    }),

  // Timeline da OS
  timeline: tenantProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    return getOsTimeline(ctx.user.tenantId!, input.id);
  }),

  // OS do cliente logado (portal público) — ISOLADO por tenant
  // Aceita cliente OAuth/Manus e cliente com login local (`customer_session`).
  myOrders: publicProcedure
    .input(z.object({
      // Passado pelo frontend quando não há resolução por host (ex: modo de teste ?tenant=slug)
      tenantId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const access = await resolveCustomerPortalAccess(ctx, db, input.tenantId);
      if (!access) return [];

      const { devices } = await import("../../drizzle/schema");
      const { inArray } = await import("drizzle-orm");

      const orders = await db
        .select({
          id: serviceOrders.id,
          osNumber: serviceOrders.osNumber,
          tenantId: serviceOrders.tenantId,
          status: serviceOrders.status,
          reportedDefect: serviceOrders.reportedDefect,
          publicToken: serviceOrders.publicToken,
          createdAt: serviceOrders.createdAt,
          updatedAt: serviceOrders.updatedAt,
          estimatedDelivery: serviceOrders.estimatedDelivery,
          totalAmount: serviceOrders.totalAmount,
          paymentRequestedAt: serviceOrders.paymentRequestedAt,
          deliveryAuthorizedAt: serviceOrders.deliveryAuthorizedAt,
          deviceId: serviceOrders.deviceId,
        })
        .from(serviceOrders)
        .where(and(
          eq(serviceOrders.tenantId, access.tenantId),
          inArray(serviceOrders.customerId, access.customerIds),
        ))
        .orderBy(serviceOrders.createdAt);

      const enriched = await Promise.all(
        orders.map(async (os) => {
          const nextBestAction = buildNextBestAction(os as SmartActionContext, "customer");
          const sla = buildSlaSnapshot(os as SmartActionContext);
          if (!os.deviceId) return { ...os, deviceBrand: null, deviceModel: null, trackingToken: os.publicToken, nextBestAction, sla };
          const [device] = await db
            .select({ brand: devices.brand, model: devices.model })
            .from(devices)
            .where(and(eq(devices.id, os.deviceId), eq(devices.tenantId, access.tenantId)))
            .limit(1);
          return {
            ...os,
            deviceBrand: device?.brand ?? null,
            deviceModel: device?.model ?? null,
            trackingToken: os.publicToken,
            nextBestAction,
            sla,
          };
        })
      );

      return { orders: enriched, lazyLinkedCount: access.lazyLinkedCount };
    }),

  // Detalhe completo de uma OS para o cliente logado no portal público — ISOLADO por tenant
  // Segurança:
  //   1. Resolve tenantId pelo middleware de host (fonte autoritátiva)
  //   2. Verifica que a OS pertence ao tenant E ao customer do usuário logado
  //   3. Nunca exibe dados de outro tenant ou de outro cliente
  myOrderDetail: publicProcedure
    .input(z.object({
      osId: z.number().int().positive(),
      tenantId: z.number().int().positive().optional(), // fallback para modo preview
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const access = await resolveCustomerPortalAccess(ctx, db, input.tenantId);
      if (!access) return null;

      const { devices, osStatusHistory, warranties, budgets, budgetItems, osNotifications } = await import("../../drizzle/schema");
      const { inArray } = await import("drizzle-orm");

      // Busca a OS verificando que pertence ao tenant E ao customer do usuário
      const [os] = await db
        .select()
        .from(serviceOrders)
        .where(and(
          eq(serviceOrders.id, input.osId),
          eq(serviceOrders.tenantId, access.tenantId),
          inArray(serviceOrders.customerId, access.customerIds),
        ))
        .limit(1);

      if (!os) return null;

      // 3. Busca dados relacionados em paralelo
      const [timeline, device, warranty, budget, osPayments, recentCommunications] = await Promise.all([
        // Timeline de status
        db.select()
          .from(osStatusHistory)
          .where(and(
            eq(osStatusHistory.tenantId, access.tenantId),
            eq(osStatusHistory.serviceOrderId, os.id),
          ))
          .orderBy(osStatusHistory.createdAt),

        // Aparelho
        os.deviceId
          ? db.select().from(devices).where(and(eq(devices.id, os.deviceId), eq(devices.tenantId, access.tenantId))).limit(1).then((r) => r[0] ?? null)
          : Promise.resolve(null),

        // Garantia
        db.select()
          .from(warranties)
          .where(and(
            eq(warranties.tenantId, access.tenantId),
            eq(warranties.serviceOrderId, os.id),
          ))
          .limit(1)
          .then((r) => r[0] ?? null),

        // Orçamento aprovado
        db.select()
          .from(budgets)
          .where(and(
            eq(budgets.tenantId, access.tenantId),
            eq(budgets.serviceOrderId, os.id),
          ))
          .orderBy(budgets.createdAt)
          .limit(1)
          .then((r) => r[0] ?? null),

        db.select()
          .from(payments)
          .where(and(
            eq(payments.tenantId, access.tenantId),
            eq(payments.serviceOrderId, os.id),
          )),

        db.select({
          id: osNotifications.id,
          channel: osNotifications.channel,
          eventType: osNotifications.eventType,
          status: osNotifications.status,
          message: osNotifications.message,
          actorName: osNotifications.actorName,
          sentAt: osNotifications.sentAt,
        })
          .from(osNotifications)
          .where(and(
            eq(osNotifications.tenantId, access.tenantId),
            eq(osNotifications.serviceOrderId, os.id),
          ))
          .orderBy(osNotifications.sentAt)
          .limit(8),
      ]);

      // 4. Itens do orçamento (se houver)
      let budgetItemsList: typeof budgetItems.$inferSelect[] = [];
      if (budget) {
        budgetItemsList = await db
          .select()
          .from(budgetItems)
          .where(eq(budgetItems.budgetId, budget.id));
      }

      return {
        os,
        device,
        timeline,
        warranty,
        budget: budget ? { ...budget, items: budgetItemsList } : null,
        payments: osPayments,
        recentCommunications: recentCommunications.map((item) => ({
          ...item,
          sentAt: item.sentAt ? new Date(item.sentAt).toISOString() : null,
        })),
        inbox: recentCommunications.map((item) => ({
          id: item.id,
          channel: item.channel,
          eventType: item.eventType,
          status: item.status,
          message: item.message,
          actorName: item.actorName ?? "Sistema",
          sentAt: item.sentAt ? new Date(item.sentAt).toISOString() : null,
        })),
        sla: buildSlaSnapshot(os as SmartActionContext),
        nextBestAction: buildNextBestAction(os as SmartActionContext, "customer"),
      };
    }),

  authorizeDeliveryByCustomer: protectedProcedure
    .input(z.object({ osId: z.number().int().positive(), tenantId: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const access = await resolveCustomerPortalAccess(ctx, db, input.tenantId);
      if (!access) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { inArray } = await import("drizzle-orm");
      const [os] = await db.select().from(serviceOrders).where(and(
        eq(serviceOrders.id, input.osId),
        eq(serviceOrders.tenantId, access.tenantId),
        inArray(serviceOrders.customerId, access.customerIds),
      )).limit(1);
      if (!os) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada." });
      const allowed = ["pronto", "aguardando_entrega", "saiu_para_entrega", "entregue", "finalizado"];
      if (!allowed.includes(String(os.status))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A entrega só pode ser autorizada quando o serviço estiver concluído." });
      }
      const nextStatus = os.status === "pronto" ? "aguardando_entrega" : os.status;
      await db.update(serviceOrders).set({
        deliveryAuthorizedAt: os.deliveryAuthorizedAt || new Date(),
        deliveryAuthorizedIp: (ctx.req?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || ctx.req?.socket?.remoteAddress || null,
        status: nextStatus,
      } as any).where(and(eq(serviceOrders.id, os.id), eq(serviceOrders.tenantId, access.tenantId)));
      await db.insert(osStatusHistory).values({
        tenantId: access.tenantId,
        serviceOrderId: os.id,
        status: String(nextStatus),
        notes: "Cliente autorizou a entrega e liberou a opção de pagamento online.",
        changedByName: "Cliente",
      });
      await notifyOwner({ title: `Entrega autorizada pelo cliente na OS ${os.osNumber}`, content: "O cliente autorizou a entrega. Caso exista valor pendente, o pagamento online por PIX/cartão fica liberado." }).catch(() => undefined);
      return { success: true };
    }),

  // Métricas do tenant
  productivity: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { byStatus: [], dailySeries: [] };
    const { sql } = await import("drizzle-orm");
    const tenantId = ctx.user.tenantId!;
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    // Contagem por status nos últimos 30 dias
    const byStatusRaw = await db
      .select({
        status: serviceOrders.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(serviceOrders)
      .where(and(
        eq(serviceOrders.tenantId, tenantId),
        sql`${serviceOrders.createdAt} >= ${since}`,
      ))
      .groupBy(serviceOrders.status);

    // Série temporal: OS criadas por dia nos últimos 30 dias
    const dailyRaw = await db
      .select({
        day: sql<string>`DATE(${serviceOrders.createdAt})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(serviceOrders)
      .where(and(
        eq(serviceOrders.tenantId, tenantId),
        sql`${serviceOrders.createdAt} >= ${since}`,
      ))
      .groupBy(sql`DATE(${serviceOrders.createdAt})`);

    // Preencher dias sem OS com zero
    const dailyMap = new Map(dailyRaw.map((r) => [r.day, Number(r.count)]));
    const dailySeries: { day: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailySeries.push({ day: key, count: dailyMap.get(key) ?? 0 });
    }

    return {
      byStatus: byStatusRaw.map((r) => ({ status: r.status, count: Number(r.count) })),
      dailySeries,
    };
  }),

  financialReport: tenantProcedure
    .input(
      z.object({
        months: z.number().int().min(1).max(60).optional(),
        startDate: z.string().optional(), // ISO date string YYYY-MM-DD
        endDate: z.string().optional(),   // ISO date string YYYY-MM-DD
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const opts: { months?: number; startDate?: Date; endDate?: Date } = {};
      if (input?.months) opts.months = input.months;
      if (input?.startDate) opts.startDate = new Date(input.startDate);
      if (input?.endDate) {
        const end = new Date(input.endDate);
        end.setHours(23, 59, 59, 999);
        opts.endDate = end;
      }
      return getFinancialReport(ctx.user.tenantId!, opts);
    }),
  metrics: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, open: 0, pending: 0, finished: 0 };
    const { sql } = await import("drizzle-orm");
    const [total, open, finished, pendingPickup] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(serviceOrders).where(eq(serviceOrders.tenantId, ctx.user.tenantId!)),
      db.select({ count: sql<number>`COUNT(*)` }).from(serviceOrders).where(and(eq(serviceOrders.tenantId, ctx.user.tenantId!), sql`status NOT IN ('finalizado','encerrado_sem_reparo','encerrado_condenado','cancelado','entregue')`)),
      db.select({ count: sql<number>`COUNT(*)` }).from(serviceOrders).where(and(eq(serviceOrders.tenantId, ctx.user.tenantId!), eq(serviceOrders.status, "finalizado"))),
      db.select({ count: sql<number>`COUNT(*)` }).from(serviceOrders).where(and(eq(serviceOrders.tenantId, ctx.user.tenantId!), sql`status IN ('aguardando_coleta','coleta_agendada')`)),
    ]);
    return {
      total: Number(total[0]?.count ?? 0),
      open: Number(open[0]?.count ?? 0),
      finished: Number(finished[0]?.count ?? 0),
      pendingPickup: Number(pendingPickup[0]?.count ?? 0),
    };
  }),

  centralDay: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        cards: { newOrdersToday: 0, pendingBudgets: 0, overdueOrders: 0, readyForPickup: 0, pendingPayments: 0, failedCommunications: 0 },
        financial: { paidToday: 0, paidMonth: 0, pendingAmount: 0, pendingCount: 0 },
        actionQueue: [],
        alerts: [],
        recentCommunications: [],
        statusDistribution: [],
        technicianMetrics: [],
        actionSummary: { high: 0, medium: 0, normal: 0, stalled: 0 },
        inboxByOs: [],
      };
    }

    const { sql, desc } = await import("drizzle-orm");
    const tenantId = ctx.user.tenantId!;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const countExpr = sql<number>`COUNT(*)`;
    const sumAmountExpr = sql<string | number | null>`COALESCE(SUM(${payments.amount}), 0)`;

    const [
      newOrdersToday,
      pendingBudgets,
      overdueOrders,
      readyForPickup,
      pendingPayments,
      failedCommunications,
      paidToday,
      paidMonth,
      pendingAmount,
      actionRows,
      recentCommunications,
      statusDistributionRows,
      technicianMetricRows,
    ] = await Promise.all([
      db.select({ count: countExpr }).from(serviceOrders).where(and(
        eq(serviceOrders.tenantId, tenantId),
        sql`${serviceOrders.createdAt} >= ${startOfToday}`,
      )),
      db.select({ count: countExpr }).from(serviceOrders).where(and(
        eq(serviceOrders.tenantId, tenantId),
        eq(serviceOrders.status, "aguardando_aprovacao"),
      )),
      db.select({ count: countExpr }).from(serviceOrders).where(and(
        eq(serviceOrders.tenantId, tenantId),
        sql`${serviceOrders.estimatedDelivery} IS NOT NULL`,
        sql`${serviceOrders.estimatedDelivery} < ${now}`,
        sql`${serviceOrders.status} NOT IN ('finalizado','encerrado_sem_reparo','encerrado_condenado','cancelado','entregue')`,
      )),
      db.select({ count: countExpr }).from(serviceOrders).where(and(
        eq(serviceOrders.tenantId, tenantId),
        sql`${serviceOrders.status} IN ('pronto','aguardando_entrega')`,
      )),
      db.select({ count: countExpr }).from(payments).where(and(
        eq(payments.tenantId, tenantId),
        sql`${payments.status} IN ('pending','processing','failed')`,
      )),
      db.select({ count: countExpr }).from(osNotifications).where(and(
        eq(osNotifications.tenantId, tenantId),
        eq(osNotifications.eventType, "auto_communication"),
        sql`${osNotifications.channel} = 'email'`,
        sql`${osNotifications.status} = 'failed'`,
      )),
      db.select({ total: sumAmountExpr }).from(payments).where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.status, "paid"),
        sql`${payments.paidAt} >= ${startOfToday}`,
      )),
      db.select({ total: sumAmountExpr }).from(payments).where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.status, "paid"),
        sql`${payments.paidAt} >= ${startOfMonth}`,
      )),
      db.select({ total: sumAmountExpr }).from(payments).where(and(
        eq(payments.tenantId, tenantId),
        sql`${payments.status} IN ('pending','processing','failed')`,
      )),
      db
        .select({
          id: serviceOrders.id,
          osNumber: serviceOrders.osNumber,
          status: serviceOrders.status,
          reportedDefect: serviceOrders.reportedDefect,
          estimatedDelivery: serviceOrders.estimatedDelivery,
          totalAmount: serviceOrders.totalAmount,
          paymentRequestedAt: serviceOrders.paymentRequestedAt,
          deliveryAuthorizedAt: serviceOrders.deliveryAuthorizedAt,
          createdAt: serviceOrders.createdAt,
          updatedAt: serviceOrders.updatedAt,
          customerName: customers.name,
          deviceBrand: devices.brand,
          deviceModel: devices.model,
          technicianName: users.name,
        })
        .from(serviceOrders)
        .leftJoin(customers, eq(customers.id, serviceOrders.customerId))
        .leftJoin(devices, eq(devices.id, serviceOrders.deviceId))
        .leftJoin(users, eq(users.id, serviceOrders.technicianId))
        .where(and(
          eq(serviceOrders.tenantId, tenantId),
          sql`(${serviceOrders.status} IN ('recebido_na_assistencia','solicitado','aguardando_coleta','coleta_agendada','em_diagnostico','aguardando_aprovacao','aguardando_peca','em_reparo','pronto','aguardando_entrega') OR ${serviceOrders.estimatedDelivery} < ${now})`,
          sql`${serviceOrders.status} NOT IN ('finalizado','encerrado_sem_reparo','encerrado_condenado','cancelado','entregue')`,
        ))
        .orderBy(desc(serviceOrders.createdAt))
        .limit(12),
      db
        .select({
          id: osNotifications.id,
          serviceOrderId: osNotifications.serviceOrderId,
          osNumber: serviceOrders.osNumber,
          status: osNotifications.status,
          channel: osNotifications.channel,
          message: osNotifications.message,
          eventType: osNotifications.eventType,
          actorName: osNotifications.actorName,
          sentAt: osNotifications.sentAt,
        })
        .from(osNotifications)
        .leftJoin(serviceOrders, eq(serviceOrders.id, osNotifications.serviceOrderId))
        .where(eq(osNotifications.tenantId, tenantId))
        .orderBy(desc(osNotifications.sentAt))
        .limit(6),
      db
        .select({ status: serviceOrders.status, count: countExpr })
        .from(serviceOrders)
        .where(eq(serviceOrders.tenantId, tenantId))
        .groupBy(serviceOrders.status),
      db
        .select({
          technicianId: serviceOrders.technicianId,
          technicianName: users.name,
          total: countExpr,
          openCount: sql<number>`SUM(CASE WHEN ${serviceOrders.status} NOT IN ('finalizado','encerrado_sem_reparo','encerrado_condenado','cancelado','entregue') THEN 1 ELSE 0 END)`,
          finishedCount: sql<number>`SUM(CASE WHEN ${serviceOrders.status} IN ('finalizado','encerrado_sem_reparo','encerrado_condenado','entregue') THEN 1 ELSE 0 END)`,
          overdueCount: sql<number>`SUM(CASE WHEN ${serviceOrders.estimatedDelivery} IS NOT NULL AND ${serviceOrders.estimatedDelivery} < ${now} AND ${serviceOrders.status} NOT IN ('finalizado','encerrado_sem_reparo','encerrado_condenado','cancelado','entregue') THEN 1 ELSE 0 END)`,
        })
        .from(serviceOrders)
        .leftJoin(users, eq(users.id, serviceOrders.technicianId))
        .where(eq(serviceOrders.tenantId, tenantId))
        .groupBy(serviceOrders.technicianId, users.name)
        .orderBy(desc(countExpr))
        .limit(8),
    ]);

    const cards = {
      newOrdersToday: Number(newOrdersToday[0]?.count ?? 0),
      pendingBudgets: Number(pendingBudgets[0]?.count ?? 0),
      overdueOrders: Number(overdueOrders[0]?.count ?? 0),
      readyForPickup: Number(readyForPickup[0]?.count ?? 0),
      pendingPayments: Number(pendingPayments[0]?.count ?? 0),
      failedCommunications: Number(failedCommunications[0]?.count ?? 0),
    };

    const actionQueue = actionRows
      .map((order) => {
        const estimatedDelivery = order.estimatedDelivery ? new Date(order.estimatedDelivery) : null;
        const sla = buildSlaSnapshot(order as SmartActionContext, now);
        const nextBestAction = buildNextBestAction(order as SmartActionContext, "tenant", now);
        return {
          ...order,
          priority: nextBestAction.priority,
          reason: sla.isOverdue ? "Prazo vencido" : sla.isStageStalled ? "Etapa parada" : nextBestAction.title,
          suggestedAction: nextBestAction.ctaLabel,
          nextBestAction,
          sla,
          href: `/painel/os/${order.id}`,
          deviceLabel: [order.deviceBrand, order.deviceModel].filter(Boolean).join(" ") || "Aparelho não informado",
          estimatedDelivery: estimatedDelivery ? estimatedDelivery.toISOString() : null,
          createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
          updatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : null,
          totalAmount: Number(order.totalAmount ?? 0),
        };
      })
      .sort((a, b) => {
        const weight = { alta: 3, media: 2, normal: 1, baixa: 0 } as Record<string, number>;
        const priorityDiff = (weight[b.priority] ?? 0) - (weight[a.priority] ?? 0);
        if (priorityDiff !== 0) return priorityDiff;
        return Number(b.sla?.statusAgeHours ?? 0) - Number(a.sla?.statusAgeHours ?? 0);
      })
      .slice(0, 10);


    const actionSummary = actionQueue.reduce((acc, item) => {
      if (item.priority === "alta") acc.high += 1;
      else if (item.priority === "media") acc.medium += 1;
      else acc.normal += 1;
      if (item.sla?.isStageStalled || item.sla?.isOverdue) acc.stalled += 1;
      return acc;
    }, { high: 0, medium: 0, normal: 0, stalled: 0 });

    const inboxByOs = recentCommunications
      .filter((item) => item.serviceOrderId)
      .map((item) => ({
        osId: item.serviceOrderId,
        osNumber: item.osNumber,
        status: item.status,
        channel: item.channel,
        eventType: item.eventType,
        message: item.message,
        actorName: item.actorName ?? "Sistema",
        sentAt: item.sentAt ? new Date(item.sentAt).toISOString() : null,
        href: item.serviceOrderId ? `/painel/os/${item.serviceOrderId}` : "/painel/notificacoes",
      }));

    const alerts = [
      cards.overdueOrders > 0 ? { type: "danger", title: "OS atrasadas", description: `${cards.overdueOrders} ordem(ns) passaram do prazo estimado.`, href: "/painel/os" } : null,
      cards.pendingBudgets > 0 ? { type: "warning", title: "Orçamentos pendentes", description: `${cards.pendingBudgets} orçamento(s) aguardam aprovação do cliente.`, href: "/painel/os?status=aguardando_aprovacao" } : null,
      cards.readyForPickup > 0 ? { type: "success", title: "Prontos para retirada", description: `${cards.readyForPickup} serviço(s) já podem ser retirados ou entregues.`, href: "/painel/os?status=pronto" } : null,
      cards.failedCommunications > 0 ? { type: "warning", title: "Comunicações com falha", description: `${cards.failedCommunications} e-mail(s) automático(s) precisam de conferência.`, href: "/painel/notificacoes?eventType=auto_communication" } : null,
      actionQueue.length === 0 ? { type: "success", title: "Operação em dia", description: "Nenhuma ação crítica encontrada para agora.", href: "/painel/os/nova" } : null,
    ].filter(Boolean);

    return {
      cards,
      financial: {
        paidToday: Number(paidToday[0]?.total ?? 0),
        paidMonth: Number(paidMonth[0]?.total ?? 0),
        pendingAmount: Number(pendingAmount[0]?.total ?? 0),
        pendingCount: cards.pendingPayments,
      },
      actionQueue,
      actionSummary,
      inboxByOs,
      alerts,
      recentCommunications: recentCommunications.map((item) => ({
        ...item,
        sentAt: item.sentAt ? new Date(item.sentAt).toISOString() : null,
      })),
      statusDistribution: statusDistributionRows.map((item) => ({
        status: item.status,
        count: Number(item.count ?? 0),
      })),
      technicianMetrics: technicianMetricRows.map((item) => ({
        technicianId: item.technicianId,
        technicianName: item.technicianName ?? "Sem técnico",
        total: Number(item.total ?? 0),
        openCount: Number(item.openCount ?? 0),
        finishedCount: Number(item.finishedCount ?? 0),
        overdueCount: Number(item.overdueCount ?? 0),
      })),
      generatedAt: now.toISOString(),
    };
  }),
});
