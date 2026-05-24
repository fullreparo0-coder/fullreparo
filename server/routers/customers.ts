import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getCustomersByTenant, getCustomerById, getDevicesByCustomer } from "../db";
import { customers, devices, serviceOrders } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { and, desc, eq, sql } from "drizzle-orm";
import { isValidDocument, detectDocumentType, onlyDigits } from "../../shared/cpfCnpj";
import { resolveCustomerPortalAccess } from "../_core/customerPortalAuth";

const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem tenant" });
  return next({ ctx });
});

export const customersRouter = router({
  list: tenantProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return getCustomersByTenant(
        ctx.user.tenantId!,
        input?.search,
        input?.page ?? 1,
        input?.pageSize ?? 20
      );
    }),

  getById: tenantProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const customer = await getCustomerById(ctx.user.tenantId!, input.id);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
    return customer;
  }),

  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(2),
        phone: z.string().min(8),
        email: z.string().email().optional().or(z.literal("")),
        document: z.string().optional(),
        address: z.string().optional(),
        addressNumber: z.string().optional(),
        addressReference: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Normalização: CPF/CNPJ salvo apenas com dígitos; e-mail em lowercase
      const docDigits = input.document ? onlyDigits(input.document) : undefined;
      // Validação de dígitos verificadores quando CPF (11 dígitos) ou CNPJ (14 dígitos)
      if (docDigits && (docDigits.length === 11 || docDigits.length === 14)) {
        if (!isValidDocument(docDigits)) {
          const type = detectDocumentType(docDigits);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: type ? `${type} inválido. Verifique os dígitos informados.` : "Documento inválido.",
          });
        }
      }
      const normalized = {
        ...input,
        document: docDigits || undefined,
        email: input.email ? input.email.toLowerCase().trim() || undefined : undefined,
      };
      const result = await db.insert(customers).values({ ...normalized, tenantId: ctx.user.tenantId! });
      return { id: Number((result as any)[0]?.insertId ?? (result as any).insertId), success: true };
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        document: z.string().optional(),
        address: z.string().optional(),
        addressNumber: z.string().optional(),
        addressReference: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...raw } = input;
      // Validação de dígitos verificadores quando CPF (11 dígitos) ou CNPJ (14 dígitos)
      if (raw.document !== undefined) {
        const docDigits = onlyDigits(raw.document);
        if (docDigits.length === 11 || docDigits.length === 14) {
          if (!isValidDocument(docDigits)) {
            const type = detectDocumentType(docDigits);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: type ? `${type} inválido. Verifique os dígitos informados.` : "Documento inválido.",
            });
          }
        }
      }
      // Normalização: CPF/CNPJ salvo apenas com dígitos; e-mail em lowercase
      const data = {
        ...raw,
        ...(raw.document !== undefined && { document: onlyDigits(raw.document) || undefined }),
        ...(raw.email !== undefined && { email: raw.email.toLowerCase().trim() || undefined }),
      };
      await db
        .update(customers)
        .set(data)
        .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.user.tenantId!)));
      return { success: true };
    }),

  /**
   * Busca um cliente por CPF ou e-mail dentro do tenant atual.
   * Usado pelo step 0 da Nova OS para identificação rápida no balcão.
   *
   * Normalização:
   *   - CPF: remove tudo que não é dígito antes de comparar
   *   - E-mail: lowercase + trim
   *
   * Retorna o primeiro cliente encontrado ou null.
   * Sempre limitado ao tenantId do usuário logado.
   */
  findByDocument: tenantProcedure
    .input(
      z.object({
        query: z
          .string()
          .min(5, "Digite ao menos 5 caracteres")
          .max(100)
          .transform((v) => v.trim()),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const { or, like } = await import("drizzle-orm");
      const raw = input.query;

      // Detecta se é CPF/CNPJ (só dígitos após normalização) ou e-mail
      const digits = raw.replace(/\D/g, "");
      const isDocument = digits.length >= 6 && digits === raw.replace(/[.\-\/\s]/g, "");
      const isEmail = raw.includes("@");

      if (!isDocument && !isEmail) return null;

      const tenantId = ctx.user.tenantId!;

      // Monta a condição de busca
      let searchCondition;
      if (isEmail) {
        const normalizedEmail = raw.toLowerCase();
        searchCondition = eq(customers.email, normalizedEmail);
      } else {
        // Busca pelo CPF/CNPJ normalizado (só dígitos)
        // O banco pode armazenar com ou sem formatação, então buscamos
        // tanto pelo valor exato quanto pelo normalizado
        searchCondition = or(
          eq(customers.document, digits),
          eq(customers.document, raw),
          // Busca parcial para CPF com formatação (ex: "123.456.789-00" vs "12345678900")
          like(customers.document, `%${digits.slice(0, 11)}%`)
        );
      }

      const results = await db
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          document: customers.document,
          address: customers.address,
          addressNumber: customers.addressNumber,
          addressReference: customers.addressReference,
          neighborhood: customers.neighborhood,
          city: customers.city,
          state: customers.state,
          zipCode: customers.zipCode,
          notes: customers.notes,
          userOpenId: customers.userOpenId,
        })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), searchCondition!))
        .limit(1);

      return results[0] ?? null;
    }),

  // Vincula o usuário autenticado ao customer via openId
  // Chamado pelo atendente ao criar OS no balcão quando o cliente já tem conta
  linkUser: tenantProcedure
    .input(z.object({ customerId: z.number(), userOpenId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(customers)
        .set({ userOpenId: input.userOpenId })
        .where(and(eq(customers.id, input.customerId), eq(customers.tenantId, ctx.user.tenantId!)));
      return { success: true };
    }),

  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db
      .delete(customers)
      .where(and(eq(customers.id, input.id), eq(customers.tenantId, ctx.user.tenantId!)));
    return { success: true };
  }),

  // Dispositivos do cliente
  devices: tenantProcedure.input(z.object({ customerId: z.number() })).query(async ({ ctx, input }) => {
    return getDevicesByCustomer(ctx.user.tenantId!, input.customerId);
  }),

  addDevice: tenantProcedure
    .input(
      z.object({
        customerId: z.number(),
        brand: z.string().min(1),
        model: z.string().min(1),
        type: z.string().optional(),
        imei: z.string().optional(),
        serialNumber: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(devices).values({ ...input, tenantId: ctx.user.tenantId! });
      return { id: Number((result as any)[0]?.insertId ?? (result as any).insertId), success: true };
    }),

  // Aparelhos do cliente logado no portal público — ISOLADO por tenant
  // Aceita cliente OAuth/Manus e cliente com login local (`customer_session`).
  myDevices: publicProcedure
    .input(z.object({
      tenantId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const access = await resolveCustomerPortalAccess(ctx, db, input.tenantId);
      if (!access) return [];

      const { inArray } = await import("drizzle-orm");
      return db
        .select()
        .from(devices)
        .where(and(
          eq(devices.tenantId, access.tenantId),
          inArray(devices.customerId, access.customerIds),
        ))
        .orderBy(desc(devices.createdAt));
    }),

  // Ordens de serviço do cliente (para a página de detalhes)
  orders: tenantProcedure
    .input(z.object({
      customerId: z.number(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { data: [], totalCount: 0, totalPages: 0, currentPage: input.page };
      const { customerId, page, pageSize } = input;
      const tenantId = ctx.user.tenantId!;
      const offset = (page - 1) * pageSize;
      const where = and(
        eq(serviceOrders.tenantId, tenantId),
        eq(serviceOrders.customerId, customerId)
      );
      const [data, countResult] = await Promise.all([
        db.select().from(serviceOrders).where(where)
          .orderBy(desc(serviceOrders.createdAt))
          .limit(pageSize).offset(offset),
        db.select({ count: sql<number>`COUNT(*)` }).from(serviceOrders).where(where),
      ]);
      const totalCount = Number(countResult[0]?.count ?? 0);
      return {
        data,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      };
    }),
});
