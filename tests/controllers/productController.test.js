
jest.mock('../../src/models/product');
jest.mock('../../src/models/supplier');
jest.mock('../../src/models/client');

const Product  = require('../../src/models/product');
const Supplier = require('../../src/models/supplier');
const Client   = require('../../src/models/client');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductActive,
  deleteProduct,
} = require('../../src/controllers/productController');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const adminUser = { id: 'adminId', profile: 'admin' };
const repUser   = { id: 'repId',   profile: 'representative' };

// Helper: mock de cliente ativo acessível
function mockClientAccess(repId = adminUser.id) {
  Client.findById.mockResolvedValue({
    _id: 'c1',
    active: true,
    representativeId: { toString: () => repId },
  });
}

// ─── createProduct ────────────────────────────────────────────────────────────

describe('createProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 quando clientId está ausente', async () => {
    const req = { body: {}, user: adminUser };
    const res = makeRes();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cliente é obrigatório' });
  });

  it('400 quando supplierId está ausente', async () => {
    const req = { body: { clientId: 'c1' }, user: adminUser };
    const res = makeRes();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Fornecedor é obrigatório' });
  });

  it('400 quando name está ausente', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1' }, user: adminUser };
    const res = makeRes();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Nome é obrigatório' });
  });

  it('400 quando productType está ausente', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P' }, user: adminUser };
    const res = makeRes();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Tipo do produto é obrigatório' });
  });

  it('400 quando saleMode está ausente', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'custom' }, user: adminUser };
    const res = makeRes();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Modo de venda é obrigatório' });
  });

  it('400 quando calculationMode está ausente', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'custom', saleMode: 'unit' }, user: adminUser };
    const res = makeRes();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Modo de cálculo é obrigatório' });
  });

  it('403 quando cliente não existe', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'custom', saleMode: 'unit', calculationMode: 'manual_price' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(null);
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cliente não encontrado' });
  });

  it('403 quando representante não tem acesso ao cliente', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'custom', saleMode: 'unit', calculationMode: 'manual_price' }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({ _id: 'c1', active: true, representativeId: { toString: () => 'outroRepId' } });
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado ao cliente informado' });
  });

  it('403 quando cliente está inativo', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'custom', saleMode: 'unit', calculationMode: 'manual_price' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({ _id: 'c1', active: false, representativeId: { toString: () => adminUser.id } });
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Não é possível usar um cliente inativo' });
  });

  it('400 quando plastic_bag sem material', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'plastic_bag', saleMode: 'thousand', calculationMode: 'dimensions_density_factor' }, user: adminUser };
    const res = makeRes();
    mockClientAccess();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Para sacos plásticos, o material é obrigatório' });
  });

  it('400 quando fornecedor não encontrado para plastic_bag', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'plastic_bag', saleMode: 'thousand', calculationMode: 'dimensions_density_factor', material: 'PEMD' }, user: adminUser };
    const res = makeRes();
    mockClientAccess();
    Supplier.findById.mockResolvedValue(null);
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Fornecedor não encontrado' });
  });

  it('400 quando fornecedor inativo para plastic_bag', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'plastic_bag', saleMode: 'thousand', calculationMode: 'dimensions_density_factor', material: 'PEMD' }, user: adminUser };
    const res = makeRes();
    mockClientAccess();
    Supplier.findById.mockResolvedValue({ _id: 's1', active: false, priceTable: [] });
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Não é possível usar um fornecedor inativo' });
  });

  it('400 quando material não encontrado na tabela do fornecedor', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'plastic_bag', saleMode: 'thousand', calculationMode: 'dimensions_density_factor', material: 'PEMD' }, user: adminUser };
    const res = makeRes();
    mockClientAccess();
    Supplier.findById.mockResolvedValue({ _id: 's1', active: true, priceTable: [{ material: 'OUTRO', price: 10, density: 0.95 }] });
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Material não encontrado na tabela do fornecedor' });
  });

  it('400 quando material sem densidade na tabela do fornecedor', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'plastic_bag', saleMode: 'thousand', calculationMode: 'dimensions_density_factor', material: 'PEMD' }, user: adminUser };
    const res = makeRes();
    mockClientAccess();
    Supplier.findById.mockResolvedValue({ _id: 's1', active: true, priceTable: [{ material: 'PEMD', price: 10 }] });
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'O material selecionado no fornecedor não possui densidade cadastrada' });
  });

  it('400 quando validateProductRules retorna erro (plastic_bag sem medidas)', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'P',
        productType: 'plastic_bag', saleMode: 'thousand',
        calculationMode: 'dimensions_density_factor', material: 'PEMD',
        technicalData: { measurements: {} },
        commercialData: {},
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    Supplier.findById.mockResolvedValue({ _id: 's1', active: true, priceTable: [{ material: 'PEMD', price: 10, density: 0.95 }] });
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('largura') });
  });

  it('cria produto custom com sucesso', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Produto Custom',
        productType: 'custom', saleMode: 'unit',
        calculationMode: 'manual_price',
        commercialData: { basePrice: 10 },
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    Product.create.mockResolvedValue({ _id: 'p1', name: 'Produto Custom' });
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Produto criado com sucesso' }));
  });

  it('cria produto tape com boxPrice calculado automaticamente', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Fita',
        productType: 'tape', saleMode: 'box',
        calculationMode: 'boxes_times_units_per_box_times_unit_price',
        technicalData: { unitsPerBox: 36 },
        commercialData: { unitPrice: 2 },
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    Product.create.mockResolvedValue({ _id: 'p1', name: 'Fita' });
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    // boxPrice deve ter sido calculado: 36 * 2 = 72
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ commercialData: expect.objectContaining({ boxPrice: 72 }) }),
    );
  });

  it('500 em caso de erro', async () => {
    const req = { body: { clientId: 'c1', supplierId: 's1', name: 'P', productType: 'custom', saleMode: 'unit', calculationMode: 'manual_price' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockRejectedValue(new Error('DB'));
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getProducts ──────────────────────────────────────────────────────────────

describe('getProducts', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockFind(results = []) {
    const q = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(results),
    };
    Product.find.mockReturnValue(q);
    Product.countDocuments.mockResolvedValue(results.length);
  }

  it('admin vê todos os produtos com filtros opcionais', async () => {
    const req = { query: { active: 'true', clientId: 'c1', supplierId: 's1', productType: 'custom', material: 'pvc' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getProducts(req, res);
    expect(Product.find).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, clientId: 'c1', supplierId: 's1', productType: 'custom', material: 'PVC' }),
    );
  });

  it('filtra por active=false', async () => {
    const req = { query: { active: 'false' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getProducts(req, res);
    expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('filtra por dimensões (width, length, thickness)', async () => {
    const req = { query: { width: '20', length: '30', thickness: '0,1' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getProducts(req, res);
    expect(Product.find).toHaveBeenCalledWith(
      expect.objectContaining({
        'technicalData.measurements.width': 20,
        'technicalData.measurements.length': 30,
        'technicalData.measurements.thickness': 0.1,
      }),
    );
  });

  it('aplica busca por texto com $or', async () => {
    const req = { query: { search: 'saco' }, user: adminUser };
    const res = makeRes();
    mockFind();
    Client.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    Supplier.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await getProducts(req, res);
    expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });

  it('representante vê apenas produtos de seus clientes e somente ativos', async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    mockFind();
    Client.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'c1' }]) });
    await getProducts(req, res);
    expect(Product.find).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, clientId: { $in: ['c1'] } }),
    );
  });

  it('retorna paginação correta', async () => {
    const req = { query: { page: '3', limit: '4' }, user: adminUser };
    const res = makeRes();
    const q = { populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
    Product.find.mockReturnValue(q);
    Product.countDocuments.mockResolvedValue(20);
    await getProducts(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 3, limit: 4, total: 20, totalPages: 5 }));
  });

  it('500 em caso de erro', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    Product.find.mockImplementation(() => { throw new Error('DB'); });
    await getProducts(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getProductById ───────────────────────────────────────────────────────────

describe('getProductById', () => {
  beforeEach(() => jest.clearAllMocks());

  // getProductById usa .populate().populate() em cadeia — precisamos de mock encadeado correto
  function mockFindByIdPopulate(result) {
    const secondPopulate = jest.fn().mockResolvedValue(result);
    const firstPopulate  = jest.fn().mockReturnValue({ populate: secondPopulate });
    Product.findById.mockReturnValue({ populate: firstPopulate });
  }

  it('404 quando produto não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    mockFindByIdPopulate(null);
    await getProductById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 quando representante não tem acesso', async () => {
    const req = { params: { id: 'p1' }, user: repUser };
    const res = makeRes();
    const mockProduct = { _id: 'p1', clientId: { representativeId: { toString: () => 'outroRepId' } } };
    mockFindByIdPopulate(mockProduct);
    await getProductById(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admin acessa qualquer produto', async () => {
    const req = { params: { id: 'p1' }, user: adminUser };
    const res = makeRes();
    const mockProduct = { _id: 'p1', clientId: { representativeId: { toString: () => 'qualquerRepId' } } };
    mockFindByIdPopulate(mockProduct);
    await getProductById(req, res);
    expect(res.json).toHaveBeenCalledWith(mockProduct);
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'p1' }, user: adminUser };
    const res = makeRes();
    Product.findById.mockImplementation(() => { throw new Error('DB'); });
    await getProductById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── toggleProductActive ──────────────────────────────────────────────────────

describe('toggleProductActive', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando produto não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    Product.findById.mockResolvedValue(null);
    await toggleProductActive(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 quando cliente não existe (via ensureClientAccess)', async () => {
    const req = { params: { id: 'p1' }, user: adminUser };
    const res = makeRes();
    Product.findById.mockResolvedValue({ _id: 'p1', clientId: 'c1', active: true });
    Client.findById.mockResolvedValue(null);
    await toggleProductActive(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('desativa produto ativo', async () => {
    const req = { params: { id: 'p1' }, user: adminUser };
    const res = makeRes();
    const mockProduct = { _id: 'p1', clientId: 'c1', active: true, save: jest.fn().mockResolvedValue(true) };
    Product.findById.mockResolvedValue(mockProduct);
    mockClientAccess();
    await toggleProductActive(req, res);
    expect(mockProduct.active).toBe(false);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Produto desativado com sucesso' }));
  });

  it('reativa produto inativo', async () => {
    const req = { params: { id: 'p1' }, user: adminUser };
    const res = makeRes();
    const mockProduct = { _id: 'p1', clientId: 'c1', active: false, save: jest.fn().mockResolvedValue(true) };
    Product.findById.mockResolvedValue(mockProduct);
    mockClientAccess();
    await toggleProductActive(req, res);
    expect(mockProduct.active).toBe(true);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Produto reativado com sucesso' }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'p1' }, user: adminUser };
    const res = makeRes();
    Product.findById.mockRejectedValue(new Error('DB'));
    await toggleProductActive(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── deleteProduct ────────────────────────────────────────────────────────────

describe('deleteProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando produto não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    Product.findById.mockResolvedValue(null);
    await deleteProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 quando representante não tem acesso ao cliente', async () => {
    const req = { params: { id: 'p1' }, user: repUser };
    const res = makeRes();
    Product.findById.mockResolvedValue({ _id: 'p1', clientId: 'c1' });
    Client.findById.mockResolvedValue({ _id: 'c1', active: true, representativeId: { toString: () => 'outroRepId' } });
    await deleteProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('deleta produto com sucesso', async () => {
    const req = { params: { id: 'p1' }, user: adminUser };
    const res = makeRes();
    Product.findById.mockResolvedValue({ _id: 'p1', clientId: 'c1' });
    mockClientAccess();
    Product.findByIdAndDelete.mockResolvedValue({});
    await deleteProduct(req, res);
    expect(Product.findByIdAndDelete).toHaveBeenCalledWith('p1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Produto excluído com sucesso' }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'p1' }, user: adminUser };
    const res = makeRes();
    Product.findById.mockRejectedValue(new Error('DB'));
    await deleteProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── updateProduct ────────────────────────────────────────────────────────────

describe('updateProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando produto não existe', async () => {
    const req = { params: { id: 'x' }, body: {}, user: adminUser };
    const res = makeRes();
    Product.findById.mockResolvedValue(null);
    await updateProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 quando cliente atual não acessível', async () => {
    const req = { params: { id: 'p1' }, body: {}, user: repUser };
    const res = makeRes();
    Product.findById.mockResolvedValue({ _id: 'p1', clientId: 'c1', productType: 'custom', calculationMode: 'manual_price', material: null, supplierId: 's1', technicalData: {}, commercialData: {}, selectedExtras: [] });
    Client.findById.mockResolvedValue(null);
    await updateProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('403 quando cliente está inativo no update', async () => {
    const req = { params: { id: 'p1' }, body: {}, user: adminUser };
    const res = makeRes();
    Product.findById.mockResolvedValue({ _id: 'p1', clientId: 'c1', productType: 'custom', calculationMode: 'manual_price', material: null, supplierId: 's1', technicalData: {}, commercialData: {}, selectedExtras: [] });
    Client.findById.mockResolvedValue({ _id: 'c1', active: false, representativeId: { toString: () => adminUser.id } });
    await updateProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Não é possível usar um cliente inativo' });
  });

  it('400 quando plastic_bag sem material no update', async () => {
    const req = {
      params: { id: 'p1' },
      body: { productType: 'plastic_bag', material: null },
      user: adminUser,
    };
    const res = makeRes();
    Product.findById.mockResolvedValue({
      _id: 'p1', clientId: 'c1', supplierId: 's1',
      productType: 'custom', calculationMode: 'manual_price',
      material: null, saleMode: 'unit', unitLabel: 'UN', description: 'D',
      technicalData: { measurements: {} }, commercialData: { basePrice: 10 },
      selectedExtras: [],
      save: jest.fn(),
    });
    Client.findById.mockResolvedValue({ _id: 'c1', active: true, representativeId: { toString: () => adminUser.id } });
    await updateProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Para sacos plásticos, o material é obrigatório' });
  });

  it('400 quando validateProductRules retorna erro no update', async () => {
    const req = {
      params: { id: 'p1' },
      body: {
        calculationMode: 'weight_times_price_per_kg',
        commercialData: {}, // sem basePrice
      },
      user: adminUser,
    };
    const res = makeRes();
    Product.findById.mockResolvedValue({
      _id: 'p1', clientId: 'c1', supplierId: 's1',
      productType: 'stretch', calculationMode: 'manual_price',
      material: null, saleMode: 'kg', unitLabel: 'KG', description: 'D',
      technicalData: { measurements: {} }, commercialData: { basePrice: 10 },
      selectedExtras: [],
      save: jest.fn(),
    });
    Client.findById.mockResolvedValue({ _id: 'c1', active: true, representativeId: { toString: () => adminUser.id } });
    await updateProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('preço base') });
  });

  it('atualiza produto custom com sucesso', async () => {
    const req = {
      params: { id: 'p1' },
      body: { name: 'Novo Nome', notes: 'Nova obs' },
      user: adminUser,
    };
    const res = makeRes();
    const mockProduct = {
      _id: 'p1', clientId: 'c1', supplierId: 's1',
      name: 'Antigo', productType: 'custom', calculationMode: 'manual_price',
      material: null, saleMode: 'unit', unitLabel: 'UN', description: 'D',
      technicalData: { measurements: {} }, commercialData: { basePrice: 10 },
      selectedExtras: [],
      save: jest.fn().mockResolvedValue(true),
    };
    const updatedProduct = { ...mockProduct, name: 'Novo Nome' };

    // Primeira chamada: findById simples para buscar o produto
    Product.findById.mockResolvedValueOnce(mockProduct);
    // Segunda chamada: findById com .populate().populate() para retornar o produto atualizado
    const secondPopulate = jest.fn().mockResolvedValue(updatedProduct);
    const firstPopulate  = jest.fn().mockReturnValue({ populate: secondPopulate });
    Product.findById.mockReturnValueOnce({ populate: firstPopulate });

    // ensureClientAccess é chamado duas vezes (clientId atual e novo)
    Client.findById.mockResolvedValue({ _id: 'c1', active: true, representativeId: { toString: () => adminUser.id } });

    await updateProduct(req, res);

    expect(mockProduct.name).toBe('Novo Nome');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Produto atualizado com sucesso' }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'p1' }, body: {}, user: adminUser };
    const res = makeRes();
    Product.findById.mockRejectedValue(new Error('DB'));
    await updateProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── Funções de normalização internas (cobertura de branches) ─────────────────

describe('normalização de selectedExtras via createProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('filtra extras inválidos (sem name, chargeType ou value negativo)', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Produto',
        productType: 'custom', saleMode: 'unit', calculationMode: 'manual_price',
        commercialData: { basePrice: 10 },
        selectedExtras: [
          { name: 'Extra Válido', chargeType: 'per_kg', value: 5, source: 'manual' },
          { name: '', chargeType: 'per_kg', value: 5, source: 'manual' }, // sem name — filtrado
          { name: 'Sem chargeType', chargeType: null, value: 5, source: 'manual' }, // sem chargeType — filtrado
          { name: 'Valor negativo', chargeType: 'per_kg', value: -1, source: 'manual' }, // valor negativo — filtrado
          // Nota: source: null vira 'manual' pelo || 'manual', então NÃO é filtrado
        ],
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    Product.create.mockResolvedValue({ _id: 'p1' });

    await createProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // 1 extra válido deve ter sido passado (os outros 3 foram filtrados)
    const createArg = Product.create.mock.calls[0][0];
    expect(createArg.selectedExtras).toHaveLength(1);
    expect(createArg.selectedExtras[0].name).toBe('Extra Válido');
  });

  it('selectedExtras não-array resulta em array vazio', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Produto',
        productType: 'custom', saleMode: 'unit', calculationMode: 'manual_price',
        commercialData: { basePrice: 10 },
        selectedExtras: 'não é array',
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    Product.create.mockResolvedValue({ _id: 'p1' });

    await createProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createArg = Product.create.mock.calls[0][0];
    expect(createArg.selectedExtras).toEqual([]);
  });
});

describe('normalização de measurements via createProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('parseia medidas em formato brasileiro (vírgula como decimal)', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Produto',
        productType: 'custom', saleMode: 'unit', calculationMode: 'manual_price',
        commercialData: { basePrice: 10 },
        technicalData: {
          measurements: { width: '0,077', length: '0,135', thickness: '0,00015' },
        },
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    Product.create.mockResolvedValue({ _id: 'p1' });

    await createProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createArg = Product.create.mock.calls[0][0];
    expect(createArg.technicalData.measurements.width).toBeCloseTo(0.077, 5);
    expect(createArg.technicalData.measurements.length).toBeCloseTo(0.135, 5);
    expect(createArg.technicalData.measurements.thickness).toBeCloseTo(0.00015, 8);
  });

  it('measurements undefined resulta em campos undefined (não incluídos)', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Produto',
        productType: 'custom', saleMode: 'unit', calculationMode: 'manual_price',
        commercialData: { basePrice: 10 },
        technicalData: {}, // sem measurements
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    Product.create.mockResolvedValue({ _id: 'p1' });

    await createProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createArg = Product.create.mock.calls[0][0];
    expect(createArg.technicalData.measurements.width).toBeUndefined();
  });
});

describe('validação de regras de produto (validateProductRules)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 para tape sem unitsPerBox', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Fita',
        productType: 'tape', saleMode: 'box',
        calculationMode: 'boxes_times_box_price',
        commercialData: { boxPrice: 10 },
        // sem technicalData.unitsPerBox
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('quantidade por caixa') });
  });

  it('400 para tape com calculationMode boxes_times_units_per_box_times_unit_price sem unitPrice', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Fita',
        productType: 'tape', saleMode: 'box',
        calculationMode: 'boxes_times_units_per_box_times_unit_price',
        technicalData: { unitsPerBox: 36 },
        commercialData: {}, // sem unitPrice
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('valor unitário') });
  });

  it('400 para tape com calculationMode boxes_times_box_price sem boxPrice', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Fita',
        productType: 'tape', saleMode: 'box',
        calculationMode: 'boxes_times_box_price',
        technicalData: { unitsPerBox: 36 },
        commercialData: {}, // sem boxPrice
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('valor da caixa') });
  });

  it('400 para weight_times_price_per_kg sem basePrice', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Stretch',
        productType: 'stretch', saleMode: 'kg',
        calculationMode: 'weight_times_price_per_kg',
        commercialData: {}, // sem basePrice
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('preço base') });
  });

  it('400 para quantity_times_unit_price sem unitPrice', async () => {
    const req = {
      body: {
        clientId: 'c1', supplierId: 's1', name: 'Produto',
        productType: 'custom', saleMode: 'unit',
        calculationMode: 'quantity_times_unit_price',
        commercialData: {}, // sem unitPrice
      },
      user: adminUser,
    };
    const res = makeRes();
    mockClientAccess();
    await createProduct(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('valor unitário') });
  });
});
