jest.mock('../../src/models/user');
jest.mock('../../src/models/client');
jest.mock('argon2');

const User   = require('../../src/models/user');
const Client = require('../../src/models/client');
const argon2 = require('argon2');
const {
  createRepresentative,
  getRepresentatives,
  getRepresentativeById,
  updateRepresentative,
  deleteRepresentative,
  toggleRepresentativeActive,
} = require('../../src/controllers/userController');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const adminUser = { id: 'adminId', profile: 'admin' };

// ─── createRepresentative ─────────────────────────────────────────────────────

describe('createRepresentative', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 quando campos obrigatórios estão ausentes', async () => {
    const req = { body: { name: 'Rep' }, user: adminUser };
    const res = makeRes();
    await createRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('409 quando email já existe', async () => {
    const req = { body: { name: 'Rep', email: 'rep@test.com', password: '12345678' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockResolvedValue({ _id: 'x' });
    await createRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('cria representante com sucesso e retorna 201', async () => {
    const req = { body: { name: 'Rep', email: 'rep@test.com', password: '12345678' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockResolvedValue(null);
    argon2.hash.mockResolvedValue('hashed');
    User.create.mockResolvedValue({ _id: 'r1', name: 'Rep', email: 'rep@test.com', profile: 'representative', active: true });
    await createRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ profile: 'representative' }));
  });

  it('400 quando senha tem menos de 8 caracteres', async () => {
    const req = { body: { name: 'Rep', email: 'rep@test.com', password: '1234567' }, user: adminUser };
    const res = makeRes();
    await createRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'A senha deve ter no mínimo 8 caracteres' });
  });

  it('400 quando email é inválido', async () => {
    const req = { body: { name: 'Rep', email: 'nao-e-email', password: '12345678' }, user: adminUser };
    const res = makeRes();
    await createRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email inválido' });
  });

  it('500 em caso de erro', async () => {
    const req = { body: { name: 'Rep', email: 'rep@test.com', password: '12345678' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockRejectedValue(new Error('DB'));
    await createRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getRepresentatives ───────────────────────────────────────────────────────

describe('getRepresentatives', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lista com filtro de profile=representative', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await getRepresentatives(req, res);
    expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ profile: 'representative' }));
  });

  it('filtra por active=true', async () => {
    const req = { query: { active: 'true' }, user: adminUser };
    const res = makeRes();
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await getRepresentatives(req, res);
    expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
  });

  it('filtra por active=false', async () => {
    const req = { query: { active: 'false' }, user: adminUser };
    const res = makeRes();
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await getRepresentatives(req, res);
    expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('500 em caso de erro', async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    User.find.mockImplementation(() => { throw new Error('DB'); });
    await getRepresentatives(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getRepresentativeById ────────────────────────────────────────────────────

describe('getRepresentativeById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando representante não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await getRepresentativeById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna representante quando encontrado', async () => {
    const req = { params: { id: 'r1' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', name: 'Rep', profile: 'representative' };
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockRep) });
    await getRepresentativeById(req, res);
    expect(res.json).toHaveBeenCalledWith(mockRep);
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'r1' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockImplementation(() => { throw new Error('DB'); });
    await getRepresentativeById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── updateRepresentative ─────────────────────────────────────────────────────

describe('updateRepresentative', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando representante não existe', async () => {
    const req = { params: { id: 'x' }, body: {}, user: adminUser };
    const res = makeRes();
    User.findOne.mockResolvedValue(null);
    await updateRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('409 quando novo email já pertence a outro usuário', async () => {
    const req = { params: { id: 'r1' }, body: { email: 'outro@test.com' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', email: 'rep@test.com', save: jest.fn() };
    // Primeiro findOne retorna o representante, segundo retorna conflito de email
    User.findOne
      .mockResolvedValueOnce(mockRep)
      .mockResolvedValueOnce({ _id: 'outro' });
    await updateRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('400 quando email é inválido no update', async () => {
    const req = { params: { id: 'r1' }, body: { email: 'nao-e-email' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', save: jest.fn() };
    User.findOne.mockResolvedValue(mockRep);
    await updateRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email inválido' });
  });

  it('atualiza nome, email e senha com sucesso', async () => {
    const req = { params: { id: 'r1' }, body: { name: 'Novo', email: 'novo@test.com', password: 'nova1234' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', name: 'Antigo', email: 'antigo@test.com', profile: 'representative', active: true, save: jest.fn().mockResolvedValue(true) };
    User.findOne
      .mockResolvedValueOnce(mockRep)   // busca o representante
      .mockResolvedValueOnce(null);     // verifica conflito de email
    argon2.hash.mockResolvedValue('hashed_nova');

    await updateRepresentative(req, res);

    expect(mockRep.name).toBe('Novo');
    expect(mockRep.email).toBe('novo@test.com');
    expect(mockRep.password).toBe('hashed_nova');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Representante atualizado com sucesso' }));
  });

  it('400 quando nova senha tem menos de 8 caracteres', async () => {
    const req = { params: { id: 'r1' }, body: { password: '1234567' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', save: jest.fn() };
    User.findOne.mockResolvedValue(mockRep);
    await updateRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'A senha deve ter no mínimo 8 caracteres' });
  });

  it('não atualiza senha quando password é string vazia', async () => {
    const req = { params: { id: 'r1' }, body: { password: '' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', password: 'original', save: jest.fn().mockResolvedValue(true) };
    User.findOne.mockResolvedValue(mockRep);

    await updateRepresentative(req, res);

    expect(argon2.hash).not.toHaveBeenCalled();
    expect(mockRep.password).toBe('original');
  });

  it('400 quando defaultCommissionPercentage é negativo', async () => {
    const req = { params: { id: 'r1' }, body: { defaultCommissionPercentage: -1 }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', save: jest.fn() };
    User.findOne.mockResolvedValue(mockRep);
    await updateRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'defaultCommissionPercentage deve ser um número entre 0 e 100' });
  });

  it('400 quando defaultCommissionPercentage é maior que 100', async () => {
    const req = { params: { id: 'r1' }, body: { defaultCommissionPercentage: 101 }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', save: jest.fn() };
    User.findOne.mockResolvedValue(mockRep);
    await updateRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 quando defaultCommissionPercentage não é número', async () => {
    const req = { params: { id: 'r1' }, body: { defaultCommissionPercentage: 'abc' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', save: jest.fn() };
    User.findOne.mockResolvedValue(mockRep);
    await updateRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('atualiza defaultCommissionPercentage válido com sucesso', async () => {
    const req = { params: { id: 'r1' }, body: { defaultCommissionPercentage: 25 }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', name: 'Rep', email: 'r@t.com', profile: 'representative', active: true, defaultCommissionPercentage: 0, save: jest.fn().mockResolvedValue(true) };
    User.findOne.mockResolvedValue(mockRep);
    await updateRepresentative(req, res);
    expect(mockRep.defaultCommissionPercentage).toBe(25);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Representante atualizado com sucesso' }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'r1' }, body: {}, user: adminUser };
    const res = makeRes();
    User.findOne.mockRejectedValue(new Error('DB'));
    await updateRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── deleteRepresentative ─────────────────────────────────────────────────────

describe('deleteRepresentative', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando representante não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockResolvedValue(null);
    await deleteRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 quando representante tem clientes vinculados', async () => {
    const req = { params: { id: 'r1' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockResolvedValue({ _id: 'r1', name: 'Rep' });
    Client.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'c1' }) });
    await deleteRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('vínculos') }));
  });

  it('deleta representante sem vínculos', async () => {
    const req = { params: { id: 'r1' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockResolvedValue({ _id: 'r1', name: 'Rep' });
    Client.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    User.deleteOne.mockResolvedValue({});
    await deleteRepresentative(req, res);
    expect(User.deleteOne).toHaveBeenCalledWith({ _id: 'r1' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('excluído') }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'r1' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockRejectedValue(new Error('DB'));
    await deleteRepresentative(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── toggleRepresentativeActive ───────────────────────────────────────────────

describe('toggleRepresentativeActive', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 quando representante não existe', async () => {
    const req = { params: { id: 'x' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockResolvedValue(null);
    await toggleRepresentativeActive(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('desativa representante ativo', async () => {
    const req = { params: { id: 'r1' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', name: 'Rep', email: 'r@t.com', profile: 'representative', active: true, save: jest.fn().mockResolvedValue(true) };
    User.findOne.mockResolvedValue(mockRep);
    await toggleRepresentativeActive(req, res);
    expect(mockRep.active).toBe(false);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Representante desativado com sucesso' }));
  });

  it('reativa representante inativo', async () => {
    const req = { params: { id: 'r1' }, user: adminUser };
    const res = makeRes();
    const mockRep = { _id: 'r1', name: 'Rep', email: 'r@t.com', profile: 'representative', active: false, save: jest.fn().mockResolvedValue(true) };
    User.findOne.mockResolvedValue(mockRep);
    await toggleRepresentativeActive(req, res);
    expect(mockRep.active).toBe(true);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Representante reativado com sucesso' }));
  });

  it('500 em caso de erro', async () => {
    const req = { params: { id: 'r1' }, user: adminUser };
    const res = makeRes();
    User.findOne.mockRejectedValue(new Error('DB'));
    await toggleRepresentativeActive(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
