import { TRPCError } from "@trpc/server";
import { and, eq, or, inArray } from "drizzle-orm";
import type { TrpcContext } from "./context";
import { customers } from "../../drizzle/schema";
import { extractCustomerToken, verifyCustomerToken } from "../routers/customerAuth";

export type CustomerPortalAccess = {
  tenantId: number;
  customerIds: number[];
  displayName: string;
  source: "oauth" | "local";
  lazyLinkedCount: number;
};

type ResolveOptions = {
  throwOnFailure?: boolean;
};

function failOrNull(options?: ResolveOptions, message = "Cliente não autenticado") {
  if (options?.throwOnFailure) {
    throw new TRPCError({ code: "UNAUTHORIZED", message });
  }
  return null;
}

/**
 * Resolve o cliente autenticado no portal público considerando os dois fluxos suportados:
 * OAuth/Manus (`ctx.user`) e login local do cliente (`customer_session`).
 *
 * O tenant resolvido pelo host continua sendo a fonte autoritativa. O `inputTenantId`
 * é aceito apenas como fallback para preview/testes, mantendo isolamento por tenant.
 */
export async function resolveCustomerPortalAccess(
  ctx: TrpcContext,
  db: any,
  inputTenantId?: number,
  options?: ResolveOptions,
): Promise<CustomerPortalAccess | null> {
  const resolvedTenantId = ctx.tenantFromHost?.id ?? inputTenantId ?? null;

  if (ctx.user) {
    if (!resolvedTenantId) return failOrNull(options, "Tenant não identificado");

    const conditions = [];
    if (ctx.user.openId) conditions.push(eq(customers.userOpenId, ctx.user.openId));
    if (ctx.user.email) conditions.push(eq(customers.email, ctx.user.email));
    if (conditions.length === 0) return failOrNull(options);

    const matchedCustomers = await db
      .select({ id: customers.id, email: customers.email, userOpenId: customers.userOpenId, name: customers.name })
      .from(customers)
      .where(and(eq(customers.tenantId, resolvedTenantId), or(...conditions)));

    if (matchedCustomers.length === 0) return failOrNull(options, "Cliente não encontrado neste tenant");

    const toLink = ctx.user.openId
      ? matchedCustomers.filter((customer: { userOpenId: string | null; email: string | null }) => !customer.userOpenId && customer.email)
      : [];

    if (ctx.user.openId && toLink.length > 0) {
      await db
        .update(customers)
        .set({ userOpenId: ctx.user.openId })
        .where(and(
          eq(customers.tenantId, resolvedTenantId),
          inArray(customers.id, toLink.map((customer: { id: number }) => customer.id)),
        ))
        .catch(() => { /* Vinculação lazy é best-effort. */ });
    }

    return {
      tenantId: resolvedTenantId,
      customerIds: matchedCustomers.map((customer: { id: number }) => customer.id),
      displayName: ctx.user.name ?? matchedCustomers[0]?.name ?? "Cliente",
      source: "oauth",
      lazyLinkedCount: toLink.length,
    };
  }

  const cookieHeader = ctx.req.headers.cookie ?? "";
  const token = extractCustomerToken(Array.isArray(cookieHeader) ? cookieHeader.join(";") : cookieHeader);
  if (!token) return failOrNull(options);

  const localSession = await verifyCustomerToken(token);
  if (!localSession) return failOrNull(options, "Sessão do cliente inválida");

  const tenantId = resolvedTenantId ?? localSession.tenantId;
  if (tenantId !== localSession.tenantId) {
    return failOrNull(options, "Sessão do cliente não pertence a este tenant");
  }

  const [customer] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(and(eq(customers.id, localSession.customerId), eq(customers.tenantId, tenantId)))
    .limit(1);

  if (!customer) return failOrNull(options, "Cliente não encontrado neste tenant");

  return {
    tenantId,
    customerIds: [customer.id],
    displayName: customer.name ?? "Cliente",
    source: "local",
    lazyLinkedCount: 0,
  };
}
