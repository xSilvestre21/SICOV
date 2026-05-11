jest.mock('../../src/models/settings');

const Settings = require('../../src/models/settings');
const { getSettings, updateSettings } = require('../../src/controllers/settingsController');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const adminUser = { id: 'adminId', profile: 'admin', name: 'Admin Teste' };

// ─── getSettings ──────────────────────────────────────────────────────────────

describe('getSettings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna defaultObservations, defaultSellerName e sellerName do usuário autenticado', async () => {
    const req = { user: adminUser };
    const res = makeRes();
    Settings.findOneAndUpdate.mockResolvedValue({
      defaultObservations: 'Obs padrão',
      defaultSellerName: 'Valquiria',
    });

    await getSettings(req, res);

    expect(res.json).toHaveBeenCalledWith({
      defaultObservations: 'Obs padrão',
      defaultSellerName: 'Valquiria',
      sellerName: adminUser.name,
    });
  });

  it('500 em caso de erro no banco', async () => {
    const req = { user: adminUser };
    const res = makeRes();
    Settings.findOneAndUpdate.mockRejectedValue(new Error('DB'));

    await getSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao buscar configurações' });
  });
});

// ─── updateSettings ───────────────────────────────────────────────────────────

describe('updateSettings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 quando nenhum campo é enviado', async () => {
    const req = { body: {}, user: adminUser };
    const res = makeRes();

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Informe ao menos defaultObservations ou defaultSellerName',
    });
  });

  it('atualiza defaultObservations com sucesso', async () => {
    const req = { body: { defaultObservations: 'Novo texto' }, user: adminUser };
    const res = makeRes();
    Settings.findOneAndUpdate.mockResolvedValue({
      defaultObservations: 'Novo texto',
      defaultSellerName: 'Valquiria',
    });

    await updateSettings(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Configurações atualizadas com sucesso',
        defaultObservations: 'Novo texto',
      }),
    );
  });

  it('atualiza defaultSellerName com sucesso', async () => {
    const req = { body: { defaultSellerName: 'Nova Vendedora' }, user: adminUser };
    const res = makeRes();
    Settings.findOneAndUpdate.mockResolvedValue({
      defaultObservations: 'Obs',
      defaultSellerName: 'Nova Vendedora',
    });

    await updateSettings(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ defaultSellerName: 'Nova Vendedora' }),
    );
  });

  it('atualiza ambos os campos de uma vez', async () => {
    const req = { body: { defaultObservations: 'Obs', defaultSellerName: 'Vendedora X' }, user: adminUser };
    const res = makeRes();
    Settings.findOneAndUpdate.mockResolvedValue({
      defaultObservations: 'Obs',
      defaultSellerName: 'Vendedora X',
    });

    await updateSettings(req, res);

    expect(Settings.findOneAndUpdate).toHaveBeenCalledWith(
      { singleton: true },
      { defaultObservations: 'Obs', defaultSellerName: 'Vendedora X' },
      expect.any(Object),
    );
  });

  it('500 em caso de erro no banco', async () => {
    const req = { body: { defaultObservations: 'Texto' }, user: adminUser };
    const res = makeRes();
    Settings.findOneAndUpdate.mockRejectedValue(new Error('DB'));

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao atualizar configurações' });
  });
});
