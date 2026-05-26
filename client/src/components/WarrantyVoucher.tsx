import { QRCodeSVG } from "qrcode.react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WarrantyVoucherProps {
  osNumber: string;
  publicToken: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerDocument?: string | null;
  customerAddress?: string | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  reportedDefect?: string | null;
  warrantyCode: string;
  warrantyDays: number;
  startsAt?: Date | string | null;
  expiresAt: Date | string;
  tenant: {
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    phone?: string | null;
    whatsappNumber?: string | null;
    address?: string | null;
    cnpj?: string | null;
    serviceTerms?: string | null;
    warrantyTerms?: string | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function calcProgress(startsAt: Date | string | null | undefined, expiresAt: Date | string, warrantyDays: number): number {
  if (!startsAt || warrantyDays <= 0) return 0;
  const start = new Date(startsAt).getTime();
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WarrantyVoucher({
  osNumber,
  publicToken,
  customerName,
  customerPhone,
  customerDocument,
  customerAddress,
  deviceBrand,
  deviceModel,
  reportedDefect,
  warrantyCode,
  warrantyDays,
  startsAt,
  expiresAt,
  tenant,
}: WarrantyVoucherProps) {
  const primary = tenant.primaryColor ?? "#1e3a5f";
  const verifyUrl = `${window.location.origin}/garantia?codigo=${encodeURIComponent(warrantyCode)}`;
  const trackingUrl = `${window.location.origin}/rastrear/${publicToken}`;
  const progress = calcProgress(startsAt, expiresAt, warrantyDays);
  const isExpired = new Date(expiresAt) < new Date();
  const deviceLabel = [deviceBrand, deviceModel].filter(Boolean).join(" ") || "—";

  return (
    <div className="warranty-voucher">
      {/* ── Borda decorativa externa ── */}
      <div className="warranty-outer-border" style={{ borderColor: primary }}>
        <div className="warranty-inner-border" style={{ borderColor: primary }}>

          {/* ── Cabeçalho ── */}
          <div className="warranty-header" style={{ background: primary }}>
            <div className="warranty-header-brand">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="warranty-logo" />
              ) : (
                <div className="warranty-logo-placeholder">
                  <span>{tenant.name.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
              <div className="warranty-header-text">
                <div className="warranty-tenant-name">{tenant.name}</div>
                {tenant.address && <div className="warranty-tenant-sub">{tenant.address}</div>}
                {(tenant.phone || tenant.whatsappNumber) && (
                  <div className="warranty-tenant-sub">
                    {[tenant.phone, tenant.whatsappNumber].filter(Boolean).join(" · ")}
                  </div>
                )}
                {tenant.cnpj && <div className="warranty-tenant-sub">CNPJ: {tenant.cnpj}</div>}
              </div>
            </div>
            <div className="warranty-header-badge">
              <div className="warranty-certificate-label">CERTIFICADO DE</div>
              <div className="warranty-certificate-title">GARANTIA</div>
            </div>
          </div>

          {/* ── Corpo ── */}
          <div className="warranty-body">

            {/* Coluna principal */}
            <div className="warranty-main">

              {/* Status da garantia */}
              <div className="warranty-status-block">
                <div
                  className="warranty-status-badge"
                  style={{ background: isExpired ? "#6b7280" : "#059669", color: "#fff" }}
                >
                  {isExpired ? "⚠ GARANTIA EXPIRADA" : "✓ GARANTIA ATIVA"}
                </div>
              </div>

              {/* Dados principais em grid */}
              <div className="warranty-grid">
                <div className="warranty-field">
                  <div className="warranty-field-label" style={{ color: primary }}>CLIENTE</div>
                  <div className="warranty-field-value">{customerName ?? "—"}</div>
                  {customerPhone && <div className="warranty-field-sub">{customerPhone}</div>}
                  {customerDocument && <div className="warranty-field-sub">CPF/CNPJ: {customerDocument}</div>}
                  {customerAddress && <div className="warranty-field-sub text-xs">{customerAddress}</div>}
                </div>
                <div className="warranty-field">
                  <div className="warranty-field-label" style={{ color: primary }}>OS Nº</div>
                  <div className="warranty-field-value warranty-os-number">{osNumber}</div>
                </div>
                <div className="warranty-field">
                  <div className="warranty-field-label" style={{ color: primary }}>APARELHO</div>
                  <div className="warranty-field-value">{deviceLabel}</div>
                </div>
                <div className="warranty-field">
                  <div className="warranty-field-label" style={{ color: primary }}>PRAZO</div>
                  <div className="warranty-field-value">{warrantyDays} dias</div>
                </div>
                {reportedDefect && (
                  <div className="warranty-field warranty-field-full">
                    <div className="warranty-field-label" style={{ color: primary }}>SERVIÇO REALIZADO</div>
                    <div className="warranty-field-value">{reportedDefect}</div>
                  </div>
                )}
              </div>

              {/* Datas de vigência */}
              <div className="warranty-dates-block" style={{ borderColor: primary }}>
                <div className="warranty-date-item">
                  <div className="warranty-date-label">Data de início</div>
                  <div className="warranty-date-value" style={{ color: primary }}>{fmt(startsAt)}</div>
                </div>
                <div className="warranty-date-divider" style={{ background: primary }} />
                <div className="warranty-date-item warranty-date-center">
                  <div className="warranty-date-label">Vigência</div>
                  <div className="warranty-date-days" style={{ color: primary }}>{warrantyDays}d</div>
                </div>
                <div className="warranty-date-divider" style={{ background: primary }} />
                <div className="warranty-date-item warranty-date-right">
                  <div className="warranty-date-label">Válida até</div>
                  <div className="warranty-date-value" style={{ color: primary }}>{fmt(expiresAt)}</div>
                </div>
              </div>

              {/* Barra de progresso */}
              {!isExpired && (
                <div className="warranty-progress-block">
                  <div className="warranty-progress-bar-bg">
                    <div
                      className="warranty-progress-bar-fill"
                      style={{ width: `${progress}%`, background: primary }}
                    />
                  </div>
                  <div className="warranty-progress-label">
                    <span>{progress}% consumido</span>
                    <span>{Math.max(0, warrantyDays - Math.round(progress * warrantyDays / 100))} dias restantes</span>
                  </div>
                </div>
              )}

              {/* Código de garantia */}
              <div className="warranty-code-block" style={{ borderColor: primary, background: `${primary}08` }}>
                <div className="warranty-code-label" style={{ color: primary }}>CÓDIGO DE VERIFICAÇÃO</div>
                <div className="warranty-code-value" style={{ color: primary }}>{warrantyCode}</div>
              </div>

              {/* Assinatura */}
              <div className="warranty-signature-block">
                <div className="warranty-sig-line">
                  <div className="warranty-sig-bar" style={{ borderColor: primary }} />
                  <div className="warranty-sig-caption">Assinatura / Carimbo da Assistência</div>
                </div>
                <div className="warranty-sig-line">
                  <div className="warranty-sig-bar" style={{ borderColor: primary }} />
                  <div className="warranty-sig-caption">Assinatura do Cliente</div>
                </div>
              </div>
            </div>

            {/* Coluna lateral — QR codes */}
            <div className="warranty-sidebar">
              <div className="warranty-qr-block">
                <div className="warranty-qr-title" style={{ color: primary }}>Verificar Garantia</div>
                <QRCodeSVG
                  value={verifyUrl}
                  size={100}
                  level="M"
                  fgColor={primary}
                />
                <div className="warranty-qr-sub">Aponte a câmera para verificar</div>
              </div>

              <div className="warranty-qr-block warranty-qr-block-secondary">
                <div className="warranty-qr-title" style={{ color: primary }}>Rastrear OS</div>
                <QRCodeSVG
                  value={trackingUrl}
                  size={80}
                  level="M"
                />
                <div className="warranty-qr-sub">{osNumber}</div>
              </div>
            </div>
          </div>

          {/* ── Termos de garantia ── */}
          {(tenant.warrantyTerms || tenant.serviceTerms) && (
            <div className="warranty-terms" style={{ borderColor: primary }}>
              <div className="warranty-terms-title" style={{ color: primary }}>TERMOS DE GARANTIA</div>
              <p className="warranty-terms-text">{tenant.warrantyTerms || tenant.serviceTerms}</p>
            </div>
          )}

          {/* ── Rodapé ── */}
          <div className="warranty-footer" style={{ background: primary }}>
            <span>Emitido em {new Date().toLocaleString("pt-BR")}</span>
            <span className="warranty-footer-url">{verifyUrl}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
