const PDFDocument = require('pdfkit');
const path = require('path');

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
// O PDFKit com margin:0 ainda aplica um offset interno de ~3pt no eixo Y.
// Medido empiricamente: gerado_y = correto_y - 3 (em coordenadas PDF, base inferior).
// Portanto: pdfkit_y = pageH - pdf_y - fontSize + 3  →  pdfkit_y = pageH - pdf_y - fontSize + OFFSET
// Simplificando: usamos as coordenadas PDFKit diretamente com o ajuste embutido.
const PAGE_H = 595.28; // altura A4 landscape
const Y_OFFSET = 3;    // offset interno do PDFKit medido na comparação

/**
 * Converte coordenada Y do PDF (origem inferior) para PDFKit (origem superior),
 * aplicando o offset interno do PDFKit.
 */
function py(pdfY, fontSize) {
  return PAGE_H - pdfY - fontSize + Y_OFFSET;
}

/**
 * Renderiza label em negrito pequeno + valor abaixo, sem bordas.
 * Usa coordenadas PDF (y = base da linha do label).
 */
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
  // Coordenadas do correto: nome x=43 y=553 fs=12
  if (s.logoUrl) {
    try {
      const logoPath = path.resolve(s.logoUrl);
      doc.image(logoPath, 43, py(553, 12), { fit: [220, 55] });
    } catch {
      doc.fontSize(12).font('Helvetica-Bold').text(s.name || '', 43, py(553, 12));
    }
  } else {
    doc.fontSize(12).font('Helvetica-Bold').text(s.name || '', 43, py(553, 12));
  }

  // CNPJ | IE | Fone  — y=539 fs=9
  doc.fontSize(9).font('Helvetica');
  if (s.cnpj) {
    doc.text(`CNPJ: ${s.cnpj}`, 43, py(539, 9), { lineBreak: false });
  }
  if (s.stateRegistration) {
    doc.text(`IE: ${s.stateRegistration}`, 159, py(539, 9), { lineBreak: false });
  }
  if (s.phone) {
    doc.text(`Fone: ${s.phone}`, 248, py(539, 9), { lineBreak: false });
  }

  // Endereço — y=527 fs=9
  if (s.address) {
    const cepPart = s.zipCode ? ` - CEP: ${s.zipCode}` : '';
    doc.text(
      `Endereço: ${s.address}${cepPart}`,
      43, py(527, 9),
      { lineBreak: false },
    );
  }

  // Cidade - UF  |  E-mail — y=515 fs=9
  if (s.city || s.state) {
    const cidadeUF = [s.city, s.state].filter(Boolean).join(' - ');
    doc.text(cidadeUF, 43, py(515, 9), { lineBreak: false });
  }
  if (s.email) {
    doc.text(`E-mail: ${s.email}`, 113, py(515, 9), { lineBreak: false });
  }

  // PEDIDO Nº — x=692 y=553 fs=14
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(`PEDIDO Nº ${order.orderNumber}`, 692, py(553, 14), { lineBreak: false });

  // Data — x=723 y=537 fs=10
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`Data: ${formatDate(order.createdAt)}`, 723, py(537, 10), { lineBreak: false });

  // ── DADOS DO CLIENTE ─────────────────────────────────────────────────────
  // Título — x=43 y=461 fs=12
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('DADOS DO CLIENTE', 43, py(461, 12));

  // Linha 1: RAZÃO SOCIAL (x=43) | CNPJ/CPF (x=354) | IE (x=482)
  // label y=441, valor y=429
  field(doc, 'RAZÃO SOCIAL',  c.name,              43,  441, 305);
  field(doc, 'CNPJ/CPF',      c.cnpj,              354, 441, 122);
  field(doc, 'IE',            c.stateRegistration, 482, 441, 316);

  // Linha 2: ENDEREÇO (x=43) | BAIRRO (x=354)
  // label y=409, valor y=397
  field(doc, 'ENDEREÇO', c.address,  43,  409, 305);
  field(doc, 'BAIRRO',   c.district, 354, 409, 122);

  // Linha 3: MUNICÍPIO (x=43) | UF (x=354) | CEP (x=439)
  // label y=377, valor y=365
  field(doc, 'MUNICÍPIO', c.city,    43,  377, 305);
  field(doc, 'UF',        c.state,   354, 377, 79);
  field(doc, 'CEP',       c.zipCode, 439, 377, 359);

  // Linha 4: TELEFONE (x=43) | E-MAIL (x=354)
  // label y=345, valor y=333
  field(doc, 'TELEFONE',                c.phone, 43,  345, 305);
  field(doc, 'E-MAIL PARA ENVIO DA NF-e', c.email, 354, 345, 444);

  // Linha 5: PRAZO PARA PAGAMENTO (x=43) | PRAZO PARA ENTREGA (x=354)
  // label y=313, valor y=301
  field(doc, 'PRAZO PARA PAGAMENTO', order.paymentTerm,              43,  313, 305);
  field(doc, 'PRAZO PARA ENTREGA',   formatDate(order.deliveryDate), 354, 313, 444);

  // Linha 6: PEDIDO DO CLIENTE (x=43) — label y=281
  field(doc, 'PEDIDO DO CLIENTE', order.customerPurchaseOrder, 43, 281, 755);

  // Observação — label y=249 fs=9, texto y=237 fs=10
  // Ordem correta: c.notes primeiro, depois order.notes (conforme PDF correto)
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
  // Cabeçalho — y=167 fs=9  (coordenadas PDF do correto)
  const TABLE_Y = py(167, 9);
  const ROW_H   = 20; // espaçamento entre linhas (167-147=20 em coord PDF)

  // Posições X exatas do PDF correto — todos LEFT-aligned.
  // headerX: posição do label do cabeçalho
  // valueX:  posição onde o valor da linha de dados começa
  // valueWidth: largura disponível para o valor (até o início da próxima coluna)
  const columns = [
    { label: 'FORNECEDOR',   headerX: 46,  valueX: 46,  valueWidth: 83  },
    { label: 'CLIENTE',      headerX: 131, valueX: 131, valueWidth: 68  },
    { label: 'DESCRIÇÃO',    headerX: 201, valueX: 201, valueWidth: 285 },
    { label: 'QNT',          headerX: 488, valueX: 487, valueWidth: 29  },
    { label: 'UN',           headerX: 518, valueX: 519, valueWidth: 33  },
    { label: 'MILHEIRO',     headerX: 554, valueX: 554, valueWidth: 55  },
    { label: 'TOTAL S/ IPI', headerX: 611, valueX: 622, valueWidth: 59  },
    { label: 'VALOR IPI',    headerX: 683, valueX: 691, valueWidth: 73  },
    // Última coluna: valueX recuado para acomodar valores largos (R$ 5.458,97 = ~47pt)
    { label: 'TOTAL',        headerX: 766, valueX: 753, valueWidth: 47  },
  ];

  // Renderizar headers (LEFT-aligned nas posições headerX)
  doc.fontSize(9).font('Helvetica-Bold');
  columns.forEach((col) => {
    doc.text(col.label, col.headerX, TABLE_Y, { lineBreak: false });
  });

  // Linha separadora abaixo do cabeçalho (entre y=167 e y=147, ~y=157 em coord PDF)
  const SEP_Y1 = py(157, 0);
  doc
    .moveTo(43, SEP_Y1)
    .lineTo(800, SEP_Y1)
    .lineWidth(0.5)
    .stroke();

  // Linhas de dados — primeira linha y=147 fs=8
  let itemPdfY = 147;

  doc.fontSize(8).font('Helvetica');

  order.items.forEach((item) => {
    const p = item.productSnapshot || {};

    const itemIpi =
      order.subtotal > 0
        ? (item.subtotal / order.subtotal) * order.ipiValue
        : 0;

    const itemTotal = item.subtotal + itemIpi;

    // Quantidade com separador de milhar (correto usa "2.000")
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

    itemPdfY -= ROW_H; // próxima linha: 20pt abaixo (em coord PDF, y decresce)
  });

  // ── TOTAIS ───────────────────────────────────────────────────────────────
  // No correto com 1 item: última linha y=147, itemPdfY após loop = 127
  // Separadora ~y=135 (itemPdfY+8), SUBTOTAL y=123 (itemPdfY-4)
  // IPI y=109 (subtotal-14), TOTAL y=95 (ipi-14)
  const SEP_Y2 = py(itemPdfY + 8, 0);
  doc
    .moveTo(43, SEP_Y2)
    .lineTo(800, SEP_Y2)
    .lineWidth(0.5)
    .stroke();

  const subtotalPdfY = itemPdfY - 4;
  doc.fontSize(10).font('Helvetica-Bold');

  doc.text('SUBTOTAL', 619, py(subtotalPdfY, 10), { lineBreak: false });
  doc.text(formatCurrency(order.subtotal), 745, py(subtotalPdfY, 10), {
    width: 55,
    lineBreak: false,
  });

  const ipiPdfY = subtotalPdfY - 14;
  doc.text(`IPI (${s.ipi || 0}%)`, 622, py(ipiPdfY, 10), { lineBreak: false });
  doc.text(formatCurrency(order.ipiValue), 753, py(ipiPdfY, 10), {
    width: 55,
    lineBreak: false,
  });

  const totalPdfY = ipiPdfY - 14;
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('TOTAL', 632, py(totalPdfY, 12), { lineBreak: false });
  doc.text(formatCurrency(order.total), 734, py(totalPdfY, 12), {
    width: 66,
    lineBreak: false,
  });

  // ── ASSINATURA ───────────────────────────────────────────────────────────
  // x=43 y=17 fs=11
  doc
    .fontSize(11)
    .font('Helvetica')
    .text(order.sellerName || '', 43, py(17, 11), { lineBreak: false });

  doc.end();
}

module.exports = generateOrderPdf;
