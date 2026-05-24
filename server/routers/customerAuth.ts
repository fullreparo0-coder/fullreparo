/**
 * customerAuth router — Fase 3
 *
 * Autenticação local para clientes sem conta Manus OAuth.
 * Usa um cookie separado `customer_session` para não interferir no fluxo OAuth.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { isValidCPF, onlyDigits } from "../../shared/cpfCnpj";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, or } from "drizzle-orm";
import { getDb } from "../db";
import { customers } from "../../drizzle/schema";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { ONE_YEAR_MS } from "@shared/const";

// ─── Constantes ──────────────────────────────────────────────────────────────

const CUSTOMER_COOKIE = "customer_session";
const BCRYPT_ROUNDS = 10;

// ─── Validação de senha ───────────────────────────────────────────────────────

/**
 * Valida os requisitos mínimos de senha.
 * Mesmas regras do frontend (ChangePassword.tsx) — validação dupla (client + server).
 */
function validatePasswordStrength(password: string): void {
  const errors: string[] = [];
  if (password.length < 8) errors.push("mínimo 8 caracteres");
  if (!/[A-Z]/.test(password)) errors.push("pelo menos 1 letra maiúscula");
  if (!/\d/.test(password)) errors.push("pelo menos 1 número");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("pelo menos 1 caractere especial");

  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `A senha não atende aos requisitos: ${errors.join(", ")}.`,
    });
  }
}

/**
 * Schema Zod reutilizável para nova senha com requisitos mínimos.
 * Sincronizado com PASSWORD_RULES do ChangePassword.tsx.
 */
const strongPasswordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .regex(/[A-Z]/, "A senha deve conter pelo menos 1 letra maiúscula")
  .regex(/\d/, "A senha deve conter pelo menos 1 número")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos 1 caractere especial");

// ─── Helpers JWT ─────────────────────────────────────────────────────────────

function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

async function signCustomerToken(payload: {
  customerId: number;
  tenantId: number;
}): Promise<string> {
  const expiresAt = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({
    sub: String(payload.customerId),
    tenantId: payload.tenantId,
    type: "customer_local",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expiresAt)
    .sign(getSecret());
}

export async function verifyCustomerToken(
  token: string
): Promise<{ customerId: number; tenantId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const customerId = Number(payload.sub);
    const tenantId = Number(payload.tenantId);
    if (!customerId || !tenantId || payload.type !== "customer_local") return null;
    return { customerId, tenantId };
  } catch {
    return null;
  }
}

export function extractCustomerToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(/customer_session=([^;]+)/);
  return match ? match[1] : null;
}

function getCustomerCookieOptions(req: any) {
  const host: string = req.hostname ?? req.headers?.host ?? "";
  const isPreview =
    host.includes("manus.computer") ||
    host.includes("manus.space") ||
    host === "localhost" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host);

  const parts = host.split(".");
  const domain =
    !isPreview && parts.length >= 2
      ? `.${parts.slice(-2).join(".")}`
      : undefined;

  const isSecure =
    req.secure || req.headers?.["x-forwarded-proto"] === "https";

  return {
    httpOnly: true,
    path: "/",
    domain,
    sameSite: isSecure ? ("none" as const) : ("lax" as const),
    secure: isSecure,
    maxAge: ONE_YEAR_MS / 1000,
  };
}

/** Gera uma senha provisória legível: 2 palavras + 2 dígitos */
export function generateProvisionalPassword(): string {
  const words = [
    "azul", "sol", "mar", "rio", "pato", "gato", "leao", "rosa",
    "lima", "ouro", "prata", "ferro", "cobre", "vidro", "pedra",
    "vento", "chuva", "neve", "fogo", "terra",
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(10 + Math.random() * 90));
  return `${pick()}${pick()}${digits}`;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const customerAuthRouter = router({
  /**
   * Auto-cadastro de cliente no portal do tenant.
   * Cria customer vinculado ao tenantId informado, com senha forte definida pelo próprio cliente.
   * CPF e e-mail são únicos por tenant.
   */
  registerLocal: publicProcedure
    .input(
      z.object({
        tenantId: z.number().int().positive(),
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres.").max(200),
        email: z.string().email("E-mail inválido.").toLowerCase().optional().or(z.literal("")),
        phone: z.string().min(10, "Telefone inválido.").max(20),
        document: z.string().optional().refine(
          (v) => !v || !v.trim() || isValidCPF(onlyDigits(v)),
          { message: "CPF inválido. Verifique os dígitos informados." }
        ), // CPF — opcional mas recomendado
        password: strongPasswordSchema,
        confirmPassword: z.string().min(1),
      }).refine((d) => d.password === d.confirmPassword, {
        message: "As senhas não conferem.",
        path: ["confirmPassword"],
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const { tenantId, name, email, phone, document, password } = input;

      // Normaliza CPF (apenas dígitos)
      const normalizedDoc = document ? document.replace(/\D/g, "") : undefined;
      const normalizedEmail = email && email.trim() !== "" ? email.trim().toLowerCase() : undefined;
      const normalizedPhone = phone.replace(/\D/g, "");

      // Verifica unicidade de CPF dentro do tenant
      if (normalizedDoc) {
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.tenantId, tenantId), eq(customers.document, normalizedDoc)))
          .limit(1);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe uma conta com este CPF. Faça login ou recupere sua senha.",
          });
        }
      }

      // Verifica unicidade de e-mail dentro do tenant
      if (normalizedEmail) {
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.tenantId, tenantId), eq(customers.email, normalizedEmail)))
          .limit(1);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe uma conta com este e-mail. Faça login ou recupere sua senha.",
          });
        }
      }

      validatePasswordStrength(password);
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const [result] = await db
        .insert(customers)
        .values({
          tenantId,
          name: name.trim(),
          email: normalizedEmail ?? null,
          phone: normalizedPhone,
          document: normalizedDoc ?? null,
          passwordHash,
          passwordMustChange: false,
          localLoginEnabled: true,
        });

      const customerId = (result as any).insertId as number;

      // Faz login automático após o cadastro
      const token = await signCustomerToken({ customerId, tenantId });
      ctx.res.cookie(CUSTOMER_COOKIE, token, getCustomerCookieOptions(ctx.req));

      return {
        success: true,
        customerId,
        name: name.trim(),
        role: "cliente" as const,
      };
    }),

  /**
   * Login com CPF/email + senha.
   * Aceita CPF (document) ou e-mail como identificador.
   */
  loginLocal: publicProcedure
    .input(
      z.object({
        tenantId: z.number().int().positive(),
        identifier: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tenantId, identifier, password } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      // Normaliza CPF (remove pontuação) ou e-mail (lowercase)
      const isCpf = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(identifier.trim());
      const normalizedId = isCpf
        ? identifier.replace(/\D/g, "")
        : identifier.toLowerCase().trim();

      const [customer] = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            or(
              eq(customers.document, normalizedId),
              eq(customers.email, normalizedId)
            )
          )
        )
        .limit(1);

      const INVALID_MSG = "CPF/e-mail ou senha inválidos.";

      if (!customer || !customer.localLoginEnabled || !customer.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_MSG });
      }

      const passwordMatch = await bcrypt.compare(password, customer.passwordHash);
      if (!passwordMatch) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_MSG });
      }

      await db
        .update(customers)
        .set({ lastLocalLoginAt: new Date() })
        .where(eq(customers.id, customer.id));

      const token = await signCustomerToken({
        customerId: customer.id,
        tenantId: customer.tenantId,
      });

      ctx.res.cookie(CUSTOMER_COOKIE, token, getCustomerCookieOptions(ctx.req));

      return {
        success: true,
        passwordMustChange: customer.passwordMustChange,
        customerId: customer.id,
        name: customer.name,
        // Clientes locais são sempre do tipo "cliente"
        role: "cliente" as const,
      };
    }),

  /** Logout — limpa o cookie de sessão local */
  logoutLocal: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(CUSTOMER_COOKIE, { path: "/", httpOnly: true });
    return { success: true };
  }),

  /** Retorna dados do cliente autenticado localmente */
  meLocal: publicProcedure.query(async ({ ctx }) => {
    const cookieHeader = ctx.req.headers.cookie ?? "";
    const token = extractCustomerToken(cookieHeader);
    if (!token) return null;

    const session = await verifyCustomerToken(token);
    if (!session) return null;

    const db = await getDb();
    if (!db) return null;

    const [customer] = await db
      .select({
                id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        document: customers.document,
        tenantId: customers.tenantId,
        passwordMustChange: customers.passwordMustChange,
        localLoginEnabled: customers.localLoginEnabled,
        // Endereço para pré-preencher formulários
        address: customers.address,
        addressNumber: customers.addressNumber,
        addressReference: customers.addressReference,
        neighborhood: customers.neighborhood,
        city: customers.city,
        state: customers.state,
        zipCode: customers.zipCode,
      })
      .from(customers)
      .where(
        and(
          eq(customers.id, session.customerId),
          eq(customers.tenantId, session.tenantId)
        )
      )
      .limit(1);
    return customer ?? null;
  }),
  /** Troca a senha do cliente autenticado localmente */
  changePassword: publicProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: strongPasswordSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const cookieHeader = ctx.req.headers.cookie ?? "";
      const token = extractCustomerToken(cookieHeader);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão não encontrada." });
      }

      const session = await verifyCustomerToken(token);
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão inválida." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, session.customerId))
        .limit(1);

      if (!customer || !customer.passwordHash) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
      }

      const currentMatch = await bcrypt.compare(
        input.currentPassword,
        customer.passwordHash
      );
      if (!currentMatch) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
      }

      // Validação dupla: Zod já validou via strongPasswordSchema, mas chamamos
      // validatePasswordStrength como camada extra de defesa (defense-in-depth).
      validatePasswordStrength(input.newPassword);

      const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

      await db
        .update(customers)
        .set({ passwordHash: newHash, passwordMustChange: false })
        .where(eq(customers.id, customer.id));

      return { success: true };
    }),

  /**
   * Gera senha provisória para um customer (tenant_admin / atendente).
   * Retorna a senha em texto claro para o atendente enviar ao cliente.
   */
  generateProvisionalPassword: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      if (!tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem tenant." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [customer] = await db
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
        })
        .from(customers)
        .where(
          and(
            eq(customers.id, input.customerId),
            eq(customers.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
      }

      const plainPassword = generateProvisionalPassword();
      const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

      await db
        .update(customers)
        .set({
          passwordHash: hash,
          passwordMustChange: true,
          localLoginEnabled: true,
        })
        .where(eq(customers.id, customer.id));

      return {
        success: true,
        plainPassword,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
      };
    }),

  /**
   * Solicita reset de senha ("Esqueci minha senha") — rota pública.
   * Gera nova senha provisória e retorna link WhatsApp pré-preenchido.
   * Resposta sempre genérica para não revelar se CPF/e-mail existe.
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        credential: z.string().min(1, "Informe o CPF, e-mail ou telefone."),
        tenantId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      // Se o banco estiver indisponível, retornamos sucesso genérico
      if (!db) return { success: true, whatsappUrl: null };

      const cred = input.credential.trim().toLowerCase();

      // Busca por e-mail, CPF (document) ou telefone dentro do tenant
      const [customer] = await db
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          localLoginEnabled: customers.localLoginEnabled,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, input.tenantId),
            or(
              eq(customers.email, cred),
              eq(customers.document, cred.replace(/\D/g, "")),
              eq(customers.phone, cred.replace(/\D/g, ""))
            )
          )
        )
        .limit(1);

      // Se não encontrou ou não tem acesso local, retorna genérico
      if (!customer || !customer.localLoginEnabled) {
        return { success: true, whatsappUrl: null };
      }

      const plainPassword = generateProvisionalPassword();
      const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

      await db
        .update(customers)
        .set({ passwordHash: hash, passwordMustChange: true })
        .where(eq(customers.id, customer.id));

      // Monta link WhatsApp se tiver telefone cadastrado
      let whatsappUrl: string | null = null;
      if (customer.phone) {
        const phone = String(customer.phone).replace(/\D/g, "");
        const msg = encodeURIComponent(
          `Olá ${customer.name}! Sua nova senha de acesso ao portal é: *${plainPassword}*. Acesse e troque sua senha no primeiro login.`
        );
        whatsappUrl = `https://wa.me/55${phone}?text=${msg}`;
      }

      return { success: true, whatsappUrl };
    }),

  /**
   * Reenvia (regera) a senha provisória para um customer.
   */
  resendProvisionalPassword: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      if (!tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem tenant." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [customer] = await db
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          localLoginEnabled: customers.localLoginEnabled,
        })
        .from(customers)
        .where(
          and(
            eq(customers.id, input.customerId),
            eq(customers.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
      }

      const plainPassword = generateProvisionalPassword();
      const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

      await db
        .update(customers)
        .set({
          passwordHash: hash,
          passwordMustChange: true,
          localLoginEnabled: true,
        })
        .where(eq(customers.id, customer.id));

      return {
        success: true,
        plainPassword,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
      };
    }),

  /**
   * Retorna o perfil do cliente autenticado via cookie customer_session.
   * Usado para pré-preencher formulários (coleta, cadastro de OS) e exibir /minha-conta.
   */
  getMyProfile: publicProcedure.query(async ({ ctx }) => {
    const token = ctx.req.cookies?.[CUSTOMER_COOKIE];
    if (!token) return null;
    const payload = await verifyCustomerToken(token);
    if (!payload) return null;

    const db = await getDb();
    if (!db) return null;

    const [customer] = await db
      .select({
        id: customers.id,
        tenantId: customers.tenantId,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        document: customers.document,
        address: customers.address,
        addressNumber: customers.addressNumber,
        addressReference: customers.addressReference,
        neighborhood: customers.neighborhood,
        city: customers.city,
        state: customers.state,
        zipCode: customers.zipCode,
        passwordMustChange: customers.passwordMustChange,
      })
      .from(customers)
      .where(eq(customers.id, payload.customerId))
      .limit(1);

    return customer ?? null;
  }),

  /**
   * Atualiza os dados do perfil do cliente autenticado.
   * Valida unicidade de CPF e e-mail dentro do tenant.
   */
  updateMyProfile: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres.").max(200),
        email: z.string().email("E-mail inválido.").toLowerCase().optional().or(z.literal("")),
        phone: z.string().min(10, "Telefone inválido.").max(20),
        document: z.string().optional().refine(
          (v) => !v || !v.trim() || isValidCPF(onlyDigits(v)),
          { message: "CPF inválido." }
        ),
        address: z.string().optional(),
        addressNumber: z.string().max(20).optional(),
        addressReference: z.string().max(200).optional(),
        neighborhood: z.string().max(100).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(2).optional(),
        zipCode: z.string().max(10).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = ctx.req.cookies?.[CUSTOMER_COOKIE];
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado." });
      const payload = await verifyCustomerToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão inválida." });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const { customerId, tenantId } = payload;
      const normalizedDoc = input.document ? onlyDigits(input.document) : undefined;
      const normalizedEmail = input.email && input.email.trim() !== "" ? input.email.trim().toLowerCase() : undefined;
      const normalizedPhone = input.phone.replace(/\D/g, "");

      // Unicidade de CPF (exceto o próprio)
      if (normalizedDoc) {
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.tenantId, tenantId), eq(customers.document, normalizedDoc)))
          .limit(1);
        if (existing && existing.id !== customerId) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este CPF." });
        }
      }

      // Unicidade de e-mail (exceto o próprio)
      if (normalizedEmail) {
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.tenantId, tenantId), eq(customers.email, normalizedEmail)))
          .limit(1);
        if (existing && existing.id !== customerId) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });
        }
      }

      await db
        .update(customers)
        .set({
          name: input.name.trim(),
          email: normalizedEmail ?? null,
          phone: normalizedPhone,
          document: normalizedDoc ?? null,
          address: input.address?.trim() ?? null,
          addressNumber: input.addressNumber?.trim() ?? null,
          addressReference: input.addressReference?.trim() ?? null,
          neighborhood: input.neighborhood?.trim() ?? null,
          city: input.city?.trim() ?? null,
          state: input.state?.trim() ?? null,
          zipCode: input.zipCode?.replace(/\D/g, "") ?? null,
        })
        .where(eq(customers.id, customerId));

      return { success: true };
    }),
});
