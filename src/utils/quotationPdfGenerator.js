const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Diretório raiz do projeto — logoUrl é um caminho relativo a partir daqui.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ─── Utilitários ─────────────────────────────────────────────────────────────

function resolveLogoPath(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string') return null;
  if (/^https?:\/\//i.test(logoUrl)) return null;

  // Se começa com /, resolve relativo à pasta public do frontend
  let relativePath = logoUrl;
  if (logoUrl.startsWith('/')) {
    relativePath = path.join('SICOV-WEB', 'public', logoUrl);
  }

  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  if (!resolved.startsWith(PROJECT_ROOT + path.sep) && resolved !== PROJECT_ROOT) return null;

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }

  return resolved;
}

function formatSaleMode(saleMode) {
  const map = { kg: 'KG', thousand: 'MIL', unit: 'UN', box: 'CX', linear_meter: 'M', manual: '', ML: 'MIL', KG: 'KG', UN: 'UN', CX: 'CX' };
  return map[saleMode] || saleMode || '';
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
//
//  QTDE(50) + gap(8) + UN(42) + gap(14) + CÓD.CLI(70) + gap(8) + ITEM(193) + MILHEIRO(88) + TOT S/IPI(88) + VALOR IPI(88) + TOTAL(88) = 749 ✓
//
//  Ajustes em relação à versão anterior:
//    - gap UN → CÓD.CLI: 8 → 14pt  (+6)  mais respiro entre as colunas curtas
//    - ITEM: 163 → 193pt            (+30) mais espaço para descrição longa
//    - MILHEIRO/TOT S/IPI/VALOR IPI/TOTAL: 101/101/101/96 → 88/88/88/88  (-39 total)
const COL = {
  qtde:     { x: MARGIN,       w: 35,  align: 'left'  },
  un:       { x: MARGIN + 38,  w: 30,  align: 'left'  },
  codCli:   { x: MARGIN + 72,  w: 70,  align: 'left'  },
  item:     { x: MARGIN + 146, w: 260, align: 'left'  },
  milheiro: { x: MARGIN + 414, w: 80,  align: 'right' },
  totSipi:  { x: MARGIN + 500, w: 80,  align: 'right' },
  valorIpi: { x: MARGIN + 586, w: 80,  align: 'right' },
  total:    { x: MARGIN + 672, w: 84,  align: 'right' },
};

const COLUMNS = [
  { label: 'QTDE',         ...COL.qtde     },
  { label: 'UN',           ...COL.un       },
  { label: 'CÓD.CLI',      ...COL.codCli   },
  { label: 'ITEM',         ...COL.item     },
  { label: 'VLR. UNIT.',   ...COL.milheiro },
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

  // ── Nome do arquivo: nome do cliente - data atual ───────────────────────────
  const clientName = String(c.tradeName || c.name || 'Cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const dateStr    = formatDateFile(new Date());
  const fileName   = `${clientName}-${dateStr}.pdf`;

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
  const dateLong = formatDateLong(new Date());
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

  // Determina label da coluna de preço baseado no modo de venda dos itens
  const saleModeMap = { thousand: 'MILHEIRO', kg: 'PREÇO/KG', unit: 'PREÇO/UN', box: 'PREÇO/CX', linear_meter: 'PREÇO/M', manual: 'PREÇO' };
  const firstQItem = (quotation.items || [])[0];
  const firstQSaleMode = firstQItem?.productSnapshot?.saleMode || 'thousand';
  const unitPriceLabel = saleModeMap[firstQSaleMode] || 'VLR. UNIT.';

  // Cabeçalho das colunas
  doc.fontSize(9).font('Helvetica-Bold');
  COLUMNS.forEach((col) => {
    const label = col.label === 'VLR. UNIT.' ? unitPriceLabel : col.label;
    doc.text(label, col.x, currentY, {
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

  const ROW_H = 18;
  const PAGE_BOTTOM = PAGE_H - MARGIN - 20; // margem inferior segura

  // Função para desenhar cabeçalho da tabela em nova página
  function drawTableHeaderOnNewPage() {
    doc.addPage();
    let y = HEADER_TOP;

    // Logo ou nome do fornecedor (mesmo tamanho da primeira página)
    if (logoPath) {
      try {
        doc.image(logoPath, MARGIN, y, { fit: [LOGO_MAX_W, LOGO_MAX_H] });
      } catch {
        doc.fontSize(13).font('Helvetica-Bold')
          .text(s.tradeName || s.name || '', MARGIN, y + 20, { lineBreak: false });
      }
    } else {
      doc.fontSize(13).font('Helvetica-Bold')
        .text(s.tradeName || s.name || '', MARGIN, y + 20, { lineBreak: false });
    }
    y += LOGO_MAX_H + 14;

    // Linha superior da tabela
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y)
      .lineWidth(0.5).opacity(0.5).stroke().opacity(1);
    y += 6;

    // Cabeçalho das colunas
    doc.fontSize(9).font('Helvetica-Bold');
    COLUMNS.forEach((col) => {
      const label = col.label === 'VLR. UNIT.' ? unitPriceLabel : col.label;
      doc.text(label, col.x, y, {
        width: col.w, align: col.align, lineBreak: false,
      });
    });
    y += 14;

    // Linha abaixo do cabeçalho
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y)
      .lineWidth(0.5).opacity(0.5).stroke().opacity(1);
    y += 5;

    doc.fontSize(9).font('Helvetica');
    return y;
  }

  (quotation.items || []).forEach((item) => {
    // Verifica se precisa de nova página
    if (currentY + ROW_H > PAGE_BOTTOM) {
      currentY = drawTableHeaderOnNewPage();
    }

    const p = item.productSnapshot || {};

    const itemIpi = quotation.subtotal > 0
      ? (item.subtotal / quotation.subtotal) * quotation.ipiValue
      : 0;
    const itemTotal    = item.subtotal + itemIpi;
    const qtyFormatted = Number(item.quantity || 0).toLocaleString('pt-BR');

    const values = [
      qtyFormatted,
      formatSaleMode(p.unitLabel || p.saleMode) || '',
      p.clientCode || '',
      p.name ? (p.description ? `${p.name} - ${p.description}` : p.name) : (p.description || ''),
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

    currentY += ROW_H;
  });

  currentY += 4;

  // Linha inferior da tabela
  doc.moveTo(MARGIN, currentY).lineTo(RIGHT, currentY)
    .lineWidth(0.5).opacity(0.5).stroke().opacity(1);

  currentY += 14;

  // Verifica se os totais (3 linhas ~45pt) cabem na página atual
  if (currentY + 50 > PAGE_BOTTOM) {
    doc.addPage();
    currentY = MARGIN + 40;
  }

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

  // Se observações não cabem, quebra com espaço no topo
  const obsLines = observationsText.split('\n').length;
  const obsEstimate = obsLines * 14 + 10;
  if (currentY + obsEstimate > PAGE_BOTTOM) {
    doc.addPage();
    currentY = MARGIN + 40;
  }

  doc.fontSize(10).font('Helvetica')
    .text(observationsText, MARGIN, currentY, { width: PAGE_W - 2 * MARGIN });

  currentY = doc.y + 20;

  // ── ENCERRAMENTO ───────────────────────────────────────────────────────────
  // Se encerramento não cabe, quebra com espaço no topo
  if (currentY + 60 > PAGE_BOTTOM) {
    doc.addPage();
    currentY = MARGIN + 40;
  }

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
