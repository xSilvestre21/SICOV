const request = require('supertest');
const app = require('../../app');

// Segredo usado apenas nos testes — deve bater com o que está em process.env
const TEST_ADMIN_SECRET = process.env.ADMIN_REGISTER_SECRET || 'test-secret';

/**
 * Cria um admin e retorna o token JWT.
 */
async function createAdminAndLogin(email = 'admin@test.com', password = 'senha123') {
  await request(app)
    .post('/api/auth/register-admin')
    .set('x-admin-secret', TEST_ADMIN_SECRET)
    .send({ name: 'Admin Teste', email, password });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  return { token: res.body.token, user: res.body.user };
}

/**
 * Cria um representante via API (requer token de admin) e faz login.
 */
async function createRepAndLogin(adminToken, email = 'rep@test.com', password = 'senha123') {
  await request(app)
    .post('/api/users/create-representative')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Representante Teste', email, password });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  return { token: res.body.token, user: res.body.user };
}

/**
 * Cria um fornecedor via API e retorna o objeto criado.
 */
async function createSupplier(adminToken, overrides = {}) {
  const payload = {
    name: 'Fornecedor Teste',
    cnpj: '08819970000125',
    ipi: 9.75,
    priceTable: [{ material: 'PEMD', factorKg: 10, density: 0.95 }],
    ...overrides,
  };

  const res = await request(app)
    .post('/api/suppliers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(payload);

  return res.body.supplier;
}

/**
 * Cria um cliente via API e retorna o objeto criado.
 */
async function createClient(adminToken, representativeId, overrides = {}) {
  const payload = {
    name: 'Cliente Teste',
    cnpj: '20927468000133',
    representativeId,
    paymentTerm: 'Boleto 30 dias',
    ...overrides,
  };

  const res = await request(app)
    .post('/api/clients')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(payload);

  return res.body.client;
}

/**
 * Cria um produto via API e retorna o objeto criado.
 */
async function createProduct(adminToken, clientId, supplierId, overrides = {}) {
  const payload = {
    clientId,
    supplierId,
    name: 'Produto Teste',
    productType: 'stretch',
    saleMode: 'kg',
    calculationMode: 'weight_times_price_per_kg',
    commercialData: { basePrice: 12.5 },
    ...overrides,
  };

  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(payload);

  return res.body.product;
}

/**
 * Cria um orçamento via API e retorna o objeto criado.
 * Por padrão usa save: true para persistir no banco.
 */
async function createQuotation(token, clientId, supplierId, productId, overrides = {}) {
  const payload = {
    clientId,
    items: [{ productId, quantity: 100 }],
    save: true,
    ...overrides,
  };

  const res = await request(app)
    .post('/api/quotations')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);

  return res.body.quotation;
}

/**
 * Cria um pedido via API e retorna o objeto criado.
 */
async function createOrder(adminToken, clientId, supplierId, productId, overrides = {}) {
  const payload = {
    clientId,
    items: [{ productId, quantity: 100 }],
    ...overrides,
  };

  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(payload);

  return res.body.order;
}

module.exports = {
  createAdminAndLogin,
  createRepAndLogin,
  createSupplier,
  createClient,
  createProduct,
  createQuotation,
  createOrder,
};
