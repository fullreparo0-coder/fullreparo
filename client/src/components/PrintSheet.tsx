import { QRCodeSVG } from "qrcode.react";
import { STATUS_LABELS } from "@/components/StatusBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OsData {
  id: number | string;
  osNumber: string;
  status: string;
  origin: string;
  reportedDefect: string;
  physicalCondition?: string | null;
  accessories?: string | null;
  devicePassword?: string | null;
  internalNotes?: string | null;
  estimatedDelivery?: Date | string | null;
  warrantyDays?: number | null;
  orderType?: string | null;
  originalServiceOrderId?: number | string | null;
  warrantyReturnStatus?: string | null;
  originalServiceOrder?: {
    id?: number | string | null;
    osNumber?: string | null;
  } | null;
  createdAt: Date | string;
  publicToken: string;
  customer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    document?: string | null;
    address?: string | null;
    addressNumber?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  } | null;
  technician?: { name?: string | null } | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  deviceImei?: string | null;
  deviceSerialNumber?: string | null;
}

interface BudgetItem {
  description: string;
  quantity: number;
  unitPrice: number | string;
  type: string;
}

interface Budget {
  laborCost?: number | string | null;
  items?: BudgetItem[];
}

interface WarrantyData {
  warrantyCode?: string | null;
  expiresAt?: Date | string | null;
  warrantyDays?: number | null;
}

interface ChecklistItem {
  item: string;
  checked: boolean;
}

interface TenantInfo {
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  address?: string | null;
  cnpj?: string | null;
  serviceTerms?: string | null;
  warrantyTerms?: string | null;
}

export type PrintMode = "a4" | "thermal58" | "thermal80" | "argox8040";

interface PrintSheetProps {
  os: OsData;
  tenant: TenantInfo;
  budgets?: Budget[] | null;
  warranty?: WarrantyData | null;
  checklist?: ChecklistItem[] | null;
  mode: PrintMode;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtLabelDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(v: number | string | null | undefined): string {
  if (v == null) return "R$ 0,00";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcBudgetTotal(budgets: Budget[] | null | undefined): number {
  if (!budgets?.length) return 0;
  return budgets.reduce((sum, b) => {
    const labor = Number(b.laborCost ?? 0);
    const parts = (b.items ?? []).reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0);
    return sum + labor + parts;
  }, 0);
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const normalized = (value ?? "—").trim() || "—";
  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 1))}…` : normalized;
}

function receiptLine(label: string, value: string | number | null | undefined): string {
  const cleanLabel = label.replace(/:/g, "").trim().toUpperCase();
  const cleanValue = String(value ?? "—").trim() || "—";
  return `${cleanLabel.padEnd(12, ".")}: ${cleanValue}`;
}

function isWarrantyReturn(os: OsData): boolean {
  return os.orderType === "retorno_garantia" || Boolean(os.originalServiceOrderId);
}

function originalOsLabel(os: OsData): string {
  return os.originalServiceOrder?.osNumber
    ? `OS ${os.originalServiceOrder.osNumber}`
    : os.originalServiceOrderId
      ? `OS #${os.originalServiceOrderId}`
      : "OS original";
}

function warrantyReturnProblemLabel(os: OsData): string {
  const text = (os.reportedDefect ?? "").trim();
  if (!text) return "—";

  if (!isWarrantyReturn(os)) return text;

  const prefixEnd = text.indexOf(":");
  if (text.toLowerCase().startsWith("retorno em garantia") && prefixEnd >= 0) {
    return text.slice(prefixEnd + 1).trim() || "—";
  }

  return text;
}

// ─── A4 Layout ───────────────────────────────────────────────────────────────

export function PrintSheetA4({ os, tenant, budgets, warranty, checklist }: Omit<PrintSheetProps, "mode">) {
  const trackingUrl = `${window.location.origin}/rastrear/${os.publicToken}`;
  const primary = tenant.primaryColor ?? "#1e3a5f";
  const total = calcBudgetTotal(budgets);
  const allBudgetItems = budgets?.flatMap((b) => b.items ?? []) ?? [];
  const totalLabor = budgets?.reduce((s, b) => s + Number(b.laborCost ?? 0), 0) ?? 0;
  const warrantyReturn = isWarrantyReturn(os);
  const originalReference = originalOsLabel(os);
  const warrantyReturnProblem = warrantyReturnProblemLabel(os);

  return (
    <div className="print-a4-sheet">
      {/* ── Cabeçalho ── */}
      <div className="print-a4-header" style={{ borderColor: primary }}>
        <div className="print-a4-brand">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="print-a4-logo" />
          ) : (
            <div className="print-a4-logo-placeholder" style={{ background: primary }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>
                {tenant.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <div className="print-a4-tenant-name">{tenant.name}</div>
            {tenant.cnpj && <div className="print-a4-tenant-sub">CNPJ: {tenant.cnpj}</div>}
            {tenant.address && <div className="print-a4-tenant-sub">{tenant.address}</div>}
            {(tenant.phone || tenant.whatsappNumber) && (
              <div className="print-a4-tenant-sub">
                {[tenant.phone, tenant.whatsappNumber].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
        <div className="print-a4-os-badge" style={{ background: primary }}>
          <div className="print-a4-os-label">ORDEM DE SERVIÇO</div>
          <div className="print-a4-os-number">{os.osNumber}</div>
          <div className="print-a4-os-date">Abertura: {fmt(os.createdAt)}</div>
          <div className="print-a4-os-status">{STATUS_LABELS[os.status as keyof typeof STATUS_LABELS] ?? os.status}</div>
        </div>
      </div>

      {/* ── Corpo em duas colunas ── */}
      <div className="print-a4-body">
        {/* Coluna esquerda */}
        <div className="print-a4-col">
          {/* Cliente */}
          <div className="print-a4-section">
            <div className="print-a4-section-title" style={{ color: primary }}>CLIENTE</div>
            <table className="print-a4-table">
              <tbody>
                <tr><td className="print-a4-td-label">Nome</td><td>{os.customer?.name ?? "—"}</td></tr>
                <tr><td className="print-a4-td-label">Telefone</td><td>{os.customer?.phone ?? "—"}</td></tr>
                {os.customer?.email && <tr><td className="print-a4-td-label">E-mail</td><td>{os.customer.email}</td></tr>}
                {os.customer?.document && <tr><td className="print-a4-td-label">CPF/CNPJ</td><td>{os.customer.document}</td></tr>}
                {(os.customer?.address || os.customer?.city) && (
                  <tr>
                    <td className="print-a4-td-label">Endereço</td>
                    <td>{[os.customer.address, os.customer.addressNumber ? `nº ${os.customer.addressNumber}` : null, os.customer.neighborhood, os.customer.city, os.customer.state].filter(Boolean).join(", ")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Aparelho */}
          <div className="print-a4-section">
            <div className="print-a4-section-title" style={{ color: primary }}>APARELHO</div>
            <table className="print-a4-table">
              <tbody>
                {(os.deviceBrand || os.deviceModel) && (
                  <tr><td className="print-a4-td-label">Modelo</td><td>{[os.deviceBrand, os.deviceModel].filter(Boolean).join(" ")}</td></tr>
                )}
                {os.physicalCondition && <tr><td className="print-a4-td-label">Estado físico</td><td>{os.physicalCondition}</td></tr>}
                {os.accessories && <tr><td className="print-a4-td-label">Acessórios</td><td>{os.accessories}</td></tr>}
                {os.devicePassword && <tr><td className="print-a4-td-label">Senha/PIN</td><td>{os.devicePassword}</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Defeito */}
          <div className="print-a4-section">
            <div className="print-a4-section-title" style={{ color: primary }}>DEFEITO RELATADO</div>
            <p className="print-a4-text">{os.reportedDefect}</p>
          </div>

          {/* Notas internas */}
          {os.internalNotes && (
            <div className="print-a4-section">
              <div className="print-a4-section-title" style={{ color: primary }}>OBSERVAÇÕES INTERNAS</div>
              <p className="print-a4-text">{os.internalNotes}</p>
            </div>
          )}
        </div>

        {/* Coluna direita */}
        <div className="print-a4-col">
          {/* Checklist */}
          {checklist && checklist.filter((c) => c.checked).length > 0 && (
            <div className="print-a4-section">
              <div className="print-a4-section-title" style={{ color: primary }}>ACESSÓRIOS RECEBIDOS</div>
              <div className="print-a4-checklist">
                {checklist
                  .filter((c) => c.checked)
                  .map((item, i) => (
                    <div key={i} className="print-a4-checklist-item">
                      <span className="print-a4-checkbox">☑</span>
                      <span>{item.item}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Orçamento */}
          {(allBudgetItems.length > 0 || totalLabor > 0) && (
            <div className="print-a4-section">
              <div className="print-a4-section-title" style={{ color: primary }}>ORÇAMENTO</div>
              <table className="print-a4-budget-table">
                <thead>
                  <tr>
                    <th className="print-a4-th">Descrição</th>
                    <th className="print-a4-th text-right">Qtd</th>
                    <th className="print-a4-th text-right">Unit.</th>
                    <th className="print-a4-th text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {allBudgetItems.map((item, i) => (
                    <tr key={i}>
                      <td className="print-a4-td">{item.description}</td>
                      <td className="print-a4-td text-right">{item.quantity}</td>
                      <td className="print-a4-td text-right">{fmtMoney(item.unitPrice)}</td>
                      <td className="print-a4-td text-right">{fmtMoney(Number(item.unitPrice) * Number(item.quantity))}</td>
                    </tr>
                  ))}
                  {totalLabor > 0 && (
                    <tr>
                      <td className="print-a4-td" colSpan={3}>Mão de obra</td>
                      <td className="print-a4-td text-right">{fmtMoney(totalLabor)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="print-a4-total-label" style={{ color: primary }}>TOTAL</td>
                    <td className="print-a4-total-value" style={{ color: primary }}>{fmtMoney(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Garantia */}
          {warranty?.warrantyCode && (
            <div className="print-a4-section">
              <div className="print-a4-section-title" style={{ color: primary }}>GARANTIA DIGITAL</div>
              <table className="print-a4-table">
                <tbody>
                  <tr><td className="print-a4-td-label">Código</td><td className="font-mono text-xs">{warranty.warrantyCode}</td></tr>
                  {warranty.warrantyDays != null && <tr><td className="print-a4-td-label">Prazo</td><td>{warranty.warrantyDays} dias</td></tr>}
                  {warranty.expiresAt && <tr><td className="print-a4-td-label">Válida até</td><td>{fmt(warranty.expiresAt)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Entrega prevista / Técnico */}
          <div className="print-a4-section">
            <div className="print-a4-section-title" style={{ color: primary }}>INFORMAÇÕES ADICIONAIS</div>
            <table className="print-a4-table">
              <tbody>
                {os.estimatedDelivery && <tr><td className="print-a4-td-label">Entrega prevista</td><td>{fmt(os.estimatedDelivery)}</td></tr>}
                {os.technician?.name && <tr><td className="print-a4-td-label">Técnico</td><td>{os.technician.name}</td></tr>}
                <tr><td className="print-a4-td-label">Origem</td><td>{os.origin === "coleta" ? "Coleta" : "Balcão"}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Retorno em garantia */}
          {warrantyReturn && (
            <div className="print-a4-section" style={{ border: "1px solid #7e22ce", padding: 8, background: "#faf5ff" }}>
              <div className="print-a4-section-title" style={{ color: "#7e22ce" }}>RETORNO GARANTIA</div>
              <p className="print-a4-text" style={{ margin: 0, fontWeight: 700 }}>{`Vinculada à ${originalReference}`}</p>
              <p className="print-a4-text" style={{ margin: "4px 0 0", fontWeight: 700 }}>Problema indicado no retorno:</p>
              <p className="print-a4-text" style={{ margin: "2px 0 0" }}>{warrantyReturnProblem}</p>
            </div>
          )}

          {/* QR Code */}
          <div className="print-a4-qr-block">
            <QRCodeSVG value={trackingUrl} size={80} level="M" />
            <div className="print-a4-qr-label">Rastreie sua OS</div>
          </div>
        </div>
      </div>

      {/* ── Assinaturas ── */}
      <div className="print-a4-signatures">
        <div className="print-a4-sig-line">
          <div className="print-a4-sig-bar" style={{ borderColor: primary }} />
          <div className="print-a4-sig-caption">Assinatura do Cliente</div>
        </div>
        <div className="print-a4-sig-line">
          <div className="print-a4-sig-bar" style={{ borderColor: primary }} />
          <div className="print-a4-sig-caption">Assinatura da Assistência</div>
        </div>
        <div className="print-a4-sig-line">
          <div className="print-a4-sig-bar" style={{ borderColor: primary }} />
          <div className="print-a4-sig-caption">Data de Entrega</div>
        </div>
      </div>

      {/* ── Termos ── */}
      {tenant.serviceTerms && (
        <div className="print-a4-terms">
          <div className="print-a4-section-title" style={{ color: primary }}>TERMOS DE SERVIÇO</div>
          <p className="print-a4-terms-text">{tenant.serviceTerms}</p>
        </div>
      )}

      {/* ── Rodapé ── */}
      <div className="print-a4-footer" style={{ borderColor: primary }}>
        <span>{tenant.name} · OS {os.osNumber} · Emitido em {new Date().toLocaleString("pt-BR")}</span>
        <span className="font-mono text-xs">{trackingUrl}</span>
      </div>
    </div>
  );
}

// ─── Thermal Layout ───────────────────────────────────────────────────────────

export function PrintSheetThermal({ os, tenant, budgets, warranty, checklist, mode }: PrintSheetProps) {
  const trackingUrl = `${window.location.origin}/rastrear/${os.publicToken}`;
  const total = calcBudgetTotal(budgets);
  const allBudgetItems = budgets?.flatMap((b) => b.items ?? []) ?? [];
  const totalLabor = budgets?.reduce((s, b) => s + Number(b.laborCost ?? 0), 0) ?? 0;
  const width = mode === "thermal58" ? "print-thermal58" : "print-thermal80";
  const sep = mode === "thermal58" ? "--------------------------------" : "------------------------------------------------";
  const qrSize = mode === "thermal58" ? 80 : 72;
  const statusLabel = STATUS_LABELS[os.status as keyof typeof STATUS_LABELS] ?? os.status;
  const warrantyReturn = isWarrantyReturn(os);
  const originalReference = originalOsLabel(os);
  const warrantyReturnProblem = warrantyReturnProblemLabel(os);

  return (
    <div className={`print-thermal-sheet ${width}`}>
      <div className="print-thermal-center print-thermal-bold print-thermal-title">
        {tenant.name.toUpperCase()}
      </div>
      {tenant.cnpj && <div className="print-thermal-center">CNPJ: {tenant.cnpj}</div>}
      {tenant.address && <div className="print-thermal-center print-thermal-wrap">{tenant.address}</div>}
      {(tenant.phone || tenant.whatsappNumber) && (
        <div className="print-thermal-center">
          {[tenant.phone, tenant.whatsappNumber].filter(Boolean).join(" / ")}
        </div>
      )}

      <div className="print-thermal-sep">{sep}</div>
      <div className="print-thermal-center print-thermal-bold">ORDEM DE SERVICO</div>
      <div className="print-thermal-center print-thermal-order-number">OS {os.osNumber}</div>
      <pre className="print-thermal-lines">
        {[receiptLine("Data", fmtDateTime(os.createdAt)), receiptLine("Status", statusLabel), receiptLine("Origem", os.origin)].join("\n")}
      </pre>

      <div className="print-thermal-sep">{sep}</div>
      <div className="print-thermal-bold">CLIENTE</div>
      <pre className="print-thermal-lines">
        {[
          receiptLine("Nome", os.customer?.name),
          receiptLine("Telefone", os.customer?.phone),
          (os.customer?.address || os.customer?.city) ? receiptLine("Endereco", [os.customer?.address, os.customer?.addressNumber ? `n ${os.customer.addressNumber}` : null, os.customer?.neighborhood, os.customer?.city].filter(Boolean).join(", ")) : null,
        ].filter(Boolean).join("\n")}
      </pre>

      <div className="print-thermal-sep">{sep}</div>
      <div className="print-thermal-bold">APARELHO</div>
      <pre className="print-thermal-lines">
        {[
          receiptLine("Marca", os.deviceBrand),
          receiptLine("Modelo", os.deviceModel),
          os.deviceImei ? receiptLine("IMEI", os.deviceImei) : null,
          os.deviceSerialNumber ? receiptLine("Serial", os.deviceSerialNumber) : null,
          os.devicePassword ? receiptLine("Senha", os.devicePassword) : null,
        ].filter(Boolean).join("\n")}
      </pre>

      <div className="print-thermal-sep">{sep}</div>
      <div className="print-thermal-bold">DEFEITO</div>
      <div className="print-thermal-wrap">{os.reportedDefect || "—"}</div>

      {os.internalNotes && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-bold">OBSERVACOES</div>
          <div className="print-thermal-wrap">{os.internalNotes}</div>
        </>
      )}

      {(allBudgetItems.length > 0 || totalLabor > 0) && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-bold">VALORES</div>
          {allBudgetItems.map((item, i) => (
            <div key={i} className="print-thermal-budget-item">
              <div className="print-thermal-wrap">{item.description}</div>
              <pre className="print-thermal-lines">{receiptLine(`${item.quantity}x`, `${fmtMoney(item.unitPrice)} = ${fmtMoney(Number(item.unitPrice) * Number(item.quantity))}`)}</pre>
            </div>
          ))}
          {totalLabor > 0 && <pre className="print-thermal-lines">{receiptLine("Mao obra", fmtMoney(totalLabor))}</pre>}
          <div className="print-thermal-sep">{sep}</div>
          <pre className="print-thermal-lines print-thermal-bold">{receiptLine("TOTAL", fmtMoney(total))}</pre>
        </>
      )}

      {os.estimatedDelivery && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <pre className="print-thermal-lines">{receiptLine("Entrega", fmt(os.estimatedDelivery))}</pre>
        </>
      )}
      {os.technician?.name && <pre className="print-thermal-lines">{receiptLine("Tecnico", os.technician.name)}</pre>}

      {warranty?.warrantyCode && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-bold">GARANTIA DIGITAL</div>
          <pre className="print-thermal-lines">
            {[
              warranty.warrantyDays != null ? receiptLine("Prazo", `${warranty.warrantyDays} dias`) : null,
              warranty.expiresAt ? receiptLine("Validade", fmt(warranty.expiresAt)) : null,
              receiptLine("Codigo", warranty.warrantyCode),
            ].filter(Boolean).join("\n")}
          </pre>
        </>
      )}

      {warrantyReturn && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-center print-thermal-bold">RETORNO GARANTIA</div>
          <div className="print-thermal-center">Vinculada a {originalReference}</div>
          <div className="print-thermal-bold">PROBLEMA DO RETORNO</div>
          <div className="print-thermal-wrap">{warrantyReturnProblem}</div>
        </>
      )}

      <div className="print-thermal-sep">{sep}</div>
      <div className="print-thermal-center print-thermal-qr">
        <QRCodeSVG value={trackingUrl} size={qrSize} level="M" />
      </div>
      <div className="print-thermal-center">RASTREIE SUA OS</div>
      <div className="print-thermal-center print-thermal-url">{trackingUrl}</div>

      <div className="print-thermal-sep">{sep}</div>
      <div>ASSINATURA DO CLIENTE</div>
      <div className="print-thermal-sig-line" />
      <pre className="print-thermal-lines">{receiptLine("Data", "___/___/______")}</pre>

      {(tenant.warrantyTerms || tenant.serviceTerms) && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-bold">TERMOS</div>
          <div className="print-thermal-terms">{tenant.warrantyTerms ?? tenant.serviceTerms}</div>
        </>
      )}

      <div className="print-thermal-sep">{sep}</div>
      <div className="print-thermal-center">Emitido em {new Date().toLocaleString("pt-BR")}</div>
      <div className="print-thermal-spacer" />
    </div>
  );
}

// ─── Argox 80x40 Label Layout ────────────────────────────────────────────────

export function PrintSheetArgox({ os, tenant }: Omit<PrintSheetProps, "mode">) {
  const internalOsUrl = `${window.location.origin}/painel/os/${os.id}`;
  const deviceLabel = [os.deviceBrand, os.deviceModel].filter(Boolean).join(" ") || "Aparelho não informado";
  const statusLabel = STATUS_LABELS[os.status as keyof typeof STATUS_LABELS] ?? os.status;
  const warrantyReturn = isWarrantyReturn(os);
  const originalReference = originalOsLabel(os);
  const warrantyReturnProblem = warrantyReturnProblemLabel(os);

  return (
    <div className="print-argox8040">
      <div className="print-argox-header">
        <div className="print-argox-tenant">{truncateText(tenant.name, 18)}</div>
        <div className="print-argox-os">OS {os.osNumber}</div>
      </div>

      <div className="print-argox-body">
        <div className="print-argox-left">
          <div className="print-argox-customer">{truncateText(os.customer?.name, 32)}</div>
          <div className="print-argox-device">{truncateText(deviceLabel, 34)}</div>
          {warrantyReturn ? (
            <div className="print-argox-return-box">
              <div className="print-argox-return-title">RETORNO GARANTIA</div>
              <div className="print-argox-return-origin">{truncateText(originalReference, 30)}</div>
              <div className="print-argox-return-problem-label">PROBLEMA:</div>
              <div className="print-argox-return-problem">{truncateText(warrantyReturnProblem, 88)}</div>
            </div>
          ) : (
            <div className="print-argox-defect">{truncateText(os.reportedDefect, 42)}</div>
          )}
          <div className="print-argox-date">{fmtLabelDateTime(os.createdAt)}</div>
        </div>

        <div className="print-argox-right">
          <div className="print-argox-status">{truncateText(statusLabel, 18)}</div>
          <div className="print-argox-qr-block">
            <QRCodeSVG value={internalOsUrl} size={80} level="M" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function PrintSheet(props: PrintSheetProps) {
  if (props.mode === "a4") return <PrintSheetA4 {...props} />;
  if (props.mode === "argox8040") return <PrintSheetArgox {...props} />;
  return <PrintSheetThermal {...props} />;
}
