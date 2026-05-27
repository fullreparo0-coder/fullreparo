import { getDb } from "../db";
import { osNotifications } from "../../drizzle/schema";

/** Labels amigáveis dos status para uso nas mensagens */
const STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  aguardando_coleta: "Aguardando Coleta",
  coleta_agendada: "Coleta Agendada",
  coletado: "Coletado",
  recebido_na_assistencia: "Recebido na Assistência",
  em_diagnostico: "Em Diagnóstico",
  aguardando_aprovacao: "Aguardando Aprovação do Orçamento",
  aprovado: "Orçamento Aprovado",
  em_reparo: "Em Reparo",
  aguardando_peca: "Aguardando Peça",
  pronto: "Pronto para Retirada",
  saiu_para_entrega: "Saiu para Entrega",
  finalizado: "Feito",
  encerrado_sem_reparo: "Encerrado sem Reparo",
  encerrado_condenado: "Encerrado Condenado",
  cancelado: "Cancelado",
};

/** Emojis por status para enriquecer a mensagem */
const STATUS_EMOJIS: Record<string, string> = {
  solicitado: "📋",
  aguardando_coleta: "⏳",
  coleta_agendada: "📅",
  coletado: "🚗",
  recebido_na_assistencia: "🏪",
  em_diagnostico: "🔍",
  aguardando_aprovacao: "💬",
  aprovado: "✅",
  em_reparo: "🔧",
  aguardando_peca: "📦",
  pronto: "🎉",
  saiu_para_entrega: "🚚",
  finalizado: "✅",
  encerrado_sem_reparo: "ℹ️",
  encerrado_condenado: "⚠️",
  cancelado: "❌",
};

export interface NotificationContext {
  osNumber: string;
  customerName: string;
  customerPhone: string | null;
  tenantName: string;
  tenantWhatsapp: string | null;
  publicToken: string | null;
  trackingBaseUrl: string;
  status: string;
  notes?: string | null;
  /** Mensagem customizada pelo tenant para este status (pode conter variáveis) */
  customMessage?: string | null;
}

/**
 * Substitui variáveis na mensagem customizada do tenant.
 * Variáveis suportadas: {{nomeCliente}}, {{numeroOS}}, {{status}}, {{nomeTenant}}, {{linkRastreamento}}
 */
export function interpolateMessage(template: string, ctx: NotificationContext): string {
  const label = STATUS_LABELS[ctx.status] ?? ctx.status;
  const trackingUrl = ctx.publicToken
    ? `${ctx.trackingBaseUrl}/rastrear/${ctx.publicToken}`
    : "";

  return template
    .replace(/\{\{nomeCliente\}\}/g, ctx.customerName)
    .replace(/\{\{numeroOS\}\}/g, ctx.osNumber)
    .replace(/\{\{status\}\}/g, label)
    .replace(/\{\{nomeTenant\}\}/g, ctx.tenantName)
    .replace(/\{\{linkRastreamento\}\}/g, trackingUrl);
}

/**
 * Gera a mensagem de notificação para o cliente.
 * Se o tenant tiver uma mensagem customizada para o status, usa ela (com interpolação de variáveis).
 * Caso contrário, usa o template padrão.
 */
export function buildStatusMessage(ctx: NotificationContext): string {
  // Usar mensagem customizada do tenant se disponível
  if (ctx.customMessage && ctx.customMessage.trim()) {
    return interpolateMessage(ctx.customMessage.trim(), ctx);
  }

  // Template padrão
  const label = STATUS_LABELS[ctx.status] ?? ctx.status;
  const emoji = STATUS_EMOJIS[ctx.status] ?? "📱";
  const trackingUrl = ctx.publicToken
    ? `${ctx.trackingBaseUrl}/rastrear/${ctx.publicToken}`
    : null;

  let msg = `${emoji} *${ctx.tenantName}*\n\n`;
  msg += `Olá, *${ctx.customerName}*!\n\n`;
  msg += `Sua ordem de serviço *OS #${ctx.osNumber}* foi atualizada:\n`;
  msg += `📌 Status: *${label}*\n`;

  if (ctx.notes) {
    msg += `\n💬 Observação: ${ctx.notes}\n`;
  }

  if (trackingUrl) {
    msg += `\n🔗 Acompanhe em tempo real:\n${trackingUrl}\n`;
  }

  if (ctx.tenantWhatsapp) {
    const cleanPhone = ctx.tenantWhatsapp.replace(/\D/g, "");
    msg += `\n📞 Dúvidas? Fale conosco: https://wa.me/${cleanPhone}`;
  }

  return msg;
}

/**
 * Gera o link wa.me para envio da mensagem via WhatsApp.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}

/**
 * Verifica se o status deve disparar notificação, registra no banco e retorna o link WhatsApp.
 * Retorna null se não houver notificação a enviar.
 */
export async function prepareStatusNotification(params: {
  tenantId: number;
  serviceOrderId: number;
  notifyStatuses: string[] | null;
  /** Mapa de status → mensagem customizada do tenant */
  notifyMessages?: Record<string, string> | null;
  ctx: NotificationContext;
}): Promise<{ message: string; whatsappLink: string } | null> {
  const { tenantId, serviceOrderId, notifyStatuses, notifyMessages, ctx } = params;

  // Verificar se o status está na lista de notificações configuradas
  if (!notifyStatuses || !notifyStatuses.includes(ctx.status)) {
    return null;
  }

  // Verificar se o cliente tem telefone
  if (!ctx.customerPhone) {
    return null;
  }

  // Injetar mensagem customizada do tenant no contexto (se houver)
  const ctxWithCustom: NotificationContext = {
    ...ctx,
    customMessage: notifyMessages?.[ctx.status] ?? null,
  };

  const message = buildStatusMessage(ctxWithCustom);
  const whatsappLink = buildWhatsAppLink(ctx.customerPhone, message);

  // Registrar a notificação no banco (fire-and-forget, não bloqueia)
  const db = await getDb();
  if (db) {
    db.insert(osNotifications).values({
      tenantId,
      serviceOrderId,
      status: ctx.status,
      channel: "whatsapp",
      message,
    }).catch((err) => {
      console.warn("[StatusNotification] Erro ao registrar notificação:", err);
    });
  }

  return { message, whatsappLink };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notificações ao DONO DO TENANT sobre mudanças de status críticas da OS
// ─────────────────────────────────────────────────────────────────────────────

import { notifyOwner } from "./notification";

/** Statuses que disparam notificação ao dono do tenant */
const TENANT_CRITICAL_STATUSES: Record<string, { emoji: string; label: string; detail: string }> = {
  em_reparo: {
    emoji: "🔧",
    label: "Reparo iniciado",
    detail: "O reparo foi iniciado pelo técnico.",
  },
  pronto: {
    emoji: "✅",
    label: "Pronto para retirada",
    detail: "O aparelho está pronto e aguarda retirada pelo cliente.",
  },
  aguardando_entrega: {
    emoji: "📦",
    label: "Aguardando entrega",
    detail: "O aparelho está pronto e será enviado ao cliente.",
  },
  saiu_para_entrega: {
    emoji: "🚚",
    label: "Saiu para entrega",
    detail: "O aparelho saiu para entrega ao cliente.",
  },
  entregue: {
    emoji: "🏠",
    label: "Entregue ao cliente",
    detail: "O aparelho foi entregue com sucesso ao cliente.",
  },
  coletado: {
    emoji: "📥",
    label: "Aparelho coletado",
    detail: "O aparelho foi coletado na residência do cliente.",
  },
  coleta_agendada: {
    emoji: "📅",
    label: "Coleta agendada",
    detail: "Uma coleta foi agendada para o aparelho do cliente.",
  },
  cancelado: {
    emoji: "🚫",
    label: "OS cancelada",
    detail: "A ordem de serviço foi cancelada.",
  },
  finalizado: {
    emoji: "🎉",
    label: "Serviço finalizado",
    detail: "O serviço foi concluído e a garantia foi gerada.",
  },
};

export interface TenantStatusNotificationParams {
  /** Referência da OS para exibição (ex: "OS #42 (OS-2024-042)") */
  osRef: string;
  /** Nome da assistência técnica */
  tenantName: string;
  /** Status novo da OS */
  status: string;
  /** Nome do técnico/atendente que realizou a mudança */
  changedByName?: string;
  /** Observações adicionais (ex: motivo de cancelamento, nome do recebedor) */
  notes?: string;
  /** Data/hora da mudança (padrão: agora) */
  at?: Date;
}

/**
 * Dispara notificação ao dono do tenant sobre mudança de status crítica.
 * Fire-and-forget: retorna imediatamente, erros são logados mas não propagados.
 * Statuses não críticos são silenciosamente ignorados.
 */
export function notifyTenantStatusChange(
  params: TenantStatusNotificationParams & { tenantId?: number; serviceOrderId?: number }
): void {
  const statusInfo = TENANT_CRITICAL_STATUSES[params.status];
  if (!statusInfo) return; // status não crítico, não notifica

  const { emoji, label, detail } = statusInfo;
  const at = (params.at ?? new Date()).toLocaleString("pt-BR");
  const byLine = params.changedByName ? `**Responsável:** ${params.changedByName}\n` : "";
  const notesLine = params.notes ? `**Observação:** ${params.notes}\n` : "";
  const msgContent =
    `**${params.osRef}** em **${params.tenantName}** teve seu status atualizado.\n\n` +
    `**Novo status:** ${label}\n` +
    `${detail}\n\n` +
    byLine +
    notesLine +
    `**Data/hora:** ${at}`;

  // Persistir no banco de histórico se tenantId e serviceOrderId forem fornecidos
  if (params.tenantId && params.serviceOrderId) {
    import("../db").then(({ getDb }) => getDb()).then((db) => {
      if (!db) return;
      return import("../../drizzle/schema").then(({ osNotifications }) =>
        db.insert(osNotifications).values({
          tenantId: params.tenantId!,
          serviceOrderId: params.serviceOrderId!,
          status: params.status,
          channel: "sistema",
          message: `${label}${params.notes ? ` — ${params.notes}` : ""}`,
          eventType: "status_change",
          actorName: params.changedByName ?? "Sistema",
        })
      );
    }).catch((err) =>
      console.warn(`[TenantStatusNotification] Erro ao persistir status "${params.status}":`, err)
    );
  }

  notifyOwner({
    title: `${emoji} ${label} — ${params.osRef}`,
    content: msgContent,
  }).catch((err) =>
    console.warn(
      `[TenantStatusNotification] Falha ao notificar status "${params.status}" para ${params.osRef}:`,
      err
    )
  );
}
