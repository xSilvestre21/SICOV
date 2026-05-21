const request = require('supertest');
const app = require('../../app');
const { connectDB, clearDB, disconnectDB } = require('./setup');
const {
  createAdminAndLogin,
  createRepAndLogin,
  createSupplier,
  createClient,
  createProduct,
  createQuotation,
} = require('./helpers');

process.env.JWT_SECRET = 'integration_test_secret';

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

// ─── Fixture helper ───────────────────────────────────────────────────────────

/**
 * Cria todos os pré-requisitos para um orçamento:
 * fornecedor, cliente e produto.
 */
async function buildQuotationFixture(adminToken, representativeId, supplierOverrides = {}) {
  const supplier = await createSupplier(adminToken, {
    ipi: 10,
    city: 'São Paulo',
    priceTable: [{ material: 'PEMD', factorKg: 10, density: 0.95 }],
    ...supplierOverrides,
  });

  const client = await createClient(adminToken, representativeId, {
    paymentTerm: 'Boleto 30 dias',
  });

  const product = await createProduct(adminToken, client._id, supplier._id, {
    name: 'Produto Orçamento',
    productType: 'stretch',
    saleMode: 'kg',
    calculationMode: 'weight_times_price_per_kg',
    commercialData: { basePrice: 12.5 },
  });

  return { supplier, client, product };
}

// ─── POST /quotations ─────────────────────────────────────────────────────────

describe('POST /quotations', () => {
  it('save: true → documento persistido no banco, HTTP 201, currentOrderNumber não incrementado', async () => {
    const { token, user } = await createAdminAndLogin();
    const { supplier, client, product } = await buildQuotationFixture(token, user.id);

    // Captura currentOrderNumber antes
    const supplierBefore = await request(app)
      .get(`/api/suppliers/${supplier._id}`)
      .set('Authorization', `Bearer ${token}`);
    const orderNumberBefore = supplierBefore.body.currentOrderNumber;

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{ productId: product._id, quantity: 100 }],
        save: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.quotation).toBeDefined();
    expect(res.body.quotation._id).toBeDefined();

    // Verifica que currentOrderNumber NÃO foi incrementado
    const supplierAfter = await request(app)
      .get(`/api/suppliers/${supplier._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(supplierAfter.body.currentOrderNumber).toBe(orderNumberBefore);
  });

  it('save: false → sem documento no banco, HTTP 200', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{ productId: product._id, quantity: 100 }],
        save: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.quotation).toBeDefined();
    // Sem _id persistido (não foi salvo no banco)
    expect(res.body.quotation._id).toBeUndefined();

    // Confirma que não há orçamentos no banco
    const listRes = await request(app)
      .get('/api/quotations')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.total).toBe(0);
  });

  it('com clientId válido → clientSnapshot correto', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{ productId: product._id, quantity: 50 }],
        save: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.quotation.clientSnapshot.name).toBe(client.name);
    expect(res.body.quotation.clientId).toBe(client._id);
  });

  it('com adHocClient → clientSnapshot usa dados avulsos', async () => {
    const { token, user } = await createAdminAndLogin();
    const { product } = await buildQuotationFixture(token, user.id);

    const adHocClient = {
      name: 'Empresa Avulsa Ltda',
      tradeName: 'Avulsa',
      cnpj: '11.111.111/0001-11',
      city: 'Rio de Janeiro',
    };

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        adHocClient,
        items: [{ productId: product._id, quantity: 50 }],
        save: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.quotation.clientSnapshot.name).toBe('Empresa Avulsa Ltda');
    expect(res.body.quotation.clientSnapshot.tradeName).toBe('Avulsa');
    expect(res.body.quotation.clientId).toBeNull();
  });

  it('HTTP 400 sem cliente (sem clientId e sem adHocClient.name)', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: '000000000000000000000001', quantity: 10 }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Nome do cliente é obrigatório');
  });

  it('HTTP 400 com items vazio', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client } = await buildQuotationFixture(token, user.id);

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Itens são obrigatórios');
  });

  it('HTTP 401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/quotations')
      .send({ adHocClient: { name: 'Avulso' }, items: [] });

    expect(res.status).toBe(401);
  });

  it('com adHocProduct → cria orçamento sem productId cadastrado', async () => {
    const { token, user } = await createAdminAndLogin();
    const { supplier } = await buildQuotationFixture(token, user.id);

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        adHocClient: { name: 'Empresa Avulsa', city: 'SP' },
        items: [
          {
            adHocProduct: {
              name: 'Sacola 30x40cm',
              description: 'Sacola personalizada kraft',
              unitLabel: 'UN',
              saleMode: 'unit',
            },
            supplierId: supplier._id,
            unitPrice: 0.85,
            quantity: 5000,
          },
        ],
        save: true,
        sellerName: 'Valquiria Silvestre',
      });

    expect(res.status).toBe(201);
    expect(res.body.quotation.items[0].productId).toBeNull();
    expect(res.body.quotation.items[0].productSnapshot.name).toBe('Sacola 30x40cm');
    expect(res.body.quotation.items[0].unitPrice).toBe(0.85);
    expect(res.body.quotation.items[0].subtotal).toBe(0.85 * 5000);
    expect(res.body.quotation.subtotal).toBe(0.85 * 5000);
  });

  it('calcula subtotal, ipiValue e total corretamente', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id, { ipi: 10 });

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{ productId: product._id, quantity: 100 }],
        save: false,
      });

    expect(res.status).toBe(200);
    // basePrice = 12.5, quantity = 100 → subtotal = 1250
    expect(res.body.quotation.subtotal).toBe(1250);
    // ipiValue = 1250 * 10% = 125
    expect(res.body.quotation.ipiValue).toBe(125);
    // total = 1250 + 125 = 1375
    expect(res.body.quotation.total).toBe(1375);
  });
});

// ─── POST /quotations/pdf ─────────────────────────────────────────────────────

describe('POST /quotations/pdf', () => {
  it('retorna PDF válido (Content-Type: application/pdf) sem salvar no banco', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product, supplier } = await buildQuotationFixture(token, user.id);

    // Primeiro calcula o orçamento sem salvar
    const calcRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{ productId: product._id, quantity: 100 }],
        save: false,
      });

    expect(calcRes.status).toBe(200);

    // Envia os dados calculados para gerar o PDF
    const pdfRes = await request(app)
      .post('/api/quotations/pdf')
      .set('Authorization', `Bearer ${token}`)
      .send(calcRes.body.quotation);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toMatch(/application\/pdf/);

    // Confirma que nenhum orçamento foi salvo no banco
    const listRes = await request(app)
      .get('/api/quotations')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.total).toBe(0);
  });

  it('HTTP 401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/quotations/pdf')
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── POST /quotations/:id/convert-to-order ────────────────────────────────────

describe('POST /quotations/:id/convert-to-order', () => {
  it('converte cotação em pedido com sucesso e incrementa orderNumber', async () => {
    const { token, user } = await createAdminAndLogin();
    const { supplier, client, product } = await buildQuotationFixture(token, user.id, { ipi: 10 });
    const quotation = await createQuotation(token, client._id, null, product._id);

    // Captura orderNumber antes
    const supplierBefore = await request(app)
      .get(`/api/suppliers/${supplier._id}`)
      .set('Authorization', `Bearer ${token}`);
    const orderNumberBefore = supplierBefore.body.currentOrderNumber;

    const res = await request(app)
      .post(`/api/quotations/${quotation._id}/convert-to-order`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        deliveryDate: '2026-06-30',
        customerPurchaseOrder: 'PC-001',
        notes: 'Entregar paletizado',
        paymentTerm: '28/35/42 dias',
      });

    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.orderNumber).toBe(orderNumberBefore + 1);
    expect(res.body.order.clientId).toBe(client._id);
    expect(res.body.order.supplierId).toBe(supplier._id);
    expect(res.body.order.customerPurchaseOrder).toBe('PC-001');
    expect(res.body.order.notes).toBe('Entregar paletizado');
    expect(res.body.order.paymentTerm).toBe('28/35/42 dias');
    // subtotal = 12.5 * 100 = 1250, ipi 10% = 125, total = 1375
    expect(res.body.order.subtotal).toBe(1250);
    expect(res.body.order.ipiValue).toBe(125);
    expect(res.body.order.total).toBe(1375);
  });

  it('usa paymentTerm do cliente quando não informado no body', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);
    const quotation = await createQuotation(token, client._id, null, product._id);

    const res = await request(app)
      .post(`/api/quotations/${quotation._id}/convert-to-order`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.order.paymentTerm).toBe(client.paymentTerm);
  });

  it('HTTP 400 quando cotação tem cliente avulso (sem clientId)', async () => {
    const { token, user } = await createAdminAndLogin();
    const { product } = await buildQuotationFixture(token, user.id);

    // Cria cotação com cliente avulso
    const quotationRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        adHocClient: { name: 'Avulso' },
        items: [{ productId: product._id, quantity: 10 }],
        save: true,
      });

    const res = await request(app)
      .post(`/api/quotations/${quotationRes.body.quotation._id}/convert-to-order`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cliente avulso/i);
  });

  it('HTTP 400 quando cotação tem itens avulsos (sem productId)', async () => {
    const { token, user } = await createAdminAndLogin();
    const { supplier, client } = await buildQuotationFixture(token, user.id);

    // Cria cotação com item avulso
    const quotationRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client._id,
        items: [{
          adHocProduct: { name: 'Produto Avulso', unitLabel: 'UN' },
          supplierId: supplier._id,
          unitPrice: 5,
          quantity: 10,
        }],
        save: true,
      });

    const res = await request(app)
      .post(`/api/quotations/${quotationRes.body.quotation._id}/convert-to-order`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/avulso/i);
  });

  it('HTTP 403 quando representante tenta converter cotação de outro', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const { client, product } = await buildQuotationFixture(adminToken, admin.id);
    const quotation = await createQuotation(adminToken, client._id, null, product._id);

    const res = await request(app)
      .post(`/api/quotations/${quotation._id}/convert-to-order`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('HTTP 404 quando cotação não existe', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/quotations/000000000000000000000000/convert-to-order')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Orçamento não encontrado');
  });

  it('HTTP 401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/quotations/000000000000000000000000/convert-to-order')
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── PUT /quotations/:id ──────────────────────────────────────────────────────

describe('PUT /quotations/:id', () => {
  it('atualiza campos simples e registra no histórico', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);
    const quotation = await createQuotation(token, client._id, null, product._id);

    const res = await request(app)
      .put(`/api/quotations/${quotation._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        attn: 'Maria Contato',
        observations: 'Condições revisadas.',
        paymentTerm: '28/35/42 dias',
        changes: 'Ajuste de prazo de pagamento',
      });

    expect(res.status).toBe(200);
    expect(res.body.quotation.attn).toBe('Maria Contato');
    expect(res.body.quotation.observations).toBe('Condições revisadas.');
    expect(res.body.quotation.paymentTerm).toBe('28/35/42 dias');
    expect(res.body.quotation.editHistory).toHaveLength(1);
    expect(res.body.quotation.editHistory[0].editedBy).toBe(user.id);
    expect(res.body.quotation.editHistory[0].changes).toBe('Ajuste de prazo de pagamento');
    expect(res.body.quotation.editHistory[0].editedAt).toBeDefined();
  });

  it('acumula múltiplas entradas no histórico', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);
    const quotation = await createQuotation(token, client._id, null, product._id);

    await request(app)
      .put(`/api/quotations/${quotation._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ attn: 'Contato 1', changes: 'Primeira edição' });

    const res = await request(app)
      .put(`/api/quotations/${quotation._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ attn: 'Contato 2', changes: 'Segunda edição' });

    expect(res.status).toBe(200);
    expect(res.body.quotation.editHistory).toHaveLength(2);
    expect(res.body.quotation.editHistory[1].changes).toBe('Segunda edição');
  });

  it('reprocessa itens e recalcula totais', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id, { ipi: 10 });
    const quotation = await createQuotation(token, client._id, null, product._id);

    const res = await request(app)
      .put(`/api/quotations/${quotation._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product._id, quantity: 200 }],
        changes: 'Quantidade alterada para 200',
      });

    expect(res.status).toBe(200);
    // basePrice=12.5, qty=200 → subtotal=2500, ipi=10% → ipiValue=250, total=2750
    expect(res.body.quotation.subtotal).toBe(2500);
    expect(res.body.quotation.ipiValue).toBe(250);
    expect(res.body.quotation.total).toBe(2750);
  });

  it('HTTP 403 quando representante tenta editar orçamento de outro', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const { client, product } = await buildQuotationFixture(adminToken, admin.id);
    const quotation = await createQuotation(adminToken, client._id, null, product._id);

    const res = await request(app)
      .put(`/api/quotations/${quotation._id}`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ observations: 'Tentativa indevida' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Acesso negado');
  });

  it('HTTP 404 quando orçamento não existe', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .put('/api/quotations/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ observations: 'x' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Orçamento não encontrado');
  });

  it('HTTP 401 sem autenticação', async () => {
    const res = await request(app)
      .put('/api/quotations/000000000000000000000000')
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── GET /quotations ──────────────────────────────────────────────────────────

describe('GET /quotations', () => {
  it('retorna estrutura paginada correta', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);

    await createQuotation(token, client._id, null, product._id);
    await createQuotation(token, client._id, null, product._id);

    const res = await request(app)
      .get('/api/quotations?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
    expect(res.body.quotations).toHaveLength(2);
  });

  it('representante vê apenas seus orçamentos', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);

    const supplier = await createSupplier(adminToken, { ipi: 0 });
    const clientAdmin = await createClient(adminToken, admin.id, { cnpj: '11111111000111' });
    const clientRep   = await createClient(adminToken, rep.id,   { cnpj: '22222222000122' });
    const productAdmin = await createProduct(adminToken, clientAdmin._id, supplier._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });
    const productRep = await createProduct(adminToken, clientRep._id, supplier._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });

    // Orçamento do admin
    await createQuotation(adminToken, clientAdmin._id, null, productAdmin._id);
    // Orçamento do representante
    await createQuotation(repToken, clientRep._id, null, productRep._id);

    const res = await request(app)
      .get('/api/quotations')
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.quotations[0].representativeId._id).toBe(rep.id);
  });

  it('admin vê todos os orçamentos', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);

    const supplier = await createSupplier(adminToken, { ipi: 0 });
    const clientAdmin = await createClient(adminToken, admin.id, { cnpj: '11111111000111' });
    const clientRep   = await createClient(adminToken, rep.id,   { cnpj: '22222222000122' });
    const productAdmin = await createProduct(adminToken, clientAdmin._id, supplier._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });
    const productRep = await createProduct(adminToken, clientRep._id, supplier._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });

    await createQuotation(adminToken, clientAdmin._id, null, productAdmin._id);
    await createQuotation(repToken, clientRep._id, null, productRep._id);

    const res = await request(app)
      .get('/api/quotations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('filtra por supplierId', async () => {
    const { token, user } = await createAdminAndLogin();

    const supplier1 = await createSupplier(token, { ipi: 0, cnpj: '11111111000111' });
    const supplier2 = await createSupplier(token, { ipi: 0, cnpj: '22222222000122' });

    const client1 = await createClient(token, user.id, { cnpj: '33333333000133' });
    const client2 = await createClient(token, user.id, { cnpj: '44444444000144' });

    const product1 = await createProduct(token, client1._id, supplier1._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });
    const product2 = await createProduct(token, client2._id, supplier2._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });

    await createQuotation(token, client1._id, null, product1._id);
    await createQuotation(token, client2._id, null, product2._id);

    const res = await request(app)
      .get(`/api/quotations?supplierId=${supplier1._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.quotations[0].supplierId).toBe(supplier1._id);
  });

  it('filtra por search (nome do cliente no snapshot)', async () => {
    const { token, user } = await createAdminAndLogin();
    const supplier = await createSupplier(token, { ipi: 0 });

    const clientA = await createClient(token, user.id, {
      name: 'Empresa Alpha',
      cnpj: '11111111000111',
    });
    const clientB = await createClient(token, user.id, {
      name: 'Empresa Beta',
      cnpj: '22222222000122',
    });

    const productA = await createProduct(token, clientA._id, supplier._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });
    const productB = await createProduct(token, clientB._id, supplier._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });

    await createQuotation(token, clientA._id, null, productA._id);
    await createQuotation(token, clientB._id, null, productB._id);

    const res = await request(app)
      .get('/api/quotations?search=Alpha')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.quotations[0].clientSnapshot.name).toMatch(/Alpha/i);
  });

  it('HTTP 401 sem autenticação', async () => {
    const res = await request(app).get('/api/quotations');
    expect(res.status).toBe(401);
  });
});

// ─── GET /quotations/:id ──────────────────────────────────────────────────────

describe('GET /quotations/:id', () => {
  it('retorna orçamento por ID', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);

    const quotation = await createQuotation(token, client._id, null, product._id);

    const res = await request(app)
      .get(`/api/quotations/${quotation._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(quotation._id);
  });

  it('HTTP 403 quando representante tenta acessar orçamento de outro', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const { client, product } = await buildQuotationFixture(adminToken, admin.id);

    // Admin cria o orçamento
    const quotation = await createQuotation(adminToken, client._id, null, product._id);

    // Representante tenta acessar
    const res = await request(app)
      .get(`/api/quotations/${quotation._id}`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Acesso negado');
  });

  it('admin acessa qualquer orçamento', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);

    const supplier = await createSupplier(adminToken, { ipi: 0 });
    const clientRep = await createClient(adminToken, rep.id, { cnpj: '22222222000122' });
    const productRep = await createProduct(adminToken, clientRep._id, supplier._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });

    // Representante cria o orçamento
    const quotation = await createQuotation(repToken, clientRep._id, null, productRep._id);

    // Admin acessa
    const res = await request(app)
      .get(`/api/quotations/${quotation._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(quotation._id);
  });

  it('HTTP 404 quando orçamento não existe', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .get('/api/quotations/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Orçamento não encontrado');
  });
});

// ─── GET /quotations/:id/pdf ──────────────────────────────────────────────────

describe('GET /quotations/:id/pdf', () => {
  it('retorna PDF válido (Content-Type: application/pdf)', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);

    const quotation = await createQuotation(token, client._id, null, product._id);

    const res = await request(app)
      .get(`/api/quotations/${quotation._id}/pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('HTTP 403 quando representante tenta acessar PDF de orçamento de outro', async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const { client, product } = await buildQuotationFixture(adminToken, admin.id);

    const quotation = await createQuotation(adminToken, client._id, null, product._id);

    const res = await request(app)
      .get(`/api/quotations/${quotation._id}/pdf`)
      .set('Authorization', `Bearer ${repToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Acesso negado');
  });

  it('HTTP 401 sem autenticação', async () => {
    const res = await request(app)
      .get('/api/quotations/000000000000000000000000/pdf');

    expect(res.status).toBe(401);
  });
});

// ─── GET /quotations/client-products ─────────────────────────────────────────

describe('GET /quotations/client-products', () => {
  it('retorna produtos do cliente filtrados corretamente', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client, product } = await buildQuotationFixture(token, user.id);

    const res = await request(app)
      .get(`/api/quotations/client-products?clientId=${client._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]._id).toBe(product._id);
  });

  it('filtra por supplierId quando informado', async () => {
    const { token, user } = await createAdminAndLogin();

    const supplier1 = await createSupplier(token, { ipi: 0, cnpj: '11111111000111' });
    const supplier2 = await createSupplier(token, { ipi: 0, cnpj: '22222222000122' });
    const client = await createClient(token, user.id, { cnpj: '33333333000133' });

    const product1 = await createProduct(token, client._id, supplier1._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });
    await createProduct(token, client._id, supplier2._id, {
      calculationMode: 'weight_times_price_per_kg',
      saleMode: 'kg',
      commercialData: { basePrice: 10 },
    });

    const res = await request(app)
      .get(`/api/quotations/client-products?clientId=${client._id}&supplierId=${supplier1._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(product1._id);
  });

  it('HTTP 404 quando clientId não existe', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .get('/api/quotations/client-products?clientId=000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Cliente não encontrado');
  });

  it('retorna campos necessários para montagem do orçamento', async () => {
    const { token, user } = await createAdminAndLogin();
    const { client } = await buildQuotationFixture(token, user.id);

    const res = await request(app)
      .get(`/api/quotations/client-products?clientId=${client._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    const p = res.body[0];
    // Campos obrigatórios para montagem do orçamento
    expect(p).toHaveProperty('_id');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('saleMode');
    expect(p).toHaveProperty('calculationMode');
    expect(p).toHaveProperty('supplierId');
  });

  it('HTTP 401 sem autenticação', async () => {
    const res = await request(app)
      .get('/api/quotations/client-products?clientId=abc');

    expect(res.status).toBe(401);
  });
});
