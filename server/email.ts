/**
 * server/email.ts
 * Helper para envio de e-mail transacional via Resend.
 * Se RESEND_API_KEY não estiver configurada, o envio falha silenciosamente
 * (apenas a notificação interna via notifyOwner é disparada).
 */

import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

export type TenantEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Envia um e-mail para o tenant usando Resend.
 * Retorna true se enviado com sucesso, false se não houver API key ou se falhar.
 * Nunca lança exceção — falhas são logadas silenciosamente.
 */
export async function sendTenantEmail(payload: TenantEmailPayload): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.info("[Email] RESEND_API_KEY não configurada — e-mail não enviado.");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: "FullReparo <notificacoes@fullreparo.com.br>",
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (error) {
      console.warn("[Email] Erro ao enviar e-mail:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[Email] Exceção ao enviar e-mail:", err);
    return false;
  }
}

/**
 * Gera o HTML de e-mail de alerta de nova OS para o tenant.
 */
export function buildNewOsEmailHtml(params: {
  tenantName: string;
  osNumber: string;
  customerName: string;
  customerPhone?: string | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  defect: string;
  origin: string;
  createdAt: Date;
  panelUrl: string;
}): string {
  const {
    tenantName,
    osNumber,
    customerName,
    customerPhone,
    deviceBrand,
    deviceModel,
    defect,
    origin,
    createdAt,
    panelUrl,
  } = params;

  const device = [deviceBrand, deviceModel].filter(Boolean).join(" ") || "Não informado";
  const originLabel = origin === "coleta" ? "Portal Público (Coleta)" : "Portal Público";
  const dateStr = createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nova OS — ${osNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">🔔 Nova Ordem de Serviço</h1>
              <p style="margin:6px 0 0;color:#a8c4e0;font-size:14px;">${tenantName}</p>
            </td>
          </tr>
          <!-- Badge OS Number -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="display:inline-block;background:#1e3a5f;color:#d4a017;font-size:18px;font-weight:700;padding:8px 20px;border-radius:8px;letter-spacing:1px;">
                OS #${osNumber}
              </div>
            </td>
          </tr>
          <!-- Details -->
          <tr>
            <td style="padding:20px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                    <span style="color:#666;font-size:13px;display:block;">Cliente</span>
                    <span style="color:#1a1a1a;font-size:15px;font-weight:600;">${customerName}</span>
                    ${customerPhone ? `<span style="color:#666;font-size:13px;margin-left:8px;">${customerPhone}</span>` : ""}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                    <span style="color:#666;font-size:13px;display:block;">Aparelho</span>
                    <span style="color:#1a1a1a;font-size:15px;font-weight:600;">${device}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                    <span style="color:#666;font-size:13px;display:block;">Defeito Relatado</span>
                    <span style="color:#1a1a1a;font-size:15px;">${defect}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                    <span style="color:#666;font-size:13px;display:block;">Origem</span>
                    <span style="color:#1a1a1a;font-size:14px;">${originLabel}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#666;font-size:13px;display:block;">Data/Hora</span>
                    <span style="color:#1a1a1a;font-size:14px;">${dateStr}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${panelUrl}"
                style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
                Ver OS no Painel →
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fb;padding:16px 32px;border-top:1px solid #e8ecf0;">
              <p style="margin:0;color:#999;font-size:12px;">
                Este e-mail foi enviado automaticamente pelo FullReparo. Para alterar as configurações de notificação, acesse o painel da sua assistência.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
