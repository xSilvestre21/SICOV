const fs = require('fs');
const { Writable } = require('stream');
const generateOrderPdf = require('./src/utils/orderPdfGenerator');

// subtotais: 36.763,20 + 26.250,00 + 18.750,00 + 14.200,00 + 11.500,00 = 107.463,20
// ipi 9.75%: 10.477,66
// total: 117.940,86

const subtotal = 107463.20;
const ipi = 9.75;
const ipiValue = parseFloat((subtotal * ipi / 100).toFixed(2));
const total = parseFloat((subtotal + ipiValue).toFixed(2));

const order = {
  orderNumber: 2020,
  createdAt: new Date('2026-04-30'),
  deliveryDate: new Date('2026-05-20'),
  customerPurchaseOrder: 'PC-112233',
  paymentTerm: 'Boleto 28/35/42/49 dias',
  sellerName: 'Valquiria Silvestre',
  notes: 'Entregar paletizado com filme stretch. Romaneio obrigatório antes da entrega.',
  subtotal,
  ipiValue,
  total,
  clientSnapshot: {
    name: 'SOPROGE EMBALAGENS PLASTICAS LTDA',
    tradeName: 'SOPROGE',
    cnpj: '20.927.468/0001-33',
    stateRegistration: '675.231.088.110',
    address: 'Av. Albert Einstein, 303 Núcleo Res. Isabela',
    district: 'Vila Iasi',
    city: 'Taboão da Serra',
    state: 'SP',
    zipCode: '06780-110',
    phone: '(11) 95932-4898',
    email: 'comercial@soproge.com.br',
    notes: 'Horário de recebimento: seg-sex 08:00-12:00 e 13:00-17:00. Enviar romaneio com antecedência.',
  },
  supplierSnapshot: {
    name: 'ERIPACK EMBALAGENS INDUSTRIAIS',
    cnpj: '12.345.678/0001-99',
    stateRegistration: '123.456.789.000',
    phone: '(19) 3333-4444',
    address: 'Rua Industrial, 500 - Distrito Industrial',
    city: 'Americana',
    state: 'SP',
    zipCode: '13478-000',
    email: 'vendas@eripack.com.br',
    ipi,
    logoUrl: 'src/assets/logos/Logo-Eripack.jpg.jpeg',
  },
  items: [
    {
      productSnapshot: {
        supplierCode: 'EP-001',
        clientCode: 'SP-077',
        description: 'Saco PEMD 77x135x0,15 SF07',
        saleMode: 'thousand',
        unitLabel: 'MIL',
      },
      quantity: 7500,
      unitPrice: 4901.76,
      subtotal: 36763.20,
    },
    {
      productSnapshot: {
        supplierCode: 'EP-002',
        clientCode: 'SP-100',
        description: 'Saco PEMD 100x150x0,20 SF07',
        saleMode: 'thousand',
        unitLabel: 'MIL',
      },
      quantity: 3000,
      unitPrice: 8750.00,
      subtotal: 26250.00,
    },
    {
      productSnapshot: {
        supplierCode: 'EP-015',
        clientCode: 'SP-STR',
        description: 'Stretch Film 500mm x 23my Bobina',
        saleMode: 'kg',
        unitLabel: 'KG',
      },
      quantity: 1500,
      unitPrice: 12.50,
      subtotal: 18750.00,
    },
    {
      productSnapshot: {
        supplierCode: 'EP-030',
        clientCode: 'SP-FIT',
        description: 'Fita Adesiva Transparente 48mm x 100m',
        saleMode: 'box',
        unitLabel: 'CX',
      },
      quantity: 200,
      unitPrice: 71.00,
      subtotal: 14200.00,
    },
    {
      productSnapshot: {
        supplierCode: 'EP-045',
        clientCode: 'SP-BOB',
        description: 'Bobina Polietileno PEBD 120cm x 0,10mm',
        saleMode: 'kg',
        unitLabel: 'KG',
      },
      quantity: 920,
      unitPrice: 12.50,
      subtotal: 11500.00,
    },
  ],
};

const chunks = [];
const fakeRes = new Writable({ write(chunk, enc, cb) { chunks.push(chunk); cb(); } });
fakeRes.setHeader = () => {};
fakeRes.on('finish', () => {
  fs.writeFileSync('teste-gerado.pdf', Buffer.concat(chunks));
  console.log(`PDF gerado — subtotal: R$ ${subtotal.toLocaleString('pt-BR', {minimumFractionDigits:2})} | IPI: R$ ${ipiValue.toLocaleString('pt-BR', {minimumFractionDigits:2})} | total: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
});
generateOrderPdf(order, fakeRes);
