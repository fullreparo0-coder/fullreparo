import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import type { ResolvedTenant } from "./tenantResolver";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /**
   * Tenant resolvido pelo middleware `tenantResolverMiddleware` a partir do
   * hostname da requisição (subdomínio ou customDomain).
   * É `null` quando a requisição vem do domínio raiz ou de um host ignorado.
   */
  tenantFromHost: ResolvedTenant | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    // O middleware tenantResolverMiddleware popula req.resolvedTenant antes
    // que o contexto tRPC seja criado.
    tenantFromHost: (opts.req as any).resolvedTenant ?? null,
  };
}
