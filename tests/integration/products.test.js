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

// ─── POST /products ───────────────────────────────────────────────────────────

describe('POST /products', () => {
  it('cria produto stretch com sucesso', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        supplierId: supplier._id,
        name: 'Stretch 500m',
        productType: 'stretch',
        saleMode: 'kg',
        calculationMode: 'weight_times_price_per_kg',
        commercialData: { basePrice: 12.5 },
      });

    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe('Stretch 500m');
    expect(res.body.product.commercialData.basePrice).toBe(12.5);
  });

  it('cria saco plástico buscando dados do fornecedor', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token, {
      priceTable: [{ material: 'PEMD', factorKg: 10, density: 0.95 }],
    });
    const client = await createClient(token, user.id);

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        supplierId: supplier._id,
        name: 'Saco 77x135',
        productType: 'plastic_bag',
        material: 'PEMD',
        saleMode: 'thousand',
        calculationMode: 'dimensions_density_factor',
        technicalData: {
          measurements: { width: 0.077, length: 0.135, thickness: 0.00015 },
        },
      });

    expect(res.status).toBe(201);
    // Densidade e factorKg devem vir da tabela do fornecedor
    expect(res.body.product.commercialData.density).toBe(0.95);
    expect(res.body.product.commercialData.factorKg).toBe(10);
    expect(res.body.product.material).toBe('PEMD');
  });

  it('cria fita e calcula boxPrice automaticamente', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        supplierId: supplier._id,
        name: 'Fita 48mm',
        productType: 'tape',
        saleMode: 'box',
        calculationMode: 'boxes_times_units_per_box_times_unit_price',
        technicalData: { unitsPerBox: 36 },
        commercialData: { unitPrice: 2.5 },
      });

    expect(res.status).toBe(201);
    // boxPrice = 36 * 2.5 = 90
    expect(res.body.product.commercialData.boxPrice).toBe(90);
  });

  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Produto Incompleto' });

    expect(res.status).toBe(400);
  });

  it('retorna 400 para saco plástico sem material', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        supplierId: supplier._id,
        name: 'Saco Sem Material',
        productType: 'plastic_bag',
        saleMode: 'thousand',
        calculationMode: 'dimensions_density_factor',
        // sem material
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/material/);
  });

  it('retorna 400 para material não encontrado na tabela do fornecedor', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token, {
      priceTable: [{ material: 'PEMD', factorKg: 10, density: 0.95 }],
    });
    const client = await createClient(token, user.id);

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        supplierId: supplier._id,
        name: 'Saco PEAD',
        productType: 'plastic_bag',
        material: 'PEAD', // não existe na tabela
        saleMode: 'thousand',
        calculationMode: 'dimensions_density_factor',
        technicalData: {
          measurements: { width: 0.077, length: 0.135, thickness: 0.00015 },
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Material não encontrado/);
  });

  it('retorna 403 quando representante tenta criar produto de cliente de outro', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const supplier = await createSupplier(adminToken);
    // Cliente pertence ao admin, não ao representante
    const client = await createClient(adminToken, admin.id);

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        clientId: client._id,
        supplierId: supplier._id,
        name: 'Produto',
        productType: 'stretch',
        saleMode: 'kg',
        calculationMode: 'weight_times_price_per_kg',
        commercialData: { basePrice: 10 },
      });

    expect(res.status).toBe(403);
  });
});

// ─── GET /products ────────────────────────────────────────────────────────────

describe('GET /products', () => {
  it('admin lista todos os produtos com paginação', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);

    await createProduct(token, client._id, supplier._id, { name: 'Produto A' });
    await createProduct(token, client._id, supplier._id, { name: 'Produto B' });

    const res = await request(app)
      .get('/products?limit=1&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.products.length).toBe(1);
  });

  it('representante vê apenas produtos de seus clientes', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const supplier = await createSupplier(adminToken);

    const clientAdmin = await createClient(adminToken, admin.id, { cnpj: '11111111000111' });
    const clientRep = await createClient(adminToken, rep.id, { cnpj: '22222222000122' });

    await createProduct(adminToken, clientAdmin._id, supplier._id, { name: 'Produto Admin' });
    await createProduct(adminToken, clientRep._id, supplier._id, { name: 'Produto Rep' });

    const res = await request(app)
      .get('/products')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe('Produto Rep');
  });

  it('filtra por productType', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);

    await createProduct(token, client._id, supplier._id, {
      name: 'Stretch',
      productType: 'stretch',
      saleMode: 'kg',
      calculationMode: 'weight_times_price_per_kg',
      commercialData: { basePrice: 10 },
    });
    await createProduct(token, client._id, supplier._id, {
      name: 'Bobina',
      productType: 'bobbin',
      saleMode: 'kg',
      calculationMode: 'weight_times_price_per_kg',
      commercialData: { basePrice: 8 },
    });

    const res = await request(app)
      .get('/products?productType=stretch')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe('Stretch');
  });
});

// ─── GET /products/:id ────────────────────────────────────────────────────────

describe('GET /products/:id', () => {
  it('retorna produto por ID', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);
    const product = await createProduct(token, client._id, supplier._id);

    const res = await request(app)
      .get(`/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(product._id);
  });

  it('retorna 404 para produto inexistente', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .get('/products/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ─── PUT /products/:id ────────────────────────────────────────────────────────

describe('PUT /products/:id', () => {
  it('atualiza produto com sucesso', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);
    const product = await createProduct(token, client._id, supplier._id);

    const res = await request(app)
      .put(`/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado', commercialData: { basePrice: 15 } });

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe('Nome Atualizado');
    expect(res.body.product.commercialData.basePrice).toBe(15);
  });
});

// ─── PATCH /products/:id/toggle-active ───────────────────────────────────────

describe('PATCH /products/:id/toggle-active', () => {
  it('desativa e reativa produto', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);
    const product = await createProduct(token, client._id, supplier._id);

    let res = await request(app)
      .patch(`/products/${product._id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.product.active).toBe(false);

    res = await request(app)
      .patch(`/products/${product._id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.product.active).toBe(true);
  });
});

// ─── DELETE /products/:id ─────────────────────────────────────────────────────

describe('DELETE /products/:id', () => {
  it('deleta produto com sucesso', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token);
    const client = await createClient(token, user.id);
    const product = await createProduct(token, client._id, supplier._id);

    const res = await request(app)
      .delete(`/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/excluído/);
  });
});
