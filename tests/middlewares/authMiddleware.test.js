const jwt = require('jsonwebtoken');

// Mock do modelo User antes de importar o middleware
jest.mock('../../src/models/user');
const User = require('../../src/models/user');
const authMiddleware = require('../../src/middlewares/authMiddleware');

process.env.JWT_SECRET = 'test_secret';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna 401 quando Authorization header não existe', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token não provido.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 quando formato do header é inválido (sem espaço)', async () => {
    const req = { headers: { authorization: 'tokenSemEspaco' } };
    const res = makeRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Formato de token inválido.' });
  });

  it('retorna 401 quando scheme não é Bearer', async () => {
    const req = { headers: { authorization: 'Basic algumtoken' } };
    const res = makeRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token mal formatado' });
  });

  it('retorna 401 quando token é inválido', async () => {
    const req = { headers: { authorization: 'Bearer tokeninvalido' } };
    const res = makeRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token inválido ou expirado.' }),
    );
  });

  it('retorna 401 quando usuário não é encontrado no banco', async () => {
    const token = jwt.sign({ id: 'userId123' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuário não encontrado.' });
  });

  it('retorna 403 quando usuário está inativo', async () => {
    const token = jwt.sign({ id: 'userId123' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: 'userId123',
        name: 'Teste',
        email: 'teste@email.com',
        profile: 'representative',
        active: false,
      }),
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Usuário inativo. Acesso bloqueado.',
    });
  });

  it('popula req.user e chama next() com token válido e usuário ativo', async () => {
    const token = jwt.sign({ id: 'userId123' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    const mockUser = {
      _id: { toString: () => 'userId123' },
      name: 'Admin Teste',
      email: 'admin@email.com',
      profile: 'admin',
      active: true,
    };

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      id: 'userId123',
      name: 'Admin Teste',
      email: 'admin@email.com',
      profile: 'admin',
      active: true,
    });
  });
});
