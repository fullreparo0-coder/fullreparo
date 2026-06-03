import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, tenants, plans, customers, devices,
  serviceOrders, osStatusHistory, budgets, budgetItems,
  pickups, stockItems, payments, warranties, photos, osChecklist
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { nanoid } from "nanoid";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    const isOwner = user.openId === ENV.ownerOpenId;
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (isOwner) { values.role = "super_admin"; updateSet.role = "super_admin"; }
    // Preserve tenantId on duplicate key update (do not overwrite with null)
    // Never set tenantId for the platform owner (super_admin)
    if (!isOwner && user.tenantId !== undefined && user.tenantId !== null) {
      values.tenantId = user.tenantId;
      updateSet.tenantId = user.tenantId;
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUsersByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.tenantId, tenantId));
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export async function getAllTenants() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tenants).orderBy(desc(tenants.createdAt));
}

export async function getTenantById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0];
}

export async function getTenantBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return result[0];
}

/**
 * Resolve um tenant a partir de um hostname HTTP.
 * Estratégia:
 *   1. Tenta extrair o slug do primeiro label do subdomínio
 *      (ex: "rocha.fullreparo.com.br" → slug "rocha").
 *   2. Se não encontrar por slug, tenta o campo customDomain exato.
 * Retorna undefined se o host for ignorado (www, app, localhost, IP, raiz).
 */
export async function getTenantByDomain(hostname: string) {
  // Remove porta, se houver
  const host = hostname.split(":")[0].toLowerCase().trim();
  if (!host) return undefined;

  // Import inline para evitar dependência circular (tenantResolver importa db)
  const { extractTenantSlug } = await import("./_core/tenantResolver");
  const slug = extractTenantSlug(host);

  // 1. Busca por slug (quando há subdomínio válido)
  if (slug) {
    const bySlug = await getTenantBySlug(slug);
    if (bySlug) return bySlug;
  }

  // 2. Fallback: busca por customDomain exato
  // Cobre domínios raiz customizados (ex: rochacelulares.com.br)
  // e subdomínios com slug não encontrado no banco.
  const db = await getDb();
  if (!db) return undefined;
  const byDomain = await db
    .select()
    .from(tenants)
    .where(eq(tenants.customDomain, host))
    .limit(1);
  return byDomain[0];
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function getCustomersByTenant(
  tenantId: number,
  search?: string,
  page = 1,
  pageSize = 20
) {
  const db = await getDb();
  if (!db) return { data: [], totalCount: 0, totalPages: 0, currentPage: page };
  const conditions = [eq(customers.tenantId, tenantId)];
  if (search) conditions.push(or(
    like(customers.name, `%${search}%`),
    like(customers.phone, `%${search}%`),
    like(customers.document, `%${search}%`)
  )!);
  const where = and(...conditions);
  const offset = (page - 1) * pageSize;
  const [data, countResult] = await Promise.all([
    db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(where),
  ]);
  const totalCount = Number(countResult[0]?.count ?? 0);
  return { data, totalCount, totalPages: Math.ceil(totalCount / pageSize), currentPage: page };
}

export async function getCustomerById(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(and(eq(customers.tenantId, tenantId), eq(customers.id, id))).limit(1);
  return result[0];
}

export async function getDevicesByCustomer(tenantId: number, customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devices).where(and(eq(devices.tenantId, tenantId), eq(devices.customerId, customerId)));
}

// ─── Service Orders ───────────────────────────────────────────────────────────

export async function generateOsNumber(tenantId: number): Promise<string> {
  const db = await getDb();
  if (!db) return `OS-${Date.now()}`;
  const year = new Date().getFullYear();
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.tenantId, tenantId), sql`YEAR(createdAt) = ${year}`));
  const count = Number(result[0]?.count ?? 0) + 1;
  return `OS-${year}-${String(count).padStart(4, "0")}`;
}

export async function countOsThisMonth(tenantId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(serviceOrders)
    .where(and(
      eq(serviceOrders.tenantId, tenantId),
      sql`createdAt >= ${firstDay}`,
      sql`createdAt <= ${lastDay}`,
    ));
  return Number(result[0]?.count ?? 0);
}

export async function getTenantWithPlan(tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      tenantId: tenants.id,
      tenantStatus: tenants.status,
      trialEndsAt: tenants.trialEndsAt,
      subscriptionEndsAt: tenants.subscriptionEndsAt,
      planId: plans.id,
      planName: plans.name,
      maxOsPerMonth: plans.maxOsPerMonth,
      maxUsers: plans.maxUsers,
      hasPickupDelivery: plans.hasPickupDelivery,
    })
    .from(tenants)
    .innerJoin(plans, eq(tenants.planId, plans.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return result[0];
}

export async function getServiceOrdersByTenant(
  tenantId: number,
  search?: string,
  status?: string,
  page = 1,
  pageSize = 20,
  dateFrom?: Date,
  dateTo?: Date,
) {
  const db = await getDb();
  if (!db) return { data: [], totalCount: 0, totalPages: 0, currentPage: page };

  // Build base conditions (tenant isolation + status filter)
  const baseConditions = [eq(serviceOrders.tenantId, tenantId)];
  // Filtro de período por createdAt
  if (dateFrom) baseConditions.push(sql`${serviceOrders.createdAt} >= ${dateFrom}`);
  if (dateTo) baseConditions.push(sql`${serviceOrders.createdAt} <= ${dateTo}`);
  if (status && status !== "all") {
    // Suporte a múltiplos status separados por vírgula (ex: "aguardando_coleta,coleta_agendada")
    const statusList = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statusList.length === 1) {
      baseConditions.push(eq(serviceOrders.status, statusList[0] as any));
    } else if (statusList.length > 1) {
      baseConditions.push(inArray(serviceOrders.status, statusList as any[]));
    }
  }

  // Expanded search: osNumber, reportedDefect, customer name/phone/document(CPF), device IMEI/serialNumber
  if (search) {
    const s = `%${search}%`;
    baseConditions.push(
      or(
        like(serviceOrders.osNumber, s),
        like(serviceOrders.reportedDefect, s),
        // subquery-style: match via customer join
        sql`EXISTS (
          SELECT 1 FROM customers c
          WHERE c.id = ${serviceOrders.customerId}
            AND c.tenantId = ${serviceOrders.tenantId}
            AND (c.name LIKE ${s} OR c.phone LIKE ${s} OR c.document LIKE ${s})
        )`,
        // match via device join
        sql`EXISTS (
          SELECT 1 FROM devices d
          WHERE d.id = ${serviceOrders.deviceId}
            AND d.tenantId = ${serviceOrders.tenantId}
            AND (d.imei LIKE ${s} OR d.serialNumber LIKE ${s})
        )`
      )!
    );
  }

  const where = and(...baseConditions);
  const offset = (page - 1) * pageSize;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: serviceOrders.id,
        tenantId: serviceOrders.tenantId,
        osNumber: serviceOrders.osNumber,
        customerId: serviceOrders.customerId,
        deviceId: serviceOrders.deviceId,
        technicianId: serviceOrders.technicianId,
        status: serviceOrders.status,
        origin: serviceOrders.origin,
        reportedDefect: serviceOrders.reportedDefect,
        totalAmount: serviceOrders.totalAmount,
        estimatedDelivery: serviceOrders.estimatedDelivery,
        paymentRequestedAt: serviceOrders.paymentRequestedAt,
        deliveryAuthorizedAt: serviceOrders.deliveryAuthorizedAt,
        createdAt: serviceOrders.createdAt,
        updatedAt: serviceOrders.updatedAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerDocument: customers.document,
        deviceBrand: devices.brand,
        deviceModel: devices.model,
        deviceType: devices.type,
        deviceImei: devices.imei,
        deviceSerialNumber: devices.serialNumber,
        technicianName: sql<string | null>`(
          SELECT u.name FROM users u
          WHERE u.id = ${serviceOrders.technicianId}
          LIMIT 1
        )`,
        paidAmount: sql<string>`COALESCE((
          SELECT SUM(CAST(p.amount AS DECIMAL(10,2)))
          FROM payments p
          WHERE p.tenantId = ${serviceOrders.tenantId}
            AND p.serviceOrderId = ${serviceOrders.id}
            AND p.status = 'paid'
        ), 0)`,
        pendingPaymentsCount: sql<number>`(
          SELECT COUNT(*)
          FROM payments p
          WHERE p.tenantId = ${serviceOrders.tenantId}
            AND p.serviceOrderId = ${serviceOrders.id}
            AND p.status IN ('pending', 'processing')
        )`,
      })
      .from(serviceOrders)
      .leftJoin(customers, and(eq(serviceOrders.customerId, customers.id), eq(serviceOrders.tenantId, customers.tenantId)))
      .leftJoin(devices, and(eq(serviceOrders.deviceId, devices.id), eq(serviceOrders.tenantId, devices.tenantId)))
      .where(where)
      .orderBy(desc(serviceOrders.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(serviceOrders).where(where),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  return {
    data,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
  };
}

export async function getServiceOrderById(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(serviceOrders)
    .leftJoin(customers, eq(serviceOrders.customerId, customers.id))
    .leftJoin(devices, eq(serviceOrders.deviceId, devices.id))
    .where(and(eq(serviceOrders.tenantId, tenantId), eq(serviceOrders.id, id)))
    .limit(1);
  if (!result[0]) return undefined;
  const { service_orders: os, customers: cust, devices: dev } = result[0];
  return {
    ...os,
    customerName: cust?.name ?? null,
    customerPhone: cust?.phone ?? null,
    customerEmail: cust?.email ?? null,
    customerDocument: cust?.document ?? null,
    customerAddress: cust?.address ?? null,
    customerAddressNumber: cust?.addressNumber ?? null,
    customerNeighborhood: cust?.neighborhood ?? null,
    customerCity: cust?.city ?? null,
    customerState: cust?.state ?? null,
    customerZipCode: cust?.zipCode ?? null,
    deviceBrand: dev?.brand ?? null,
    deviceModel: dev?.model ?? null,
    deviceType: dev?.type ?? null,
    deviceImei: dev?.imei ?? null,
    deviceSerialNumber: dev?.serialNumber ?? null,
    deviceColor: dev?.color ?? null,
    deviceNotes: dev?.notes ?? null,
  };
}

export async function getServiceOrderByPublicToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(serviceOrders).where(eq(serviceOrders.publicToken, token)).limit(1);
  return result[0];
}

export async function getOsTimeline(tenantId: number, serviceOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(osStatusHistory)
    .where(and(eq(osStatusHistory.tenantId, tenantId), eq(osStatusHistory.serviceOrderId, serviceOrderId)))
    .orderBy(osStatusHistory.createdAt);
}

export async function getPhotosByOs(tenantId: number, serviceOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photos).where(and(eq(photos.tenantId, tenantId), eq(photos.serviceOrderId, serviceOrderId)));
}

export async function getChecklistByOs(tenantId: number, serviceOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(osChecklist).where(and(eq(osChecklist.tenantId, tenantId), eq(osChecklist.serviceOrderId, serviceOrderId)));
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export async function getBudgetsByOs(tenantId: number, serviceOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(budgets)
    .where(and(eq(budgets.tenantId, tenantId), eq(budgets.serviceOrderId, serviceOrderId)))
    .orderBy(desc(budgets.createdAt));
}

export async function getBudgetItems(tenantId: number, budgetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(budgetItems).where(and(eq(budgetItems.tenantId, tenantId), eq(budgetItems.budgetId, budgetId)));
}

// ─── Pickups ─────────────────────────────────────────────────────────────────

export async function getPendingPickups(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pickups)
    .where(and(eq(pickups.tenantId, tenantId), sql`status != 'completed'`))
    .orderBy(pickups.createdAt);
}

export async function getPickupsByDeliverer(tenantId: number, delivererId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pickups)
    .where(and(eq(pickups.tenantId, tenantId), eq(pickups.delivererId, delivererId)))
    .orderBy(desc(pickups.createdAt));
}

// ─── Stock ────────────────────────────────────────────────────────────────────

export async function getStockByTenant(
  tenantId: number,
  search?: string,
  page = 1,
  pageSize = 20
) {
  const db = await getDb();
  if (!db) return { data: [], totalCount: 0, totalPages: 0, currentPage: page };
  const conditions = [eq(stockItems.tenantId, tenantId)];
  if (search) conditions.push(or(like(stockItems.name, `%${search}%`), like(stockItems.sku ?? "", `%${search}%`))!);
  const where = and(...conditions);
  const offset = (page - 1) * pageSize;
  const [data, countResult] = await Promise.all([
    db.select().from(stockItems).where(where).orderBy(stockItems.name).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(stockItems).where(where),
  ]);
  const totalCount = Number(countResult[0]?.count ?? 0);
  return { data, totalCount, totalPages: Math.ceil(totalCount / pageSize), currentPage: page };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function getPaymentsByOs(tenantId: number, serviceOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.serviceOrderId, serviceOrderId)));
}

// ─── Warranties ───────────────────────────────────────────────────────────────

export async function getWarrantyByOs(tenantId: number, serviceOrderId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(warranties).where(and(eq(warranties.tenantId, tenantId), eq(warranties.serviceOrderId, serviceOrderId))).limit(1);
  return result[0] ?? null;
}

export async function getWarrantyByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(warranties).where(eq(warranties.warrantyCode, code)).limit(1);
  return result[0] ?? null;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Retorna todas as OS do tenant para exportação (sem paginação), com dados
 * de cliente e aparelho em join. Respeita os mesmos filtros da listagem.
 */
export async function getServiceOrdersForExport(
  tenantId: number,
  search?: string,
  status?: string,
  dateFrom?: Date,
  dateTo?: Date,
) {
  const db = await getDb();
  if (!db) return [];

  const baseConditions = [eq(serviceOrders.tenantId, tenantId)];
  if (dateFrom) baseConditions.push(sql`${serviceOrders.createdAt} >= ${dateFrom}`);
  if (dateTo) baseConditions.push(sql`${serviceOrders.createdAt} <= ${dateTo}`);
  if (status && status !== "all") {
    const statusList = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statusList.length === 1) {
      baseConditions.push(eq(serviceOrders.status, statusList[0] as any));
    } else if (statusList.length > 1) {
      baseConditions.push(inArray(serviceOrders.status, statusList as any[]));
    }
  }
  if (search) {
    const s = `%${search}%`;
    baseConditions.push(
      or(
        like(serviceOrders.osNumber, s),
        like(serviceOrders.reportedDefect, s),
        sql`EXISTS (
          SELECT 1 FROM customers c
          WHERE c.id = ${serviceOrders.customerId}
            AND c.tenantId = ${serviceOrders.tenantId}
            AND (c.name LIKE ${s} OR c.phone LIKE ${s} OR c.document LIKE ${s})
        )`,
        sql`EXISTS (
          SELECT 1 FROM devices d
          WHERE d.id = ${serviceOrders.deviceId}
            AND d.tenantId = ${serviceOrders.tenantId}
            AND (d.imei LIKE ${s} OR d.serialNumber LIKE ${s})
        )`
      )!
    );
  }

  const where = and(...baseConditions);

  const rows = await db
    .select({
      id: serviceOrders.id,
      osNumber: serviceOrders.osNumber,
      status: serviceOrders.status,
      origin: serviceOrders.origin,
      reportedDefect: serviceOrders.reportedDefect,
      totalAmount: serviceOrders.totalAmount,
      createdAt: serviceOrders.createdAt,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerDocument: customers.document,
      deviceBrand: devices.brand,
      deviceModel: devices.model,
      deviceImei: devices.imei,
    })
    .from(serviceOrders)
    .leftJoin(customers, eq(serviceOrders.customerId, customers.id))
    .leftJoin(devices, eq(serviceOrders.deviceId, devices.id))
    .where(where)
    .orderBy(desc(serviceOrders.createdAt))
    .limit(5000); // segurança: máximo 5.000 linhas por exportação

  return rows;
}

// ─── Export de Clientes ───────────────────────────────────────────────────────

/**
 * Retorna todos os clientes do tenant para exportação (sem paginação),
 * com contagem de OS por cliente.
 */
export async function getCustomersForExport(
  tenantId: number,
  search?: string,
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(customers.tenantId, tenantId)];
  if (search) {
    const s = `%${search}%`;
    conditions.push(
      or(
        like(customers.name, s),
        like(customers.phone, s),
        like(customers.document ?? "", s),
      )!
    );
  }

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      document: customers.document,
      city: customers.city,
      state: customers.state,
      createdAt: customers.createdAt,
      osCount: sql<number>`(
        SELECT COUNT(*) FROM service_orders so
        WHERE so.customerId = ${customers.id}
          AND so.tenantId = ${customers.tenantId}
      )`,
    })
    .from(customers)
    .where(and(...conditions))
    .orderBy(customers.name)
    .limit(10000);

  return rows;
}

// ─── Relatório Financeiro ─────────────────────────────────────────────────────

/**
 * Retorna dados para o relatório financeiro mensal:
 * - receita por mês (últimos 12 meses)
 * - top 5 defeitos mais comuns
 * - totais por método de pagamento
 * - totais por status de OS
 */
export async function getFinancialReport(
  tenantId: number,
  options?: { months?: number; startDate?: Date; endDate?: Date }
) {
  const db = await getDb();
  if (!db) {
    return {
      monthlyRevenue: [],
      topDefects: [],
      paymentMethods: [],
      statusSummary: [],
    };
  }

  // Determinar o intervalo de datas
  let periodStart: Date;
  let periodEnd: Date | null = null;

  if (options?.startDate) {
    periodStart = options.startDate;
    periodEnd = options.endDate ?? null;
  } else {
    const monthsBack = options?.months ?? 12;
    periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - (monthsBack - 1));
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
  }

  const twelveMonthsAgo = periodStart; // alias para compatibilidade

  const [monthlyRevenue, topDefects, paymentMethods, statusSummary] = await Promise.all([
    // Receita por mês (últimos 12 meses) — soma dos pagamentos pagos
    db
      .select({
        month: sql<string>`DATE_FORMAT(${payments.paidAt}, '%Y-%m')`,
        total: sql<number>`SUM(${payments.amount})`,
        count: sql<number>`COUNT(DISTINCT ${payments.serviceOrderId})`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.status, "paid"),
          sql`${payments.paidAt} >= ${twelveMonthsAgo}`,
          ...(periodEnd ? [sql`${payments.paidAt} <= ${periodEnd}`] : []),
        )
      )
      .groupBy(sql`DATE_FORMAT(${payments.paidAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${payments.paidAt}, '%Y-%m')`),

    // Top 5 defeitos mais comuns
    db
      .select({
        defect: serviceOrders.reportedDefect,
        count: sql<number>`COUNT(*)`,
      })
      .from(serviceOrders)
      .where(eq(serviceOrders.tenantId, tenantId))
      .groupBy(serviceOrders.reportedDefect)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5),

    // Totais por método de pagamento
    db
      .select({
        method: payments.method,
        total: sql<number>`SUM(${payments.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.status, "paid")))
      .groupBy(payments.method)
      .orderBy(sql`SUM(${payments.amount}) DESC`),

    // Totais por status de OS
    db
      .select({
        status: serviceOrders.status,
        count: sql<number>`COUNT(*)`,
        total: sql<number>`SUM(${serviceOrders.totalAmount})`,
      })
      .from(serviceOrders)
      .where(eq(serviceOrders.tenantId, tenantId))
      .groupBy(serviceOrders.status)
      .orderBy(sql`COUNT(*) DESC`),
  ]);

  return {
    monthlyRevenue: monthlyRevenue.map((r) => ({
      month: r.month,
      total: Number(r.total ?? 0),
      count: Number(r.count ?? 0),
    })),
    topDefects: topDefects.map((r) => ({
      defect: r.defect,
      count: Number(r.count ?? 0),
    })),
    paymentMethods: paymentMethods.map((r) => ({
      method: r.method,
      total: Number(r.total ?? 0),
      count: Number(r.count ?? 0),
    })),
    statusSummary: statusSummary.map((r) => ({
      status: r.status,
      count: Number(r.count ?? 0),
      total: Number(r.total ?? 0),
    })),
  };
}
