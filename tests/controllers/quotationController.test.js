jest.mock('../../src/models/quotation');
jest.mock('../../src/models/product');
jest.mock('../../src/models/client');
jest.mock('../../src/models/supplier');
jest.mock('../../src/models/order');
jest.mock('../../src/utils/quotationPdfGenerator');
jest.mock('../../src/utils/priceCalculator');

const Quotation          = require('../../src/models/quotation');
const Product            = require('../../src/models/product');
const Client             = require('../../src/models/client');
const Supplier           = require('../../src/models/supplier');
const Order              = require('../../src/models/order');
const generateQuotationPdf = require('../../src/utils/quotationPdfGenerator');
const { calculateProductPrice } = require('../../src/utils/priceCalculator');

const {
  createQuotation,
  updateQuotation,
  convertToOrder,
  getQuotations,
  getQuotationById,
  getQuotationPdf,
  generateQuotationPdfFromBody,
  getClientProductsForQuotation,
} = require('../../src/controllers/quotationController');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const adminUser = { id: 'adminId', profile: 'admin' };
const repUser   = { id: 'repId',   profile: 'representante' };

const mockProduct = {
  _id: 'p1',
  name: 'Produto Teste',
  supplierId: { toString: () => 's1' },
  calculationMode: 'quantity_times_unit_price',
  saleMode: 'unit',
  commercialData: { unitPrice: 10 },
  technicalData: {},
  supplierCode: 'SC1',
  clientCode: 'CC1',
  description: 'Descrição do produto',
  productType: 'custom',
  material: 'PVC',
  unitLabel: 'UN',
  selectedExtras: [],
};

const mockSupplier = {
  _id: 's1',
  name: 'Fornecedor Teste',
  tradeName: 'Forn',
  cnpj: '12.345.678/0001-99',
  ipi: 10,
  logoUrl: null,
  city: 'São Paulo',
};

const mockClient = {
  _id: 'c1',
  name: 'Cliente Teste',
  tradeName: 'Cliente',
  cnpj: '98.765.432/0001-11',
  stateRegistration: '123456789',
  address: 'Rua das Flores, 100',
  city: 'Campinas',
  state: 'SP',
  district: 'Centro',
  zipCode: '13010-000',
  phone: '(19) 99999-9999',
  email: 'cliente@teste.com',
  paymentTerm: '30 dias',
  notes: '',
};

// ─── createQuotation ─────────────────────────────────────────────────────────

describe('createQuotation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 quando clientId ausente e adHocClient.name ausente', async () => {
    const req = { body: {}, user: repUser };
    const res = makeRes();
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Nome do cliente é obrigatório' });
  });

  it('400 quando adHocClient existe mas name está vazio', async () => {
    const req = { body: { adHocClient: { name: '' } }, user: repUser };
    const res = makeRes();
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Nome do cliente é obrigatório' });
  });

  it('404 quando clientId não existe no banco', async () => {
    const req = {
      body: { clientId: 'c1', items: [{ productId: 'p1', quantity: 10 }] },
      user: repUser,
    };
    const res = makeRes();
    Client.findById.mockResolvedValue(null);
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cliente não encontrado' });
  });

  it('400 quando items está ausente', async () => {
    const req = { body: { adHocClient: { name: 'Avulso' } }, user: repUser };
    const res = makeRes();
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Itens são obrigatórios' });
  });

  it('400 quando items é array vazio', async () => {
    const req = { body: { adHocClient: { name: 'Avulso' }, items: [] }, user: repUser };
    const res = makeRes();
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Itens são obrigatórios' });
  });

  it('404 quando productId não existe', async () => {
    const req = {
      body: { adHocClient: { name: 'Avulso' }, items: [{ productId: 'p1', quantity: 10 }] },
      user: repUser,
    };
    const res = makeRes();
    Product.findById.mockResolvedValue(null);
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Produto não encontrado' });
  });

  it('400 quando produtos são de fornecedores diferentes', async () => {
    const product2 = { ...mockProduct, _id: 'p2', supplierId: { toString: () => 's2' } };
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [
          { productId: 'p1', quantity: 10 },
          { productId: 'p2', quantity: 5 },
        ],
      },
      user: repUser,
    };
    const res = makeRes();
    Product.findById
      .mockResolvedValueOnce(mockProduct)
      .mockResolvedValueOnce(product2);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Todos os produtos devem ser do mesmo fornecedor' });
  });

  it('400 quando produto não possui preço válido (erro de calculateProductPrice)', async () => {
    const req = {
      body: { adHocClient: { name: 'Avulso' }, items: [{ productId: 'p1', quantity: 10 }] },
      user: repUser,
    };
    const res = makeRes();
    Product.findById.mockResolvedValue(mockProduct);
    calculateProductPrice.mockImplementation(() => {
      throw new Error('Preço unitário não configurado');
    });
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Preço unitário não configurado' });
  });

  it('save: true → chama Quotation.create e retorna HTTP 201', async () => {
    const req = {
      body: {
        clientId: 'c1',
        items: [{ productId: 'p1', quantity: 100 }],
        save: true,
        sellerName: 'Vendedor',
      },
      user: repUser,
    };
    const res = makeRes();

    Client.findById.mockResolvedValue(mockClient);
    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 1000 });
    Quotation.create.mockResolvedValue({ _id: 'q1', total: 1100 });

    await createQuotation(req, res);

    expect(Quotation.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Orçamento criado com sucesso' }),
    );
  });

  it('save: false → não chama Quotation.create e retorna HTTP 200', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [{ productId: 'p1', quantity: 50 }],
        save: false,
      },
      user: repUser,
    };
    const res = makeRes();

    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 500 });

    await createQuotation(req, res);

    expect(Quotation.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ quotation: expect.any(Object) }),
    );
  });

  it('save ausente → comporta como save: false (HTTP 200, sem persistência)', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [{ productId: 'p1', quantity: 10 }],
      },
      user: repUser,
    };
    const res = makeRes();

    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });

    await createQuotation(req, res);

    expect(Quotation.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('currentOrderNumber do fornecedor NÃO é incrementado (Supplier.findByIdAndUpdate não é chamado)', async () => {
    const req = {
      body: {
        clientId: 'c1',
        items: [{ productId: 'p1', quantity: 10 }],
        save: true,
      },
      user: repUser,
    };
    const res = makeRes();

    Client.findById.mockResolvedValue(mockClient);
    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });
    Quotation.create.mockResolvedValue({ _id: 'q1' });

    await createQuotation(req, res);

    expect(Supplier.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('representativeId é o req.user.id quando save: true', async () => {
    const req = {
      body: {
        clientId: 'c1',
        items: [{ productId: 'p1', quantity: 10 }],
        save: true,
      },
      user: repUser,
    };
    const res = makeRes();

    Client.findById.mockResolvedValue(mockClient);
    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });
    Quotation.create.mockResolvedValue({ _id: 'q1' });

    await createQuotation(req, res);

    const createArg = Quotation.create.mock.calls[0][0];
    expect(createArg.representativeId).toBe(repUser.id);
  });

  it('criação com adHocClient → clientSnapshot usa dados do adHocClient', async () => {
    const adHocClient = {
      name: 'Empresa Avulsa',
      tradeName: 'Avulsa',
      cnpj: '11.111.111/0001-11',
      city: 'Rio de Janeiro',
    };
    const req = {
      body: {
        adHocClient,
        items: [{ productId: 'p1', quantity: 10 }],
        save: true,
      },
      user: repUser,
    };
    const res = makeRes();

    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });
    Quotation.create.mockResolvedValue({ _id: 'q1' });

    await createQuotation(req, res);

    const createArg = Quotation.create.mock.calls[0][0];
    expect(createArg.clientSnapshot.name).toBe('Empresa Avulsa');
    expect(createArg.clientSnapshot.tradeName).toBe('Avulsa');
    expect(createArg.clientSnapshot.cnpj).toBe('11.111.111/0001-11');
    expect(createArg.clientId).toBeNull();
  });

  it('500 em caso de erro inesperado', async () => {
    const req = {
      body: { adHocClient: { name: 'Avulso' }, items: [{ productId: 'p1', quantity: 10 }] },
      user: repUser,
    };
    const res = makeRes();
    // Simula erro real de banco (rejeição da Promise), não produto não encontrado
    Product.findById.mockRejectedValue(new Error('DB connection lost'));
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao criar orçamento' });
  });

  // ── Itens avulsos (adHocProduct) ──────────────────────────────────────────

  it('400 quando adHocProduct não tem name', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [{ adHocProduct: {}, supplierId: 's1', unitPrice: 10, quantity: 5 }],
      },
      user: repUser,
    };
    const res = makeRes();
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Nome do produto avulso é obrigatório' });
  });

  it('400 quando adHocProduct não tem supplierId', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [{ adHocProduct: { name: 'Prod Avulso' }, unitPrice: 10, quantity: 5 }],
      },
      user: repUser,
    };
    const res = makeRes();
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'supplierId é obrigatório para produto avulso' });
  });

  it('400 quando adHocProduct não tem unitPrice', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [{ adHocProduct: { name: 'Prod Avulso' }, supplierId: 's1', quantity: 5 }],
      },
      user: repUser,
    };
    const res = makeRes();
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Preço unitário é obrigatório para produto avulso' });
  });

  it('400 quando adHocProduct tem unitPrice <= 0', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [{ adHocProduct: { name: 'Prod Avulso' }, supplierId: 's1', unitPrice: 0, quantity: 5 }],
      },
      user: repUser,
    };
    const res = makeRes();
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Preço unitário é obrigatório para produto avulso' });
  });

  it('400 quando itens avulsos são de fornecedores diferentes', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [
          { adHocProduct: { name: 'Prod 1' }, supplierId: 's1', unitPrice: 10, quantity: 5 },
          { adHocProduct: { name: 'Prod 2' }, supplierId: 's2', unitPrice: 20, quantity: 3 },
        ],
      },
      user: repUser,
    };
    const res = makeRes();
    Supplier.findById.mockResolvedValue(mockSupplier);
    await createQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Todos os produtos devem ser do mesmo fornecedor' });
  });

  it('save: true com adHocProduct → cria orçamento com productId: null', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [{
          adHocProduct: { name: 'Sacola 30x40', description: 'Sacola personalizada', unitLabel: 'UN', saleMode: 'unit' },
          supplierId: 's1',
          unitPrice: 0.85,
          quantity: 5000,
        }],
        save: true,
      },
      user: repUser,
    };
    const res = makeRes();

    Supplier.findById.mockResolvedValue(mockSupplier);
    Quotation.create.mockResolvedValue({ _id: 'q1' });

    await createQuotation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createArg = Quotation.create.mock.calls[0][0];
    expect(createArg.items[0].productId).toBeNull();
    expect(createArg.items[0].productSnapshot.name).toBe('Sacola 30x40');
    expect(createArg.items[0].unitPrice).toBe(0.85);
    expect(createArg.items[0].subtotal).toBe(0.85 * 5000);
  });

  it('save: false com adHocProduct → calcula subtotal corretamente', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [{
          adHocProduct: { name: 'Produto X', unitLabel: 'KG' },
          supplierId: 's1',
          unitPrice: 5.5,
          quantity: 200,
        }],
        save: false,
      },
      user: repUser,
    };
    const res = makeRes();

    Supplier.findById.mockResolvedValue(mockSupplier);

    await createQuotation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { quotation } = res.json.mock.calls[0][0];
    expect(quotation.items[0].subtotal).toBe(5.5 * 200);
    expect(quotation.subtotal).toBe(5.5 * 200);
    // ipiValue = subtotal * 10% (mockSupplier.ipi = 10)
    expect(quotation.ipiValue).toBeCloseTo(5.5 * 200 * 0.1, 5);
  });

  it('mix de produto cadastrado e avulso no mesmo orçamento', async () => {
    const req = {
      body: {
        adHocClient: { name: 'Avulso' },
        items: [
          { productId: 'p1', quantity: 100 },
          {
            adHocProduct: { name: 'Produto Avulso', unitLabel: 'UN' },
            supplierId: 's1',
            unitPrice: 2.0,
            quantity: 50,
          },
        ],
        save: false,
      },
      user: repUser,
    };
    const res = makeRes();

    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 1000 });

    await createQuotation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { quotation } = res.json.mock.calls[0][0];
    expect(quotation.items).toHaveLength(2);
    // subtotal = 1000 (cadastrado) + 100 (avulso)
    expect(quotation.subtotal).toBe(1100);
  });
});

// ─── updateQuotation ──────────────────────────────────────────────────────────

describe('updateQuotation', () => {
  beforeEach(() => jest.clearAllMocks());

  function makeExistingQuotation(repId = repUser.id) {
    return {
      _id: 'q1',
      representativeId: { toString: () => repId },
      clientSnapshot: { name: 'Cliente Original' },
      supplierSnapshot: { name: 'Forn', ipi: 10 },
      items: [],
      subtotal: 0,
      ipiValue: 0,
      total: 0,
      attn: '',
      observations: '',
      sellerName: 'Valquiria',
      editHistory: [],
      save: jest.fn().mockResolvedValue(true),
    };
  }

  it('404 quando orçamento não existe', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(null);
    await updateQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Orçamento não encontrado' });
  });

  it('403 quando representante tenta editar orçamento de outro', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(makeExistingQuotation('outroRepId'));
    await updateQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado' });
  });

  it('admin pode editar orçamento de qualquer representante', async () => {
    const existing = makeExistingQuotation('outroRepId');
    const req = { params: { id: 'q1' }, body: { observations: 'Nova obs' }, user: adminUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(existing);
    await updateQuotation(req, res);
    expect(existing.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Orçamento atualizado com sucesso' }),
    );
  });

  it('atualiza campos simples sem reprocessar itens', async () => {
    const existing = makeExistingQuotation();
    const req = {
      params: { id: 'q1' },
      body: {
        attn: 'Novo Contato',
        observations: 'Obs atualizada',
        paymentTerm: '28/35 dias',
        sellerName: 'Nova Vendedora',
        changes: 'Ajuste de condições comerciais',
      },
      user: repUser,
    };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(existing);
    await updateQuotation(req, res);
    expect(existing.attn).toBe('Novo Contato');
    expect(existing.observations).toBe('Obs atualizada');
    expect(existing.paymentTerm).toBe('28/35 dias');
    expect(existing.sellerName).toBe('Nova Vendedora');
    expect(existing.editHistory).toHaveLength(1);
    expect(existing.editHistory[0].editedBy).toBe(repUser.id);
    expect(existing.editHistory[0].changes).toBe('Ajuste de condições comerciais');
    expect(existing.save).toHaveBeenCalled();
  });

  it('registra editedBy como req.user.id no histórico', async () => {
    const existing = makeExistingQuotation();
    const req = { params: { id: 'q1' }, body: { observations: 'x' }, user: adminUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(existing);
    await updateQuotation(req, res);
    expect(existing.editHistory[0].editedBy).toBe(adminUser.id);
  });

  it('usa mensagem padrão no histórico quando changes não é informado', async () => {
    const existing = makeExistingQuotation();
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(existing);
    await updateQuotation(req, res);
    expect(existing.editHistory[0].changes).toBe('Orçamento atualizado');
  });

  it('reprocessa itens e recalcula totais quando items é fornecido', async () => {
    const existing = makeExistingQuotation();
    const req = {
      params: { id: 'q1' },
      body: {
        items: [{ productId: 'p1', quantity: 50 }],
      },
      user: repUser,
    };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(existing);
    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 500 });
    await updateQuotation(req, res);
    expect(existing.subtotal).toBe(500);
    expect(existing.ipiValue).toBeCloseTo(500 * 0.1, 5);
    expect(existing.total).toBeCloseTo(550, 5);
    expect(existing.save).toHaveBeenCalled();
  });

  it('atualiza clientSnapshot quando clientId é fornecido', async () => {
    const existing = makeExistingQuotation();
    const req = {
      params: { id: 'q1' },
      body: { clientId: 'c1' },
      user: repUser,
    };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(existing);
    Client.findById.mockResolvedValue(mockClient);
    await updateQuotation(req, res);
    expect(existing.clientSnapshot.name).toBe(mockClient.name);
    expect(existing.clientId).toBe('c1');
  });

  it('404 quando clientId fornecido não existe', async () => {
    const existing = makeExistingQuotation();
    const req = { params: { id: 'q1' }, body: { clientId: 'c_inexistente' }, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(existing);
    Client.findById.mockResolvedValue(null);
    await updateQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cliente não encontrado' });
  });

  it('500 em caso de erro inesperado', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockRejectedValue(new Error('DB'));
    await updateQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao atualizar orçamento' });
  });
});

// ─── getQuotations ────────────────────────────────────────────────────────────

describe('getQuotations', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockFind(results = []) {
    const q = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(results),
    };
    Quotation.find.mockReturnValue(q);
    Quotation.countDocuments.mockResolvedValue(results.length);
  }

  it('representante vê apenas seus orçamentos (filtro por representativeId)', async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    mockFind();
    await getQuotations(req, res);
    expect(Quotation.find).toHaveBeenCalledWith(
      expect.objectContaining({ representativeId: repUser.id }),
    );
  });

  it('admin vê todos os orçamentos (sem filtro por representativeId)', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    mockFind();
    await getQuotations(req, res);
    expect(Quotation.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ representativeId: expect.anything() }),
    );
  });

  it('filtra por supplierId quando informado', async () => {
    const req = { query: { supplierId: 's1' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getQuotations(req, res);
    expect(Quotation.find).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: 's1' }),
    );
  });

  it('filtra por search (regex em clientSnapshot.name e tradeName)', async () => {
    const req = { query: { search: 'empresa' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getQuotations(req, res);
    const callArg = Quotation.find.mock.calls[0][0];
    expect(callArg.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ 'clientSnapshot.name': expect.any(RegExp) }),
        expect.objectContaining({ 'clientSnapshot.tradeName': expect.any(RegExp) }),
      ]),
    );
  });

  it('retorna estrutura paginada correta', async () => {
    const req = { query: { page: '2', limit: '5' }, user: adminUser };
    const res = makeRes();
    mockFind([{ _id: 'q1' }]);
    Quotation.countDocuments.mockResolvedValue(11);
    await getQuotations(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 5,
        total: 11,
        totalPages: 3,
        quotations: expect.any(Array),
      }),
    );
  });

  it('500 em caso de erro', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    Quotation.find.mockImplementation(() => { throw new Error('DB'); });
    await getQuotations(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao buscar orçamentos' });
  });
});

// ─── getQuotationById ─────────────────────────────────────────────────────────

describe('getQuotationById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando orçamento não existe', async () => {
    const req = { params: { id: 'q1' }, user: adminUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(null);
    await getQuotationById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Orçamento não encontrado' });
  });

  it('403 quando representante tenta acessar orçamento de outro', async () => {
    const req = { params: { id: 'q1' }, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue({
      _id: 'q1',
      representativeId: { toString: () => 'outroRepId' },
    });
    await getQuotationById(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado' });
  });

  it('representante acessa seu próprio orçamento com sucesso', async () => {
    const req = { params: { id: 'q1' }, user: repUser };
    const res = makeRes();
    const mockQuotation = { _id: 'q1', representativeId: { toString: () => repUser.id } };
    Quotation.findById.mockResolvedValue(mockQuotation);
    await getQuotationById(req, res);
    expect(res.json).toHaveBeenCalledWith(mockQuotation);
  });

  it('admin acessa qualquer orçamento', async () => {
    const req = { params: { id: 'q1' }, user: adminUser };
    const res = makeRes();
    const mockQuotation = { _id: 'q1', representativeId: { toString: () => 'qualquerRepId' } };
    Quotation.findById.mockResolvedValue(mockQuotation);
    await getQuotationById(req, res);
    expect(res.json).toHaveBeenCalledWith(mockQuotation);
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'q1' }, user: adminUser };
    const res = makeRes();
    Quotation.findById.mockRejectedValue(new Error('DB'));
    await getQuotationById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao buscar orçamento' });
  });
});

// ─── getQuotationPdf ──────────────────────────────────────────────────────────

describe('getQuotationPdf', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando orçamento não existe', async () => {
    const req = { params: { id: 'q1' }, user: adminUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(null);
    await getQuotationPdf(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Orçamento não encontrado' });
  });

  it('403 quando representante tenta acessar PDF de orçamento de outro', async () => {
    const req = { params: { id: 'q1' }, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue({
      _id: 'q1',
      representativeId: { toString: () => 'outroRepId' },
    });
    await getQuotationPdf(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado' });
  });

  it('chama generateQuotationPdf quando orçamento existe e acesso permitido', async () => {
    const req = { params: { id: 'q1' }, user: adminUser };
    const res = makeRes();
    const mockQuotation = { _id: 'q1', representativeId: { toString: () => 'qualquerRepId' } };
    Quotation.findById.mockResolvedValue(mockQuotation);
    generateQuotationPdf.mockImplementation(() => {});
    await getQuotationPdf(req, res);
    expect(generateQuotationPdf).toHaveBeenCalledWith(mockQuotation, res);
  });

  it('representante acessa PDF do seu próprio orçamento', async () => {
    const req = { params: { id: 'q1' }, user: repUser };
    const res = makeRes();
    const mockQuotation = { _id: 'q1', representativeId: { toString: () => repUser.id } };
    Quotation.findById.mockResolvedValue(mockQuotation);
    generateQuotationPdf.mockImplementation(() => {});
    await getQuotationPdf(req, res);
    expect(generateQuotationPdf).toHaveBeenCalledWith(mockQuotation, res);
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'q1' }, user: adminUser };
    const res = makeRes();
    Quotation.findById.mockRejectedValue(new Error('DB'));
    await getQuotationPdf(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao gerar PDF do orçamento' });
  });
});

// ─── getClientProductsForQuotation ────────────────────────────────────────────

describe('getClientProductsForQuotation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando clientId não existe', async () => {
    const req = { query: { clientId: 'c1' }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(null);
    await getClientProductsForQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cliente não encontrado' });
  });

  it('retorna produtos filtrados por clientId e active: true', async () => {
    const req = { query: { clientId: 'c1' }, user: repUser };
    const res = makeRes();
    const mockProducts = [{ _id: 'p1', name: 'Produto 1' }];
    Client.findById.mockResolvedValue(mockClient);
    const selectMock = jest.fn().mockResolvedValue(mockProducts);
    Product.find.mockReturnValue({ select: selectMock });
    await getClientProductsForQuotation(req, res);
    expect(Product.find).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'c1', active: true }),
    );
    expect(res.json).toHaveBeenCalledWith(mockProducts);
  });

  it('filtra por supplierId quando informado', async () => {
    const req = { query: { clientId: 'c1', supplierId: 's1' }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(mockClient);
    const selectMock = jest.fn().mockResolvedValue([]);
    Product.find.mockReturnValue({ select: selectMock });
    await getClientProductsForQuotation(req, res);
    expect(Product.find).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'c1', active: true, supplierId: 's1' }),
    );
  });

  it('não inclui supplierId no filtro quando não informado', async () => {
    const req = { query: { clientId: 'c1' }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(mockClient);
    const selectMock = jest.fn().mockResolvedValue([]);
    Product.find.mockReturnValue({ select: selectMock });
    await getClientProductsForQuotation(req, res);
    const callArg = Product.find.mock.calls[0][0];
    expect(callArg).not.toHaveProperty('supplierId');
  });

  it('500 em caso de erro', async () => {
    const req = { query: { clientId: 'c1' }, user: repUser };
    const res = makeRes();
    Client.findById.mockRejectedValue(new Error('DB'));
    await getClientProductsForQuotation(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao buscar produtos' });
  });
});

// ─── convertToOrder ───────────────────────────────────────────────────────────

describe('convertToOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  function makeQuotationForConvert(overrides = {}) {
    return {
      _id: 'q1',
      representativeId: { toString: () => repUser.id },
      clientId: 'c1',
      supplierId: 's1',
      clientSnapshot: { name: 'Cliente' },
      supplierSnapshot: { name: 'Forn', ipi: 10 },
      items: [
        {
          productId: 'p1',
          productSnapshot: { name: 'Produto' },
          quantity: 100,
        },
      ],
      deliveryDate: null,
      sellerName: 'Valquiria',
      ...overrides,
    };
  }

  it('404 quando orçamento não existe', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(null);
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Orçamento não encontrado' });
  });

  it('403 quando representante tenta converter orçamento de outro', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(makeQuotationForConvert({
      representativeId: { toString: () => 'outroRepId' },
    }));
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado' });
  });

  it('400 quando cotação tem cliente avulso (clientId null)', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(makeQuotationForConvert({ clientId: null }));
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('cliente avulso') }),
    );
  });

  it('400 quando cotação tem itens avulsos (productId null)', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(makeQuotationForConvert({
      items: [{ productId: null, productSnapshot: { name: 'Avulso' }, quantity: 10 }],
    }));
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('avulso') }),
    );
  });

  it('404 quando cliente não existe ao converter', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(makeQuotationForConvert());
    Client.findById.mockResolvedValue(null);
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cliente não encontrado' });
  });

  it('404 quando fornecedor não existe ao converter', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(makeQuotationForConvert());
    Client.findById.mockResolvedValue(mockClient);
    Supplier.findByIdAndUpdate.mockResolvedValue(null);
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Fornecedor não encontrado' });
  });

  it('404 quando produto não existe ao recalcular preços', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockResolvedValue(makeQuotationForConvert());
    Client.findById.mockResolvedValue(mockClient);
    Supplier.findByIdAndUpdate.mockResolvedValue({ ...mockSupplier, currentOrderNumber: 1 });
    Product.findById.mockResolvedValue(null);
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('não encontrado') }),
    );
  });

  it('converte cotação em pedido com sucesso e incrementa orderNumber', async () => {
    const req = {
      params: { id: 'q1' },
      body: { deliveryDate: '2026-06-30', customerPurchaseOrder: 'PC-001', paymentTerm: '30 dias' },
      user: repUser,
    };
    const res = makeRes();
    const updatedSupplier = { ...mockSupplier, currentOrderNumber: 5, ipi: 10 };
    Quotation.findById.mockResolvedValue(makeQuotationForConvert());
    Client.findById.mockResolvedValue(mockClient);
    Supplier.findByIdAndUpdate.mockResolvedValue(updatedSupplier);
    Product.findById.mockResolvedValue(mockProduct);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 1000 });
    Order.create.mockResolvedValue({ _id: 'o1', orderNumber: 5 });
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Pedido') }),
    );
    expect(Order.create).toHaveBeenCalledTimes(1);
  });

  it('admin pode converter orçamento de qualquer representante', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: adminUser };
    const res = makeRes();
    const updatedSupplier = { ...mockSupplier, currentOrderNumber: 1, ipi: 0 };
    Quotation.findById.mockResolvedValue(makeQuotationForConvert({
      representativeId: { toString: () => 'outroRepId' },
    }));
    Client.findById.mockResolvedValue(mockClient);
    Supplier.findByIdAndUpdate.mockResolvedValue(updatedSupplier);
    Product.findById.mockResolvedValue(mockProduct);
    calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });
    Order.create.mockResolvedValue({ _id: 'o1', orderNumber: 1 });
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('400 quando calculateProductPrice lança erro ao converter', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    const updatedSupplier = { ...mockSupplier, currentOrderNumber: 1, ipi: 0 };
    Quotation.findById.mockResolvedValue(makeQuotationForConvert());
    Client.findById.mockResolvedValue(mockClient);
    Supplier.findByIdAndUpdate.mockResolvedValue(updatedSupplier);
    Product.findById.mockResolvedValue(mockProduct);
    calculateProductPrice.mockImplementation(() => { throw new Error('Produto sem preço válido'); });
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Produto sem preço válido' });
  });

  it('500 em caso de erro inesperado', async () => {
    const req = { params: { id: 'q1' }, body: {}, user: repUser };
    const res = makeRes();
    Quotation.findById.mockRejectedValue(new Error('DB connection lost'));
    await convertToOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao converter orçamento em pedido' });
  });
});

// ─── generateQuotationPdfFromBody ─────────────────────────────────────────────

describe('generateQuotationPdfFromBody', () => {
  beforeEach(() => jest.clearAllMocks());

  it('chama generateQuotationPdf com os dados do body', async () => {
    const quotationData = { clientSnapshot: { name: 'Avulso' }, items: [], subtotal: 0, ipiValue: 0, total: 0 };
    const req = { body: quotationData, user: repUser };
    const res = makeRes();
    generateQuotationPdf.mockImplementation(() => {});
    await generateQuotationPdfFromBody(req, res);
    expect(generateQuotationPdf).toHaveBeenCalledWith(quotationData, res);
  });

  it('500 em caso de erro', async () => {
    const req = { body: {}, user: repUser };
    const res = makeRes();
    generateQuotationPdf.mockImplementation(() => { throw new Error('PDF error'); });
    await generateQuotationPdfFromBody(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao gerar PDF do orçamento' });
  });
});
