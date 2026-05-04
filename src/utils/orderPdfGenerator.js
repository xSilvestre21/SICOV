const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Diretório raiz do projeto — logoUrl é um caminho relativo a partir daqui.
// Ex: "src/assets/logos/Logo-Eripack.jpg.jpeg"
// Isso impede path traversal: qualquer tentativa de sair do diretório é bloqueada.
// __dirname está em src/utils, então subimos 2 níveis para chegar na raiz do projeto
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Valida e resolve o caminho da logo de forma segura.
 * Retorna o caminho absoluto se for válido, ou null caso contrário.
 */
function resolveLogoPath(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string') return null;

  // Rejeita URLs HTTP/HTTPS e caminhos absolutos
  if (/^https?:\/\//i.test(logoUrl)) return null;
  if (path.isAbsolute(logoUrl)) return null;

  const resolved = path.resolve(PROJECT_ROOT, logoUrl);

  // Garante que o caminho resolvido está dentro do diretório raiz do projeto
  if (!resolved.startsWith(PROJECT_ROOT + path.sep) && resolved !== PROJECT_ROOT) {
    return null;
  }

  // Verifica se o arquivo existe e é um arquivo regular
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
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
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
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// ─── Helper: posiciona texto com coordenadas absolutas ───────────────────────
const PAGE_H = 595.28; // altura A4 landscape
const Y_OFFSET = 3;    // offset interno do PDFKit medido empiricamente

function py(pdfY, fontSize) {
  return PAGE_H - pdfY - fontSize + Y_OFFSET;
}

function field(doc, label, value, x, pdfLabelY, width) {
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(label, x, py(pdfLabelY, 9), { width, lineBreak: false });

  doc
    .fontSize(10)
    .font('Helvetica')
    .text(value || '', x, py(pdfLabelY - 12, 10), { width, lineBreak: false });
}

// ─── Gerador principal ───────────────────────────────────────────────────────

function generateOrderPdf(order, res) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    autoFirstPage: true,
  });

  // ── Nome do arquivo ──────────────────────────────────────────────────────
  const companyName = sanitize(
    order.clientSnapshot.tradeName || order.clientSnapshot.name,
  );

  let purchaseOrder = '';
  if (order.customerPurchaseOrder) {
    purchaseOrder = `PC-${sanitize(order.customerPurchaseOrder)}`;
  }

  const date = formatDateFile(order.createdAt);
  let fileName = `${order.orderNumber}-${companyName}`;
  if (purchaseOrder) fileName += `-${purchaseOrder}`;
  fileName += `-${date}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  const c = order.clientSnapshot || {};
  const s = order.supplierSnapshot || {};

  // ── CABEÇALHO DO FORNECEDOR ──────────────────────────────────────────────
  // Lado esquerdo: logo ou dados textuais do fornecedor (x=43..680)
  // Lado direito:  PEDIDO Nº e Data (x=692..799)
  const logoPath = resolveLogoPath(s.logoUrl);

  if (logoPath) {
    try {
      // Logo no lado esquerdo do cabeçalho, altura máxima de 82pt
      doc.image(logoPath, 43, 22, { fit: [630, 82] });
    } catch {
      // Fallback para texto se a imagem não puder ser carregada
      doc.fontSize(12).font('Helvetica-Bold').text(s.name || '', 43, py(553, 12));
      doc.fontSize(9).font('Helvetica');
      if (s.cnpj) doc.text(`CNPJ: ${s.cnpj}`, 43, py(539, 9), { lineBreak: false });
      if (s.stateRegistration) doc.text(`IE: ${s.stateRegistration}`, 159, py(539, 9), { lineBreak: false });
      if (s.phone) doc.text(`Fone: ${s.phone}`, 248, py(539, 9), { lineBreak: false });
      if (s.address) {
        const cepPart = s.zipCode ? ` - CEP: ${s.zipCode}` : '';
        doc.text(`Endereço: ${s.address}${cepPart}`, 43, py(527, 9), { lineBreak: false });
      }
      if (s.city || s.state) {
        doc.text([s.city, s.state].filter(Boolean).join(' - '), 43, py(515, 9), { lineBreak: false });
      }
      if (s.email) doc.text(`E-mail: ${s.email}`, 113, py(515, 9), { lineBreak: false });
    }
  } else {
    // Sem logo: exibe nome e dados do fornecedor em texto
    doc.fontSize(12).font('Helvetica-Bold').text(s.name || '', 43, py(553, 12));
    doc.fontSize(9).font('Helvetica');
    if (s.cnpj) doc.text(`CNPJ: ${s.cnpj}`, 43, py(539, 9), { lineBreak: false });
    if (s.stateRegistration) doc.text(`IE: ${s.stateRegistration}`, 159, py(539, 9), { lineBreak: false });
    if (s.phone) doc.text(`Fone: ${s.phone}`, 248, py(539, 9), { lineBreak: false });
    if (s.address) {
      const cepPart = s.zipCode ? ` - CEP: ${s.zipCode}` : '';
      doc.text(`Endereço: ${s.address}${cepPart}`, 43, py(527, 9), { lineBreak: false });
    }
    if (s.city || s.state) {
      doc.text([s.city, s.state].filter(Boolean).join(' - '), 43, py(515, 9), { lineBreak: false });
    }
    if (s.email) doc.text(`E-mail: ${s.email}`, 113, py(515, 9), { lineBreak: false });
  }

  // PEDIDO Nº — lado direito do cabeçalho
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(`PEDIDO Nº ${order.orderNumber}`, 692, py(553, 14), { lineBreak: false });

  // Data
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`Data: ${formatDate(order.createdAt)}`, 723, py(537, 10), { lineBreak: false });

  // ── DADOS DO CLIENTE ─────────────────────────────────────────────────────
  doc
    .moveTo(43, py(490, 0))
    .lineTo(799, py(490, 0))
    .lineWidth(0.5)
    .opacity(0.6)
    .stroke()
    .opacity(1);

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('DADOS DO CLIENTE', 43, py(461, 12));

  field(doc, 'RAZÃO SOCIAL',  c.name,              43,  441, 305);
  field(doc, 'CNPJ/CPF',      c.cnpj,              354, 441, 122);
  field(doc, 'IE',            c.stateRegistration, 482, 441, 316);

  field(doc, 'ENDEREÇO', c.address,  43,  409, 305);
  field(doc, 'BAIRRO',   c.district, 354, 409, 122);

  field(doc, 'MUNICÍPIO', c.city,    43,  377, 305);
  field(doc, 'UF',        c.state,   354, 377, 79);
  field(doc, 'CEP',       c.zipCode, 439, 377, 359);

  field(doc, 'TELEFONE',                  c.phone, 43,  345, 305);
  field(doc, 'E-MAIL PARA ENVIO DA NF-e', c.email, 354, 345, 444);

  field(doc, 'PRAZO PARA PAGAMENTO', order.paymentTerm,              43,  313, 305);
  field(doc, 'PRAZO PARA ENTREGA',   formatDate(order.deliveryDate), 354, 313, 444);

  field(doc, 'PEDIDO DO CLIENTE', order.customerPurchaseOrder, 43, 281, 755);

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('OBSERVAÇÃO', 43, py(249, 9));

  const observations = [order.notes, c.notes].filter(Boolean).join('\n');
  if (observations) {
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(observations, 43, py(237, 10), { width: 755 });
  }

  // ── TABELA DE ITENS ──────────────────────────────────────────────────────
  // Layout das colunas (total usável: x=46..800 = 754pt):
  //
  //  COD.FORN  COD.CLI  DESCRIÇÃO        QNT   UN   MILHEIRO  TOT S/IPI  IPI      TOTAL
  //  x=46      x=121    x=191            x=431 x=471 x=511    x=581      x=661    x=731
  //  w=69      w=64     w=234            w=34  w=34  w=64     w=74       w=64     w=69
  //
  // DESCRIÇÃO reduzida de 285 → 234 (-51pt), redistribuídos:
  //   QNT:      29 → 34  (+5)
  //   UN:       33 → 34  (+1)
  //   MILHEIRO: 62 → 64  (+2)
  //   TOT S/IPI:70 → 74  (+4)
  //   VALOR IPI:70 → 64  (-6)  ← "IPI" é mais curto, cabe em menos
  //   TOTAL:    70 → 69  (-1)
  //   Ganho líquido redistribuído: 51pt ✓
  const columns = [
    { label: 'COD.FORN',   headerX: 46,  valueX: 46,  valueWidth: 69  },
    { label: 'COD.CLI',    headerX: 121, valueX: 121, valueWidth: 64  },
    { label: 'DESCRIÇÃO',  headerX: 191, valueX: 191, valueWidth: 234 },
    { label: 'QNT',        headerX: 431, valueX: 431, valueWidth: 34  },
    { label: 'UN',         headerX: 471, valueX: 471, valueWidth: 34  },
    { label: 'MILHEIRO',   headerX: 511, valueX: 511, valueWidth: 64  },
    { label: 'TOT S/IPI',  headerX: 581, valueX: 581, valueWidth: 74  },
    { label: 'IPI',        headerX: 661, valueX: 661, valueWidth: 64  },
    { label: 'TOTAL',      headerX: 731, valueX: 731, valueWidth: 69  },
  ];

  const TABLE_Y = py(167, 9);
  const ROW_H   = 20;

  // Linha acima do cabeçalho
  doc
    .moveTo(43, py(179, 0))
    .lineTo(799, py(179, 0))
    .lineWidth(0.5)
    .opacity(0.8)
    .stroke();

  // Headers
  doc.fontSize(9).font('Helvetica-Bold');
  columns.forEach((col) => {
    doc.text(col.label, col.headerX, TABLE_Y, { lineBreak: false });
  });

  // Linha abaixo do cabeçalho
  doc
    .moveTo(43, py(163, 0))
    .lineTo(799, py(163, 0))
    .lineWidth(0.5)
    .opacity(0.8)
    .stroke()
    .opacity(1);

  // Linhas de dados
  let itemPdfY = 147;
  doc.fontSize(8).font('Helvetica');

  order.items.forEach((item) => {
    const p = item.productSnapshot || {};

    const itemIpi =
      order.subtotal > 0
        ? (item.subtotal / order.subtotal) * order.ipiValue
        : 0;

    const itemTotal = item.subtotal + itemIpi;
    const qtyFormatted = Number(item.quantity || 0).toLocaleString('pt-BR');

    const values = [
      p.supplierCode || '',
      p.clientCode   || '',
      p.description  || p.name || '',
      qtyFormatted,
      p.unitLabel    || p.saleMode || '',
      formatCurrency(item.unitPrice),
      formatCurrency(item.subtotal),
      formatCurrency(itemIpi),
      formatCurrency(itemTotal),
    ];

    const rowY = py(itemPdfY, 8);

    columns.forEach((col, i) => {
      doc.text(values[i], col.valueX, rowY, {
        width: col.valueWidth,
        lineBreak: false,
      });
    });

    itemPdfY -= ROW_H;
  });

  // ── TOTAIS ───────────────────────────────────────────────────────────────
  const SEP_Y2 = py(itemPdfY + 16, 0);
  doc
    .moveTo(43, SEP_Y2)
    .lineTo(799, SEP_Y2)
    .lineWidth(0.5)
    .opacity(0.3)
    .stroke()
    .opacity(1);

  const subtotalPdfY = itemPdfY - 2;
  const TOTAL_VAL_X = 715;
  const TOTAL_VAL_W = 85;
  doc.fontSize(10).font('Helvetica-Bold');

  doc.text('SUBTOTAL', 619, py(subtotalPdfY, 10), { lineBreak: false });
  doc.text(formatCurrency(order.subtotal), TOTAL_VAL_X, py(subtotalPdfY, 10), {
    width: TOTAL_VAL_W,
    lineBreak: false,
  });

  const ipiPdfY = subtotalPdfY - 14;
  doc.text(`IPI (${s.ipi || 0}%)`, 622, py(ipiPdfY, 10), { lineBreak: false });
  doc.text(formatCurrency(order.ipiValue), TOTAL_VAL_X, py(ipiPdfY, 10), {
    width: TOTAL_VAL_W,
    lineBreak: false,
  });

  const totalPdfY = ipiPdfY - 14;
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('TOTAL', 632, py(totalPdfY, 12), { lineBreak: false });
  doc.text(formatCurrency(order.total), TOTAL_VAL_X, py(totalPdfY, 12), {
    width: TOTAL_VAL_W,
    lineBreak: false,
  });

  // ── ASSINATURA ───────────────────────────────────────────────────────────
  doc
    .fontSize(11)
    .font('Helvetica')
    .text(order.sellerName || '', 43, py(17, 11), { lineBreak: false });

  doc.end();
}

module.exports = generateOrderPdf;
