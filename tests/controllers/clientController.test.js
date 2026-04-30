jest.mock('../../src/models/client');

const Client = require('../../src/models/client');
const {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  toggleClientActive,
} = require('../../src/controllers/clientController');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const adminUser = { id: 'adminId', profile: 'admin' };
const repUser   = { id: 'repId',   profile: 'representative' };

// ─── createClient ─────────────────────────────────────────────────────────────

describe('createClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 quando nome está ausente', async () => {
    const req = { body: {}, user: adminUser };
    const res = makeRes();
    await createClient(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Nome é obrigatório' });
  });

  it('cria cliente com sucesso, normaliza campos e retorna 201', async () => {
    const req = {
      body: {
        name: 'Empresa Teste',
        cnpj: '12.345.678/0001-99',
        phone: '(11) 99999-9999',
        zipCode: '01310-100',
        stateRegistration: '123.456.789.000',
        state: 'sp',
      },
      user: repUser,
    };
    const res = makeRes();
    Client.create.mockResolvedValue({ _id: 'c1', name: 'Empresa Teste' });

    await createClient(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cnpj: '12345678000199',
        phone: '11999999999',
        zipCode: '01310100',
        stateRegistration: '123456789000',
        state: 'SP',
        representativeId: repUser.id,
      }),
    );
  });

  it('usa representativeId do body quando fornecido', async () => {
    const req = { body: { name: 'Empresa', representativeId: 'outroRepId' }, user: adminUser };
    const res = makeRes();
    Client.create.mockResolvedValue({ _id: 'c1' });

    await createClient(req, res);

    expect(Client.create).toHaveBeenCalledWith(
      expect.objectContaining({ representativeId: 'outroRepId' }),
    );
  });

  it('500 em caso de erro inesperado', async () => {
    const req = { body: { name: 'Empresa' }, user: adminUser };
    const res = makeRes();
    Client.create.mockRejectedValue(new Error('DB error'));

    await createClient(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getClients ───────────────────────────────────────────────────────────────

describe('getClients', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockFind(results = []) {
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(results) };
    Client.find.mockReturnValue(q);
    Client.countDocuments.mockResolvedValue(results.length);
    return q;
  }

  it('admin vê todos os clientes sem filtro de representante', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    mockFind();

    await getClients(req, res);

    expect(Client.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ representativeId: expect.anything() }),
    );
  });

  it('representante vê apenas seus clientes', async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    mockFind();

    await getClients(req, res);

    expect(Client.find).toHaveBeenCalledWith(
      expect.objectContaining({ representativeId: repUser.id }),
    );
  });

  it('admin pode filtrar por representativeId', async () => {
    const req = { query: { representativeId: 'rep123' }, user: adminUser };
    const res = makeRes();
    mockFind();

    await getClients(req, res);

    expect(Client.find).toHaveBeenCalledWith(
      expect.objectContaining({ representativeId: 'rep123' }),
    );
  });

  it('filtra por active=true', async () => {
    const req = { query: { active: 'true' }, user: adminUser };
    const res = makeRes();
    mockFind();

    await getClients(req, res);

    expect(Client.find).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
  });

  it('filtra por active=false', async () => {
    const req = { query: { active: 'false' }, user: adminUser };
    const res = makeRes();
    mockFind();

    await getClients(req, res);

    expect(Client.find).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('aplica busca por texto com $or', async () => {
    const req = { query: { search: 'empresa' }, user: adminUser };
    const res = makeRes();
    mockFind();

    await getClients(req, res);

    expect(Client.find).toHaveBeenCalledWith(
      expect.objectContaining({ $or: expect.any(Array) }),
    );
  });

  it('retorna paginação correta', async () => {
    const req = { query: { page: '2', limit: '5' }, user: adminUser };
    const res = makeRes();
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
    Client.find.mockReturnValue(q);
    Client.countDocuments.mockResolvedValue(12);

    await getClients(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, total: 12, totalPages: 3 }),
    );
  });

  it('500 em caso de erro', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    Client.find.mockImplementation(() => { throw new Error('DB'); });

    await getClients(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getClientById ────────────────────────────────────────────────────────────

describe('getClientById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando cliente não existe (admin)', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(null);

    await getClientById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('admin acessa qualquer cliente', async () => {
    const req = { params: { id: 'c1' }, user: adminUser };
    const res = makeRes();
    const mockClient = { _id: 'c1', name: 'Empresa' };
    Client.findById.mockResolvedValue(mockClient);

    await getClientById(req, res);

    expect(res.json).toHaveBeenCalledWith(mockClient);
  });

  it('representante acessa seu próprio cliente', async () => {
    const req = { params: { id: 'c1' }, user: repUser };
    const res = makeRes();
    const mockClient = { _id: 'c1', name: 'Empresa' };
    Client.findOne.mockResolvedValue(mockClient);

    await getClientById(req, res);

    expect(res.json).toHaveBeenCalledWith(mockClient);
  });

  it('404 quando representante não tem acesso ao cliente', async () => {
    const req = { params: { id: 'c1' }, user: repUser };
    const res = makeRes();
    Client.findOne.mockResolvedValue(null);

    await getClientById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'c1' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockRejectedValue(new Error('DB'));

    await getClientById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── updateClient ─────────────────────────────────────────────────────────────

describe('updateClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando cliente não existe', async () => {
    const req = { params: { id: 'x' }, body: {}, user: adminUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(null);

    await updateClient(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cliente não encontrado.' });
  });

  it('403 quando representante tenta editar cliente de outro', async () => {
    const req = { params: { id: 'c1' }, body: {}, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({
      _id: 'c1',
      representativeId: { toString: () => 'outroRepId' },
    });

    await updateClient(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado.' });
  });

  it('atualiza cliente com sucesso (admin)', async () => {
    const req = {
      params: { id: 'c1' },
      body: { name: 'Novo Nome', phone: '(11) 1111-1111', state: 'rj', cnpj: '11.111.111/0001-11' },
      user: adminUser,
    };
    const res = makeRes();
    const mockClient = {
      _id: 'c1',
      name: 'Antigo',
      phone: '0',
      state: 'SP',
      cnpj: '0',
      representativeId: { toString: () => 'repId' },
      save: jest.fn().mockResolvedValue(true),
    };
    Client.findById.mockResolvedValue(mockClient);

    await updateClient(req, res);

    expect(mockClient.name).toBe('Novo Nome');
    expect(mockClient.phone).toBe('1111111111');
    expect(mockClient.state).toBe('RJ');
    expect(mockClient.cnpj).toBe('11111111000111');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cliente atualizado com sucesso.' }),
    );
  });

  it('representante atualiza seu próprio cliente', async () => {
    const req = {
      params: { id: 'c1' },
      body: { name: 'Novo Nome' },
      user: repUser,
    };
    const res = makeRes();
    const mockClient = {
      _id: 'c1',
      name: 'Antigo',
      representativeId: { toString: () => repUser.id },
      save: jest.fn().mockResolvedValue(true),
    };
    Client.findById.mockResolvedValue(mockClient);

    await updateClient(req, res);

    expect(mockClient.name).toBe('Novo Nome');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cliente atualizado com sucesso.' }),
    );
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'c1' }, body: {}, user: adminUser };
    const res = makeRes();
    Client.findById.mockRejectedValue(new Error('DB'));

    await updateClient(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── deleteClient ─────────────────────────────────────────────────────────────

describe('deleteClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando cliente não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(null);

    await deleteClient(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 quando representante tenta deletar cliente de outro', async () => {
    const req = { params: { id: 'c1' }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({
      _id: 'c1',
      name: 'Empresa',
      representativeId: { toString: () => 'outroRepId' },
    });

    await deleteClient(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('deleta cliente com sucesso (admin)', async () => {
    const req = { params: { id: 'c1' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({ _id: 'c1', name: 'Empresa', representativeId: { toString: () => 'repId' } });
    Client.findByIdAndDelete.mockResolvedValue({});

    await deleteClient(req, res);

    expect(Client.findByIdAndDelete).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('excluído') }));
  });

  it('representante deleta seu próprio cliente', async () => {
    const req = { params: { id: 'c1' }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({ _id: 'c1', name: 'Empresa', representativeId: { toString: () => repUser.id } });
    Client.findByIdAndDelete.mockResolvedValue({});

    await deleteClient(req, res);

    expect(Client.findByIdAndDelete).toHaveBeenCalledWith('c1');
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'c1' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockRejectedValue(new Error('DB'));

    await deleteClient(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── toggleClientActive ───────────────────────────────────────────────────────

describe('toggleClientActive', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando cliente não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(null);

    await toggleClientActive(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 quando representante tenta alterar cliente de outro', async () => {
    const req = { params: { id: 'c1' }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({ _id: 'c1', active: true, representativeId: { toString: () => 'outroRepId' } });

    await toggleClientActive(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('desativa cliente ativo', async () => {
    const req = { params: { id: 'c1' }, user: adminUser };
    const res = makeRes();
    const mockClient = { _id: 'c1', active: true, representativeId: { toString: () => 'repId' }, save: jest.fn().mockResolvedValue(true) };
    Client.findById.mockResolvedValue(mockClient);

    await toggleClientActive(req, res);

    expect(mockClient.active).toBe(false);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cliente desativado com sucesso' }));
  });

  it('reativa cliente inativo', async () => {
    const req = { params: { id: 'c1' }, user: adminUser };
    const res = makeRes();
    const mockClient = { _id: 'c1', active: false, representativeId: { toString: () => 'repId' }, save: jest.fn().mockResolvedValue(true) };
    Client.findById.mockResolvedValue(mockClient);

    await toggleClientActive(req, res);

    expect(mockClient.active).toBe(true);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cliente reativado com sucesso' }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'c1' }, user: adminUser };
    const res = makeRes();
    Client.findById.mockRejectedValue(new Error('DB'));

    await toggleClientActive(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
