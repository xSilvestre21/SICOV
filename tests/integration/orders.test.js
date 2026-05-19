const request = require('supertest');
const app = require('../../app');
const { connectDB, clearDB, disconnectDB } = require('./setup');
const {
  createAdminAndLogin,
  createRepAndLogin,
  createSupplier,
  createClient,
  createProduct,
} = require('./helpers');

process.env.JWT_SECRET = 'integration_test_secret';

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

// Helper: monta um pedido completo com todos os pré-requisitos
async function buildOrderFixture(adminToken, adminId) {
  const supplier = await createSupplier(adminToken, {
    ipi: 10,
    priceTable: [{ material: 'PEMD', factorKg: 10, density: 0.95 }],
  });
  const client = await createClient(adminToken, adminId, {
    paymentTerm: 'Boleto 30 dias',
  });
  const product = await createProduct(adminToken, client._id, supplier._id, {
    name: 'Stretch 500m',
    productType: 'stretch',
    saleMode: 'kg',
    calculationMode: 'weight_times_price_per_kg',
    commercialData: { basePrice: 12.5 },
  });

  return { supplier, client, product };
}

// ─── POST /orders ─────────────────────────────────────────────────────────────

describe('POST /orders', () => {
  it('cria pedido com sucesso e calcula IPI corretamente', async () => {
    const { token, user } = await createAdminAndLogin();
    const { supplier, client, product } = await buildOrderFixture(token, user.id);

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{ productId: product._id, quantity: 100 }],
        notes: 'Pedido de teste',
      });

    expect(res.status).toBe(201);
    // unitPrice = basePrice = 12.5, subtotal = 12.5 * 100 = 1250
    expect(res.body.order.subtotal).toBe(1250);
    // ipiValue = 1250 * 10% = 125
    expect(res.body.order.ipiValue).toBe(125);
    // total = 1250 + 125 = 1375
    expect(res.body.order.total).toBe(1375);
    expect(res.body.order.status).toBe('active');
    expect(res.body.order.sentToSupplier).toBe(false);
    // Snapshot do cliente deve estar preenchido
    expect(res.body.order.clientSnapshot.name).toBe(client.name);
    // Snapshot do fornecedor deve estar preenchido
    expect(res.body.order.supplierSnapshot.ipi).toBe(10);
  });

  it('incrementa orderNumber por fornecedor a cada pedido', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const res1 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    const res2 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 20 }] });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res2.body.order.orderNumber).toBe(res1.body.order.orderNumber + 1);
  });

  it('retorna 400 quando clientId está ausente', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: 'abc', quantity: 10 }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cliente é obrigatório');
  });

  it('retorna 400 quando items está vazio', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client } = await buildOrderFixture(token, user.id);

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Itens são obrigatórios');
  });

  it('retorna 404 quando cliente não existe', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: '000000000000000000000000',
        items: [{ productId: '000000000000000000000001', quantity: 10 }],
      });

    expect(res.status).toBe(404);
  });

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ clientId: 'abc', items: [] });

    expect(res.status).toBe(401);
  });
});

// ─── GET /orders ──────────────────────────────────────────────────────────────

describe('GET /orders', () => {
  it('admin vê todos os pedidos', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 20 }] });

    const res = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('representante vê apenas seus pedidos', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);

    const supplier = await createSupplier(adminToken, { ipi: 0 });
    const clientAdmin = await createClient(adminToken, admin.id, { cnpj: '11111111000111' });
    const clientRep = await createClient(adminToken, rep.id, { cnpj: '22222222000122' });
    const productAdmin = await createProduct(adminToken, clientAdmin._id, supplier._id);
    const productRep = await createProduct(adminToken, clientRep._id, supplier._id);

    // Pedido do admin
    await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: clientAdmin._id, items: [{ productId: productAdmin._id, quantity: 10 }] });

    // Pedido do representante
    await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${repToken}`)
      .send({ clientId: clientRep._id, items: [{ productId: productRep._id, quantity: 10 }] });

    const res = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('filtra por status=cancelled', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    await request(app)
      .patch(`/orders/${orderRes.body.order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/orders?status=cancelled')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.orders[0].status).toBe('cancelled');
  });
});

// ─── GET /orders/:id ──────────────────────────────────────────────────────────

describe('GET /orders/:id', () => {
  it('retorna pedido por ID', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    const res = await request(app)
      .get(`/orders/${orderRes.body.order._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(orderRes.body.order._id);
  });

  it('retorna 403 quando representante tenta acessar pedido de outro', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const { client, product } = await buildOrderFixture(adminToken, admin.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    const res = await request(app)
      .get(`/orders/${orderRes.body.order._id}`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── PUT /orders/:id ──────────────────────────────────────────────────────────

describe('PUT /orders/:id', () => {
  it('atualiza itens e recalcula totais', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 100 }] });

    const res = await request(app)
      .put(`/orders/${orderRes.body.order._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product._id, quantity: 200 }],
        notes: 'Nota atualizada',
      });

    expect(res.status).toBe(200);
    // subtotal = 12.5 * 200 = 2500
    expect(res.body.order.subtotal).toBe(2500);
    expect(res.body.order.notes).toBe('Nota atualizada');
  });

  it('retorna 400 quando pedido está cancelado', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    await request(app)
      .patch(`/orders/${orderRes.body.order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .put(`/orders/${orderRes.body.order._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id, quantity: 50 }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cancelado/);
  });

  it('retorna 400 quando pedido já foi enviado ao fornecedor', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    await request(app)
      .patch(`/orders/${orderRes.body.order._id}/sent-to-supplier`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .put(`/orders/${orderRes.body.order._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id, quantity: 50 }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/enviado/);
  });
});

// ─── PATCH /orders/:id/cancel ─────────────────────────────────────────────────

describe('PATCH /orders/:id/cancel', () => {
  it('admin cancela pedido ativo', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    const res = await request(app)
      .patch(`/orders/${orderRes.body.order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('cancelled');
    expect(res.body.order.sentToSupplier).toBe(false);
  });

  it('retorna 400 ao tentar cancelar pedido já cancelado', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    await request(app)
      .patch(`/orders/${orderRes.body.order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/orders/${orderRes.body.order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('representante não pode cancelar pedido', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const { client, product } = await buildOrderFixture(adminToken, admin.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    const res = await request(app)
      .patch(`/orders/${orderRes.body.order._id}/cancel`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /orders/:id/sent-to-supplier ──────────────────────────────────────

describe('PATCH /orders/:id/sent-to-supplier', () => {
  it('admin marca e desmarca envio ao fornecedor', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    let res = await request(app)
      .patch(`/orders/${orderRes.body.order._id}/sent-to-supplier`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.order.sentToSupplier).toBe(true);
    expect(res.body.order.sentToSupplierAt).toBeTruthy();

    res = await request(app)
      .patch(`/orders/${orderRes.body.order._id}/sent-to-supplier`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.order.sentToSupplier).toBe(false);
    expect(res.body.order.sentToSupplierAt).toBeNull();
  });
});

// ─── GET /orders/:id/duplicate-template ──────────────────────────────────────

describe('GET /orders/:id/duplicate-template', () => {
  it('retorna template para duplicar pedido', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{ productId: product._id, quantity: 50 }],
        notes: 'Nota original',
      });

    const res = await request(app)
      .get(`/orders/${orderRes.body.order._id}/duplicate-template`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.clientId).toBe(client._id);
    expect(res.body.items[0].quantity).toBe(50);
    expect(res.body.notes).toBe('Nota original');
  });
});

// ─── GET /orders/:id/pdf ──────────────────────────────────────────────────────

describe('GET /orders/:id/pdf', () => {
  it('retorna 403 quando representante tenta gerar PDF', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const { client, product } = await buildOrderFixture(adminToken, admin.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    const res = await request(app)
      .get(`/orders/${orderRes.body.order._id}/pdf`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(403);
  });

  it('admin gera PDF com sucesso (Content-Type application/pdf)', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    const res = await request(app)
      .get(`/orders/${orderRes.body.order._id}/pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });
});

// ─── GET /orders/:id/pdf (admin gera PDF) ─────────────────────────────────────

// Nota: o teste de PDF do admin já existe acima. Adicionamos aqui testes de edge cases.

describe('POST /orders — validações adicionais', () => {
  it('retorna 500 quando produto não existe nos items', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client } = await buildOrderFixture(token, user.id);

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{ productId: '000000000000000000000001', quantity: 10 }],
      });

    // Produto não encontrado resulta em erro 500 (lançado dentro do Promise.all)
    expect(res.status).toBe(500);
  });
});

describe('GET /orders — filtros adicionais', () => {
  it('filtra por orderNumber', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    const orderNumber = orderRes.body.order.orderNumber;

    const res = await request(app)
      .get(`/orders?orderNumber=${orderNumber}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.orders[0].orderNumber).toBe(orderNumber);
  });

  it('filtra por sentToSupplier=true', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }] });

    await request(app)
      .patch(`/orders/${orderRes.body.order._id}/sent-to-supplier`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/orders?sentToSupplier=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.orders[0].sentToSupplier).toBe(true);
  });
});

// ─── Consistência de comissões ────────────────────────────────────────────────

describe('Consistência de comissões ao cancelar/atualizar pedido', () => {
  async function getCommissionForOrder(adminToken, orderId) {
    const listRes = await request(app)
      .get('/commissions?status=all')
      .set('Authorization', `Bearer ${adminToken}`);
    return listRes.body.commissions.find(
      (c) => c.orderId === orderId || c.orderId?.toString() === orderId?.toString(),
    );
  }

  it('cancelar pedido marca a comissão vinculada como cancelled', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 100 }] });

    const orderId = orderRes.body.order._id;

    // Verifica que a comissão foi criada como active
    const commBefore = await getCommissionForOrder(token, orderId);
    expect(commBefore).toBeDefined();
    expect(commBefore.status).toBe('active');

    // Cancela o pedido
    await request(app)
      .patch(`/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    // Verifica que a comissão foi marcada como cancelled
    const commAfter = await getCommissionForOrder(token, orderId);
    expect(commAfter.status).toBe('cancelled');
  });

  it('atualizar itens do pedido recalcula orderValueWithoutIpi e comissões', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildOrderFixture(token, user.id);

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 100 }] });

    const orderId = orderRes.body.order._id;
    const commBefore = await getCommissionForOrder(token, orderId);
    const originalValue = commBefore.orderValueWithoutIpi;

    // Atualiza com quantidade diferente (dobro)
    await request(app)
      .put(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id, quantity: 200 }] });

    const commAfter = await getCommissionForOrder(token, orderId);

    // orderValueWithoutIpi deve ter dobrado
    expect(commAfter.orderValueWithoutIpi).toBeCloseTo(originalValue * 2, 2);
    // pool deve ter sido recalculado
    expect(commAfter.pool).toBeCloseTo((commAfter.orderValueWithoutIpi * commAfter.adminPercentage) / 100, 2);
  });
});
