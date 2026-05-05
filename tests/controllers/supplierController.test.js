jest.mock('../../src/models/supplier');
jest.mock('../../src/models/user');

const Supplier = require('../../src/models/supplier');
const User     = require('../../src/models/user');
const {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  toggleSupplierActive,
  deleteSupplier,
} = require('../../src/controllers/supplierController');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const adminUser = { id: 'adminId', profile: 'admin' };
const repUser   = { id: 'repId',   profile: 'representative' };

// ─── createSupplier ───────────────────────────────────────────────────────────

describe('createSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 quando nome está ausente', async () => {
    const req = { body: { cnpj: '123' }, user: adminUser };
    const res = makeRes();
    await createSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Nome é obrigatório' });
  });

  it('400 quando CNPJ está ausente', async () => {
    const req = { body: { name: 'Forn' }, user: adminUser };
    const res = makeRes();
    await createSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'CNPJ é obrigatório' });
  });

  it('400 quando IPI é inválido', async () => {
    const req = { body: { name: 'Forn', cnpj: '123', ipi: 'abc' }, user: adminUser };
    const res = makeRes();
    await createSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'IPI inválido' });
  });

  it('400 quando há materiais duplicados na tabela de preços', async () => {
    const req = {
      body: {
        name: 'Forn', cnpj: '123', ipi: 0,
        priceTable: [
          { material: 'PEMD', price: 10, density: 0.95 },
          { material: 'PEMD', price: 12, density: 0.95 },
        ],
      },
      user: adminUser,
    };
    const res = makeRes();
    await createSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Não é permitido repetir material na tabela de preços' });
  });

  it('409 quando CNPJ já existe', async () => {
    const req = { body: { name: 'Forn', cnpj: '12.345.678/0001-99', ipi: 0 }, user: adminUser };
    const res = makeRes();
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    Supplier.findOne.mockResolvedValue({ _id: 'x' });
    await createSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('cria fornecedor com sucesso, normaliza campos', async () => {
    const req = {
      body: {
        name: 'Qualyplast', cnpj: '08.819.970/0001-25', ipi: '9,75',
        state: 'sp', phone: '(19) 3406-6407', zipCode: '13478-733',
        allowedRepresentatives: ['rep1'],
      },
      user: adminUser,
    };
    const res = makeRes();
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'rep1' }]) });
    Supplier.findOne.mockResolvedValue(null);
    Supplier.create.mockResolvedValue({ _id: 's1', name: 'Qualyplast', cnpj: '08819970000125', ipi: 9.75 });

    await createSupplier(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({ cnpj: '08819970000125', ipi: 9.75, state: 'SP' }),
    );
  });

  it('500 em caso de erro', async () => {
    const req = { body: { name: 'Forn', cnpj: '123', ipi: 0 }, user: adminUser };
    const res = makeRes();
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    Supplier.findOne.mockRejectedValue(new Error('DB'));
    await createSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getSuppliers ─────────────────────────────────────────────────────────────

describe('getSuppliers', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockFind(results = []) {
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(results) };
    Supplier.find.mockReturnValue(q);
    Supplier.countDocuments.mockResolvedValue(results.length);
  }

  it('representante vê apenas fornecedores autorizados', async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    mockFind();
    await getSuppliers(req, res);
    expect(Supplier.find).toHaveBeenCalledWith(expect.objectContaining({ allowedRepresentatives: repUser.id }));
  });

  it('admin vê todos os fornecedores', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    mockFind();
    await getSuppliers(req, res);
    expect(Supplier.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ allowedRepresentatives: expect.anything() }),
    );
  });

  it('admin filtra por representativeId', async () => {
    const req = { query: { representativeId: 'rep123' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getSuppliers(req, res);
    expect(Supplier.find).toHaveBeenCalledWith(expect.objectContaining({ allowedRepresentatives: 'rep123' }));
  });

  it('filtra por active=true', async () => {
    const req = { query: { active: 'true' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getSuppliers(req, res);
    expect(Supplier.find).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
  });

  it('filtra por active=false', async () => {
    const req = { query: { active: 'false' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getSuppliers(req, res);
    expect(Supplier.find).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('aplica busca por texto', async () => {
    const req = { query: { search: 'qualyplast' }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getSuppliers(req, res);
    expect(Supplier.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });

  it('retorna paginação correta', async () => {
    const req = { query: { page: '2', limit: '5' }, user: adminUser };
    const res = makeRes();
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
    Supplier.find.mockReturnValue(q);
    Supplier.countDocuments.mockResolvedValue(15);
    await getSuppliers(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 5, total: 15, totalPages: 3 }));
  });

  it('500 em caso de erro', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    Supplier.find.mockImplementation(() => { throw new Error('DB'); });
    await getSuppliers(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getSupplierById ──────────────────────────────────────────────────────────

describe('getSupplierById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando fornecedor não existe (admin)', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await getSupplierById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('admin busca por ID sem restrição', async () => {
    const req = { params: { id: 's1' }, user: adminUser };
    const res = makeRes();
    const mockSupplier = { _id: 's1', name: 'Qualyplast' };
    Supplier.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockSupplier) });
    await getSupplierById(req, res);
    expect(res.json).toHaveBeenCalledWith(mockSupplier);
  });

  it('representante busca com restrição de allowedRepresentatives', async () => {
    const req = { params: { id: 's1' }, user: repUser };
    const res = makeRes();
    const mockSupplier = { _id: 's1', name: 'Qualyplast' };
    Supplier.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockSupplier) });
    await getSupplierById(req, res);
    expect(Supplier.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ allowedRepresentatives: repUser.id, active: true }),
    );
    expect(res.json).toHaveBeenCalledWith(mockSupplier);
  });

  it('404 quando representante não tem acesso', async () => {
    const req = { params: { id: 's1' }, user: repUser };
    const res = makeRes();
    Supplier.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await getSupplierById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 's1' }, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockImplementation(() => { throw new Error('DB'); });
    await getSupplierById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── updateSupplier ───────────────────────────────────────────────────────────

describe('updateSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando fornecedor não existe', async () => {
    const req = { params: { id: 'x' }, body: {}, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockResolvedValue(null);
    await updateSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 quando CNPJ atualizado é vazio', async () => {
    const req = { params: { id: 's1' }, body: { cnpj: '   ' }, user: adminUser };
    const res = makeRes();
    const mockSupplier = { _id: 's1', cnpj: '123', ipi: 0, priceTable: [], allowedRepresentatives: [] };
    Supplier.findById.mockResolvedValue(mockSupplier);
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await updateSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'CNPJ é obrigatório' });
  });

  it('409 quando novo CNPJ já pertence a outro fornecedor', async () => {
    const req = { params: { id: 's1' }, body: { cnpj: '99.999.999/0001-99' }, user: adminUser };
    const res = makeRes();
    const mockSupplier = { _id: 's1', cnpj: '123', ipi: 0, priceTable: [], allowedRepresentatives: [] };
    Supplier.findById.mockResolvedValue(mockSupplier);
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    Supplier.findOne.mockResolvedValue({ _id: 'outro' });
    await updateSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('400 quando IPI atualizado é inválido', async () => {
    const req = { params: { id: 's1' }, body: { ipi: 'abc' }, user: adminUser };
    const res = makeRes();
    const mockSupplier = { _id: 's1', cnpj: '123', ipi: 0, priceTable: [], allowedRepresentatives: [] };
    Supplier.findById.mockResolvedValue(mockSupplier);
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await updateSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'IPI inválido' });
  });

  it('400 quando tabela de preços atualizada tem materiais duplicados', async () => {
    const req = {
      params: { id: 's1' },
      body: { priceTable: [{ material: 'PEMD', price: 10, density: 0.95 }, { material: 'PEMD', price: 12, density: 0.95 }] },
      user: adminUser,
    };
    const res = makeRes();
    const mockSupplier = { _id: 's1', cnpj: '123', ipi: 0, priceTable: [], allowedRepresentatives: [] };
    Supplier.findById.mockResolvedValue(mockSupplier);
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await updateSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('atualiza fornecedor com sucesso — normaliza state para maiúsculo', async () => {
    const req = {
      params: { id: 's1' },
      body: { name: 'Novo Nome', state: 'rj', ipi: 5 },
      user: adminUser,
    };
    const res = makeRes();
    const mockSupplier = {
      _id: 's1', name: 'Antigo', cnpj: '123', ipi: 0, state: 'SP',
      priceTable: [], allowedRepresentatives: [],
      save: jest.fn().mockResolvedValue(true),
    };
    Supplier.findById.mockResolvedValue(mockSupplier);
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    const updatedMock = { _id: 's1', name: 'Novo Nome' };
    Supplier.findById.mockResolvedValueOnce(mockSupplier).mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(updatedMock) });

    await updateSupplier(req, res);

    expect(mockSupplier.name).toBe('Novo Nome');
    expect(mockSupplier.state).toBe('RJ');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Fornecedor atualizado com sucesso' }));
  });

  it('mantém state existente quando state não é enviado no body', async () => {
    const req = {
      params: { id: 's1' },
      body: { name: 'Novo Nome' }, // sem state
      user: adminUser,
    };
    const res = makeRes();
    const mockSupplier = {
      _id: 's1', name: 'Antigo', cnpj: '123', ipi: 0, state: 'MG',
      priceTable: [], allowedRepresentatives: [],
      save: jest.fn().mockResolvedValue(true),
    };
    Supplier.findById.mockResolvedValue(mockSupplier);
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    const updatedMock = { _id: 's1', name: 'Novo Nome', state: 'MG' };
    Supplier.findById.mockResolvedValueOnce(mockSupplier).mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(updatedMock) });

    await updateSupplier(req, res);

    // state não foi enviado, deve manter o valor original
    expect(mockSupplier.state).toBe('MG');
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 's1' }, body: {}, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockRejectedValue(new Error('DB'));
    await updateSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── toggleSupplierActive ─────────────────────────────────────────────────────

describe('toggleSupplierActive', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando fornecedor não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockResolvedValue(null);
    await toggleSupplierActive(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('desativa fornecedor ativo', async () => {
    const req = { params: { id: 's1' }, user: adminUser };
    const res = makeRes();
    const mock = { _id: 's1', active: true, save: jest.fn().mockResolvedValue(true) };
    Supplier.findById.mockResolvedValue(mock);
    await toggleSupplierActive(req, res);
    expect(mock.active).toBe(false);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Fornecedor desativado com sucesso' }));
  });

  it('reativa fornecedor inativo', async () => {
    const req = { params: { id: 's1' }, user: adminUser };
    const res = makeRes();
    const mock = { _id: 's1', active: false, save: jest.fn().mockResolvedValue(true) };
    Supplier.findById.mockResolvedValue(mock);
    await toggleSupplierActive(req, res);
    expect(mock.active).toBe(true);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Fornecedor reativado com sucesso' }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 's1' }, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockRejectedValue(new Error('DB'));
    await toggleSupplierActive(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── deleteSupplier ───────────────────────────────────────────────────────────

describe('deleteSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando fornecedor não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockResolvedValue(null);
    await deleteSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deleta fornecedor com sucesso', async () => {
    const req = { params: { id: 's1' }, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockResolvedValue({ _id: 's1', name: 'Qualyplast' });
    Supplier.findByIdAndDelete.mockResolvedValue({});
    await deleteSupplier(req, res);
    expect(Supplier.findByIdAndDelete).toHaveBeenCalledWith('s1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Fornecedor excluído com sucesso' }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 's1' }, user: adminUser };
    const res = makeRes();
    Supplier.findById.mockRejectedValue(new Error('DB'));
    await deleteSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
