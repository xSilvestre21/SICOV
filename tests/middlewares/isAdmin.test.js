const isAdmin = require('../../src/middlewares/isAdmin');

// Helper para criar mocks de req/res/next
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('isAdmin middleware', () => {
  it('retorna 401 quando req.user não existe', () => {
    const req = {};
    const res = makeRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuário não autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 403 quando usuário não é admin', () => {
    const req = { user: { profile: 'representative' } };
    const res = makeRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Acesso negado. Apenas administradores.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('chama next() quando usuário é admin', () => {
    const req = { user: { profile: 'admin' } };
    const res = makeRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
