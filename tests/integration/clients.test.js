const request = require('supertest');
const app = require('../../app');
const { connectDB, clearDB, disconnectDB } = require('./setup');
const { createAdminAndLogin, createRepAndLogin, createClient } = require('./helpers');

process.env.JWT_SECRET = 'integration_test_secret';

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

// ─── POST /clients ────────────────────────────────────────────────────────────

describe('POST /clients', () => {
  it('admin cria cliente com sucesso', async () => {
    const { token, user } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Empresa ABC',
        cnpj: '20927468000133',
        representativeId: user.id,
        phone: '(11) 99999-9999',
        state: 'sp',
        zipCode: '01310-100',
      });

    expect(res.status).toBe(201);
    expect(res.body.client.name).toBe('Empresa ABC');
    // CNPJ normalizado (só números)
    expect(res.body.client.cnpj).toBe('20927468000133');
    // Telefone normalizado
    expect(res.body.client.phone).toBe('11999999999');
    // Estado em maiúsculo
    expect(res.body.client.state).toBe('SP');
  });

  it('representante não pode criar cliente (rota exige admin)', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${repToken}`)
      .send({ name: 'Empresa', cnpj: '12345678000199' });

    expect(res.status).toBe(403);
  });

  it('retorna 400 quando nome está ausente', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ cnpj: '12345678000199' });

    expect(res.status).toBe(400);
  });

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ name: 'Empresa', cnpj: '12345678000199' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /clients ─────────────────────────────────────────────────────────────

describe('GET /clients', () => {
  it('admin vê todos os clientes', async () => {
    const { token, user } = await createAdminAndLogin();
    const { token: adminToken2, user: admin2 } = await createAdminAndLogin('admin2@test.com');

    await createClient(token, user.id, { cnpj: '11111111000111' });
    await createClient(adminToken2, admin2.id, { cnpj: '22222222000122' });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('representante vê apenas seus clientes', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);

    // Cliente do admin
    await createClient(adminToken, admin.id, { cnpj: '11111111000111' });
    // Cliente do representante
    await createClient(adminToken, rep.id, { cnpj: '22222222000122' });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.clients[0].cnpj).toBe('22222222000122');
  });

  it('paginação funciona corretamente', async () => {
    const { token, user } = await createAdminAndLogin();

    for (let i = 0; i < 5; i++) {
      await createClient(token, user.id, {
        cnpj: `1111111100011${i}`,
        name: `Cliente ${i}`,
      });
    }

    const res = await request(app)
      .get('/api/clients?page=2&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.total).toBe(5);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.clients.length).toBe(2);
  });

  it('busca por nome funciona', async () => {
    const { token, user } = await createAdminAndLogin();
    await createClient(token, user.id, { name: 'Empresa Alpha', cnpj: '11111111000111' });
    await createClient(token, user.id, { name: 'Empresa Beta', cnpj: '22222222000122' });

    const res = await request(app)
      .get('/api/clients?search=Alpha')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.clients[0].name).toBe('Empresa Alpha');
  });
});

// ─── GET /clients/:id ─────────────────────────────────────────────────────────

describe('GET /clients/:id', () => {
  it('retorna cliente por ID', async () => {
    const { token, user } = await createAdminAndLogin();
    const client = await createClient(token, user.id);

    const res = await request(app)
      .get(`/api/clients/${client._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(client._id);
  });

  it('retorna 404 para ID inexistente', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .get('/api/clients/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('representante não acessa cliente de outro representante', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);

    // Cliente pertence ao admin, não ao representante
    const client = await createClient(adminToken, admin.id);

    const res = await request(app)
      .get(`/api/clients/${client._id}`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── PUT /clients/:id ─────────────────────────────────────────────────────────

describe('PUT /clients/:id', () => {
  it('atualiza dados do cliente', async () => {
    const { token, user } = await createAdminAndLogin();
    const client = await createClient(token, user.id);

    const res = await request(app)
      .put(`/api/clients/${client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado', state: 'rj' });

    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe('Nome Atualizado');
    expect(res.body.client.state).toBe('RJ');
  });

  it('retorna 404 para cliente inexistente', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .put('/api/clients/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Novo Nome' });

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /clients/:id/toggle-active ────────────────────────────────────────

describe('PATCH /clients/:id/toggle-active', () => {
  it('desativa e reativa cliente', async () => {
    const { token, user } = await createAdminAndLogin();
    const client = await createClient(token, user.id);

    let res = await request(app)
      .patch(`/api/clients/${client._id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.client.active).toBe(false);

    res = await request(app)
      .patch(`/api/clients/${client._id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.client.active).toBe(true);
  });
});

// ─── DELETE /clients/:id ──────────────────────────────────────────────────────

describe('DELETE /clients/:id', () => {
  it('admin deleta cliente com sucesso', async () => {
    const { token, user } = await createAdminAndLogin();
    const client = await createClient(token, user.id);

    const res = await request(app)
      .delete(`/api/clients/${client._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/excluído/);
  });

  it('retorna 403 quando representante tenta deletar cliente de outro', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);

    const client = await createClient(adminToken, admin.id);

    const res = await request(app)
      .delete(`/api/clients/${client._id}`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── Validação de email e CNPJ duplicado ──────────────────────────────────────

describe('POST /clients — validação de email e CNPJ', () => {
  it('retorna 400 para email inválido no create', async () => {
    const { token, user } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Empresa', email: 'nao-e-email', representativeId: user.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email inválido');
  });

  it('retorna 409 para CNPJ duplicado no create', async () => {
    const { token, user } = await createAdminAndLogin();

    await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Empresa 1', cnpj: '20927468000133', representativeId: user.id });

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Empresa 2', cnpj: '20927468000133', representativeId: user.id });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Já existe um cliente com esse CNPJ');
  });

  it('aceita email válido no create', async () => {
    const { token, user } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Empresa', email: 'contato@empresa.com', representativeId: user.id });

    expect(res.status).toBe(201);
  });
});

describe('PUT /clients/:id — validação de email e CNPJ', () => {
  it('retorna 400 para email inválido no update', async () => {
    const { token, user } = await createAdminAndLogin();
    const client = await createClient(token, user.id);

    const res = await request(app)
      .put(`/api/clients/${client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'invalido' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email inválido');
  });

  it('retorna 409 para CNPJ duplicado no update', async () => {
    const { token, user } = await createAdminAndLogin();

    const client1 = await createClient(token, user.id, { cnpj: '20927468000133' });
    const client2 = await createClient(token, user.id, { name: 'Empresa 2', cnpj: '11222333000181' });

    const res = await request(app)
      .put(`/api/clients/${client2._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cnpj: '20927468000133' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Já existe um cliente com esse CNPJ');
  });
});
