import { TRPCError } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb, getTenantById, getTenantBySlug, getAllTenants } from "../db";
import { tenants, plans, users } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { and, eq, gt, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { buildTrialEndsAt, getTenantSubscriptionSnapshot, notifyPlanSelected } from "../_core/subscription";
import { storagePut } from "../storage";
import { sanitizePagarmeConfig } from "../_core/pagarme";
import { sanitizeUberDirectConfig } from "../_core/uberDirect";
import { validatePassword } from "../../shared/passwordRules";

// Valida CNPJ
function isValidCNPJ(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, "");
  if (n.length !== 14) return false;
  if (/^(\d)\1+$/.test(n)) return false;
  const calc = (len: number) => {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n.charAt(len - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return r === parseInt(n.charAt(len));
  };
  return calc(12) && calc(13);
}

// Valida CPF
function isValidCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11) return false;
  if (/^(\d)\1+$/.test(n)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(n.charAt(i)) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return (r === 10 || r === 11 ? 0 : r) === parseInt(n.charAt(len));
  };
  return calc(9) && calc(10);
}

// Gera slug a partir do nome: remove acentos, converte para minúsculas, substitui espaços por hífens
function generateSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function generateTenantProvisionalPassword(): string {
  const words = [
    "Azul", "Solar", "Reparo", "Oficina", "Tecnico", "Seguro",
    "Painel", "Acesso", "Portal", "Cliente", "Rapido", "Central",
  ];
  const word = words[crypto.randomInt(0, words.length)];
  const digits = crypto.randomInt(100, 1000);
  return `FR-${word}-${digits}!`;
}

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "super_admin" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao super admin" });
  }
  return next({ ctx });
});

const tenantAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowed = ["super_admin", "admin", "tenant_admin"];
  if (!allowed.includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const tenantsRouter = router({
  // Listar todos os tenants (super admin)
  list: superAdminProcedure.query(async () => {
    return getAllTenants();
  }),

  // Cadastro público de nova assistência (sem autenticação)
  register: publicProcedure
    .input(
      z.object({
        // Dados da empresa
        name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
        document: z.string().min(11, "Documento obrigatório (CPF ou CNPJ)"),
        email: z.string().email("E-mail inválido"),
        phone: z.string().min(8, "Telefone inválido"),
        addressStreet: z.string().min(3, "Rua é obrigatória"),
        addressNumber: z.string().min(1, "Número é obrigatório"),
        addressNeighborhood: z.string().optional(),
        addressReference: z.string().optional(),
        city: z.string().min(2, "Cidade é obrigatória"),
        state: z.string().length(2, "Estado (UF) é obrigatório"),
        zipCode: z.string().min(8, "CEP é obrigatório"),
        password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
        confirmPassword: z.string().min(8, "Confirmação de senha é obrigatória"),
        // Plano escolhido
        planId: z.number().optional(),
        // Slug personalizado (opcional — gerado automaticamente se omitido)
        slug: z
          .string()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens")
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });

      if (input.password !== input.confirmPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A confirmação de senha não confere." });
      }

      const passwordErrors = validatePassword(input.password);
      if (passwordErrors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A senha deve conter: ${passwordErrors.join(", ")}.`,
        });
      }

      // Validar CNPJ/CPF se fornecido
      if (input.document) {
        const digits = input.document.replace(/\D/g, "");
        if (digits.length === 11 && !isValidCPF(digits)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "CPF inválido. Verifique os dígitos informados." });
        }
        if (digits.length === 14 && !isValidCNPJ(digits)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "CNPJ inválido. Verifique os dígitos informados." });
        }
        if (digits.length !== 11 && digits.length !== 14) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." });
        }
      }

      // Gerar slug base a partir do nome
      const baseSlug = input.slug ?? generateSlug(input.name);

      // Garantir unicidade do slug (adiciona sufixo numérico se necessário)
      let finalSlug = baseSlug;
      let attempt = 0;
      while (true) {
        const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, finalSlug)).limit(1);
        if (existing.length === 0) break;
        attempt++;
        finalSlug = `${baseSlug}-${attempt}`;
        if (attempt > 99) throw new TRPCError({ code: "CONFLICT", message: "Não foi possível gerar um slug único. Tente um nome diferente." });
      }

      // Verificar e-mail duplicado no cadastro de assistência e no login administrativo.
      const normalizedEmail = input.email.trim().toLowerCase();
      const emailExists = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.email, normalizedEmail)).limit(1);
      if (emailExists.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe uma assistência cadastrada com este e-mail." });
      }

      const userEmailExists = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
      if (userEmailExists.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário administrativo cadastrado com este e-mail." });
      }

      const requestedPlanId = input.planId ?? 1;
      const [selectedPlan] = await db
        .select({ id: plans.id, name: plans.name, isActive: plans.isActive })
        .from(plans)
        .where(eq(plans.id, requestedPlanId))
        .limit(1);
      if (!selectedPlan || !selectedPlan.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plano selecionado inválido ou indisponível." });
      }

      const trialEndsAt = buildTrialEndsAt();
      const addressParts = [
        `${input.addressStreet.trim()}, Nº ${input.addressNumber.trim()}`,
        input.addressNeighborhood?.trim() ? `Bairro ${input.addressNeighborhood.trim()}` : null,
        input.addressReference?.trim() ? `Ref.: ${input.addressReference.trim()}` : null,
      ].filter(Boolean);
      const fullAddress = addressParts.join(" - ");

      // Inserir tenant em teste grátis com o plano selecionado no cadastro público.
      const result = await db.insert(tenants).values({
        name: input.name.trim(),
        slug: finalSlug,
        document: input.document,
        email: normalizedEmail,
        phone: input.phone,
        address: fullAddress,
        city: input.city.trim(),
        state: input.state,
        zipCode: input.zipCode,
        planId: requestedPlanId,
        status: "trial",
        trialEndsAt,
        subscriptionEndsAt: null,
      });

      const tenantId = Number((result as any)[0]?.insertId ?? (result as any).insertId);
      if (!tenantId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir o cadastro da assistência." });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      await db.insert(users).values({
        openId: `local_tenant_${tenantId}_${crypto.randomBytes(12).toString("hex")}`,
        tenantId,
        name: input.name.trim(),
        email: normalizedEmail,
        phone: input.phone,
        loginMethod: "local",
        role: "tenant_admin",
        isActive: true,
        passwordHash,
        localLoginEnabled: true,
      });

      // Notificar super admin (não bloqueia o cadastro se falhar)
      try {
        await notifyOwner({
          title: `Nova assistência cadastrada: ${input.name}`,
          content: `Uma nova assistência técnica se cadastrou no fullreparo.\n\n**Nome:** ${input.name}\n**E-mail:** ${normalizedEmail}\n**Telefone:** ${input.phone}\n**Endereço:** ${fullAddress}\n**Cidade:** ${input.city ?? "—"} / ${input.state ?? "—"}\n**Slug:** ${finalSlug}\n**Plano:** ${selectedPlan.name}\n**Teste até:** ${trialEndsAt.toLocaleString("pt-BR")}\n\nAcesse o painel super admin para gerenciar.`,
        });
      } catch {
        // Falha silenciosa — cadastro já foi criado
      }

      await notifyPlanSelected({
        tenantName: input.name,
        tenantEmail: normalizedEmail,
        tenantSlug: finalSlug,
        planName: selectedPlan.name,
        trialEndsAt,
        selectedBy: "tenant",
      }).catch(() => undefined);

      // Gerar claimToken para ativação da conta pelo dono
      const claimToken = crypto.randomBytes(32).toString("hex");
      const claimExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 horas

      await db
        .update(tenants)
        .set({ claimToken, claimExpiresAt })
        .where(eq(tenants.id, tenantId));

      return {
        success: true,
        tenantId,
        slug: finalSlug,
        name: input.name,
        claimToken,
        planName: selectedPlan.name,
        trialEndsAt: trialEndsAt.getTime(),
        loginUrl: "/login",
        dashboardUrl: "/painel/dashboard",
        message: "Assistência cadastrada com sucesso! Use o e-mail e a senha cadastrados para acessar o painel.",
      };
    }),

  // Ativar conta do dono: vincula user.tenantId ao tenant via claimToken
  claimTenant: protectedProcedure
    .input(z.object({ claimToken: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço indisponível" });

      // Buscar tenant com token válido e não expirado
      const now = new Date();
      const [tenant] = await db
        .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
        .from(tenants)
        .where(and(eq(tenants.claimToken, input.claimToken), gt(tenants.claimExpiresAt, now)))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Link de ativação inválido ou expirado. Solicite um novo cadastro ou entre em contato com o suporte.",
        });
      }

      // Não permitir que um usuário já vinculado a outro tenant reivindique
      if (ctx.user.tenantId && ctx.user.tenantId !== tenant.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Sua conta já está vinculada a outra assistência técnica.",
        });
      }

      // Vincular usuário ao tenant e promover a tenant_admin
      await db
        .update(users)
        .set({ tenantId: tenant.id, role: "tenant_admin" })
        .where(eq(users.id, ctx.user.id));

      // Limpar claimToken para evitar reutilização
      await db
        .update(tenants)
        .set({ claimToken: null, claimExpiresAt: null })
        .where(eq(tenants.id, tenant.id));

      return {
        success: true,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        message: `Conta ativada com sucesso! Bem-vindo ao painel da ${tenant.name}.`,
      };
    }),

  // Verificar disponibilidade de slug (público)
  checkSlug: publicProcedure
    .input(z.object({ slug: z.string().min(2).regex(/^[a-z0-9-]+$/) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { available: true };
      const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, input.slug)).limit(1);
      return { available: existing.length === 0 };
    }),

  // Listar planos públicos para a página de cadastro
  listPublicPlans: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(plans).where(and(eq(plans.isActive, true), eq(plans.isPublic, true)));
  }),

  // Obter tenant do usuário logado
  getMine: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.tenantId) return null;
    await getTenantSubscriptionSnapshot(ctx.user.tenantId);
    return getTenantById(ctx.user.tenantId);
  }),

  // Criar tenant (super admin)
  create: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        planId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verificar slug único
      const existing = await db.select().from(tenants).where(eq(tenants.slug, input.slug)).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Slug já em uso" });
      const planId = input.planId ?? 1;
      const [selectedPlan] = await db.select({ id: plans.id, name: plans.name }).from(plans).where(eq(plans.id, planId)).limit(1);
      if (!selectedPlan) throw new TRPCError({ code: "BAD_REQUEST", message: "Plano inválido" });
      const result = await db.insert(tenants).values({
        name: input.name,
        slug: input.slug,
        email: input.email || undefined,
        phone: input.phone,
        planId,
        status: "active",
        trialEndsAt: null,
      });
      const tenantId = Number((result as any)[0]?.insertId ?? (result as any).insertId);
      await notifyPlanSelected({
        tenantName: input.name,
        tenantEmail: input.email || undefined,
        tenantSlug: input.slug,
        planName: selectedPlan.name,
        trialEndsAt: null,
        selectedBy: "super_admin",
      }).catch(() => undefined);
      return { id: tenantId, success: true };
    }),

  // Atualizar status do tenant (super admin)
  toggleStatus: superAdminProcedure
    .input(z.object({ id: z.number(), status: z.enum(["active", "blocked", "suspended", "trial"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [tenant] = await db
        .select({ name: tenants.name, email: tenants.email, slug: tenants.slug, planName: plans.name })
        .from(tenants)
        .innerJoin(plans, eq(tenants.planId, plans.id))
        .where(eq(tenants.id, input.id))
        .limit(1);
      await db.update(tenants).set({ status: input.status }).where(eq(tenants.id, input.id));
      if (tenant) {
        await notifyOwner({
          title: `Status de assinatura alterado: ${tenant.name}`,
          content: `**Assistência:** ${tenant.name}\n**Plano:** ${tenant.planName}\n**Novo status:** ${input.status}\n**Origem:** Super admin`,
        }).catch(() => false);
      }
      return { success: true };
    }),

  // Ativar Plano Beta para um tenant (super admin)
  activateBetaPlan: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [tenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          email: tenants.email,
          slug: tenants.slug,
          currentPlanId: tenants.planId,
        })
        .from(tenants)
        .where(eq(tenants.id, input.id))
        .limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Assistência não encontrada" });

      const [betaPlan] = await db
        .select({ id: plans.id, name: plans.name })
        .from(plans)
        .where(and(eq(plans.slug, "beta"), eq(plans.isActive, true)))
        .limit(1);
      if (!betaPlan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plano Beta não encontrado ou inativo. Crie/ative o Plano Beta em Super Admin → Planos.",
        });
      }

      await db
        .update(tenants)
        .set({
          planId: betaPlan.id,
          status: "active",
          trialEndsAt: null,
          subscriptionEndsAt: null,
        })
        .where(eq(tenants.id, input.id));

      if (tenant.currentPlanId !== betaPlan.id) {
        await notifyPlanSelected({
          tenantName: tenant.name,
          tenantEmail: tenant.email || undefined,
          tenantSlug: tenant.slug,
          planName: betaPlan.name,
          trialEndsAt: null,
          selectedBy: "super_admin",
        }).catch(() => undefined);
      }

      return { success: true, planId: betaPlan.id, planName: betaPlan.name };
    }),

  // Obter detalhes completos de um tenant (super admin)
  getById: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const tenant = await getTenantById(input.id);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Assistência não encontrada" });

      // Buscar métricas básicas
      const [userCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.tenantId, input.id))
        .execute() as any;
      
      // Nota: Em um sistema real, buscaríamos contagem de OS, etc.
      // Por simplicidade, vamos retornar o que temos no schema
      
      return {
        ...tenant,
        metrics: {
          users: userCount?.count ?? 0,
          // Adicione outras métricas conforme necessário
        }
      };
    }),

  // Atualizar dados de um tenant (super admin)
  update: superAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string(),
      document: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      planId: z.number().optional(),
      status: z.enum(["active", "blocked", "suspended", "trial"]).optional(),
      trialEndsAt: z.number().nullable().optional(),
      subscriptionEndsAt: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const { id, trialEndsAt, subscriptionEndsAt, ...data } = input;
      const [before] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          email: tenants.email,
          slug: tenants.slug,
          planId: tenants.planId,
          status: tenants.status,
          trialEndsAt: tenants.trialEndsAt,
          subscriptionEndsAt: tenants.subscriptionEndsAt,
          planName: plans.name,
        })
        .from(tenants)
        .innerJoin(plans, eq(tenants.planId, plans.id))
        .where(eq(tenants.id, id))
        .limit(1);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Assistência não encontrada" });

      const updates: any = { ...data };
      if (trialEndsAt !== undefined) updates.trialEndsAt = trialEndsAt === null ? null : new Date(trialEndsAt);
      if (subscriptionEndsAt !== undefined) updates.subscriptionEndsAt = subscriptionEndsAt === null ? null : new Date(subscriptionEndsAt);

      await db.update(tenants).set(updates).where(eq(tenants.id, id));

      if (data.planId && data.planId !== before.planId) {
        const [newPlan] = await db.select({ name: plans.name }).from(plans).where(eq(plans.id, data.planId)).limit(1);
        await notifyPlanSelected({
          tenantName: data.name || before.name,
          tenantEmail: data.email || before.email,
          tenantSlug: before.slug,
          planName: newPlan?.name ?? `Plano ${data.planId}`,
          trialEndsAt: updates.trialEndsAt ?? before.trialEndsAt,
          selectedBy: "super_admin",
        }).catch(() => undefined);
      } else if (data.status && data.status !== before.status) {
        await notifyOwner({
          title: `Status de assinatura alterado: ${before.name}`,
          content: `**Assistência:** ${before.name}\n**Plano:** ${before.planName}\n**Status anterior:** ${before.status}\n**Novo status:** ${data.status}\n**Origem:** Super admin`,
        }).catch(() => false);
      }
      
      return { success: true };
    }),

  // Super admin seleciona um tenant para operar como tenant_admin
  switchTenant: superAdminProcedure
    .input(z.object({ tenantId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verificar que o tenant existe
      const tenant = await getTenantById(input.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado" });
      // Atualizar o tenantId do super_admin no banco
      await db.update(users).set({ tenantId: input.tenantId }).where(eq(users.id, ctx.user.id));
      return { success: true, tenantId: input.tenantId, tenantName: tenant.name };
    }),

  // Gerar senha provisória para o administrador da assistência (super admin)
  generateTenantAdminProvisionalPassword: superAdminProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [tenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          email: tenants.email,
          phone: tenants.phone,
        })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assistência não encontrada." });
      }

      const tenantEmail = tenant.email?.trim().toLowerCase() || null;
      const [adminUser] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(and(eq(users.tenantId, tenant.id), eq(users.role, "tenant_admin")))
        .limit(1);

      if (!adminUser && !tenantEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta assistência não possui e-mail cadastrado para criar o login administrativo.",
        });
      }

      const plainPassword = generateTenantProvisionalPassword();
      const passwordErrors = validatePassword(plainPassword);
      if (passwordErrors.length > 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Não foi possível gerar uma senha provisória compatível com a política de segurança.",
        });
      }
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      const adminEmail = (adminUser?.email?.trim().toLowerCase() || tenantEmail)!;
      const adminName = adminUser?.name?.trim() || tenant.name;
      const adminPhone = adminUser?.phone || tenant.phone || null;

      if (adminUser) {
        await db
          .update(users)
          .set({
            email: adminEmail,
            passwordHash,
            localLoginEnabled: true,
            isActive: true,
            loginMethod: "local",
          })
          .where(eq(users.id, adminUser.id));
      } else {
        await db.insert(users).values({
          openId: `local_tenant_${tenant.id}_${crypto.randomBytes(12).toString("hex")}`,
          tenantId: tenant.id,
          name: adminName,
          email: adminEmail,
          phone: adminPhone ?? undefined,
          loginMethod: "local",
          role: "tenant_admin",
          isActive: true,
          passwordHash,
          localLoginEnabled: true,
        });
      }

      await notifyOwner({
        title: `Senha provisória gerada: ${tenant.name}`,
        content: `O super admin ${ctx.user.email ?? ctx.user.name ?? "—"} gerou uma senha provisória para o administrador da assistência.\n\n**Assistência:** ${tenant.name}\n**E-mail de login:** ${adminEmail}\n**Slug:** ${tenant.slug}`,
      }).catch(() => false);

      return {
        success: true,
        tenantId: tenant.id,
        tenantName: tenant.name,
        adminName,
        adminEmail,
        plainPassword,
        loginUrl: "/login",
        message: "Senha provisória gerada com sucesso. Informe esta senha ao administrador da assistência e oriente a troca após o acesso.",
      };
    }),

  // Upload de logotipo do tenant
  uploadLogo: tenantAdminProcedure
    .input(
      z.object({
        // dataURL base64 da imagem (ex: "data:image/png;base64,...")
        // base64 tem overhead ~33%, então 2MB de binário = ~2.73MB de base64
        dataUrl: z.string().min(10).max(3_000_000, "Imagem muito grande"),
        mimeType: z
          .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
          .refine((v) => ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(v), {
            message: "Formato inválido. Use PNG, JPG ou WebP.",
          }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });

      // Decodificar base64
      const base64Data = input.dataUrl.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Validar tamanho (2 MB)
      if (buffer.byteLength > 2 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Imagem muito grande. Máximo 2 MB." });
      }

      const ext = input.mimeType.split("/")[1];
      const key = `tenants/${ctx.user.tenantId}/logo.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      await db.update(tenants).set({ logoUrl: url }).where(eq(tenants.id, ctx.user.tenantId));

      return { success: true, logoUrl: url };
    }),

  // Remover logotipo do tenant
  removeLogo: tenantAdminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
    await db.update(tenants).set({ logoUrl: null }).where(eq(tenants.id, ctx.user.tenantId));
    return { success: true };
  }),

  // Atualizar domínio personalizado do tenant
  updateCustomDomain: tenantAdminProcedure
    .input(
      z.object({
        customDomain: z
          .string()
          .min(4, "Domínio muito curto")
          .max(253, "Domínio muito longo")
          .regex(
            /^(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i,
            "Formato de domínio inválido. Ex: rochacelulares.com.br"
          )
          .transform((d) => d.toLowerCase().trim()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });

      const domain = input.customDomain;

      // Rejeitar subdomínios do próprio SaaS
      if (/\.fullreparo\.com\.br$/i.test(domain) || domain === "fullreparo.com.br") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não é possível usar um subdomínio do fullreparo como domínio personalizado.",
        });
      }

      // Verificar unicidade (outro tenant já usa este domínio)
      const existing = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(and(eq(tenants.customDomain, domain)))
        .limit(1);
      if (existing.length > 0 && existing[0]!.id !== ctx.user.tenantId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este domínio já está em uso por outra assistência.",
        });
      }

      await db
        .update(tenants)
        .set({ customDomain: domain })
        .where(eq(tenants.id, ctx.user.tenantId));

      return { success: true, customDomain: domain };
    }),

  // Remover domínio personalizado do tenant
  removeCustomDomain: tenantAdminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
    await db
      .update(tenants)
      .set({ customDomain: null })
      .where(eq(tenants.id, ctx.user.tenantId));
    return { success: true };
  }),

  // Atualizar e-mail de notificações do tenant
  updateNotificationEmail: tenantAdminProcedure
    .input(
      z.object({
        notificationEmail: z
          .string()
          .max(320)
          .optional()
          .or(z.literal(""))
          .transform((v) => (v === "" ? null : v ?? null))
          .refine((v) => v === null || /^[^@]+@[^@]+\.[^@]+$/.test(v), "E-mail inválido"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(tenants)
        .set({ notificationEmail: input.notificationEmail })
        .where(eq(tenants.id, ctx.user.tenantId));
      return { success: true, notificationEmail: input.notificationEmail };
    }),

  // Buscar especialidades (tipos e marcas) do tenant atual
  getSpecialties: tenantAdminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return {} as Record<string, string[]>;
    if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
    const [tenant] = await db
      .select({ deviceSpecialties: tenants.deviceSpecialties })
      .from(tenants)
      .where(eq(tenants.id, ctx.user.tenantId))
      .limit(1);
    if (!tenant?.deviceSpecialties) return {} as Record<string, string[]>;
    try {
      return JSON.parse(tenant.deviceSpecialties) as Record<string, string[]>;
    } catch {
      return {} as Record<string, string[]>;
    }
  }),

  // Salvar especialidades (tipos e marcas) do tenant
  updateSpecialties: tenantAdminProcedure
    .input(
      z.object({
        specialties: z.record(z.string(), z.array(z.string())),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(tenants)
        .set({ deviceSpecialties: JSON.stringify(input.specialties) })
        .where(eq(tenants.id, ctx.user.tenantId));
      return { success: true };
    }),

  // Atualizar configurações do próprio tenant
  updateMine: tenantAdminProcedure
    .input(
      z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        whatsappNumber: z.string().optional(),
        businessHours: z.string().max(2000).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        logoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(tenants).set(input).where(eq(tenants.id, ctx.user.tenantId));
      return { success: true };
    }),

  // Salvar/atualizar configuração de notificações de status ao cliente
  updateNotifyStatuses: tenantAdminProcedure
    .input(
      z.object({
        notifyStatuses: z.array(z.string()),
        // Mapa de status → mensagem customizada (opcional por status)
        notifyMessages: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(tenants)
        .set({
          notifyStatuses: JSON.stringify(input.notifyStatuses),
          notifyMessages: input.notifyMessages ? JSON.stringify(input.notifyMessages) : null,
        })
        .where(eq(tenants.id, ctx.user.tenantId));
      return { success: true };
    }),


  getPagarmeConfig: tenantAdminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
    const [tenant] = await db
      .select({
        pagarmeEnabled: tenants.pagarmeEnabled,
        pagarmeEnvironment: tenants.pagarmeEnvironment,
        pagarmePublicKey: tenants.pagarmePublicKey,
        pagarmeSecretKey: tenants.pagarmeSecretKey,
        pagarmeWebhookSecret: tenants.pagarmeWebhookSecret,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.user.tenantId))
      .limit(1);
    return sanitizePagarmeConfig({
      enabled: Boolean(tenant?.pagarmeEnabled),
      environment: tenant?.pagarmeEnvironment || "sandbox",
      publicKey: tenant?.pagarmePublicKey || null,
      secretKey: tenant?.pagarmeSecretKey || null,
      webhookSecret: tenant?.pagarmeWebhookSecret || null,
    });
  }),

  updatePagarmeConfig: tenantAdminProcedure
    .input(z.object({
      enabled: z.boolean(),
      environment: z.enum(["sandbox", "production"]).default("sandbox"),
      publicKey: z.string().max(255).optional().nullable(),
      secretKey: z.string().max(500).optional().nullable(),
      webhookSecret: z.string().max(255).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      const [current] = await db
        .select({
          pagarmePublicKey: tenants.pagarmePublicKey,
          pagarmeSecretKey: tenants.pagarmeSecretKey,
          pagarmeWebhookSecret: tenants.pagarmeWebhookSecret,
        })
        .from(tenants)
        .where(eq(tenants.id, ctx.user.tenantId))
        .limit(1);
      const publicKey = input.publicKey?.trim() || current?.pagarmePublicKey || null;
      const secretKey = input.secretKey?.trim() || current?.pagarmeSecretKey || null;
      const webhookSecret = input.webhookSecret?.trim() || current?.pagarmeWebhookSecret || null;
      await db.update(tenants).set({
        pagarmeEnabled: input.enabled,
        pagarmeEnvironment: input.environment,
        pagarmePublicKey: publicKey,
        pagarmeSecretKey: secretKey,
        pagarmeWebhookSecret: webhookSecret,
      } as any).where(eq(tenants.id, ctx.user.tenantId));
      await notifyOwner({ title: "Configuração Pagar.me atualizada", content: input.enabled ? "O Pagar.me foi habilitado/atualizado para PIX e cartão no pagamento do cliente." : "O Pagar.me foi desabilitado no console da assistência." }).catch(() => undefined);
      return { success: true };
    }),

  getUberDirectConfig: tenantAdminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
    const [tenant] = await db
      .select({
        ownDeliveryEnabled: tenants.ownDeliveryEnabled,
        uberDirectEnabled: tenants.uberDirectEnabled,
        uberDirectEnvironment: tenants.uberDirectEnvironment,
        uberDirectCustomerId: tenants.uberDirectCustomerId,
        uberDirectClientId: tenants.uberDirectClientId,
        uberDirectClientSecret: tenants.uberDirectClientSecret,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.user.tenantId))
      .limit(1);
    return sanitizeUberDirectConfig({
      ownDeliveryEnabled: tenant?.ownDeliveryEnabled ?? true,
      enabled: Boolean(tenant?.uberDirectEnabled),
      environment: tenant?.uberDirectEnvironment || "sandbox",
      customerId: tenant?.uberDirectCustomerId || null,
      clientId: tenant?.uberDirectClientId || null,
      clientSecret: tenant?.uberDirectClientSecret || null,
    });
  }),

  updateUberDirectConfig: tenantAdminProcedure
    .input(z.object({
      ownDeliveryEnabled: z.boolean().default(true),
      enabled: z.boolean(),
      environment: z.enum(["sandbox", "production"]).default("sandbox"),
      customerId: z.string().max(128).optional().nullable(),
      clientId: z.string().max(255).optional().nullable(),
      clientSecret: z.string().max(1000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });

      const [current] = await db
        .select({
          uberDirectCustomerId: tenants.uberDirectCustomerId,
          uberDirectClientId: tenants.uberDirectClientId,
          uberDirectClientSecret: tenants.uberDirectClientSecret,
        })
        .from(tenants)
        .where(eq(tenants.id, ctx.user.tenantId))
        .limit(1);

      const customerId = input.customerId?.trim() || current?.uberDirectCustomerId || null;
      const clientId = input.clientId?.trim() || current?.uberDirectClientId || null;
      const clientSecret = input.clientSecret?.trim() || current?.uberDirectClientSecret || null;

      if (input.enabled && (!customerId || !clientId || !clientSecret)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe Customer ID, Client ID e Client Secret para ativar o Uber Direct.",
        });
      }

      await db.update(tenants).set({
        ownDeliveryEnabled: input.ownDeliveryEnabled,
        uberDirectEnabled: input.enabled,
        uberDirectEnvironment: input.environment,
        uberDirectCustomerId: customerId,
        uberDirectClientId: clientId,
        uberDirectClientSecret: clientSecret,
      } as any).where(eq(tenants.id, ctx.user.tenantId));

      await notifyOwner({
        title: "Configuração Uber Direct atualizada",
        content: input.enabled ? "O Uber Direct foi habilitado/atualizado como opção logística da assistência." : "O Uber Direct foi desabilitado no painel da assistência.",
      }).catch(() => undefined);

      return { success: true };
    }),

  // Buscar configuração de notificações do tenant (statuses ativos + mensagens customizadas)
  getNotifyConfig: tenantAdminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { notifyStatuses: [] as string[], notifyMessages: {} as Record<string, string> };
    if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
    const [tenant] = await db
      .select({ notifyStatuses: tenants.notifyStatuses, notifyMessages: tenants.notifyMessages })
      .from(tenants)
      .where(eq(tenants.id, ctx.user.tenantId))
      .limit(1);
    const statuses: string[] = tenant?.notifyStatuses ? (() => { try { return JSON.parse(tenant.notifyStatuses); } catch { return []; } })() : [];
    const messages: Record<string, string> = tenant?.notifyMessages ? (() => { try { return JSON.parse(tenant.notifyMessages); } catch { return {}; } })() : {};
    return { notifyStatuses: statuses, notifyMessages: messages };
  }),

  // Salvar/atualizar prazos de coleta por prefixo de CEP
  updateCoverageDeadlines: tenantAdminProcedure
    .input(
      z.object({
        // mapa de prefixo → prazo em horas (ex: {"01": 2, "04": 4, "default": 24})
        deadlines: z.record(z.string(), z.number().int().min(1).max(720)),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(tenants)
        .set({ coverageDeadlines: JSON.stringify(input.deadlines) })
        .where(eq(tenants.id, ctx.user.tenantId));
      return { success: true };
    }),

  // Salvar/atualizar prefixos de CEP cobertos pelo tenant
  updateCoverage: tenantAdminProcedure
    .input(
      z.object({
        coverageZipPrefixes: z.array(z.string().min(1).max(8)).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(tenants)
        .set({ coverageZipPrefixes: JSON.stringify(input.coverageZipPrefixes) })
        .where(eq(tenants.id, ctx.user.tenantId));
      return { success: true };
    }),

  // Salvar/atualizar o texto de boas-vindas do hero do portal público
  updateWelcomeText: tenantAdminProcedure
    .input(z.object({ welcomeText: z.string().max(300) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(tenants)
        .set({ welcomeText: input.welcomeText.trim() || null } as any)
        .where(eq(tenants.id, ctx.user.tenantId));
      return { success: true };
    }),

  // Salvar/atualizar os termos do tenant (serviço e garantia)
  updateTerms: tenantAdminProcedure
    .input(z.object({
      serviceTerms: z.string().optional(),
      warrantyTerms: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
      const updates: Record<string, string | null> = {};
      if (input.serviceTerms !== undefined) updates.serviceTerms = input.serviceTerms.trim() || null;
      if (input.warrantyTerms !== undefined) updates.warrantyTerms = input.warrantyTerms.trim() || null;
      await db
        .update(tenants)
        .set(updates as any)
        .where(eq(tenants.id, ctx.user.tenantId));
      return { success: true };
    }),
});

const planPayloadSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen no slug."),
  description: z.string().max(500).optional().nullable(),
  price: z.number().min(0),
  maxOsPerMonth: z.number().int().min(-1),
  maxUsers: z.number().int().min(-1),
  hasPickupDelivery: z.boolean().optional(),
  hasOnlineBudget: z.boolean().optional(),
  hasWhatsapp: z.boolean().optional(),
  hasClientPortal: z.boolean().optional(),
  hasStock: z.boolean().optional(),
  hasFinancial: z.boolean().optional(),
  hasReports: z.boolean().optional(),
  hasAdvancedCustomization: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const plansRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(plans).where(eq(plans.isActive, true));
  }),

  listAll: superAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(plans);
  }),

  create: superAdminProcedure
    .input(planPayloadSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(plans).values({
        name: input.name.trim(),
        slug: input.slug.trim(),
        description: input.description?.trim() || null,
        price: String(input.price),
        maxOsPerMonth: input.maxOsPerMonth,
        maxUsers: input.maxUsers,
        hasPickupDelivery: input.hasPickupDelivery ?? false,
        hasOnlineBudget: input.hasOnlineBudget ?? false,
        hasWhatsapp: input.hasWhatsapp ?? false,
        hasClientPortal: input.hasClientPortal ?? false,
        hasStock: input.hasStock ?? false,
        hasFinancial: input.hasFinancial ?? false,
        hasReports: input.hasReports ?? false,
        hasAdvancedCustomization: input.hasAdvancedCustomization ?? false,
        isPublic: input.isPublic ?? true,
        isActive: input.isActive ?? true,
      });
      return { success: true };
    }),

  update: superAdminProcedure
    .input(planPayloadSchema.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, price, name, slug, description, ...data } = input;
      const updates: Record<string, unknown> = { ...data };
      if (name !== undefined) updates.name = name.trim();
      if (slug !== undefined) updates.slug = slug.trim();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (price !== undefined) updates.price = String(price);
      await db.update(plans).set(updates).where(eq(plans.id, id));
      return { success: true };
    }),
});
