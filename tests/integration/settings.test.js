const request = require('supertest');
const app = require('../../app');
const { connectDB, clearDB, disconnectDB } = require('./setup');
const { createAdminAndLogin, createRepAndLogin } = require('./helpers');

process.env.JWT_SECRET = 'integration_test_secret';

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

// ─── GET /settings ────────────────────────────────────────────────────────────

describe('GET /settings', () => {
  it('retorna defaultObservations, defaultSellerName e sellerName do usuário', async () => {
    const { token, user } = await createAdminAndLogin();

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.defaultObservations).toBe('string');
    expect(typeof res.body.defaultSellerName).toBe('string');
    // sellerName = nome do usuário autenticado (para pré-preencher cotações)
    expect(res.body.sellerName).toBe(user.name);
  });

  it('representante recebe seu próprio nome como sellerName', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.sellerName).toBe(rep.name);
  });

  it('cria documento com texto padrão na primeira chamada (upsert)', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.defaultObservations).toMatch(/Condições de pagamento/);
    expect(res.body.defaultObservations).toMatch(/I\.C\.M\.S\./);
    expect(res.body.defaultObservations).toMatch(/Frete/);
    expect(res.body.defaultSellerName).toBeTruthy();
  });

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });
});

// ─── PUT /settings ────────────────────────────────────────────────────────────

describe('PUT /settings', () => {
  it('admin atualiza defaultObservations com sucesso', async () => {
    const { token } = await createAdminAndLogin();
    const novoTexto = 'Pagamento: 30 dias\nFrete: FOB\nICMS incluso';

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultObservations: novoTexto });

    expect(res.status).toBe(200);
    expect(res.body.defaultObservations).toBe(novoTexto);
    expect(res.body.message).toMatch(/sucesso/);
  });

  it('admin atualiza defaultSellerName com sucesso', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultSellerName: 'Maria Administradora' });

    expect(res.status).toBe(200);
    expect(res.body.defaultSellerName).toBe('Maria Administradora');
  });

  it('admin atualiza ambos os campos de uma vez', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        defaultObservations: 'Novo texto',
        defaultSellerName: 'Nova Vendedora',
      });

    expect(res.status).toBe(200);
    expect(res.body.defaultObservations).toBe('Novo texto');
    expect(res.body.defaultSellerName).toBe('Nova Vendedora');
  });

  it('GET após PUT retorna os valores atualizados', async () => {
    const { token } = await createAdminAndLogin();

    await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultObservations: 'Texto personalizado', defaultSellerName: 'Vendedora X' });

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.defaultObservations).toBe('Texto personalizado');
    expect(res.body.defaultSellerName).toBe('Vendedora X');
  });

  it('retorna 400 quando nenhum campo é enviado', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('representante não pode alterar settings (403)', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${repToken}`)
      .send({ defaultObservations: 'Tentativa indevida' });

    expect(res.status).toBe(403);
  });

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ defaultObservations: 'Texto' });

    expect(res.status).toBe(401);
  });

  it('preserva quebras de linha no texto salvo', async () => {
    const { token } = await createAdminAndLogin();
    const textoComQuebras = 'Linha 1\nLinha 2\nLinha 3';

    await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultObservations: textoComQuebras });

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.defaultObservations).toBe(textoComQuebras);
  });
});
