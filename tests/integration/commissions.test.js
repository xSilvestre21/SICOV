const request = require('supertest');
const app = require('../../app');
const { connectDB, clearDB, disconnectDB } = require('./setup');
const {
  createAdminAndLogin,
  createRepAndLogin,
  createSupplier,
  createClient,
  createProduct,
  createOrder,
} = require('./helpers');

process.env.JWT_SECRET = 'integration_test_secret';

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

// ─── Helpers locais ───────────────────────────────────────────────────────────

/**
 * Monta o contexto mínimo: admin, representante, fornecedor, cliente, produto e pedido.
 * O pedido cria automaticamente o Registro_Comissao.
 */
async function buildCommissionContext() {
  const { token: adminToken } = await createAdminAndLogin();
  const { token: repToken, user: rep } = await createRepAndLogin(adminToken);

  const supplier = await createSupplier(adminToken);
  const client = await createClient(adminToken, rep._id);
  const product = await createProduct(adminToken, client._id, supplier._id);
  const order = await createOrder(adminToken, client._id, supplier._id, product._id);

  return { adminToken, repToken, rep, order };
}

/**
 * Busca a comissão criada automaticamente para um pedido.
 * Retorna o primeiro registro encontrado para o orderId (inclui canceladas).
 */
async function getCommissionForOrder(adminToken, orderId) {
  const res = await request(app)
    .get(`/commissions?orderId=${orderId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  // Fallback: busca na listagem geral e filtra pelo orderId (inclui todas)
  const listRes = await request(app)
    .get('/commissions?status=all')
    .set('Authorization', `Bearer ${adminToken}`);
  return listRes.body.commissions.find(
    (c) => c.orderId === orderId || c.orderId?.toString() === orderId?.toString(),
  );
}

// ─── PUT /commissions/:id ─────────────────────────────────────────────────────

describe('PUT /commissions/:id', () => {
  it('admin atualiza representativePercentage e comissões são recalculadas', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const base = commission.orderValueWithoutIpi;
    const newRepPercentage = 60;

    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ representativePercentage: newRepPercentage });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/sucesso/i);

    const updated = res.body.commission;
    expect(updated.representativePercentage).toBe(newRepPercentage);

    const expectedPool = parseFloat(((base * 5) / 100).toFixed(2));
    const expectedRepComm = parseFloat(((expectedPool * newRepPercentage) / 100).toFixed(2));
    const expectedAdminComm = parseFloat((expectedPool - expectedRepComm).toFixed(2));

    expect(updated.pool).toBeCloseTo(expectedPool, 2);
    expect(updated.representativeCommission).toBeCloseTo(expectedRepComm, 2);
    expect(updated.adminCommission).toBeCloseTo(expectedAdminComm, 2);
  });

  it('admin atualiza realReceivedValue e comissões reais são calculadas separadamente', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const orderBase = commission.orderValueWithoutIpi;
    const newRealReceivedValue = 800;
    const repPercentage = commission.representativePercentage;
    const adminPercentage = commission.adminPercentage;

    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ realReceivedValue: newRealReceivedValue });

    expect(res.status).toBe(200);

    const updated = res.body.commission;
    expect(updated.realReceivedValue).toBe(newRealReceivedValue);

    // pool/rep/admin continuam baseados no pedido original
    const expectedPool = parseFloat(((orderBase * adminPercentage) / 100).toFixed(2));
    const expectedRepComm = parseFloat(((expectedPool * repPercentage) / 100).toFixed(2));
    const expectedAdminComm = parseFloat((expectedPool - expectedRepComm).toFixed(2));
    expect(updated.pool).toBeCloseTo(expectedPool, 2);
    expect(updated.representativeCommission).toBeCloseTo(expectedRepComm, 2);
    expect(updated.adminCommission).toBeCloseTo(expectedAdminComm, 2);

    // campos reais calculados com base no valor real
    const expectedRealPool = parseFloat(((newRealReceivedValue * adminPercentage) / 100).toFixed(2));
    const expectedRealRepComm = parseFloat(((expectedRealPool * repPercentage) / 100).toFixed(2));
    const expectedRealAdminComm = parseFloat((expectedRealPool - expectedRealRepComm).toFixed(2));
    expect(updated.realPool).toBeCloseTo(expectedRealPool, 2);
    expect(updated.realRepresentativeCommission).toBeCloseTo(expectedRealRepComm, 2);
    expect(updated.realAdminCommission).toBeCloseTo(expectedRealAdminComm, 2);
  });

  it('admin atualiza realDeliveryDate e os valores de comissão NÃO mudam', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const originalPool = commission.pool;
    const originalRepComm = commission.representativeCommission;
    const originalAdminComm = commission.adminCommission;

    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ realDeliveryDate: '2026-05-20' });

    expect(res.status).toBe(200);

    const updated = res.body.commission;
    expect(updated.realDeliveryDate).toBeTruthy();
    expect(updated.pool).toBe(originalPool);
    expect(updated.representativeCommission).toBe(originalRepComm);
    expect(updated.adminCommission).toBe(originalAdminComm);
  });

  it('representante não pode atualizar comissão — retorna 403', async () => {
    const { adminToken, repToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ representativePercentage: 60 });

    expect(res.status).toBe(403);
  });

  it('retorna 404 quando ID não existe', async () => {
    const { adminToken } = await buildCommissionContext();

    const res = await request(app)
      .put('/commissions/000000000000000000000001')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ representativePercentage: 60 });

    expect(res.status).toBe(404);
  });

  it('retorna 401 sem autenticação', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .send({ representativePercentage: 60 });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /commissions/:id ──────────────────────────────────────────────────

describe('DELETE /commissions/:id', () => {
  it('admin remove comissão com sucesso e registro não existe mais no banco', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const deleteRes = await request(app)
      .delete(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toMatch(/sucesso/i);

    const getRes = await request(app)
      .get(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(404);
  });

  it('representante não pode remover comissão — retorna 403', async () => {
    const { adminToken, repToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .delete(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(403);
  });

  it('retorna 404 quando ID não existe', async () => {
    const { adminToken } = await buildCommissionContext();

    const res = await request(app)
      .delete('/commissions/000000000000000000000001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('retorna 401 sem autenticação', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .delete(`/commissions/${commission._id}`);

    expect(res.status).toBe(401);
  });
});

// ─── POST /commissions não existe mais — criação é automática via pedido ──────

describe('Criação automática de comissão ao criar pedido', () => {
  it('ao criar um pedido, o sistema cria automaticamente o Registro_Comissao', async () => {
    const { adminToken, order } = await buildCommissionContext();

    const commission = await getCommissionForOrder(adminToken, order._id);

    expect(commission).toBeDefined();
    expect(commission.orderId).toBeTruthy();
    expect(commission.projected).toBe(false);
    expect(commission.adminPercentage).toBe(5);
    expect(commission.pool).toBeDefined();
    expect(commission.representativeCommission).toBeDefined();
    expect(commission.adminCommission).toBeDefined();
  });

  it('POST /commissions retorna 404 (rota não existe mais)', async () => {
    const { adminToken, order } = await buildCommissionContext();

    const res = await request(app)
      .post('/commissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId: order._id, representativePercentage: 50 });

    expect(res.status).toBe(404);
  });
});

// ─── GET /commissions ─────────────────────────────────────────────────────────

describe('GET /commissions', () => {
  it('admin vê todos os registros', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const supplier = await createSupplier(adminToken);

    const clientAdmin = await createClient(adminToken, admin.id);
    const productAdmin = await createProduct(adminToken, clientAdmin._id, supplier._id);
    await createOrder(adminToken, clientAdmin._id, supplier._id, productAdmin._id);

    const clientRep = await createClient(adminToken, rep.id, { name: 'Cliente Rep', cnpj: '11222333000181' });
    const productRep = await createProduct(adminToken, clientRep._id, supplier._id, { name: 'Produto Rep' });
    await createOrder(repToken, clientRep._id, supplier._id, productRep._id);

    const res = await request(app)
      .get('/commissions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.commissions).toHaveLength(2);
  });

  it('representante vê apenas os seus próprios registros', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const supplier = await createSupplier(adminToken);

    const clientAdmin = await createClient(adminToken, admin.id);
    const productAdmin = await createProduct(adminToken, clientAdmin._id, supplier._id);
    await createOrder(adminToken, clientAdmin._id, supplier._id, productAdmin._id);

    const clientRep = await createClient(adminToken, rep.id, { name: 'Cliente Rep', cnpj: '11222333000181' });
    const productRep = await createProduct(adminToken, clientRep._id, supplier._id, { name: 'Produto Rep' });
    await createOrder(repToken, clientRep._id, supplier._id, productRep._id);

    const res = await request(app)
      .get('/commissions')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.commissions[0].representativeId).toBe(rep.id);
  });

  it('representante não recebe campos sensíveis na listagem', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, rep.id);
    const product = await createProduct(adminToken, client._id, supplier._id);
    await createOrder(repToken, client._id, supplier._id, product._id);

    const res = await request(app)
      .get('/commissions')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    const c = res.body.commissions[0];
    expect(c.realReceivedValue).toBeUndefined();
    expect(c.adminCommission).toBeUndefined();
    expect(c.adminPercentage).toBeUndefined();
    expect(c.representativeCommission).toBeDefined();
    expect(c.pool).toBeDefined();
  });

  it('filtra por month e year', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);

    await createOrder(adminToken, client._id, supplier._id, product._id, { deliveryDate: '2024-01-15' });
    await createOrder(adminToken, client._id, supplier._id, product._id, { deliveryDate: '2024-02-20' });

    const res = await request(app)
      .get('/commissions?month=1&year=2024')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.commissions[0].period.month).toBe(1);
    expect(res.body.commissions[0].period.year).toBe(2024);
  });

  it('filtra por orderNumber', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .get(`/commissions?orderNumber=${order.orderNumber}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.commissions[0].orderNumber).toBe(order.orderNumber);
  });

  it('filtra por customerPurchaseOrder (parcial, case-insensitive)', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);

    await createOrder(adminToken, client._id, supplier._id, product._id, {
      customerPurchaseOrder: 'PC-2026-001',
    });
    await createOrder(adminToken, client._id, supplier._id, product._id, {
      customerPurchaseOrder: 'PC-2026-002',
    });

    const res = await request(app)
      .get('/commissions?customerPurchaseOrder=PC-2026-001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.commissions[0].customerPurchaseOrder).toBe('PC-2026-001');
  });

  it('comissão criada automaticamente contém orderNumber e customerPurchaseOrder', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);

    const order = await createOrder(adminToken, client._id, supplier._id, product._id, {
      customerPurchaseOrder: 'PC-TEST-999',
    });

    const commission = await getCommissionForOrder(adminToken, order._id);

    expect(commission.orderNumber).toBe(order.orderNumber);
    expect(commission.customerPurchaseOrder).toBe('PC-TEST-999');
  });

  it('filtra por projected=true', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    await request(app).post(`/commissions/${commission._id}/installments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ intervals: [28, 35, 42], representativePercentage: 50 });

    const res = await request(app)
      .get('/commissions?projected=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.commissions.every((c) => c.projected === true)).toBe(true);
    expect(res.body.total).toBe(3);
  });

  it('paginação retorna page, limit, total, totalPages corretos', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);

    for (let i = 0; i < 5; i++) {
      await createOrder(adminToken, client._id, supplier._id, product._id);
    }

    const res = await request(app)
      .get('/commissions?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
    expect(res.body.total).toBe(5);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.commissions).toHaveLength(2);
  });

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app).get('/commissions');
    expect(res.status).toBe(401);
  });
});

// ─── GET /commissions/:id ─────────────────────────────────────────────────────

describe('GET /commissions/:id', () => {
  it('admin acessa qualquer registro com todos os campos', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .get(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pool).toBeDefined();
    expect(res.body.adminCommission).toBeDefined();
    expect(res.body.adminPercentage).toBeDefined();
  });

  it('representante acessa seu próprio registro sem campos sensíveis', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, rep.id);
    const product = await createProduct(adminToken, client._id, supplier._id);
    const order = await createOrder(repToken, client._id, supplier._id, product._id);

    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .get(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.representativeCommission).toBeDefined();
    expect(res.body.pool).toBeDefined();
    expect(res.body.realReceivedValue).toBeUndefined();
    expect(res.body.adminCommission).toBeUndefined();
    expect(res.body.adminPercentage).toBeUndefined();
  });

  it('representante recebe 403 ao acessar registro de outro representante', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const { token: rep2Token } = await createRepAndLogin(adminToken, 'rep2@test.com');
    const supplier = await createSupplier(adminToken);

    const { user: rep2 } = await createRepAndLogin(adminToken, 'rep2@test.com');
    const client = await createClient(adminToken, rep2.id, { cnpj: '11222333000181' });
    const product = await createProduct(adminToken, client._id, supplier._id, { name: 'Prod2' });
    const order = await createOrder(rep2Token, client._id, supplier._id, product._id);
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .get(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(403);
  });

  it('retorna 404 quando ID não existe', async () => {
    const { adminToken } = await buildCommissionContext();

    const res = await request(app)
      .get('/commissions/000000000000000000000001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('retorna 401 sem autenticação', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app).get(`/commissions/${commission._id}`);
    expect(res.status).toBe(401);
  });
});

// ─── POST /commissions/:id/installments ──────────────────────────────────────

describe('POST /commissions/:id/installments', () => {
  it('admin projeta parcelas com sucesso — verifica dueDate, period, installmentIndex e valores', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);
    const order = await createOrder(adminToken, client._id, supplier._id, product._id, {
      deliveryDate: '2026-04-01',
    });

    const commission = await getCommissionForOrder(adminToken, order._id);
    const commId = commission._id;
    const orderValue = commission.orderValueWithoutIpi;

    const res = await request(app)
      .post(`/commissions/${commId}/installments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ intervals: [28, 35, 42], representativePercentage: 50, adminPercentage: 5 });

    expect(res.status).toBe(201);
    expect(res.body.installments).toHaveLength(3);

    const installments = res.body.installments;
    expect(installments.every((i) => i.projected === true)).toBe(true);
    expect(installments[0].installmentIndex).toBe(1);
    expect(installments[1].installmentIndex).toBe(2);
    expect(installments[2].installmentIndex).toBe(3);

    const installmentValue = parseFloat((orderValue / 3).toFixed(2));
    const expectedPool = parseFloat(((installmentValue * 5) / 100).toFixed(2));
    const expectedRep = parseFloat(((expectedPool * 50) / 100).toFixed(2));
    const expectedAdmin = parseFloat((expectedPool - expectedRep).toFixed(2));

    expect(installments[0].orderValueWithoutIpi).toBeCloseTo(installmentValue, 2);
    expect(installments[0].pool).toBeCloseTo(expectedPool, 2);
    expect(installments[0].representativeCommission).toBeCloseTo(expectedRep, 2);
    expect(installments[0].adminCommission).toBeCloseTo(expectedAdmin, 2);

    const dueDate1 = new Date(installments[0].dueDate);
    expect(dueDate1.getUTCDate()).toBe(29);
    expect(dueDate1.getUTCMonth() + 1).toBe(4);
    expect(dueDate1.getUTCFullYear()).toBe(2026);
  });

  it('saldo pendente desconta realReceivedValue quando informado', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    // Atualiza o valor real recebido
    await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ realReceivedValue: 400 });

    const orderValue = commission.orderValueWithoutIpi;
    const pendingBalance = orderValue - 400;

    const res = await request(app)
      .post(`/commissions/${commission._id}/installments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ intervals: [28], representativePercentage: 50 });

    expect(res.status).toBe(201);
    expect(res.body.installments[0].orderValueWithoutIpi).toBeCloseTo(pendingBalance, 2);
  });

  it('retorna 400 quando intervals é array vazio', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .post(`/commissions/${commission._id}/installments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ intervals: [], representativePercentage: 50 });

    expect(res.status).toBe(400);
  });

  it('retorna 400 quando intervals contém valor não positivo', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .post(`/commissions/${commission._id}/installments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ intervals: [28, 0], representativePercentage: 50 });

    expect(res.status).toBe(400);
  });

  it('representante não pode projetar parcelas — retorna 403', async () => {
    const { adminToken, repToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .post(`/commissions/${commission._id}/installments`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ intervals: [28, 35], representativePercentage: 50 });

    expect(res.status).toBe(403);
  });

  it('retorna 401 sem autenticação', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .post(`/commissions/${commission._id}/installments`)
      .send({ intervals: [28], representativePercentage: 50 });

    expect(res.status).toBe(401);
  });
});

// ─── GET /commissions/summary ─────────────────────────────────────────────────

describe('GET /commissions/summary', () => {
  it('admin recebe totais agregados com os campos esperados incluindo comparativo real', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);

    await createOrder(adminToken, client._id, supplier._id, product._id, { deliveryDate: '2025-03-10' });
    await createOrder(adminToken, client._id, supplier._id, product._id, { deliveryDate: '2025-03-20' });

    const res = await request(app)
      .get('/commissions/summary?month=3&year=2025')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(Array.isArray(res.body.summary)).toBe(true);
    expect(res.body.summary.length).toBeGreaterThanOrEqual(1);
    // Paginação
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('totalPages');

    const item = res.body.summary[0];
    expect(item).toHaveProperty('period');
    expect(item).toHaveProperty('representativeId');
    expect(item).toHaveProperty('totalRepresentativeCommission');
    expect(item).toHaveProperty('totalAdminCommission');
    expect(item).toHaveProperty('totalPool');
    expect(item).toHaveProperty('totalRealRepresentativeCommission');
    expect(item).toHaveProperty('totalRealAdminCommission');
    expect(item).toHaveProperty('totalRealPool');
    expect(item).toHaveProperty('count');
  });

  it('representante não recebe totalAdminCommission no resumo', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, rep.id);
    const product = await createProduct(adminToken, client._id, supplier._id);
    await createOrder(repToken, client._id, supplier._id, product._id, { deliveryDate: '2025-04-15' });

    const res = await request(app)
      .get('/commissions/summary')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.length).toBeGreaterThanOrEqual(1);

    const item = res.body.summary[0];
    expect(item).not.toHaveProperty('totalAdminCommission');
    expect(item).toHaveProperty('totalRepresentativeCommission');
    expect(item).toHaveProperty('totalPool');
    expect(item).toHaveProperty('count');
  });

  it('filtra por month e year e retorna apenas o período correto', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);

    await createOrder(adminToken, client._id, supplier._id, product._id, { deliveryDate: '2025-01-10' });
    await createOrder(adminToken, client._id, supplier._id, product._id, { deliveryDate: '2025-02-10' });

    const res = await request(app)
      .get('/commissions/summary?month=1&year=2025')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toHaveLength(1);
    expect(res.body.summary[0].period.month).toBe(1);
    expect(res.body.summary[0].period.year).toBe(2025);
  });

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app).get('/commissions/summary');
    expect(res.status).toBe(401);
  });
});

// ─── Validação de realReceivedValue ───────────────────────────────────────────

describe('PUT /commissions/:id — validação de realReceivedValue', () => {
  it('retorna 400 quando realReceivedValue é negativo', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ realReceivedValue: -100 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('realReceivedValue deve ser um número >= 0');
  });

  it('retorna 400 quando realReceivedValue não é número', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ realReceivedValue: 'abc' });

    expect(res.status).toBe(400);
  });

  it('aceita realReceivedValue igual a zero', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ realReceivedValue: 0 });

    expect(res.status).toBe(200);
    expect(res.body.commission.realReceivedValue).toBe(0);
  });

  it('aceita realReceivedValue null para limpar o valor', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    // Primeiro define um valor
    await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ realReceivedValue: 500 });

    // Depois limpa
    const res = await request(app)
      .put(`/commissions/${commission._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ realReceivedValue: null });

    expect(res.status).toBe(200);
    expect(res.body.commission.realReceivedValue).toBeNull();
  });
});

// ─── Filtro por status ────────────────────────────────────────────────────────

describe('GET /commissions — filtro por status', () => {
  it('por padrão retorna apenas comissões ativas', async () => {
    const { adminToken, order } = await buildCommissionContext();

    // Busca a comissão antes de cancelar (ainda ativa)
    const commBefore = await getCommissionForOrder(adminToken, order._id);
    expect(commBefore).toBeDefined();
    expect(commBefore.status).toBe('active');

    // Cancela o pedido (marca comissão como cancelled)
    await request(app)
      .patch(`/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Listagem padrão não deve retornar a comissão cancelada
    const listRes = await request(app)
      .get('/commissions')
      .set('Authorization', `Bearer ${adminToken}`);

    const ids = listRes.body.commissions.map((c) => c._id);
    expect(ids).not.toContain(commBefore._id);
  });

  it('filtra por status=cancelled retorna apenas canceladas', async () => {
    const { adminToken, order } = await buildCommissionContext();
    const commission = await getCommissionForOrder(adminToken, order._id);

    await request(app)
      .patch(`/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/commissions?status=cancelled')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.commissions[0]._id).toBe(commission._id);
    expect(res.body.commissions[0].status).toBe('cancelled');
  });

  it('filtra por status=all retorna ativas e canceladas', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);

    const order1 = await createOrder(adminToken, client._id, supplier._id, product._id);
    const order2 = await createOrder(adminToken, client._id, supplier._id, product._id);

    // Cancela o primeiro
    await request(app)
      .patch(`/orders/${order1._id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/commissions?status=all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });
});

// ─── Paginação do summary ─────────────────────────────────────────────────────

describe('GET /commissions/summary — paginação', () => {
  it('retorna page, limit, total e totalPages', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const supplier = await createSupplier(adminToken);
    const client = await createClient(adminToken, admin.id);
    const product = await createProduct(adminToken, client._id, supplier._id);

    await createOrder(adminToken, client._id, supplier._id, product._id, { deliveryDate: '2025-06-10' });

    const res = await request(app)
      .get('/commissions/summary?month=6&year=2025&page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 5);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.summary)).toBe(true);
  });
});
