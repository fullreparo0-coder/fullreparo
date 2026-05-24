import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { osChecklistState, serviceOrders, checklistTemplates, tenantChecklistOverrides, devices } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { eq, and, asc, or, isNull } from "drizzle-orm";

/** Middleware: requer tenantId */
const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem tenant." });
  }
  return next({ ctx: { ...ctx, tenantId: ctx.user.tenantId } });
});

/**
 * Inicializa o checklist de uma OS copiando o template efetivo do tenant
 * (globais + overrides + exclusivos) filtrado pelo deviceType do aparelho.
 */
async function initChecklistForOs(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  serviceOrderId: number,
  tenantId: number,
  deviceType: string | null
) {
  // 1. Templates globais ativos
  const templates = await db
    .select()
    .from(checklistTemplates)
    .where(
      deviceType
        ? or(isNull(checklistTemplates.deviceType), eq(checklistTemplates.deviceType, deviceType))
        : isNull(checklistTemplates.deviceType)
    )
    .orderBy(asc(checklistTemplates.sortOrder), asc(checklistTemplates.id));

  // 2. Overrides do tenant
  const overrides = await db
    .select()
    .from(tenantChecklistOverrides)
    .where(eq(tenantChecklistOverrides.tenantId, tenantId))
    .orderBy(asc(tenantChecklistOverrides.sortOrder), asc(tenantChecklistOverrides.id));

  const overrideMap = new Map(overrides.map((o) => [o.templateId, o]));

  const items: { label: string; sortOrder: number }[] = [];

  // 3. Itens globais com merge de overrides
  for (const t of templates) {
    if (!t.isActive) continue;
    const override = overrideMap.get(t.id);
    if (override && !override.isActive) continue; // desativado pelo tenant
    const label = override?.label ?? t.label;
    const sortOrder = override?.sortOrder ?? t.sortOrder;
    items.push({ label, sortOrder });
  }

  // 4. Itens exclusivos do tenant (isCustom=true)
  const customItems = overrides.filter(
    (o) => o.isCustom && o.isActive && (!o.deviceType || o.deviceType === deviceType || !deviceType)
  );
  for (const c of customItems) {
    items.push({ label: c.label, sortOrder: c.sortOrder });
  }

  // 5. Ordenar e inserir
  items.sort((a, b) => a.sortOrder - b.sortOrder);

  if (items.length === 0) return;

  await db.insert(osChecklistState).values(
    items.map((item, idx) => ({
      serviceOrderId,
      label: item.label,
      isChecked: false,
      sortOrder: idx,
    }))
  );
}

export const osChecklistRouter = router({
  /**
   * Retorna os itens do checklist da OS.
   * Se ainda não foram inicializados, cria a partir do template do tenant.
   */
  getByOs: tenantProcedure
    .input(z.object({ serviceOrderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verificar que a OS pertence ao tenant e obter deviceType via join com devices
      const [os] = await db
        .select({
          id: serviceOrders.id,
          tenantId: serviceOrders.tenantId,
          deviceType: devices.type,
        })
        .from(serviceOrders)
        .leftJoin(devices, eq(serviceOrders.deviceId, devices.id))
        .where(and(eq(serviceOrders.id, input.serviceOrderId), eq(serviceOrders.tenantId, ctx.tenantId)))
        .limit(1);

      if (!os) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada." });

      // Verificar se já existe checklist para essa OS
      const existing = await db
        .select()
        .from(osChecklistState)
        .where(eq(osChecklistState.serviceOrderId, input.serviceOrderId))
        .orderBy(asc(osChecklistState.sortOrder), asc(osChecklistState.id));

      if (existing.length > 0) return existing;

      // Lazy init: criar checklist a partir do template
      await initChecklistForOs(db, input.serviceOrderId, ctx.tenantId, os.deviceType ?? null);

      // Retornar os itens recém-criados
      return db
        .select()
        .from(osChecklistState)
        .where(eq(osChecklistState.serviceOrderId, input.serviceOrderId))
        .orderBy(asc(osChecklistState.sortOrder), asc(osChecklistState.id));
    }),

  /**
   * Marca ou desmarca um item do checklist da OS.
   */
  toggleItem: tenantProcedure
    .input(z.object({ itemId: z.number(), isChecked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verificar que o item pertence a uma OS do tenant
      const [item] = await db
        .select({ id: osChecklistState.id, serviceOrderId: osChecklistState.serviceOrderId })
        .from(osChecklistState)
        .where(eq(osChecklistState.id, input.itemId))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const [os] = await db
        .select({ tenantId: serviceOrders.tenantId })
        .from(serviceOrders)
        .where(eq(serviceOrders.id, item.serviceOrderId))
        .limit(1);

      if (!os || os.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(osChecklistState)
        .set({ isChecked: input.isChecked })
        .where(eq(osChecklistState.id, input.itemId));

      return { success: true };
    }),
});
