const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ─── Segurança: resolve logo de forma segura ─────────────────────────────────

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

// ─── Formatadores ────────────────────────────────────────────────────────────

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatCnpj(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '');
  if (d.length !== 14) return value;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatCpf(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '');
  if (d.length !== 11) return value;
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function formatCnpjCpf(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '');
  if (d.length === 14) return formatCnpj(d);
  if (d.length === 11) return formatCpf(d);
  return value;
}

function formatPhone(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return value;
}

function formatZipCode(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '');
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return value;
}

function formatSaleMode(saleMode) {
  const map = { kg: 'KG', thousand: 'MIL', unit: 'UN', box: 'CX', linear_meter: 'M', manual: '', ML: 'MIL', KG: 'KG', UN: 'UN', CX: 'CX' };
  return map[saleMode] || saleMode || '';
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
  return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const MARGIN   = 43;
const PAGE_W   = 841.89; // A4 landscape
const PAGE_H   = 595.28;
const CONTENT_W = PAGE_W - 2 * MARGIN; // 755.89 pt

// Colunas da tabela de itens
const COLUMNS = [
  { label: 'COD.FORN',  x: MARGIN,       w: 69,  align: 'left'  },
  { label: 'COD.CLI',   x: MARGIN + 75,  w: 64,  align: 'left'  },
  { label: 'DESCRIÇÃO', x: MARGIN + 145, w: 234, align: 'left'  },
  { label: 'QNT',       x: MARGIN + 385, w: 40,  align: 'right' },
  { label: 'UN',        x: MARGIN + 431, w: 34,  align: 'left'  },
  { label: 'VLR. UNIT.', x: MARGIN + 471, w: 75,  align: 'right' },
  { label: 'TOT S/IPI', x: MARGIN + 552, w: 75,  align: 'right' },
  { label: 'IPI',       x: MARGIN + 633, w: 60,  align: 'right' },
  { label: 'TOTAL',     x: MARGIN + 699, w: 57,  align: 'right' },
];

const ROW_H        = 16; // altura de cada linha de item
const HEADER_H     = 40; // altura do bloco cabeçalho da tabela (linha + labels + linha)
const TOTALS_H     = 60; // altura do bloco de totais
const SIGNATURE_H  = 24; // altura da assinatura

// Altura mínima necessária no rodapé para fechar a página com totais + assinatura
const FOOTER_RESERVE = TOTALS_H + SIGNATURE_H + 10;

// ─── Helpers de desenho ───────────────────────────────────────────────────────

/** Linha horizontal de x=MARGIN até x=PAGE_W-MARGIN */
function hline(doc, y, opacity = 0.5, lineWidth = 0.5) {
  doc
    .save()
    .moveTo(MARGIN, y)
    .lineTo(PAGE_W - MARGIN, y)
    .lineWidth(lineWidth)
    .opacity(opacity)
    .stroke()
    .restore();
}

/**
 * Desenha um campo com label em negrito acima e valor abaixo.
 * Usa coordenadas top-down.
 * GAP = espaço entre o label e o valor (padrão 11pt).
 */
function field(doc, label, value, x, y, w, gap = 9) {
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text(label, x, y, { width: w, lineBreak: false });

  const val = value || '';
  const textWidth = doc.font('Helvetica').fontSize(9).widthOfString(val);

  if (textWidth > w * 1.8) {
    // Muito longo: usa fonte menor E permite quebra de linha
    doc.fontSize(7.5).font('Helvetica').text(val, x, y + gap, { width: w });
  } else if (textWidth > w) {
    // Longo: reduz a fonte para caber em uma linha
    const fontSize = Math.max(7, 9 * (w / textWidth));
    doc.fontSize(fontSize).font('Helvetica').text(val, x, y + gap, { width: w, lineBreak: false });
  } else {
    doc.fontSize(9).font('Helvetica').text(val, x, y + gap, { width: w, lineBreak: false });
  }
}

// ─── Seções reutilizáveis ─────────────────────────────────────────────────────

/**
 * Desenha o cabeçalho do fornecedor (logo ou texto) + número e data do pedido.
 * Retorna a coordenada Y logo abaixo do cabeçalho.
 */
function drawHeader(doc, order) {
  const s = order.supplierSnapshot || {};
  const logoPath = resolveLogoPath(s.logoUrl);

  const LOGO_MAX_W = 560;
  const LOGO_MAX_H = 70;
  const HEADER_TOP = 18;

  if (logoPath) {
    try {
      doc.image(logoPath, MARGIN, HEADER_TOP, { fit: [LOGO_MAX_W, LOGO_MAX_H] });
    } catch {
      drawSupplierText(doc, s, HEADER_TOP);
    }
  } else {
    drawSupplierText(doc, s, HEADER_TOP);
  }

  // Pedido Nº e data — canto direito
  const RIGHT_X = PAGE_W - MARGIN - 130;
  doc.fontSize(13).font('Helvetica-Bold')
    .text(`PEDIDO Nº ${order.orderNumber}`, RIGHT_X, HEADER_TOP + 4, { width: 130, align: 'right', lineBreak: false });
  doc.fontSize(9).font('Helvetica')
    .text(`Data: ${formatDate(order.createdAt)}`, RIGHT_X, HEADER_TOP + 22, { width: 130, align: 'right', lineBreak: false });

  return HEADER_TOP + LOGO_MAX_H + 8;
}

function drawSupplierText(doc, s, top) {
  doc.fontSize(11).font('Helvetica-Bold').text(s.name || '', MARGIN, top, { lineBreak: false });
  let ty = top + 15;
  doc.fontSize(8).font('Helvetica');
  const line1 = [
    s.cnpj            ? `CNPJ: ${formatCnpj(s.cnpj)}`          : null,
    s.stateRegistration ? `IE: ${s.stateRegistration}`          : null,
    s.phone           ? `Fone: ${formatPhone(s.phone)}`         : null,
  ].filter(Boolean).join('   ');
  if (line1) { doc.text(line1, MARGIN, ty, { lineBreak: false }); ty += 11; }

  if (s.address) {
    const cepPart = s.zipCode ? ` - CEP: ${formatZipCode(s.zipCode)}` : '';
    doc.text(`Endereço: ${s.address}${cepPart}`, MARGIN, ty, { lineBreak: false });
    ty += 11;
  }
  const line3 = [
    s.city || s.state ? [s.city, s.state].filter(Boolean).join(' - ') : null,
    s.email           ? `E-mail: ${s.email}`                           : null,
  ].filter(Boolean).join('   ');
  if (line3) doc.text(line3, MARGIN, ty, { lineBreak: false });
}

/**
 * Desenha o bloco "DADOS DO CLIENTE" e retorna Y abaixo do bloco.
 *
 * Layout das linhas (largura útil = 755.89 pt):
 *
 *  Linha 1 │ RAZÃO SOCIAL (290)          │ CNPJ/CPF (155)  │ UF (40)  │ IE (rest)
 *  Linha 2 │ ENDEREÇO (290)              │ BAIRRO (155)    │ CEP (rest)
 *  Linha 3 │ MUNICÍPIO (290)             │ TELEFONE (155)  │ E-MAIL (rest)
 *  Linha 4 │ PRAZO PARA PAGAMENTO (290)  │ PRAZO PARA ENTREGA (rest)
 *  Linha 5 │ PEDIDO DO CLIENTE (full)
 *  Linha 6 │ OBSERVAÇÃO (full, se houver)
 *
 *  Coluna A: x = MARGIN,       w = 290
 *  Coluna B: x = MARGIN + 296, w = 155   (gap de 6pt entre colunas)
 *  Coluna C: x = MARGIN + 457, w = 40    (UF / CEP label)
 *  Coluna D: x = MARGIN + 503, w = rest  (IE / CEP valor / E-mail)
 */
function drawClientData(doc, order, startY) {
  const c = order.clientSnapshot || {};

  // Pontos de ancoragem das colunas
  const COL_A = MARGIN;
  const COL_B = MARGIN + 296;
  const COL_C = MARGIN + 457;
  const COL_D = MARGIN + 503;
  const W_A   = 290;
  const W_B   = 155;
  const W_C   = 40;
  const W_D   = PAGE_W - MARGIN - COL_D; // até a margem direita
  const ROW_STEP = 24; // altura de cada linha de campo (label + valor + espaço após o valor)

  let y = startY;

  hline(doc, y, 0.4);
  y += 6;

  doc.fontSize(10).font('Helvetica-Bold').text('DADOS DO CLIENTE', MARGIN, y);
  y += 16;

  // ── Linha 1: Razão Social | CNPJ/CPF | UF | IE ───────────────────────────
  field(doc, 'RAZÃO SOCIAL', c.name,                    COL_A, y, W_A);
  field(doc, 'CNPJ/CPF',     formatCnpjCpf(c.cnpj),    COL_B, y, W_B);
  field(doc, 'UF',           c.state,                   COL_C, y, W_C);
  field(doc, 'IE',           c.stateRegistration,       COL_D, y, W_D);

  // Se o nome é muito longo, dá mais espaço vertical
  const nameWidth = doc.font('Helvetica').fontSize(9).widthOfString(c.name || '');
  const row1Height = nameWidth > W_A ? ROW_STEP + 12 : ROW_STEP;
  y += row1Height;

  // ── Linha 2: Endereço | Bairro | CEP ─────────────────────────────────────
  field(doc, 'ENDEREÇO', c.address,                COL_A, y, W_A);
  field(doc, 'BAIRRO',   c.district,               COL_B, y, W_B);
  field(doc, 'CEP',      formatZipCode(c.zipCode), COL_C, y, W_C + 6 + W_D); // ocupa C+D
  y += ROW_STEP;

  // ── Linha 3: Município | Telefone | E-mail ────────────────────────────────
  field(doc, 'MUNICÍPIO', c.city,                COL_A, y, W_A);
  field(doc, 'TELEFONE',  formatPhone(c.phone),  COL_B, y, W_B);
  field(doc, 'E-MAIL PARA ENVIO DA NF-e', c.email, COL_C, y, W_C + 6 + W_D);
  y += ROW_STEP;

  // ── Linha 4: Prazo pagamento | Prazo entrega ──────────────────────────────
  field(doc, 'PRAZO PARA PAGAMENTO', order.paymentTerm,              COL_A, y, W_A);
  field(doc, 'PRAZO PARA ENTREGA',   formatDate(order.deliveryDate), COL_B, y, W_B + 6 + W_C + 6 + W_D);
  y += ROW_STEP;

  // ── Linha 5: Pedido do cliente ────────────────────────────────────────────
  field(doc, 'PEDIDO DO CLIENTE', order.customerPurchaseOrder, COL_A, y, CONTENT_W);
  y += ROW_STEP + 8; // espaço extra antes das observações

  // ── Linha 6: Observações (apenas se houver) ───────────────────────────────
  const observations = [order.notes, c.notes].filter(Boolean).join('\n');
  if (observations) {
    doc.fontSize(9).font('Helvetica-Bold').text('OBSERVAÇÃO', MARGIN, y);
    y += 13;
    doc.fontSize(9).font('Helvetica').text(observations, MARGIN, y, { width: CONTENT_W });
    y = doc.y + 4;
  }

  return y;
}

/**
 * Desenha o cabeçalho da tabela de itens e retorna Y abaixo dele.
 */
function drawTableHeader(doc, y) {
  hline(doc, y, 0.6);
  y += 5;

  doc.fontSize(8).font('Helvetica-Bold');
  COLUMNS.forEach((col) => {
    doc.text(col.label, col.x, y, { width: col.w, align: col.align, lineBreak: false });
  });
  y += 12;

  hline(doc, y, 0.6);
  y += 4;

  return y;
}

/**
 * Desenha os totais (subtotal, IPI, total).
 */
function drawTotals(doc, order, y) {
  const s = order.supplierSnapshot || {};

  hline(doc, y, 0.25);
  y += 8;

  const LABEL_X = MARGIN + 490;
  const VALUE_X = MARGIN + 600;
  const VALUE_W = PAGE_W - MARGIN - VALUE_X;

  doc.fontSize(9).font('Helvetica');
  doc.text('Subtotal s/ IPI:', LABEL_X, y, { lineBreak: false });
  doc.text(formatCurrency(order.subtotal), VALUE_X, y, { width: VALUE_W, align: 'right', lineBreak: false });
  y += 13;

  doc.text(`IPI (${s.ipi || 0}%):`, LABEL_X, y, { lineBreak: false });
  doc.text(formatCurrency(order.ipiValue), VALUE_X, y, { width: VALUE_W, align: 'right', lineBreak: false });
  y += 13;

  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL GERAL:', LABEL_X, y, { lineBreak: false });
  doc.text(formatCurrency(order.total), VALUE_X, y, { width: VALUE_W, align: 'right', lineBreak: false });

  return y;
}

/**
 * Desenha o nome da vendedora fixo no rodapé da página.
 */
function drawSellerFooter(doc, order) {
  const footerY = PAGE_H - MARGIN - 10;
  doc.fontSize(9).font('Helvetica')
    .text(order.sellerName || '', MARGIN, footerY, { lineBreak: false });
}

// ─── Gerador principal ────────────────────────────────────────────────────────

function generateOrderPdf(order, res) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    autoFirstPage: true,
  });

  // Nome do arquivo: nº pedido - empresa - PC-xxx (se tiver) - data de entrega
  const companyName = sanitize(order.clientSnapshot?.tradeName || order.clientSnapshot?.name || '');
  const purchaseOrder = order.customerPurchaseOrder ? `PC-${sanitize(order.customerPurchaseOrder)}` : '';
  const date = formatDateFile(order.deliveryDate || order.createdAt);
  let fileName = `${order.orderNumber}-${companyName}`;
  if (purchaseOrder) fileName += `-${purchaseOrder}`;
  fileName += `-${date}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  // ── Página 1: cabeçalho + dados do cliente + início da tabela ────────────

  let y = drawHeader(doc, order);
  y = drawClientData(doc, order, y);
  y += 4;
  y = drawTableHeader(doc, y);

  // ── Itens ─────────────────────────────────────────────────────────────────

  const items = order.items || [];

  doc.fontSize(8).font('Helvetica');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = item.productSnapshot || {};

    const itemIpi = order.subtotal > 0
      ? (item.subtotal / order.subtotal) * order.ipiValue
      : 0;
    const itemTotal    = item.subtotal + itemIpi;
    const qtyFormatted = Number(item.quantity || 0).toLocaleString('pt-BR');

    const values = [
      p.supplierCode || '',
      p.clientCode   || '',
      p.name ? (p.description ? `${p.name} - ${p.description}` : p.name) : (p.description || ''),
      qtyFormatted,
      formatSaleMode(p.unitLabel || p.saleMode) || '',
      formatCurrency(item.unitPrice),
      formatCurrency(item.subtotal),
      formatCurrency(itemIpi),
      formatCurrency(itemTotal),
    ];

    // Verifica se há espaço para este item + rodapé obrigatório
    const isLastItem = i === items.length - 1;
    const spaceNeeded = ROW_H + (isLastItem ? FOOTER_RESERVE : 0);

    if (y + spaceNeeded > PAGE_H - MARGIN) {
      // Não cabe — nova página com cabeçalho compacto da tabela
      doc.addPage();
      y = drawHeader(doc, order);
      y += 4;
      y = drawTableHeader(doc, y);
      doc.fontSize(8).font('Helvetica');
    }

    COLUMNS.forEach((col, ci) => {
      doc.text(values[ci], col.x, y, { width: col.w, align: col.align, lineBreak: false });
    });

    y += ROW_H;
  }

  // ── Totais e assinatura ───────────────────────────────────────────────────

  // Se não couber na página atual, abre nova
  if (y + FOOTER_RESERVE > PAGE_H - MARGIN) {
    doc.addPage();
    y = drawHeader(doc, order);
    y += 8;
  }

  drawTotals(doc, order, y);

  // Nome da vendedora fixo no rodapé da página
  drawSellerFooter(doc, order);

  doc.end();
}

module.exports = generateOrderPdf;
