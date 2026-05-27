/**
 * Endpoints REST de exportação de Ordens de Serviço
 *
 * GET /api/export/os.csv  → arquivo CSV com BOM UTF-8
 * GET /api/export/os.pdf  → arquivo PDF bem estruturado
 *
 * Autenticação: cookie de sessão (mesmo mecanismo do tRPC)
 * Parâmetros de query: search, status, dateFrom (ms), dateTo (ms)
 */

import type { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { sdk } from "./_core/sdk";
import { getServiceOrdersForExport, getCustomersForExport, getFinancialReport, getTenantById } from "./db";

// ─── Mapa de labels de status (igual ao frontend) ────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  aguardando_coleta: "Aguardando Coleta",
  coleta_agendada: "Coleta Agendada",
  coletado: "Coletado",
  recebido_na_assistencia: "Recebido na Assistência",
  em_diagnostico: "Em Diagnóstico",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  aguardando_peca: "Aguardando Peça",
  em_reparo: "Em Reparo",
  pronto: "Pronto",
  aguardando_entrega: "Aguardando Entrega",
  saiu_para_entrega: "Saiu para Entrega",
  entregue: "Entregue",
  finalizado: "Feito",
  encerrado_sem_reparo: "Encerrado sem Reparo",
  encerrado_condenado: "Encerrado Condenado",
  cancelado: "Cancelado",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFilters(req: Request) {
  const search = (req.query.search as string) || undefined;
  const status = (req.query.status as string) || undefined;
  const dateFrom = req.query.dateFrom ? new Date(Number(req.query.dateFrom)) : undefined;
  const dateTo = req.query.dateTo ? new Date(Number(req.query.dateTo)) : undefined;
  return { search, status, dateFrom, dateTo };
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeCsv(v: string | null | undefined): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ─── Autenticação ─────────────────────────────────────────────────────────────

async function authenticate(req: Request): Promise<{ tenantId: number; name: string } | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user || !user.tenantId) return null;
    return { tenantId: user.tenantId, name: user.name ?? "Usuário" };
  } catch {
    return null;
  }
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

async function handleCsvExport(req: Request, res: Response) {
  const auth = await authenticate(req);
  if (!auth) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const { search, status, dateFrom, dateTo } = parseFilters(req);
  const rows = await getServiceOrdersForExport(auth.tenantId, search, status, dateFrom, dateTo);

  // BOM UTF-8 para compatibilidade com Excel
  const BOM = "\uFEFF";
  const header = ["Nº OS", "Cliente", "Telefone", "CPF/CNPJ", "Aparelho", "IMEI", "Status", "Origem", "Data Abertura", "Valor Total"];
  const lines: string[] = [header.map(escapeCsv).join(",")];

  for (const r of rows) {
    const device = [r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || "";
    lines.push([
      r.osNumber,
      r.customerName ?? "",
      r.customerPhone ?? "",
      r.customerDocument ?? "",
      device,
      r.deviceImei ?? "",
      STATUS_LABELS[r.status] ?? r.status,
      r.origin === "coleta" ? "Coleta" : "Balcão",
      formatDate(r.createdAt),
      formatCurrency(r.totalAmount),
    ].map(escapeCsv).join(","));
  }

  const csv = BOM + lines.join("\r\n");
  const filename = `ordens-de-servico-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

// Paleta de cores do documento
const COLORS = {
  primary: "#1e3a5f",      // azul escuro
  accent: "#d4a017",       // dourado
  headerBg: "#1e3a5f",
  headerText: "#ffffff",
  rowEven: "#f7f9fc",
  rowOdd: "#ffffff",
  border: "#dde3ec",
  text: "#1a1a2e",
  muted: "#6b7280",
  totalBg: "#1e3a5f",
  totalText: "#ffffff",
  statusBg: "#e8f0fe",
  statusText: "#1e3a5f",
};

async function handlePdfExport(req: Request, res: Response) {
  const auth = await authenticate(req);
  if (!auth) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const { search, status, dateFrom, dateTo } = parseFilters(req);
  const [rows, tenant] = await Promise.all([
    getServiceOrdersForExport(auth.tenantId, search, status, dateFrom, dateTo),
    getTenantById(auth.tenantId),
  ]);

  const tenantName = tenant?.name ?? "Assistência Técnica";
  const tenantCity = [tenant?.city, tenant?.state].filter(Boolean).join(" – ") || "";
  const tenantPhone = tenant?.phone ?? "";
  const tenantEmail = tenant?.email ?? "";

  const filename = `ordens-de-servico-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 40, bottom: 40, left: 36, right: 36 },
    info: {
      Title: `Ordens de Serviço — ${tenantName}`,
      Author: tenantName,
      Creator: "FullReparo",
    },
  });

  doc.pipe(res);

  const PAGE_W = doc.page.width;
  const MARGIN_L = 36;
  const MARGIN_R = 36;
  const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  // Fundo do cabeçalho
  doc.rect(0, 0, PAGE_W, 80).fill(COLORS.headerBg);

  // Nome da assistência
  doc.fillColor(COLORS.headerText)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(tenantName, MARGIN_L, 18, { width: CONTENT_W * 0.6 });

  // Subtítulo
  const subtitle = [tenantCity, tenantPhone, tenantEmail].filter(Boolean).join("  ·  ");
  if (subtitle) {
    doc.fillColor("#b0c4de").font("Helvetica").fontSize(9).text(subtitle, MARGIN_L, 42, { width: CONTENT_W * 0.6 });
  }

  // Bloco de informações da exportação (lado direito)
  const now = new Date();
  const exportInfo = [
    `Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    `Total de registros: ${rows.length}`,
  ];
  if (status && status !== "all") {
    const labels = status.split(",").map((s) => STATUS_LABELS[s.trim()] ?? s).join(", ");
    exportInfo.push(`Filtro de status: ${labels}`);
  }
  if (dateFrom || dateTo) {
    const range = [dateFrom ? formatDate(dateFrom) : null, dateTo ? formatDate(dateTo) : null].filter(Boolean).join(" a ");
    exportInfo.push(`Período: ${range}`);
  }

  doc.fillColor(COLORS.headerText).font("Helvetica").fontSize(8);
  exportInfo.forEach((line, i) => {
    doc.text(line, MARGIN_L + CONTENT_W * 0.6, 14 + i * 14, { width: CONTENT_W * 0.4, align: "right" });
  });

  // Linha dourada separadora
  doc.rect(0, 80, PAGE_W, 3).fill(COLORS.accent);

  // ── Título da seção ────────────────────────────────────────────────────────
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(11)
    .text("RELATÓRIO DE ORDENS DE SERVIÇO", MARGIN_L, 96, { width: CONTENT_W });

  // ── Tabela ─────────────────────────────────────────────────────────────────
  const TABLE_TOP = 118;
  const ROW_H = 22;
  const HEADER_H = 26;

  // Definição das colunas: [label, largura relativa]
  const COL_DEFS: [string, number][] = [
    ["Nº OS",         0.09],
    ["Cliente",       0.18],
    ["Aparelho",      0.15],
    ["Status",        0.14],
    ["Origem",        0.07],
    ["Data Abertura", 0.10],
    ["Valor Total",   0.09],
    ["CPF/CNPJ",      0.10],
    ["IMEI",          0.08],
  ];

  const totalRatio = COL_DEFS.reduce((s, [, r]) => s + r, 0);
  const cols = COL_DEFS.map(([label, ratio]) => ({
    label,
    width: Math.floor((ratio / totalRatio) * CONTENT_W),
  }));

  // Cabeçalho da tabela
  let cx = MARGIN_L;
  doc.rect(MARGIN_L, TABLE_TOP, CONTENT_W, HEADER_H).fill(COLORS.primary);
  cols.forEach((col) => {
    doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(8)
      .text(col.label, cx + 4, TABLE_TOP + 8, { width: col.width - 8, ellipsis: true });
    cx += col.width;
  });

  // Linhas de dados
  let y = TABLE_TOP + HEADER_H;
  let totalAmount = 0;

  const drawRow = (r: (typeof rows)[0], rowIndex: number) => {
    const isEven = rowIndex % 2 === 0;
    doc.rect(MARGIN_L, y, CONTENT_W, ROW_H).fill(isEven ? COLORS.rowEven : COLORS.rowOdd);

    // Borda inferior sutil
    doc.rect(MARGIN_L, y + ROW_H - 0.5, CONTENT_W, 0.5).fill(COLORS.border);

    const device = [r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || "—";
    const amount = Number(r.totalAmount ?? 0);
    totalAmount += amount;

    const values = [
      r.osNumber,
      r.customerName ?? "—",
      device,
      STATUS_LABELS[r.status] ?? r.status,
      r.origin === "coleta" ? "Coleta" : "Balcão",
      formatDate(r.createdAt),
      formatCurrency(r.totalAmount),
      r.customerDocument ?? "—",
      r.deviceImei ?? "—",
    ];

    let vx = MARGIN_L;
    values.forEach((val, i) => {
      // Valor total em destaque
      const isAmount = i === 6;
      doc.fillColor(isAmount ? COLORS.primary : COLORS.text)
        .font(isAmount ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7.5)
        .text(val, vx + 4, y + 7, { width: cols[i].width - 8, ellipsis: true });
      vx += cols[i].width;
    });

    y += ROW_H;
  };

  // Verificar se precisa de nova página
  const checkPageBreak = () => {
    if (y + ROW_H > doc.page.height - 60) {
      doc.addPage();
      y = 40;
      // Repetir cabeçalho da tabela na nova página
      cx = MARGIN_L;
      doc.rect(MARGIN_L, y, CONTENT_W, HEADER_H).fill(COLORS.primary);
      cols.forEach((col) => {
        doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(8)
          .text(col.label, cx + 4, y + 8, { width: col.width - 8, ellipsis: true });
        cx += col.width;
      });
      y += HEADER_H;
    }
  };

  rows.forEach((r, i) => {
    checkPageBreak();
    drawRow(r, i);
  });

  // ── Linha de totais ────────────────────────────────────────────────────────
  checkPageBreak();
  doc.rect(MARGIN_L, y, CONTENT_W, ROW_H + 2).fill(COLORS.totalBg);
  doc.fillColor(COLORS.totalText).font("Helvetica-Bold").fontSize(8.5)
    .text(`Total: ${rows.length} ordens`, MARGIN_L + 4, y + 7, { width: CONTENT_W * 0.7 });
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9)
    .text(formatCurrency(totalAmount), MARGIN_L + CONTENT_W * 0.7, y + 6, {
      width: CONTENT_W * 0.3 - 4,
      align: "right",
    });

  y += ROW_H + 2;

  // ── Rodapé ─────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 30;
  doc.rect(0, footerY - 4, PAGE_W, 34).fill("#f0f4f8");
  doc.rect(0, footerY - 4, PAGE_W, 1).fill(COLORS.border);

  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.5)
    .text(
      `${tenantName}  ·  Documento gerado pelo FullReparo em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}  ·  fullreparo.com.br`,
      MARGIN_L,
      footerY + 4,
      { width: CONTENT_W, align: "center" }
    );

  doc.end();
}

// ─── Registro das rotas ───────────────────────────────────────────────────────

export function registerExportRoutes(app: Express) {
  app.get("/api/export/os.csv", (req, res) => {
    handleCsvExport(req, res).catch((err) => {
      console.error("[Export CSV]", err);
      if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar CSV" });
    });
  });

  app.get("/api/export/os.pdf", (req, res) => {
    handlePdfExport(req, res).catch((err) => {
      console.error("[Export PDF]", err);
      if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar PDF" });
    });
  });

  app.get("/api/export/clientes.csv", (req, res) => {
    handleCustomersCsvExport(req, res).catch((err) => {
      console.error("[Export Clientes CSV]", err);
      if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar CSV de clientes" });
    });
  });

  app.get("/api/export/clientes.pdf", (req, res) => {
    handleCustomersPdfExport(req, res).catch((err) => {
      console.error("[Export Clientes PDF]", err);
      if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar PDF de clientes" });
    });
  });

  app.get("/api/export/relatorio-financeiro.pdf", (req, res) => {
    handleFinancialReportPdfExport(req, res).catch((err) => {
      console.error("[Export Relatorio PDF]", err);
      if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar relatório financeiro" });
    });
  });

  app.get("/api/export/relatorio-financeiro.csv", (req, res) => {
    handleFinancialReportCsvExport(req, res).catch((err) => {
      console.error("[Export Relatorio CSV]", err);
      if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar CSV do relatório financeiro" });
    });
  });
}

// ─── Exportação de Clientes — CSV ─────────────────────────────────────────────

async function handleCustomersCsvExport(req: Request, res: Response) {
  const auth = await authenticate(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const search = (req.query.search as string) || undefined;
  const rows = await getCustomersForExport(auth.tenantId, search);

  const BOM = "\uFEFF";
  const header = ["Nome", "Telefone", "E-mail", "CPF/CNPJ", "Cidade", "Estado", "Total de OS", "Data Cadastro"];
  const lines: string[] = [header.map(escapeCsv).join(",")];

  for (const r of rows) {
    const location = [r.city, r.state].filter(Boolean).join(" – ") || "";
    lines.push([
      r.name,
      r.phone,
      r.email ?? "",
      r.document ?? "",
      r.city ?? "",
      r.state ?? "",
      String(Number(r.osCount ?? 0)),
      formatDate(r.createdAt),
    ].map(escapeCsv).join(","));
  }

  const csv = BOM + lines.join("\r\n");
  const filename = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

// ─── Exportação de Clientes — PDF ─────────────────────────────────────────────

async function handleCustomersPdfExport(req: Request, res: Response) {
  const auth = await authenticate(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const search = (req.query.search as string) || undefined;
  const [rows, tenant] = await Promise.all([
    getCustomersForExport(auth.tenantId, search),
    getTenantById(auth.tenantId),
  ]);

  const tenantName = tenant?.name ?? "Assistência Técnica";
  const filename = `clientes-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 40, bottom: 40, left: 36, right: 36 },
    info: { Title: `Clientes — ${tenantName}`, Author: tenantName, Creator: "FullReparo" },
  });
  doc.pipe(res);

  const PAGE_W = doc.page.width;
  const MARGIN_L = 36;
  const CONTENT_W = PAGE_W - MARGIN_L * 2;
  const now = new Date();

  // Cabeçalho
  doc.rect(0, 0, PAGE_W, 80).fill(COLORS.headerBg);
  doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(18)
    .text(tenantName, MARGIN_L, 18, { width: CONTENT_W * 0.6 });
  doc.fillColor("#b0c4de").font("Helvetica").fontSize(9)
    .text("Relatório de Clientes", MARGIN_L, 42, { width: CONTENT_W * 0.6 });
  doc.fillColor(COLORS.headerText).font("Helvetica").fontSize(8)
    .text(`Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, MARGIN_L + CONTENT_W * 0.6, 14, { width: CONTENT_W * 0.4, align: "right" })
    .text(`Total de clientes: ${rows.length}`, MARGIN_L + CONTENT_W * 0.6, 28, { width: CONTENT_W * 0.4, align: "right" });
  doc.rect(0, 80, PAGE_W, 3).fill(COLORS.accent);
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(11)
    .text("RELATÓRIO DE CLIENTES", MARGIN_L, 96, { width: CONTENT_W });

  // Tabela
  const TABLE_TOP = 118;
  const ROW_H = 22;
  const HEADER_H = 26;

  const COL_DEFS: [string, number][] = [
    ["Nome",         0.22],
    ["Telefone",     0.13],
    ["E-mail",       0.18],
    ["CPF/CNPJ",     0.13],
    ["Cidade",       0.13],
    ["UF",           0.05],
    ["Total OS",     0.08],
    ["Cadastro",     0.08],
  ];
  const totalRatio = COL_DEFS.reduce((s, [, r]) => s + r, 0);
  const cols = COL_DEFS.map(([label, ratio]) => ({
    label,
    width: Math.floor((ratio / totalRatio) * CONTENT_W),
  }));

  let cx = MARGIN_L;
  doc.rect(MARGIN_L, TABLE_TOP, CONTENT_W, HEADER_H).fill(COLORS.primary);
  cols.forEach((col) => {
    doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(8)
      .text(col.label, cx + 4, TABLE_TOP + 8, { width: col.width - 8, ellipsis: true });
    cx += col.width;
  });

  let y = TABLE_TOP + HEADER_H;

  const checkPageBreak = () => {
    if (y + ROW_H > doc.page.height - 60) {
      doc.addPage();
      y = 40;
      cx = MARGIN_L;
      doc.rect(MARGIN_L, y, CONTENT_W, HEADER_H).fill(COLORS.primary);
      cols.forEach((col) => {
        doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(8)
          .text(col.label, cx + 4, y + 8, { width: col.width - 8, ellipsis: true });
        cx += col.width;
      });
      y += HEADER_H;
    }
  };

  rows.forEach((r, i) => {
    checkPageBreak();
    const isEven = i % 2 === 0;
    doc.rect(MARGIN_L, y, CONTENT_W, ROW_H).fill(isEven ? COLORS.rowEven : COLORS.rowOdd);
    doc.rect(MARGIN_L, y + ROW_H - 0.5, CONTENT_W, 0.5).fill(COLORS.border);

    const values = [
      r.name,
      r.phone,
      r.email ?? "—",
      r.document ?? "—",
      r.city ?? "—",
      r.state ?? "—",
      String(Number(r.osCount ?? 0)),
      formatDate(r.createdAt),
    ];

    let vx = MARGIN_L;
    values.forEach((val, ci) => {
      const isOsCount = ci === 6;
      doc.fillColor(isOsCount ? COLORS.primary : COLORS.text)
        .font(isOsCount ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7.5)
        .text(val, vx + 4, y + 7, { width: cols[ci].width - 8, ellipsis: true });
      vx += cols[ci].width;
    });
    y += ROW_H;
  });

  // Linha de total
  checkPageBreak();
  doc.rect(MARGIN_L, y, CONTENT_W, ROW_H + 2).fill(COLORS.totalBg);
  doc.fillColor(COLORS.totalText).font("Helvetica-Bold").fontSize(8.5)
    .text(`Total: ${rows.length} clientes`, MARGIN_L + 4, y + 7, { width: CONTENT_W - 8 });
  y += ROW_H + 2;

  // Rodapé
  const footerY = doc.page.height - 30;
  doc.rect(0, footerY - 4, PAGE_W, 34).fill("#f0f4f8");
  doc.rect(0, footerY - 4, PAGE_W, 1).fill(COLORS.border);
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.5)
    .text(
      `${tenantName}  ·  Documento gerado pelo FullReparo em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}  ·  fullreparo.com.br`,
      MARGIN_L, footerY + 4, { width: CONTENT_W, align: "center" }
    );

  doc.end();
}

// ─── Relatório Financeiro — PDF ───────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  transferencia: "Transferência",
  outro: "Outro",
};

async function handleFinancialReportPdfExport(req: Request, res: Response) {
  const auth = await authenticate(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const [report, tenant] = await Promise.all([
    getFinancialReport(auth.tenantId),
    getTenantById(auth.tenantId),
  ]);

  const tenantName = tenant?.name ?? "Assistência Técnica";
  const filename = `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    info: { Title: `Relatório Financeiro — ${tenantName}`, Author: tenantName, Creator: "FullReparo" },
  });
  doc.pipe(res);

  const PAGE_W = doc.page.width;
  const MARGIN_L = 40;
  const CONTENT_W = PAGE_W - MARGIN_L * 2;
  const now = new Date();

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_W, 80).fill(COLORS.headerBg);
  doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(18)
    .text(tenantName, MARGIN_L, 18, { width: CONTENT_W * 0.65 });
  doc.fillColor("#b0c4de").font("Helvetica").fontSize(9)
    .text("Relatório Financeiro", MARGIN_L, 42, { width: CONTENT_W * 0.65 });
  doc.fillColor(COLORS.headerText).font("Helvetica").fontSize(8)
    .text(`Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, MARGIN_L + CONTENT_W * 0.65, 14, { width: CONTENT_W * 0.35, align: "right" })
    .text("Últimos 12 meses", MARGIN_L + CONTENT_W * 0.65, 28, { width: CONTENT_W * 0.35, align: "right" });
  doc.rect(0, 80, PAGE_W, 3).fill(COLORS.accent);

  let y = 100;

  // ── Receita Total ──────────────────────────────────────────────────────────
  const totalRevenue = report.monthlyRevenue.reduce((s, r) => s + r.total, 0);
  const totalOs = report.monthlyRevenue.reduce((s, r) => s + r.count, 0);

  doc.rect(MARGIN_L, y, CONTENT_W, 50).fill("#f0f4f8").stroke(COLORS.border);
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(11)
    .text("RESUMO FINANCEIRO", MARGIN_L + 12, y + 8);
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8)
    .text("Receita total (pagamentos confirmados nos últimos 12 meses)", MARGIN_L + 12, y + 24);
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(16)
    .text(formatCurrency(totalRevenue), MARGIN_L + CONTENT_W - 180, y + 14, { width: 170, align: "right" });
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8)
    .text(`${totalOs} OS com pagamentos`, MARGIN_L + CONTENT_W - 180, y + 34, { width: 170, align: "right" });
  y += 62;

  // ── Receita Mensal ─────────────────────────────────────────────────────────
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(11)
    .text("RECEITA MENSAL", MARGIN_L, y);
  y += 18;

  if (report.monthlyRevenue.length === 0) {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9)
      .text("Nenhum pagamento registrado no período.", MARGIN_L, y);
    y += 20;
  } else {
    const maxRevenue = Math.max(...report.monthlyRevenue.map((r) => r.total), 1);
    const BAR_H = 16;
    const BAR_MAX_W = CONTENT_W - 120;
    const ROW_H_R = 22;

    // Cabeçalho da tabela de receita mensal
    doc.rect(MARGIN_L, y, CONTENT_W, 20).fill(COLORS.primary);
    doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(8)
      .text("Mês", MARGIN_L + 4, y + 6, { width: 60 })
      .text("OS Pagas", MARGIN_L + 70, y + 6, { width: 50, align: "center" })
      .text("Receita", MARGIN_L + 130, y + 6, { width: 100 })
      .text("Gráfico", MARGIN_L + 240, y + 6, { width: BAR_MAX_W - 10 });
    y += 20;

    report.monthlyRevenue.forEach((r, i) => {
      const isEven = i % 2 === 0;
      doc.rect(MARGIN_L, y, CONTENT_W, ROW_H_R).fill(isEven ? COLORS.rowEven : COLORS.rowOdd);
      doc.rect(MARGIN_L, y + ROW_H_R - 0.5, CONTENT_W, 0.5).fill(COLORS.border);

      // Formatar mês
      const [yr, mo] = (r.month ?? "").split("-");
      const monthName = new Date(Number(yr), Number(mo) - 1, 1)
        .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        .replace(".", "");

      doc.fillColor(COLORS.text).font("Helvetica").fontSize(8)
        .text(monthName, MARGIN_L + 4, y + 7, { width: 60 })
        .text(String(r.count), MARGIN_L + 70, y + 7, { width: 50, align: "center" });
      doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(8)
        .text(formatCurrency(r.total), MARGIN_L + 130, y + 7, { width: 100 });

      // Barra proporcional
      const barW = Math.max(2, Math.floor((r.total / maxRevenue) * BAR_MAX_W));
      doc.rect(MARGIN_L + 240, y + 5, barW, BAR_H - 4).fill(COLORS.accent);

      y += ROW_H_R;
    });

    // Total
    doc.rect(MARGIN_L, y, CONTENT_W, 22).fill(COLORS.totalBg);
    doc.fillColor(COLORS.totalText).font("Helvetica-Bold").fontSize(8.5)
      .text("TOTAL", MARGIN_L + 4, y + 7, { width: 60 })
      .text(String(totalOs), MARGIN_L + 70, y + 7, { width: 50, align: "center" });
    doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9)
      .text(formatCurrency(totalRevenue), MARGIN_L + 130, y + 6, { width: 100 });
    y += 28;
  }

  // ── Top Defeitos ───────────────────────────────────────────────────────────
  if (y > doc.page.height - 200) { doc.addPage(); y = 40; }

  y += 8;
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(11)
    .text("TOP 5 DEFEITOS MAIS COMUNS", MARGIN_L, y);
  y += 18;

  if (report.topDefects.length === 0) {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9)
      .text("Nenhuma OS registrada.", MARGIN_L, y);
    y += 20;
  } else {
    const maxDefect = Math.max(...report.topDefects.map((r) => r.count), 1);
    const BAR_MAX_W_D = CONTENT_W - 200;

    doc.rect(MARGIN_L, y, CONTENT_W, 20).fill(COLORS.primary);
    doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(8)
      .text("#", MARGIN_L + 4, y + 6, { width: 20 })
      .text("Defeito Relatado", MARGIN_L + 30, y + 6, { width: 160 })
      .text("OS", MARGIN_L + 200, y + 6, { width: 40, align: "center" })
      .text("Proporção", MARGIN_L + 250, y + 6, { width: BAR_MAX_W_D });
    y += 20;

    report.topDefects.forEach((r, i) => {
      const isEven = i % 2 === 0;
      doc.rect(MARGIN_L, y, CONTENT_W, 22).fill(isEven ? COLORS.rowEven : COLORS.rowOdd);
      doc.rect(MARGIN_L, y + 21.5, CONTENT_W, 0.5).fill(COLORS.border);

      doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8)
        .text(String(i + 1), MARGIN_L + 4, y + 7, { width: 20 });
      doc.fillColor(COLORS.text).font("Helvetica").fontSize(8)
        .text(r.defect ?? "—", MARGIN_L + 30, y + 7, { width: 160, ellipsis: true });
      doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(8)
        .text(String(r.count), MARGIN_L + 200, y + 7, { width: 40, align: "center" });

      const barW = Math.max(2, Math.floor((r.count / maxDefect) * BAR_MAX_W_D));
      doc.rect(MARGIN_L + 250, y + 6, barW, 10).fill(COLORS.primary);
      y += 22;
    });
    y += 6;
  }

  // ── Métodos de Pagamento ───────────────────────────────────────────────────
  if (y > doc.page.height - 180) { doc.addPage(); y = 40; }

  y += 8;
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(11)
    .text("MÉTODOS DE PAGAMENTO", MARGIN_L, y);
  y += 18;

  if (report.paymentMethods.length === 0) {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9)
      .text("Nenhum pagamento registrado.", MARGIN_L, y);
    y += 20;
  } else {
    doc.rect(MARGIN_L, y, CONTENT_W, 20).fill(COLORS.primary);
    doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(8)
      .text("Método", MARGIN_L + 4, y + 6, { width: 140 })
      .text("Qtd", MARGIN_L + 150, y + 6, { width: 60, align: "center" })
      .text("Total Recebido", MARGIN_L + 220, y + 6, { width: 130 })
      .text("% do Total", MARGIN_L + 360, y + 6, { width: 80, align: "right" });
    y += 20;

    const totalPaid = report.paymentMethods.reduce((s, r) => s + r.total, 0);
    report.paymentMethods.forEach((r, i) => {
      const isEven = i % 2 === 0;
      doc.rect(MARGIN_L, y, CONTENT_W, 22).fill(isEven ? COLORS.rowEven : COLORS.rowOdd);
      doc.rect(MARGIN_L, y + 21.5, CONTENT_W, 0.5).fill(COLORS.border);

      const pct = totalPaid > 0 ? ((r.total / totalPaid) * 100).toFixed(1) : "0.0";
      doc.fillColor(COLORS.text).font("Helvetica").fontSize(8)
        .text(PAYMENT_METHOD_LABELS[r.method] ?? r.method, MARGIN_L + 4, y + 7, { width: 140 })
        .text(String(r.count), MARGIN_L + 150, y + 7, { width: 60, align: "center" });
      doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(8)
        .text(formatCurrency(r.total), MARGIN_L + 220, y + 7, { width: 130 });
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8)
        .text(`${pct}%`, MARGIN_L + 360, y + 7, { width: 80, align: "right" });
      y += 22;
    });

    // Total
    doc.rect(MARGIN_L, y, CONTENT_W, 22).fill(COLORS.totalBg);
    doc.fillColor(COLORS.totalText).font("Helvetica-Bold").fontSize(8.5)
      .text("TOTAL", MARGIN_L + 4, y + 7, { width: 140 })
      .text(String(report.paymentMethods.reduce((s, r) => s + r.count, 0)), MARGIN_L + 150, y + 7, { width: 60, align: "center" });
    doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9)
      .text(formatCurrency(totalPaid), MARGIN_L + 220, y + 6, { width: 130 });
    y += 28;
  }

  // ── Rodapé ─────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 30;
  doc.rect(0, footerY - 4, PAGE_W, 34).fill("#f0f4f8");
  doc.rect(0, footerY - 4, PAGE_W, 1).fill(COLORS.border);
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.5)
    .text(
      `${tenantName}  ·  Documento gerado pelo FullReparo em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}  ·  fullreparo.com.br`,
      MARGIN_L, footerY + 4, { width: CONTENT_W, align: "center" }
    );

  doc.end();
}

// ─── Relatório Financeiro — CSV ───────────────────────────────────────────────

const PAYMENT_METHOD_LABELS_CSV: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  transferencia: "Transferência",
  outro: "Outro",
};

async function handleFinancialReportCsvExport(req: Request, res: Response) {
  const auth = await authenticate(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  // Parâmetros de período opcionais
  const opts: { months?: number; startDate?: Date; endDate?: Date } = {};
  if (req.query.months) opts.months = parseInt(req.query.months as string);
  if (req.query.startDate) opts.startDate = new Date(req.query.startDate as string);
  if (req.query.endDate) {
    const end = new Date(req.query.endDate as string);
    end.setHours(23, 59, 59, 999);
    opts.endDate = end;
  }

  const report = await getFinancialReport(auth.tenantId, opts);
  const tenant = await getTenantById(auth.tenantId);
  const tenantName = tenant?.name ?? "Assistência Técnica";
  const now = new Date();

  const BOM = "\uFEFF";
  const rows: string[] = [];

  // Cabeçalho do documento
  rows.push(`sep=,`);
  rows.push(`"Relatório Financeiro — ${tenantName}"`);
  rows.push(`"Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}"`);
  rows.push(``);

  // ── Seção 1: Receita Mensal ──────────────────────────────────────────────────
  rows.push(`"RECEITA MENSAL"`);
  rows.push([
    "Mês",
    "OS com Pagamento",
    "Receita (R$)",
    "Ticket Médio (R$)",
  ].map((h) => `"${h}"`).join(","));

  const totalRevenue = report.monthlyRevenue.reduce((s, r) => s + r.total, 0);
  const totalOsPaid = report.monthlyRevenue.reduce((s, r) => s + r.count, 0);

  report.monthlyRevenue.forEach((r) => {
    const [yr, mo] = (r.month ?? "").split("-");
    const monthName = new Date(Number(yr), Number(mo) - 1, 1)
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const ticket = r.count > 0 ? (r.total / r.count).toFixed(2) : "0.00";
    rows.push([
      `"${monthName}"`,
      r.count,
      r.total.toFixed(2).replace(".", ","),
      ticket.replace(".", ","),
    ].join(","));
  });

  // Linha de total
  const avgTicket = totalOsPaid > 0 ? (totalRevenue / totalOsPaid).toFixed(2) : "0.00";
  rows.push([
    `"TOTAL"`,
    totalOsPaid,
    totalRevenue.toFixed(2).replace(".", ","),
    avgTicket.replace(".", ","),
  ].join(","));
  rows.push(``);

  // ── Seção 2: Métodos de Pagamento ────────────────────────────────────────────
  rows.push(`"MÉTODOS DE PAGAMENTO"`);
  rows.push([
    "Método",
    "Quantidade",
    "Total Recebido (R$)",
    "% do Total",
  ].map((h) => `"${h}"`).join(","));

  const totalPaid = report.paymentMethods.reduce((s, r) => s + r.total, 0);
  report.paymentMethods.forEach((r) => {
    const pct = totalPaid > 0 ? ((r.total / totalPaid) * 100).toFixed(1) : "0.0";
    rows.push([
      `"${PAYMENT_METHOD_LABELS_CSV[r.method] ?? r.method}"`,
      r.count,
      r.total.toFixed(2).replace(".", ","),
      `"${pct}%"`,
    ].join(","));
  });
  rows.push(``);

  // ── Seção 3: Top Defeitos ────────────────────────────────────────────────────
  rows.push(`"TOP DEFEITOS MAIS COMUNS"`);
  rows.push([
    "Defeito",
    "Quantidade de OS",
  ].map((h) => `"${h}"`).join(","));

  report.topDefects.forEach((r) => {
    rows.push([
      `"${(r.defect ?? "").replace(/"/g, '""')}"`,
      r.count,
    ].join(","));
  });
  rows.push(``);

  // ── Seção 4: Distribuição por Status ─────────────────────────────────────────
  rows.push(`"DISTRIBUIÇÃO POR STATUS DE OS"`);
  rows.push([
    "Status",
    "Quantidade",
    "Valor Total (R$)",
  ].map((h) => `"${h}"`).join(","));

  const STATUS_LABELS_CSV: Record<string, string> = {
    solicitado: "Solicitado",
    aguardando_coleta: "Aguardando Coleta",
    coleta_agendada: "Coleta Agendada",
    coletado: "Coletado",
    recebido_na_assistencia: "Recebido na Assistência",
    em_diagnostico: "Em Diagnóstico",
    aguardando_aprovacao: "Aguardando Aprovação",
    aprovado: "Aprovado",
    recusado: "Recusado",
    aguardando_peca: "Aguardando Peça",
    em_reparo: "Em Reparo",
    pronto: "Pronto",
    aguardando_entrega: "Aguardando Entrega",
    saiu_para_entrega: "Saiu para Entrega",
    entregue: "Entregue",
    finalizado: "Feito",
    encerrado_sem_reparo: "Encerrado sem Reparo",
    encerrado_condenado: "Encerrado Condenado",
    cancelado: "Cancelado",
  };

  report.statusSummary.forEach((r) => {
    rows.push([
      `"${STATUS_LABELS_CSV[r.status] ?? r.status}"`,
      r.count,
      r.total.toFixed(2).replace(".", ","),
    ].join(","));
  });

  const filename = `relatorio-financeiro-${now.toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(BOM + rows.join("\r\n"));
}
