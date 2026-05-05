const fs = require('fs');
const { Writable } = require('stream');
const generateQuotationPdf = require('./src/utils/quotationPdfGenerator');

const subtotal = 94060.26;
const ipiValue = 9170.88;
const total    = 103231.14;

const quotation = {
  createdAt: new Date('2026-04-23'),
  sellerName: 'Valquiria Silvestre',
  attn: 'Adrielli',
  observations: [
    'Condições de pagamento: 28/35/42 (Após aprovação de crédito)',
    'I.C.M.S.: 18% (Incluso no preço acima)',
    'PIS e COFINS.: (Incluso no preço acima)',
    'Prazo para entrega: 15 dias uteis',
    'Frete: CIF',
    'Proposta válida: 27/04/2026',
  ].join('\n'),
  clientSnapshot: {
    name: 'MAC SANTOS',
    tradeName: 'MAC SANTOS',
  },
  supplierSnapshot: {
    name: 'QUALYPLAST EMBALAGENS',
    ipi: 9.75,
    city: 'Americana',
    logoUrl: 'src/assets/logos/Logo Qualyplast.jpg.jpeg',
  },
  items: [
    {
      productSnapshot: {
        description: '138x125x0,010 SF24 PEBD TRANSP LISO',
        unitLabel: 'UN',
        saleMode: 'unit',
      },
      quantity: 10000,
      unitPrice: 4916.25,
      subtotal: 49162.50,
    },
    {
      productSnapshot: {
        description: '45x80x0,030 SF6 PEBD TRANSP LISO',
        unitLabel: 'UN',
        saleMode: 'unit',
      },
      quantity: 6000,
      unitPrice: 3078.00,
      subtotal: 18468.00,
    },
    {
      productSnapshot: {
        description: '138x112x0,010 SF24 PEBD TRANSP LISO',
        unitLabel: 'UN',
        saleMode: 'unit',
      },
      quantity: 6000,
      unitPrice: 4404.96,
      subtotal: 26429.76,
    },
  ],
  subtotal,
  ipiValue,
  total,
};

const chunks = [];
const fakeRes = new Writable({ write(chunk, enc, cb) { chunks.push(chunk); cb(); } });
fakeRes.setHeader = () => {};
fakeRes.on('finish', () => {
  fs.writeFileSync('teste-orcamento.pdf', Buffer.concat(chunks));
  console.log('PDF gerado: teste-orcamento.pdf');
});

generateQuotationPdf(quotation, fakeRes);
