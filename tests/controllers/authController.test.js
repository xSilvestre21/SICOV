jest.mock('../../src/models/user');
jest.mock('argon2');
jest.mock('jsonwebtoken');

const User = require('../../src/models/user');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { registerAdmin, login } = require('../../src/controllers/authController');

process.env.JWT_SECRET = 'test_secret';
process.env.ADMIN_REGISTER_SECRET = 'test-secret';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─── registerAdmin ────────────────────────────────────────────────────────────

describe('registerAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const req = { body: { name: 'Admin' }, headers: { 'x-admin-secret': 'test-secret' } }; // sem email e password
    const res = makeRes();

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Nome, email e senha são obrigatórios',
    });
  });

  it('retorna 409 quando email já existe', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '123456' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    User.findOne.mockResolvedValue({ _id: 'existingId', email: 'admin@test.com' });

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Já existe um usuário com esse email',
    });
  });

  it('cria admin com sucesso e retorna 201', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '123456' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    User.findOne.mockResolvedValue(null);
    argon2.hash.mockResolvedValue('hashed_password');
    User.create.mockResolvedValue({
      _id: 'newId',
      name: 'Admin',
      email: 'admin@test.com',
      profile: 'admin',
    });

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Administrador cadastrado com sucesso.',
        user: expect.objectContaining({ email: 'admin@test.com', profile: 'admin' }),
      }),
    );
  });

  it('retorna 500 em caso de erro inesperado', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '123456' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    User.findOne.mockRejectedValue(new Error('DB error'));

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 400 quando email ou senha estão ausentes', async () => {
    const req = { body: { email: 'admin@test.com' } }; // sem password
    const res = makeRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email e senha são obrigatórios.',
    });
  });

  it('retorna 401 quando usuário não existe', async () => {
    const req = { body: { email: 'naoexiste@test.com', password: '123456' } };
    const res = makeRes();

    User.findOne.mockResolvedValue(null);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Credenciais inválidas.' });
  });

  it('retorna 403 quando usuário está inativo', async () => {
    const req = { body: { email: 'inativo@test.com', password: '123456' } };
    const res = makeRes();

    User.findOne.mockResolvedValue({ active: false });

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Usuário inativo. Acesso bloqueado.',
    });
  });

  it('retorna 401 quando senha está incorreta', async () => {
    const req = { body: { email: 'admin@test.com', password: 'senhaerrada' } };
    const res = makeRes();

    User.findOne.mockResolvedValue({
      _id: 'id1',
      email: 'admin@test.com',
      password: 'hashed',
      active: true,
      profile: 'admin',
    });
    argon2.verify.mockResolvedValue(false);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Credenciais inválidas.' });
  });

  it('retorna 200 com token quando credenciais são válidas', async () => {
    const req = { body: { email: 'admin@test.com', password: 'senha123' } };
    const res = makeRes();

    const mockUser = {
      _id: 'userId',
      name: 'Admin',
      email: 'admin@test.com',
      password: 'hashed',
      profile: 'admin',
      active: true,
    };

    User.findOne.mockResolvedValue(mockUser);
    argon2.verify.mockResolvedValue(true);
    jwt.sign.mockReturnValue('mocked_jwt_token');

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Login realizado com sucesso.',
        token: 'mocked_jwt_token',
        user: expect.objectContaining({ email: 'admin@test.com' }),
      }),
    );
  });
});
