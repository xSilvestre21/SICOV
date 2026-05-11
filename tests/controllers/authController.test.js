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

  it('403 quando ADMIN_REGISTER_SECRET não está definido no ambiente', async () => {
    const original = process.env.ADMIN_REGISTER_SECRET;
    delete process.env.ADMIN_REGISTER_SECRET;

    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '123456' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Registro de administrador desabilitado neste ambiente.' });

    process.env.ADMIN_REGISTER_SECRET = original;
  });

  it('403 quando x-admin-secret está ausente', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '123456' }, headers: {} };
    const res = makeRes();

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado.' });
  });

  it('403 quando x-admin-secret está incorreto', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '123456' }, headers: { 'x-admin-secret': 'segredo-errado' } };
    const res = makeRes();

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado.' });
  });

  it('400 quando campos obrigatórios estão ausentes (sem email e password)', async () => {
    const req = { body: { name: 'Admin' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Nome, email e senha são obrigatórios' });
  });

  it('400 quando apenas name está ausente', async () => {
    const req = { body: { email: 'admin@test.com', password: '123456' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 quando email é inválido', async () => {
    const req = { body: { name: 'Admin', email: 'nao-e-email', password: '12345678' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email inválido' });
  });

  it('400 quando senha tem menos de 8 caracteres', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '1234567' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'A senha deve ter no mínimo 8 caracteres' });
  });

  it('409 quando email já existe', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '12345678' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    User.findOne.mockResolvedValue({ _id: 'existingId', email: 'admin@test.com' });

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Já existe um usuário com esse email' });
  });

  it('cria admin com sucesso e retorna 201 sem expor senha', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '12345678' }, headers: { 'x-admin-secret': 'test-secret' } };
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
    // Senha não deve ser exposta
    const responseUser = res.json.mock.calls[0][0].user;
    expect(responseUser).not.toHaveProperty('password');
  });

  it('500 em caso de erro inesperado no banco', async () => {
    const req = { body: { name: 'Admin', email: 'admin@test.com', password: '12345678' }, headers: { 'x-admin-secret': 'test-secret' } };
    const res = makeRes();

    User.findOne.mockRejectedValue(new Error('DB error'));

    await registerAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao cadastrar o administrador.' });
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 quando email está ausente', async () => {
    const req = { body: { password: '123456' } };
    const res = makeRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email e senha são obrigatórios.' });
  });

  it('400 quando senha está ausente', async () => {
    const req = { body: { email: 'admin@test.com' } };
    const res = makeRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email e senha são obrigatórios.' });
  });

  it('401 quando usuário não existe (resposta genérica para não revelar email)', async () => {
    const req = { body: { email: 'naoexiste@test.com', password: '123456' } };
    const res = makeRes();

    User.findOne.mockResolvedValue(null);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Credenciais inválidas.' });
  });

  it('403 quando usuário está inativo', async () => {
    const req = { body: { email: 'inativo@test.com', password: '123456' } };
    const res = makeRes();

    User.findOne.mockResolvedValue({ active: false });

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuário inativo. Acesso bloqueado.' });
  });

  it('401 quando senha está incorreta', async () => {
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

  it('200 com token JWT quando credenciais são válidas', async () => {
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
        user: expect.objectContaining({ email: 'admin@test.com', profile: 'admin' }),
      }),
    );
    // Senha não deve ser exposta
    const responseUser = res.json.mock.calls[0][0].user;
    expect(responseUser).not.toHaveProperty('password');
  });

  it('token JWT é gerado com expiração de 4h', async () => {
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
    jwt.sign.mockReturnValue('token');

    await login(req, res);

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ id: mockUser._id, email: mockUser.email, profile: mockUser.profile }),
      process.env.JWT_SECRET,
      { expiresIn: '4h' },
    );
  });

  it('500 em caso de erro inesperado no banco', async () => {
    const req = { body: { email: 'admin@test.com', password: 'senha123' } };
    const res = makeRes();

    User.findOne.mockRejectedValue(new Error('DB connection lost'));

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao realizar o login.' });
  });
});
