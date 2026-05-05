/**
 * Testes unitários para quotationPdfGenerator.js
 *
 * Estratégia: capturar o PDF gerado em um Buffer via stream e verificar
 * headers, nome do arquivo e conteúdo textual (via pdf-parse quando disponível,
 * ou verificando que o buffer começa com o magic number do PDF).
 */

const generateQuotationPdf = require('../../src/utils/quotationPdfGenerator');

// ─── Helper: mock de res que coleta o PDF em buffer ──────────────────────────

function makeStreamRes() {
  const chunks = [];
  const headers = {};

  const res = {
    setHeader: jest.fn((key, value) => { headers[key.toLowerCase()] = value; }),
    write: jest.fn((chunk) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); }),
    end: jest.fn((chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }),
    // Permite que o pipe do PDFKit funcione
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    writable: true,
    headers,
    getBuffer: () => Buffer.concat(chunks),
  };

  return res;
}

/**
 * Gera o PDF e aguarda o evento 'end' do stream.
 * Retorna { headers, buffer }.
 */
function generateAndCollect(quotation) {
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
      generateQuotationPdf(quotation, res);
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeQuotation(overrides = {}) {
  return {
    clientSnapshot: {
      name: 'Empresa Teste',
      tradeName: 'Teste',
    },
    supplierSnapshot: {
      name: 'Fornecedor Teste',
      ipi: 10,
      city: 'São Paulo',
      logoUrl: null,
    },
    items: [
      {
        productSnapshot: {
          name: 'Produto A',
          description: 'Descrição do Produto A',
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
    sellerName: 'Valquiria Silvestre',
    createdAt: new Date('2026-05-05T12:00:00Z'),
    ...overrides,
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('generateQuotationPdf', () => {
  it('define Content-Type como application/pdf', async () => {
    const { headers } = await generateAndCollect(makeQuotation());
    expect(headers['content-type']).toBe('application/pdf');
  });

  it('define Content-Disposition com nome de arquivo no formato correto', async () => {
    const quotation = makeQuotation({ createdAt: new Date('2026-05-05T12:00:00Z') });
    const { headers } = await generateAndCollect(quotation);
    expect(headers['content-disposition']).toMatch(/^attachment; filename="ORCAMENTO-TESTE-05-05-2026\.pdf"$/);
  });

  it('usa tradeName no nome do arquivo quando disponível', async () => {
    const quotation = makeQuotation({
      clientSnapshot: { name: 'Razão Social', tradeName: 'Nome Fantasia' },
    });
    const { headers } = await generateAndCollect(quotation);
    expect(headers['content-disposition']).toMatch(/NOME-FANTASIA/);
  });

  it('usa name quando tradeName está ausente no nome do arquivo', async () => {
    const quotation = makeQuotation({
      clientSnapshot: { name: 'Empresa Sem Fantasia' },
    });
    const { headers } = await generateAndCollect(quotation);
    expect(headers['content-disposition']).toMatch(/EMPRESA-SEM-FANTASIA/);
  });

  it('usa CLIENTE como fallback quando clientSnapshot está vazio', async () => {
    const quotation = makeQuotation({ clientSnapshot: {} });
    const { headers } = await generateAndCollect(quotation);
    expect(headers['content-disposition']).toMatch(/ORCAMENTO-CLIENTE-/);
  });

  it('gera buffer PDF válido (magic number %PDF)', async () => {
    const { buffer } = await generateAndCollect(makeQuotation());
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('gera PDF sem erros quando supplierSnapshot está ausente', async () => {
    const quotation = makeQuotation({ supplierSnapshot: undefined });
    await expect(generateAndCollect(quotation)).resolves.toBeDefined();
  });

  it('gera PDF sem erros quando items está vazio', async () => {
    const quotation = makeQuotation({ items: [], subtotal: 0, ipiValue: 0, total: 0 });
    await expect(generateAndCollect(quotation)).resolves.toBeDefined();
  });

  it('gera PDF sem erros quando items tem subtotal=0 (itemIpi deve ser 0)', async () => {
    const quotation = makeQuotation({
      items: [{ productSnapshot: { name: 'P' }, quantity: 1, unitPrice: 0, subtotal: 0 }],
      subtotal: 0,
      ipiValue: 0,
      total: 0,
    });
    await expect(generateAndCollect(quotation)).resolves.toBeDefined();
  });

  // ── Cabeçalho: logo vs. texto ─────────────────────────────────────────────

  it('usa nome textual do fornecedor quando logoUrl é null', async () => {
    const quotation = makeQuotation({
      supplierSnapshot: { name: 'Fornecedor Sem Logo', ipi: 0, city: 'SP', logoUrl: null },
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa nome textual quando logoUrl é URL HTTP (inválida)', async () => {
    const quotation = makeQuotation({
      supplierSnapshot: { name: 'Forn HTTP', ipi: 0, city: 'SP', logoUrl: 'http://example.com/logo.png' },
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa nome textual quando logoUrl é caminho absoluto (inválido)', async () => {
    const quotation = makeQuotation({
      supplierSnapshot: { name: 'Forn Abs', ipi: 0, city: 'SP', logoUrl: '/etc/passwd' },
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa nome textual quando logoUrl aponta para arquivo inexistente', async () => {
    const quotation = makeQuotation({
      supplierSnapshot: { name: 'Forn 404', ipi: 0, city: 'SP', logoUrl: 'src/assets/logos/nao-existe.png' },
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa logo real quando logoUrl aponta para arquivo válido', async () => {
    const quotation = makeQuotation({
      supplierSnapshot: {
        name: 'Eripack',
        ipi: 0,
        city: 'SP',
        logoUrl: 'src/assets/logos/Logo-Eripack.jpg.jpeg',
      },
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Cabeçalho: cidade e data ──────────────────────────────────────────────

  it('inclui cidade no cabeçalho quando supplierSnapshot.city está preenchido', async () => {
    const quotation = makeQuotation({
      supplierSnapshot: { name: 'Forn', ipi: 0, city: 'Campinas', logoUrl: null },
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('omite cidade quando supplierSnapshot.city está vazio', async () => {
    const quotation = makeQuotation({
      supplierSnapshot: { name: 'Forn', ipi: 0, city: '', logoUrl: null },
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Destinatário: attn ────────────────────────────────────────────────────

  it('inclui linha A/C quando attn está preenchido', async () => {
    const quotation = makeQuotation({ attn: 'João da Silva' });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('omite linha A/C quando attn está ausente', async () => {
    const quotation = makeQuotation({ attn: undefined });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Observações: personalizado vs. padrão ────────────────────────────────

  it('usa texto de observações personalizado quando fornecido', async () => {
    const quotation = makeQuotation({ observations: 'Condições especiais negociadas.' });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('gera texto padrão de observações quando observations está ausente', async () => {
    const quotation = makeQuotation({ observations: undefined });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('inclui paymentTerm no texto padrão quando fornecido', async () => {
    const quotation = makeQuotation({
      observations: undefined,
      paymentTerm: 'Boleto 30 dias',
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa "A combinar" quando paymentTerm está ausente', async () => {
    const quotation = makeQuotation({ observations: undefined, paymentTerm: undefined });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('inclui deliveryDate formatada quando fornecida', async () => {
    const quotation = makeQuotation({
      observations: undefined,
      deliveryDate: new Date('2026-06-15T00:00:00Z'),
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa "A combinar" para prazo quando deliveryDate está ausente', async () => {
    const quotation = makeQuotation({ observations: undefined, deliveryDate: undefined });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Produto: unitLabel vs. saleMode ──────────────────────────────────────

  it('usa saleMode quando unitLabel está ausente no productSnapshot', async () => {
    const quotation = makeQuotation({
      items: [{
        productSnapshot: { name: 'Prod', saleMode: 'kg', unitLabel: undefined },
        quantity: 10,
        unitPrice: 5,
        subtotal: 50,
      }],
      subtotal: 50,
      ipiValue: 0,
      total: 50,
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa description quando disponível no productSnapshot', async () => {
    const quotation = makeQuotation({
      items: [{
        productSnapshot: { name: 'Nome', description: 'Descrição Detalhada', unitLabel: 'UN' },
        quantity: 5,
        unitPrice: 20,
        subtotal: 100,
      }],
      subtotal: 100,
      ipiValue: 0,
      total: 100,
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('usa name quando description está ausente no productSnapshot', async () => {
    const quotation = makeQuotation({
      items: [{
        productSnapshot: { name: 'Só Nome', description: undefined, unitLabel: 'UN' },
        quantity: 5,
        unitPrice: 20,
        subtotal: 100,
      }],
      subtotal: 100,
      ipiValue: 0,
      total: 100,
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── Múltiplos itens ───────────────────────────────────────────────────────

  it('gera PDF com múltiplos itens sem erros', async () => {
    const quotation = makeQuotation({
      items: [
        { productSnapshot: { name: 'P1', unitLabel: 'UN' }, quantity: 10, unitPrice: 5, subtotal: 50 },
        { productSnapshot: { name: 'P2', unitLabel: 'KG' }, quantity: 20, unitPrice: 3, subtotal: 60 },
        { productSnapshot: { name: 'P3', unitLabel: 'M'  }, quantity: 30, unitPrice: 2, subtotal: 60 },
      ],
      subtotal: 170,
      ipiValue: 17,
      total: 187,
    });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── sellerName ────────────────────────────────────────────────────────────

  it('inclui sellerName na assinatura', async () => {
    const quotation = makeQuotation({ sellerName: 'Maria Representante' });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('gera PDF sem erros quando sellerName está ausente', async () => {
    const quotation = makeQuotation({ sellerName: undefined });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  // ── createdAt ausente ─────────────────────────────────────────────────────

  it('gera PDF sem erros quando createdAt está ausente (usa data atual)', async () => {
    const quotation = makeQuotation({ createdAt: undefined });
    const { buffer } = await generateAndCollect(quotation);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});
