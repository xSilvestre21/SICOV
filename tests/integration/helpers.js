const request = require('supertest');
const app = require('../../app');

/**
 * Cria um admin e retorna o token JWT.
 */
async function createAdminAndLogin(email = 'admin@test.com', password = 'senha123') {
  await request(app)
    .post('/auth/register-admin')
    .send({ name: 'Admin Teste', email, password });

  const res = await request(app)
    .post('/auth/login')
    .send({ email, password });

  return { token: res.body.token, user: res.body.user };
}

/**
 * Cria um representante via API (requer token de admin) e faz login.
 */
async function createRepAndLogin(adminToken, email = 'rep@test.com', password = 'senha123') {
  await request(app)
    .post('/users/create-representative')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Representante Teste', email, password });

  const res = await request(app)
    .post('/auth/login')
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
    priceTable: [{ material: 'PEMD', price: 10, density: 0.95 }],
    ...overrides,
  };

  const res = await request(app)
    .post('/suppliers')
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
    .post('/clients')
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
    .post('/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(payload);

  return res.body.product;
}

module.exports = {
  createAdminAndLogin,
  createRepAndLogin,
  createSupplier,
  createClient,
  createProduct,
};
