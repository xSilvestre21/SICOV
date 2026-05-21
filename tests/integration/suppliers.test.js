const request = require('supertest');
const app = require('../../app');
const { connectDB, clearDB, disconnectDB } = require('./setup');
const { createAdminAndLogin, createRepAndLogin, createSupplier } = require('./helpers');

process.env.JWT_SECRET = 'integration_test_secret';

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

// ─── POST /suppliers ──────────────────────────────────────────────────────────

describe('POST /suppliers', () => {
  it('admin cria fornecedor com sucesso', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Qualyplast',
        cnpj: '08.819.970/0001-25',
        ipi: '9,75',
        state: 'sp',
        priceTable: [{ material: 'PEMD', price: 10, density: 0.95 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.supplier.cnpj).toBe('08819970000125');
    expect(res.body.supplier.ipi).toBe(9.75);
    expect(res.body.supplier.state).toBe('SP');
    expect(res.body.supplier.priceTable[0].material).toBe('PEMD');
  });

  it('representante não pode criar fornecedor', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${repToken}`)
      .send({ name: 'Fornecedor', cnpj: '12345678000199', ipi: 0 });

    expect(res.status).toBe(403);
  });

  it('retorna 400 para IPI inválido', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fornecedor', cnpj: '12345678000199', ipi: 'invalido' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('IPI inválido');
  });

  it('retorna 400 para materiais duplicados na tabela de preços', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Fornecedor',
        cnpj: '12345678000199',
        ipi: 0,
        priceTable: [
          { material: 'PEMD', price: 10, density: 0.95 },
          { material: 'PEMD', price: 12, density: 0.95 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/repetir material/);
  });

  it('retorna 409 para CNPJ duplicado', async () => {
    const { token } = await createAdminAndLogin();
    await createSupplier(token, { cnpj: '08819970000125' });

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Outro', cnpj: '08819970000125', ipi: 0 });

    expect(res.status).toBe(409);
  });
});

// ─── GET /suppliers ───────────────────────────────────────────────────────────

describe('GET /suppliers', () => {
  it('admin lista todos os fornecedores', async () => {
    const { token } = await createAdminAndLogin();
    await createSupplier(token, { cnpj: '11111111000111', name: 'Fornecedor A' });
    await createSupplier(token, { cnpj: '22222222000122', name: 'Fornecedor B' });

    const res = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('representante vê apenas fornecedores autorizados', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);

    // Fornecedor sem o representante
    await createSupplier(adminToken, { cnpj: '11111111000111', name: 'Sem Acesso' });

    // Fornecedor com o representante autorizado
    await createSupplier(adminToken, {
      cnpj: '22222222000122',
      name: 'Com Acesso',
      allowedRepresentatives: [rep.id],
    });

    const res = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.suppliers[0].name).toBe('Com Acesso');
  });
});

// ─── GET /suppliers/:id ───────────────────────────────────────────────────────

describe('GET /suppliers/:id', () => {
  it('admin busca fornecedor por ID', async () => {
    const { token } = await createAdminAndLogin();
    const supplier = await createSupplier(token);

    const res = await request(app)
      .get(`/api/suppliers/${supplier._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(supplier._id);
  });

  it('retorna 404 para ID inexistente', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .get('/api/suppliers/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ─── PUT /suppliers/:id ───────────────────────────────────────────────────────

describe('PUT /suppliers/:id', () => {
  it('admin atualiza fornecedor', async () => {
    const { token } = await createAdminAndLogin();
    const supplier = await createSupplier(token);

    const res = await request(app)
      .put(`/api/suppliers/${supplier._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado', ipi: 5 });

    expect(res.status).toBe(200);
    expect(res.body.supplier.name).toBe('Nome Atualizado');
    expect(res.body.supplier.ipi).toBe(5);
  });

  it('retorna 409 ao tentar usar CNPJ já existente', async () => {
    const { token } = await createAdminAndLogin();
    await createSupplier(token, { cnpj: '11111111000111', name: 'Fornecedor A' });
    const supplierB = await createSupplier(token, { cnpj: '22222222000122', name: 'Fornecedor B' });

    const res = await request(app)
      .put(`/api/suppliers/${supplierB._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cnpj: '11111111000111' });

    expect(res.status).toBe(409);
  });
});

// ─── PATCH /suppliers/:id/toggle-active ──────────────────────────────────────

describe('PATCH /suppliers/:id/toggle-active', () => {
  it('desativa e reativa fornecedor', async () => {
    const { token } = await createAdminAndLogin();
    const supplier = await createSupplier(token);

    let res = await request(app)
      .patch(`/api/suppliers/${supplier._id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.supplier.active).toBe(false);

    res = await request(app)
      .patch(`/api/suppliers/${supplier._id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.supplier.active).toBe(true);
  });
});

// ─── DELETE /suppliers/:id ────────────────────────────────────────────────────

describe('DELETE /suppliers/:id', () => {
  it('admin deleta fornecedor com sucesso', async () => {
    const { token } = await createAdminAndLogin();
    const supplier = await createSupplier(token);

    const res = await request(app)
      .delete(`/api/suppliers/${supplier._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/excluído/);
  });
});
