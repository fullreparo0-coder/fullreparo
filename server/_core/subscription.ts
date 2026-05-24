import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { plans, tenants } from "../../drizzle/schema";
import { notifyOwner } from "./notification";
import { sendTenantEmail } from "../email";

export type TenantSubscriptionSnapshot = {
  tenantId: number;
  tenantName: string;
  tenantEmail: string | null;
  tenantStatus: "active" | "blocked" | "suspended" | "trial";
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  planId: number;
  planName: string;
  maxOsPerMonth: number;
  maxUsers: number;
  hasPickupDelivery: boolean;
  hasWhatsapp: boolean;
};

const TRIAL_DAYS = 14;

export function buildTrialEndsAt(from = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

function formatDate(date?: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function tenantPanelUrl(slug?: string | null): string {
  if (!slug) return "https://fullreparo.com.br";
  return `https://${slug}.fullreparo.com.br`;
}

async function notifyTenantByEmail(params: {
  to?: string | null;
  tenantName: string;
  subject: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}) {
  if (!params.to) return false;
  return sendTenantEmail({
    to: params.to,
    subject: params.subject,
    text: `${params.title}\n\n${params.message}${params.actionUrl ? `\n\n${params.actionLabel ?? "Acessar"}: ${params.actionUrl}` : ""}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;line-height:1.55">
        <div style="padding:22px 0;border-bottom:1px solid #e2e8f0">
          <strong style="font-size:20px;color:#1e3a5f">fullreparo</strong>
        </div>
        <div style="padding:24px 0">
          <p style="margin:0 0 10px;color:#64748b">Olá, ${params.tenantName}.</p>
          <h1 style="font-size:22px;margin:0 0 14px;color:#0f172a">${params.title}</h1>
          <p style="font-size:15px;margin:0 0 20px;white-space:pre-line">${params.message}</p>
          ${params.actionUrl ? `<a href="${params.actionUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px;font-weight:600">${params.actionLabel ?? "Acessar painel"}</a>` : ""}
        </div>
        <div style="border-top:1px solid #e2e8f0;padding:16px 0;color:#64748b;font-size:12px">
          Esta é uma mensagem automática sobre sua assinatura no fullreparo.
        </div>
      </div>
    `,
  });
}

export async function notifyPlanSelected(params: {
  tenantName: string;
  tenantEmail?: string | null;
  tenantSlug?: string | null;
  planName: string;
  trialEndsAt?: Date | null;
  selectedBy: "tenant" | "super_admin";
}) {
  const subject = params.selectedBy === "tenant"
    ? `Plano ${params.planName} selecionado no fullreparo`
    : `Seu plano no fullreparo foi atualizado para ${params.planName}`;
  const title = params.selectedBy === "tenant"
    ? `Plano ${params.planName} selecionado`
    : `Plano atualizado pelo super admin`;
  const message = params.selectedBy === "tenant"
    ? `Seu cadastro foi criado com o plano ${params.planName}. O teste grátis ficará disponível até ${formatDate(params.trialEndsAt)}. Ao final do teste, caso a assinatura não seja regularizada, o tenant será marcado como suspenso e a assistência será notificada.`
    : `O super admin alterou sua assistência para o plano ${params.planName}. A mudança já está refletida nos limites e recursos do sistema.`;

  await Promise.allSettled([
    notifyTenantByEmail({
      to: params.tenantEmail,
      tenantName: params.tenantName,
      subject,
      title,
      message,
      actionLabel: "Acessar painel",
      actionUrl: tenantPanelUrl(params.tenantSlug),
    }),
    notifyOwner({
      title: params.selectedBy === "tenant" ? `Plano escolhido: ${params.tenantName}` : `Plano alterado: ${params.tenantName}`,
      content: `**Assistência:** ${params.tenantName}\n**Plano:** ${params.planName}\n**Origem:** ${params.selectedBy === "tenant" ? "Cadastro público" : "Super admin"}\n**Fim do teste:** ${formatDate(params.trialEndsAt)}`,
    }),
  ]);
}

export async function notifyTrialExpired(params: {
  tenantName: string;
  tenantEmail?: string | null;
  tenantSlug?: string | null;
  planName: string;
  trialEndsAt?: Date | null;
}) {
  const message = `O período de teste do plano ${params.planName} venceu em ${formatDate(params.trialEndsAt)}. O tenant foi marcado como suspenso até regularização ou alteração manual pelo super admin.`;
  await Promise.allSettled([
    notifyTenantByEmail({
      to: params.tenantEmail,
      tenantName: params.tenantName,
      subject: "Seu teste grátis no fullreparo venceu",
      title: "Teste grátis vencido",
      message,
      actionLabel: "Acessar painel",
      actionUrl: tenantPanelUrl(params.tenantSlug),
    }),
    notifyOwner({
      title: `Teste vencido: ${params.tenantName}`,
      content: `**Assistência:** ${params.tenantName}\n**Plano:** ${params.planName}\n**Venceu em:** ${formatDate(params.trialEndsAt)}\n**Ação automática:** status alterado para suspenso.`,
    }),
  ]);
}

export async function getTenantSubscriptionSnapshot(tenantId: number): Promise<TenantSubscriptionSnapshot | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [row] = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantEmail: tenants.email,
      tenantSlug: tenants.slug,
      tenantStatus: tenants.status,
      trialEndsAt: tenants.trialEndsAt,
      subscriptionEndsAt: tenants.subscriptionEndsAt,
      planId: plans.id,
      planName: plans.name,
      maxOsPerMonth: plans.maxOsPerMonth,
      maxUsers: plans.maxUsers,
      hasPickupDelivery: plans.hasPickupDelivery,
      hasWhatsapp: plans.hasWhatsapp,
    })
    .from(tenants)
    .innerJoin(plans, eq(tenants.planId, plans.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!row) return undefined;

  const now = new Date();
  const trialExpired = row.tenantStatus === "trial" && row.trialEndsAt && row.trialEndsAt.getTime() <= now.getTime();
  const subscriptionExpired = row.tenantStatus === "active" && row.subscriptionEndsAt && row.subscriptionEndsAt.getTime() <= now.getTime();

  if (trialExpired || subscriptionExpired) {
    await db.update(tenants).set({ status: "suspended" }).where(and(eq(tenants.id, tenantId), eq(tenants.status, row.tenantStatus)));
    if (trialExpired) {
      await notifyTrialExpired({
        tenantName: row.tenantName,
        tenantEmail: row.tenantEmail,
        tenantSlug: row.tenantSlug,
        planName: row.planName,
        trialEndsAt: row.trialEndsAt,
      });
    } else {
      await notifyOwner({
        title: `Assinatura vencida: ${row.tenantName}`,
        content: `**Assistência:** ${row.tenantName}\n**Plano:** ${row.planName}\n**Venceu em:** ${formatDate(row.subscriptionEndsAt)}\n**Ação automática:** status alterado para suspenso.`,
      }).catch(() => false);
    }
    return { ...row, tenantStatus: "suspended" } as TenantSubscriptionSnapshot;
  }

  return row as TenantSubscriptionSnapshot;
}

export function assertTenantOperational(plan: TenantSubscriptionSnapshot | undefined, publicMessage = false) {
  if (!plan) return;
  if (plan.tenantStatus === "blocked") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: publicMessage ? "Esta assistência está indisponível no momento." : "Tenant bloqueado pelo super admin.",
    });
  }
  if (plan.tenantStatus === "suspended") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: publicMessage ? "Esta assistência está com o teste ou assinatura vencida. Entre em contato diretamente com a assistência." : "Teste ou assinatura vencida. Regularize o plano para continuar.",
    });
  }
}
