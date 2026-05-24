import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { osNotifications, serviceOrders } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { and, desc, eq, gte, like, or } from "drizzle-orm";

const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const notificationsRouter = router({
  /**
   * Lista o histórico de notificações do tenant com paginação e filtros.
   * Inclui dados básicos da OS (número, status atual) para exibição na tabela.
   */
  list: tenantProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(30),
        /** Filtrar por tipo de evento */
        eventType: z.enum(["all", "budget_approved", "budget_rejected", "status_change", "auto_communication"]).default("all"),
        /** Filtrar por OS ID */
        serviceOrderId: z.number().int().optional(),
        /** Busca livre por mensagem ou actorName */
        search: z.string().optional(),
        /** Filtrar por data de início (timestamp ms) */
        since: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };

      const offset = (input.page - 1) * input.pageSize;

      // Construir filtros
      const filters = [eq(osNotifications.tenantId, ctx.user.tenantId!)];
      if (input.eventType !== "all") filters.push(eq(osNotifications.eventType, input.eventType));
      if (input.serviceOrderId) filters.push(eq(osNotifications.serviceOrderId, input.serviceOrderId));
      if (input.since) filters.push(gte(osNotifications.sentAt, new Date(input.since)));
      if (input.search) {
        filters.push(
          or(
            like(osNotifications.message, `%${input.search}%`),
            like(osNotifications.actorName, `%${input.search}%`)
          )!
        );
      }

      // Buscar notificações com join na OS para pegar o número
      const rows = await db
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
        .leftJoin(serviceOrders, eq(osNotifications.serviceOrderId, serviceOrders.id))
        .where(and(...filters))
        .orderBy(desc(osNotifications.sentAt))
        .limit(input.pageSize)
        .offset(offset);

      // Contar total para paginação
      const countRows = await db
        .select({ id: osNotifications.id })
        .from(osNotifications)
        .where(and(...filters));

      return {
        items: rows,
        total: countRows.length,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** Contagem de eventos não lidos (últimas 24h) para badge no sidebar */
  recentCount: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ id: osNotifications.id })
      .from(osNotifications)
      .where(
        and(
          eq(osNotifications.tenantId, ctx.user.tenantId!),
          gte(osNotifications.sentAt, since)
        )
      );
    return { count: rows.length };
  }),
});
