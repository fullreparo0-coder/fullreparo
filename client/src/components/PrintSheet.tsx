import { QRCodeSVG } from "qrcode.react";
import { STATUS_LABELS } from "@/components/StatusBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OsData {
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

// ─── A4 Layout ───────────────────────────────────────────────────────────────

export function PrintSheetA4({ os, tenant, budgets, warranty, checklist }: Omit<PrintSheetProps, "mode">) {
  const trackingUrl = `${window.location.origin}/rastrear/${os.publicToken}`;
  const primary = tenant.primaryColor ?? "#1e3a5f";
  const total = calcBudgetTotal(budgets);
  const allBudgetItems = budgets?.flatMap((b) => b.items ?? []) ?? [];
  const totalLabor = budgets?.reduce((s, b) => s + Number(b.laborCost ?? 0), 0) ?? 0;

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
  const sep = mode === "thermal58"
    ? "--------------------------------"
    : "----------------------------------------";

  return (
    <div className={`print-thermal-sheet ${width}`}>
      {/* Cabeçalho */}
      <div className="print-thermal-center print-thermal-bold print-thermal-lg">
        {tenant.name.toUpperCase()}
      </div>
      {tenant.address && <div className="print-thermal-center print-thermal-sm">{tenant.address}</div>}
      {(tenant.phone || tenant.whatsappNumber) && (
        <div className="print-thermal-center print-thermal-sm">
          {[tenant.phone, tenant.whatsappNumber].filter(Boolean).join(" / ")}
        </div>
      )}
      {tenant.cnpj && <div className="print-thermal-center print-thermal-sm">CNPJ: {tenant.cnpj}</div>}

      <div className="print-thermal-sep">{sep}</div>

      {/* Número da OS */}
      <div className="print-thermal-center print-thermal-bold" style={{ letterSpacing: "0.05em" }}>ORDEM DE SERVICO</div>
      <div className="print-thermal-center" style={{ fontSize: mode === "thermal58" ? "22px" : "26px", fontWeight: 900, letterSpacing: "0.1em", margin: "4px 0" }}>
        #{os.osNumber}
      </div>
      <div className="print-thermal-center print-thermal-sm">
        Abertura: {fmt(os.createdAt)}
      </div>
      <div className="print-thermal-center print-thermal-sm print-thermal-bold">
        Status: {STATUS_LABELS[os.status as keyof typeof STATUS_LABELS] ?? os.status}
      </div>

      <div className="print-thermal-sep">{sep}</div>

      {/* Cliente */}
      <div className="print-thermal-bold">CLIENTE</div>
      <div className="print-thermal-row"><span>Nome:</span><span>{os.customer?.name ?? "—"}</span></div>
      <div className="print-thermal-row"><span>Tel:</span><span>{os.customer?.phone ?? "—"}</span></div>
      {os.customer?.email && <div className="print-thermal-row"><span>Email:</span><span>{os.customer.email}</span></div>}
      {os.customer?.document && <div className="print-thermal-row"><span>CPF/CNPJ:</span><span>{os.customer.document}</span></div>}
      {(os.customer?.city || os.customer?.address) && (
        <div className="print-thermal-row"><span>End:</span><span>{[os.customer.address, os.customer.addressNumber ? `nº ${os.customer.addressNumber}` : null, os.customer.city].filter(Boolean).join(", ")}</span></div>
      )}

      <div className="print-thermal-sep">{sep}</div>

      {/* Aparelho */}
      <div className="print-thermal-bold">APARELHO</div>
      {(os.deviceBrand || os.deviceModel) && (
        <div className="print-thermal-row"><span>Modelo:</span><span>{[os.deviceBrand, os.deviceModel].filter(Boolean).join(" ")}</span></div>
      )}
      {os.physicalCondition && <div className="print-thermal-row"><span>Estado:</span><span>{os.physicalCondition}</span></div>}
      {os.accessories && <div className="print-thermal-row"><span>Acess.:</span><span>{os.accessories}</span></div>}
      {os.devicePassword && <div className="print-thermal-row"><span>Senha:</span><span>{os.devicePassword}</span></div>}

      <div className="print-thermal-sep">{sep}</div>

      {/* Defeito */}
      <div className="print-thermal-bold">DEFEITO RELATADO</div>
      <div className="print-thermal-wrap">{os.reportedDefect}</div>

      {/* Checklist — apenas itens presentes */}
      {checklist && checklist.filter((c) => c.checked).length > 0 && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-bold">ACESSORIOS RECEBIDOS</div>
          {checklist
            .filter((c) => c.checked)
            .map((item, i) => (
              <div key={i} className="print-thermal-checklist-item">
                [X] {item.item}
              </div>
            ))}
        </>
      )}

      {/* Orçamento */}
      {(allBudgetItems.length > 0 || totalLabor > 0) && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-bold">ORCAMENTO</div>
          {allBudgetItems.map((item, i) => (
            <div key={i} className="print-thermal-budget-item">
              <div className="print-thermal-wrap">{item.description}</div>
              <div className="print-thermal-row">
                <span>{item.quantity}x {fmtMoney(item.unitPrice)}</span>
                <span>{fmtMoney(Number(item.unitPrice) * Number(item.quantity))}</span>
              </div>
            </div>
          ))}
          {totalLabor > 0 && (
            <div className="print-thermal-row">
              <span>Mao de obra</span>
              <span>{fmtMoney(totalLabor)}</span>
            </div>
          )}
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-row print-thermal-bold">
            <span>TOTAL</span>
            <span>{fmtMoney(total)}</span>
          </div>
        </>
      )}

      {/* Garantia */}
      {warranty?.warrantyCode && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-bold">GARANTIA DIGITAL</div>
          {warranty.warrantyDays != null && (
            <div className="print-thermal-row"><span>Prazo:</span><span>{warranty.warrantyDays} dias</span></div>
          )}
          {warranty.expiresAt && (
            <div className="print-thermal-row"><span>Validade:</span><span>{fmt(warranty.expiresAt)}</span></div>
          )}
          <div className="print-thermal-sm print-thermal-mono">{warranty.warrantyCode}</div>
        </>
      )}

      {/* Entrega prevista */}
      {os.estimatedDelivery && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-row">
            <span>Entrega prevista:</span>
            <span>{fmt(os.estimatedDelivery)}</span>
          </div>
        </>
      )}

      {/* Técnico */}
      {os.technician?.name && (
        <div className="print-thermal-row">
          <span>Tecnico:</span>
          <span>{os.technician.name}</span>
        </div>
      )}

      <div className="print-thermal-sep">{sep}</div>

      {/* QR Code */}
      <div className="print-thermal-center">
        <QRCodeSVG value={trackingUrl} size={mode === "thermal58" ? 90 : 110} level="M" />
      </div>
      <div className="print-thermal-center print-thermal-sm">Rastreie sua OS</div>
      <div className="print-thermal-center print-thermal-sm print-thermal-mono">{trackingUrl}</div>

      {/* Assinatura */}
      <div className="print-thermal-sep">{sep}</div>
      <div className="print-thermal-center print-thermal-sm">Assinatura do Cliente</div>
      <div className="print-thermal-sig-line" />
      <div className="print-thermal-center print-thermal-sm">Data: ___/___/______</div>

      {/* Termos resumidos — usa warrantyTerms se disponível, senão serviceTerms */}
      {(tenant.warrantyTerms || tenant.serviceTerms) && (
        <>
          <div className="print-thermal-sep">{sep}</div>
          <div className="print-thermal-bold print-thermal-sm">TERMOS DE SERVICO</div>
          <div className="print-thermal-terms">{tenant.warrantyTerms ?? tenant.serviceTerms}</div>
        </>
      )}

      <div className="print-thermal-sep">{sep}</div>
      <div className="print-thermal-center print-thermal-sm">
        Emitido em {new Date().toLocaleString("pt-BR")}
      </div>
      <div className="print-thermal-spacer" />
    </div>
  );
}


// ─── Argox 80x40 Label Layout ────────────────────────────────────────────────

export function PrintSheetArgox({ os, tenant }: Omit<PrintSheetProps, "mode">) {
  const trackingUrl = `${window.location.origin}/rastrear/${os.publicToken}`;
  const primary = tenant.primaryColor ?? "#1e3a5f";
  const deviceLabel = [os.deviceBrand, os.deviceModel].filter(Boolean).join(" ") || "Aparelho não informado";
  const statusLabel = STATUS_LABELS[os.status as keyof typeof STATUS_LABELS] ?? os.status;

  return (
    <div className="print-argox8040">
      <div className="print-argox-header" style={{ borderColor: primary }}>
        <div className="print-argox-tenant">{truncateText(tenant.name, 28)}</div>
        <div className="print-argox-os" style={{ color: primary }}>OS {os.osNumber}</div>
      </div>

      <div className="print-argox-body">
        <div className="print-argox-info">
          <div className="print-argox-row">
            <span>Cliente</span>
            <strong>{truncateText(os.customer?.name, 32)}</strong>
          </div>
          <div className="print-argox-row">
            <span>Aparelho</span>
            <strong>{truncateText(deviceLabel, 32)}</strong>
          </div>
          <div className="print-argox-row print-argox-defect">
            <span>Defeito</span>
            <strong>{truncateText(os.reportedDefect, 50)}</strong>
          </div>
          <div className="print-argox-meta">
            <span>{fmt(os.createdAt)}</span>
            <span className="print-argox-status" style={{ borderColor: primary }}>{truncateText(statusLabel, 18)}</span>
          </div>
        </div>

        <div className="print-argox-qr-block">
          <QRCodeSVG value={trackingUrl} size={58} level="M" marginSize={0} />
          <div>Rastrear</div>
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
