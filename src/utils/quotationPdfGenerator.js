const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Diretório raiz do projeto — logoUrl é um caminho relativo a partir daqui.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ─── Utilitários ─────────────────────────────────────────────────────────────

function resolveLogoPath(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string') return null;
  if (/^https?:\/\//i.test(logoUrl)) return null;
  if (path.isAbsolute(logoUrl)) return null;

  const resolved = path.resolve(PROJECT_ROOT, logoUrl);
  if (!resolved.startsWith(PROJECT_ROOT + path.sep) && resolved !== PROJECT_ROOT) return null;

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }

  return resolved;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function sanitize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

function formatDateFile(value) {
  if (!value) return '';
  const d = new Date(value);
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatDateLong(value) {
  const d = value ? new Date(value) : new Date();
  const day   = String(d.getDate()).padStart(2, '0');
  const month = MESES[d.getMonth()];
  const year  = d.getFullYear();
  return `${day} de ${month} de ${year}`;
}

// ─── Layout A4 Landscape ──────────────────────────────────────────────────────
// PDFKit landscape: width=841.89, height=595.28
// Usamos coordenadas absolutas com margem de 43pt (igual ao orderPdfGenerator)

const PAGE_W  = 841.89;
const PAGE_H  = 595.28;
const MARGIN  = 43;
const RIGHT   = PAGE_W - MARGIN; // ~799

// Colunas da tabela (largura útil = 799 - 43 = 756pt):
//   QTDE(55)+GAP(10)+UN(45)+ITEM(241)+MILHEIRO(101)+TOT S/IPI(101)+VALOR IPI(101)+TOTAL(102) = 756 ✓
const COL = {
  qtde:     { x: MARGIN,       w: 55,  align: 'left'  },
  un:       { x: MARGIN + 65,  w: 45,  align: 'left'  },
  item:     { x: MARGIN + 110, w: 241, align: 'left'  },
  milheiro: { x: MARGIN + 351, w: 101, align: 'right' },
  totSipi:  { x: MARGIN + 452, w: 101, align: 'right' },
  valorIpi: { x: MARGIN + 553, w: 101, align: 'right' },
  total:    { x: MARGIN + 654, w: 102, align: 'right' },
};

const COLUMNS = [
  { label: 'QTDE',         ...COL.qtde     },
  { label: 'UN',           ...COL.un       },
  { label: 'ITEM',         ...COL.item     },
  { label: 'MILHEIRO',     ...COL.milheiro },
  { label: 'TOTAL S/ IPI', ...COL.totSipi  },
  { label: 'VALOR IPI',    ...COL.valorIpi },
  { label: 'TOTAL',        ...COL.total    },
];

// ─── Gerador principal ────────────────────────────────────────────────────────

function generateQuotationPdf(quotation, res) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    autoFirstPage: true,
  });

  const c = quotation.clientSnapshot || {};
  const s = quotation.supplierSnapshot || {};

  // ── Nome do arquivo ────────────────────────────────────────────────────────
  const clientName = sanitize(c.tradeName || c.name || 'CLIENTE');
  const dateStr    = formatDateFile(quotation.createdAt || new Date());
  const fileName   = `ORCAMENTO-${clientName}-${dateStr}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  // ── CABEÇALHO ──────────────────────────────────────────────────────────────
  // Esquerda: logo ou nome do fornecedor
  // Direita:  cidade + data por extenso
  const LOGO_MAX_W = 280;
  const LOGO_MAX_H = 70;
  const HEADER_TOP = 22;

  const logoPath = resolveLogoPath(s.logoUrl);

  if (logoPath) {
    try {
      doc.image(logoPath, MARGIN, HEADER_TOP, { fit: [LOGO_MAX_W, LOGO_MAX_H] });
    } catch {
      doc.fontSize(13).font('Helvetica-Bold')
        .text(s.name || '', MARGIN, HEADER_TOP + 20, { lineBreak: false });
    }
  } else {
    doc.fontSize(13).font('Helvetica-Bold')
      .text(s.name || '', MARGIN, HEADER_TOP + 20, { lineBreak: false });
  }

  // Data — canto direito, alinhada verticalmente ao meio do logo
  const city     = s.city || '';
  const dateLong = formatDateLong(quotation.createdAt);
  const dateText = city ? `${city}, ${dateLong}` : dateLong;

  doc.fontSize(10).font('Helvetica')
    .text(dateText, MARGIN, HEADER_TOP + 28, {
      width: PAGE_W - 2 * MARGIN,
      align: 'right',
      lineBreak: false,
    });

  // ── DESTINATÁRIO ───────────────────────────────────────────────────────────
  const RECIPIENT_Y = HEADER_TOP + LOGO_MAX_H + 14;

  const clientDisplayName = c.tradeName || c.name || '';
  doc.fontSize(13).font('Helvetica-Bold')
    .text(clientDisplayName, MARGIN, RECIPIENT_Y, {
      width: PAGE_W - 2 * MARGIN,
      lineBreak: false,
    });

  let currentY = RECIPIENT_Y + 18;

  // A/C apenas quando preenchido
  if (quotation.attn) {
    doc.fontSize(10).font('Helvetica-Bold')
      .text(`A/C ${quotation.attn}`, MARGIN, currentY, {
        width: PAGE_W - 2 * MARGIN,
        lineBreak: false,
      });
    currentY += 14;
  }

  // Texto introdutório
  doc.fontSize(10).font('Helvetica')
    .text(
      'Segue abaixo nossa proposta com os valores e demais condições de fornecimento',
      MARGIN, currentY, { width: PAGE_W - 2 * MARGIN, lineBreak: false },
    );

  currentY += 20;

  // ── TABELA DE ITENS ────────────────────────────────────────────────────────
  // Linha superior
  doc.moveTo(MARGIN, currentY).lineTo(RIGHT, currentY)
    .lineWidth(0.5).opacity(0.5).stroke().opacity(1);

  currentY += 6;

  // Cabeçalho das colunas
  doc.fontSize(9).font('Helvetica-Bold');
  COLUMNS.forEach((col) => {
    doc.text(col.label, col.x, currentY, {
      width: col.w, align: col.align, lineBreak: false,
    });
  });

  currentY += 14;

  // Linha abaixo do cabeçalho
  doc.moveTo(MARGIN, currentY).lineTo(RIGHT, currentY)
    .lineWidth(0.5).opacity(0.5).stroke().opacity(1);

  currentY += 5;

  // Linhas de dados
  doc.fontSize(9).font('Helvetica');

  (quotation.items || []).forEach((item) => {
    const p = item.productSnapshot || {};

    const itemIpi = quotation.subtotal > 0
      ? (item.subtotal / quotation.subtotal) * quotation.ipiValue
      : 0;
    const itemTotal    = item.subtotal + itemIpi;
    const qtyFormatted = Number(item.quantity || 0).toLocaleString('pt-BR');

    const values = [
      qtyFormatted,
      p.unitLabel || p.saleMode || '',
      p.description || p.name || '',
      formatCurrency(item.unitPrice),
      formatCurrency(item.subtotal),
      formatCurrency(itemIpi),
      formatCurrency(itemTotal),
    ];

    COLUMNS.forEach((col, i) => {
      doc.text(values[i], col.x, currentY, {
        width: col.w, align: col.align, lineBreak: false,
      });
    });

    currentY += 18;
  });

  currentY += 4;

  // Linha inferior da tabela
  doc.moveTo(MARGIN, currentY).lineTo(RIGHT, currentY)
    .lineWidth(0.5).opacity(0.5).stroke().opacity(1);

  currentY += 14;

  // ── TOTAIS ─────────────────────────────────────────────────────────────────
  // Alinhados à direita, espelhando o modelo
  const TOTAL_LABEL_X = MARGIN + 490;
  const TOTAL_VALUE_X = MARGIN + 625;
  const TOTAL_VALUE_W = 131; // até RIGHT (799)

  doc.fontSize(10).font('Helvetica');
  doc.text('Subtotal s/ IPI:', TOTAL_LABEL_X, currentY, { lineBreak: false });
  doc.text(formatCurrency(quotation.subtotal), TOTAL_VALUE_X, currentY, {
    width: TOTAL_VALUE_W, align: 'right', lineBreak: false,
  });

  currentY += 15;

  doc.text(`Total IPI${s.ipi ? ` (${s.ipi}%)` : ''}:`, TOTAL_LABEL_X, currentY, { lineBreak: false });
  doc.text(formatCurrency(quotation.ipiValue), TOTAL_VALUE_X, currentY, {
    width: TOTAL_VALUE_W, align: 'right', lineBreak: false,
  });

  currentY += 15;

  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL GERAL:', TOTAL_LABEL_X, currentY, { lineBreak: false });
  doc.text(formatCurrency(quotation.total), TOTAL_VALUE_X, currentY, {
    width: TOTAL_VALUE_W, align: 'right', lineBreak: false,
  });

  currentY += 26;

  // ── OBSERVAÇÕES ────────────────────────────────────────────────────────────
  let observationsText = quotation.observations;

  if (!observationsText) {
    const paymentLine = quotation.paymentTerm
      ? `Condições de pagamento: ${quotation.paymentTerm}`
      : 'Condições de pagamento: A combinar';

    let deliveryLine = 'Prazo para entrega: A combinar';
    if (quotation.deliveryDate) {
      const d = new Date(quotation.deliveryDate);
      deliveryLine = `Prazo para entrega: ${d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
    }

    observationsText = [
      paymentLine,
      'I.C.M.S.: 18% (Incluso no preço acima)',
      'PIS e COFINS.: (Incluso no preço acima)',
      deliveryLine,
      'Frete: CIF',
    ].join('\n');
  }

  doc.fontSize(10).font('Helvetica')
    .text(observationsText, MARGIN, currentY, { width: PAGE_W - 2 * MARGIN });

  currentY = doc.y + 20;

  // ── ENCERRAMENTO ───────────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica')
    .text(
      'No aguardo de um retorno positivo, coloco-me à disposição para maiores esclarecimentos',
      MARGIN, currentY, { width: PAGE_W - 2 * MARGIN },
    );

  currentY = doc.y + 12;

  doc.text('Sds', MARGIN, currentY, { lineBreak: false });

  currentY += 14;

  doc.font('Helvetica-Bold')
    .text(quotation.sellerName || '', MARGIN, currentY, { lineBreak: false });

  doc.end();
}

module.exports = generateQuotationPdf;
