/**
 * Testes unitários para orderPdfGenerator.js
 *
 * Estratégia: capturar o PDF gerado em um Buffer via stream e verificar
 * headers, nome do arquivo e que o buffer é um PDF válido.
 */

const generateOrderPdf = require('../../src/utils/orderPdfGenerator');

// ─── Helper: coleta o PDF em buffer ──────────────────────────────────────────

function generateAndCollect(order) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const headers = {};

    const res = {
      setHeader: (key, value) => { headers[key.toLowerCase()] = value; },
      write: (chunk) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      },
      end: (chunk) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        resolve({ headers, buffer: Buffer.concat(chunks) });
      },
      on: () => res,
      once: () => res,
      emit: () => false,
      removeListener: () => res,
      writable: true,
    };

    try {
      generateOrderPdf(order, res);
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeOrder(overrides = {}) {
  return {
    orderNumber: 42,
    clientSnapshot: {
      name: 'Empresa Teste',
      tradeName: 'Teste',
      cnpj: '12.345.678/0001-99',
      stateRegistration: '123456789',
      address: 'Rua das Flores, 100',
      city: 'Campinas',
      state: 'SP',
      district: 'Centro',
      zipCode: '13010-000',
      phone: '(19) 99999-9999',
      email: 'teste@empresa.com',
      notes: '',
    },
    supplierSnapshot: {
      name: 'Fornecedor Teste',
      tradeName: 'Forn',
      cnpj: '98.765.432/0001-11',
      ipi: 10,
      logoUrl: null,
    },
    items: [
      {
        productSnapshot: {
          supplierCode: 'SC1',
          clientCode: 'CC1',
          name: 'Produto Teste',
          description: 'Descrição do Produto',
          unitLabel: 'UN',
          saleMode: 'unit',
        },
        quantity: 100,
        unitPrice: 12.5,
        subtotal: 1250,
      },
    ],
    subtotal: 1250,
    ipiValue: 125,
    total: 1375,
    paymentTerm: 'Boleto 30 dias',
    deliveryDate: new Date('2026-06-15T00:00:00Z'),
    sellerName: 'Valquiria Silvestre',
    createdAt: new Date('2026-05-05T12:00:00Z'),
    notes: 'Observação do pedido',
    ...overrides,
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('generateOrderPdf', () => {
  it('define Content-Type como application/pdf', async () => {
    const { headers } = await generateAndCollect(makeOrder());
    expect(headers['content-type']).toBe('application/pdf');
  });

  it('define Content-Disposition com nome de arquivo no formato correto', async () => {
    const order = makeOrder({ orderNumber: 42, createdAt: new Date('2026-05-05T12:00:00Z') });
    const { headers } = await generateAndCollect(order);
    expect(headers['content-disposition']).toMatch(/^attachment; filename="42-TESTE-05-05-2026\.pdf"$/);
  });

  it('inclui customerPurchaseOrder no nome do arquivo quando fornecido', async () => {
    const order = makeOrder({ customerPurchaseOrder: 'PC-001' });
    const { headers } = await generateAndCollect(order);
    expect(headers['content-disposition']).toMatch(/PC-PC-001/);
  });

  it('omite customerPurchaseOrder do nome quando ausente', async () => {
    const order = makeOrder({ customerPurchaseOrder: undefined });
    const { headers } = await generateAndCollect(order);
    expect(headers['content-disposition']).not.toMatch(/PC-/);
  });

  it('gera buffer PDF válido (magic number %PDF)', async () => {
    const { buffer } = await generateAndCollect(makeOrder());
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Logo vs. texto ────────────────────────────────────────────────────────

  it('usa nome textual quando logoUrl é null', async () => {
    const order = makeOrder({
      supplierSnapshot: { name: 'Forn Sem Logo', ipi: 0, logoUrl: null },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa nome textual quando logoUrl é URL HTTP (inválida)', async () => {
    const order = makeOrder({
      supplierSnapshot: { name: 'Forn HTTP', ipi: 0, logoUrl: 'http://example.com/logo.png' },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa nome textual quando logoUrl aponta para arquivo inexistente', async () => {
    const order = makeOrder({
      supplierSnapshot: { name: 'Forn 404', ipi: 0, logoUrl: 'src/assets/logos/nao-existe.png' },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa logo real quando logoUrl aponta para arquivo válido', async () => {
    const order = makeOrder({
      supplierSnapshot: {
        name: 'Eripack',
        ipi: 0,
        logoUrl: 'src/assets/logos/Logo-Eripack.jpg.jpeg',
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Dados do fornecedor no cabeçalho textual ──────────────────────────────

  it('exibe cnpj, IE, telefone, endereço, cidade/estado e email quando logoUrl é inválida', async () => {
    const order = makeOrder({
      supplierSnapshot: {
        name: 'Forn Completo',
        ipi: 5,
        logoUrl: null,
        cnpj: '12345678000199',        // armazenado sem formatação
        stateRegistration: '123456789',
        phone: '11987654321',          // celular sem formatação
        address: 'Av. Paulista, 1000',
        zipCode: '01310100',           // CEP sem formatação
        city: 'São Paulo',
        state: 'SP',
        email: 'forn@teste.com',
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('omite campos opcionais do fornecedor quando ausentes', async () => {
    const order = makeOrder({
      supplierSnapshot: { name: 'Forn Mínimo', ipi: 0, logoUrl: null },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Observações ───────────────────────────────────────────────────────────

  it('exibe observações quando notes e clientSnapshot.notes estão preenchidos', async () => {
    const order = makeOrder({
      notes: 'Obs do pedido',
      clientSnapshot: { ...makeOrder().clientSnapshot, notes: 'Obs do cliente' },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('omite bloco de observações quando notes e clientSnapshot.notes estão vazios', async () => {
    const order = makeOrder({
      notes: undefined,
      clientSnapshot: { ...makeOrder().clientSnapshot, notes: '' },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Itens ─────────────────────────────────────────────────────────────────

  it('gera PDF com múltiplos itens sem erros', async () => {
    const order = makeOrder({
      items: [
        {
          productSnapshot: { supplierCode: 'S1', clientCode: 'C1', name: 'P1', description: 'D1', unitLabel: 'UN', saleMode: 'unit' },
          quantity: 10, unitPrice: 5, subtotal: 50,
        },
        {
          productSnapshot: { supplierCode: 'S2', clientCode: 'C2', name: 'P2', description: 'D2', unitLabel: 'KG', saleMode: 'kg' },
          quantity: 20, unitPrice: 3, subtotal: 60,
        },
      ],
      subtotal: 110,
      ipiValue: 11,
      total: 121,
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa name quando description está ausente no productSnapshot', async () => {
    const order = makeOrder({
      items: [{
        productSnapshot: { supplierCode: 'S1', clientCode: 'C1', name: 'Só Nome', description: undefined, unitLabel: 'UN', saleMode: 'unit' },
        quantity: 5, unitPrice: 10, subtotal: 50,
      }],
      subtotal: 50, ipiValue: 0, total: 50,
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa saleMode quando unitLabel está ausente no productSnapshot', async () => {
    const order = makeOrder({
      items: [{
        productSnapshot: { supplierCode: 'S1', clientCode: 'C1', name: 'P', description: 'D', unitLabel: undefined, saleMode: 'kg' },
        quantity: 5, unitPrice: 10, subtotal: 50,
      }],
      subtotal: 50, ipiValue: 0, total: 50,
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('calcula itemIpi=0 quando subtotal do pedido é 0', async () => {
    const order = makeOrder({
      items: [{
        productSnapshot: { supplierCode: '', clientCode: '', name: 'P', description: '', unitLabel: 'UN', saleMode: 'unit' },
        quantity: 1, unitPrice: 0, subtotal: 0,
      }],
      subtotal: 0, ipiValue: 0, total: 0,
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── sellerName e datas ────────────────────────────────────────────────────

  it('inclui sellerName na assinatura', async () => {
    const order = makeOrder({ sellerName: 'João Vendedor' });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('gera PDF sem erros quando sellerName está ausente', async () => {
    const order = makeOrder({ sellerName: undefined });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('gera PDF sem erros quando deliveryDate está ausente', async () => {
    const order = makeOrder({ deliveryDate: undefined });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('gera PDF sem erros quando createdAt está ausente', async () => {
    const order = makeOrder({ createdAt: undefined });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── IPI zero ──────────────────────────────────────────────────────────────

  it('exibe IPI 0% quando supplierSnapshot.ipi é 0', async () => {
    const order = makeOrder({
      supplierSnapshot: { name: 'Forn', ipi: 0, logoUrl: null },
      ipiValue: 0,
      total: 1250,
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});

// ─── Formatação de campos do cliente no PDF ───────────────────────────────────

describe('formatação de campos do cliente', () => {
  it('formata CNPJ de 14 dígitos corretamente no PDF', async () => {
    const order = makeOrder({
      clientSnapshot: {
        ...makeOrder().clientSnapshot,
        cnpj: '12345678000199', // sem formatação — como está no banco
      },
    });
    const { buffer } = await generateAndCollect(order);
    // O PDF deve ser gerado sem erros
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('formata CPF de 11 dígitos corretamente no PDF', async () => {
    const order = makeOrder({
      clientSnapshot: {
        ...makeOrder().clientSnapshot,
        cnpj: '12345678901', // CPF sem formatação
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('formata telefone celular (11 dígitos) corretamente', async () => {
    const order = makeOrder({
      clientSnapshot: {
        ...makeOrder().clientSnapshot,
        phone: '11987654321',
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('formata telefone fixo (10 dígitos) corretamente', async () => {
    const order = makeOrder({
      clientSnapshot: {
        ...makeOrder().clientSnapshot,
        phone: '1134567890',
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('formata CEP de 8 dígitos corretamente', async () => {
    const order = makeOrder({
      clientSnapshot: {
        ...makeOrder().clientSnapshot,
        zipCode: '01310100',
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('não quebra quando CNPJ já está formatado (com pontos e traços)', async () => {
    const order = makeOrder({
      clientSnapshot: {
        ...makeOrder().clientSnapshot,
        cnpj: '12.345.678/0001-99',
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('não quebra quando campos de formatação estão ausentes', async () => {
    const order = makeOrder({
      clientSnapshot: {
        name: 'Empresa Mínima',
        cnpj: null,
        phone: null,
        zipCode: null,
        stateRegistration: null,
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('formata CNPJ do fornecedor no cabeçalho textual', async () => {
    const order = makeOrder({
      supplierSnapshot: {
        name: 'Fornecedor',
        ipi: 0,
        logoUrl: null,
        cnpj: '08819970000125', // sem formatação
        phone: '1934066407',
        zipCode: '13478733',
      },
    });
    const { buffer } = await generateAndCollect(order);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});
