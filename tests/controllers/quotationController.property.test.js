/**
 * Testes de Propriedade (PBT) — Orçamentos (Quotations)
 *
 * Cada teste usa fc.assert(fc.property(...), { numRuns: 100 }) e valida
 * uma das propriedades de corretude definidas no design.
 */

jest.mock('../../src/models/quotation');
jest.mock('../../src/models/product');
jest.mock('../../src/models/client');
jest.mock('../../src/models/supplier');
jest.mock('../../src/utils/quotationPdfGenerator');
jest.mock('../../src/utils/priceCalculator');

const fc = require('fast-check');

const Quotation = require('../../src/models/quotation');
const Product   = require('../../src/models/product');
const Client    = require('../../src/models/client');
const Supplier  = require('../../src/models/supplier');
const { calculateProductPrice } = require('../../src/utils/priceCalculator');

const {
  createQuotation,
  getQuotations,
  getQuotationById,
  getClientProductsForQuotation,
} = require('../../src/controllers/quotationController');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

/** Monta um produto mock com calculationMode=quantity_times_unit_price */
function makeProduct(supplierId = 's1', unitPrice = 10) {
  return {
    _id: 'p1',
    name: 'Produto',
    supplierId: { toString: () => supplierId },
    calculationMode: 'quantity_times_unit_price',
    saleMode: 'unit',
    commercialData: { unitPrice },
    technicalData: {},
    supplierCode: 'SC1',
    clientCode: 'CC1',
    description: 'Desc',
    productType: 'custom',
    material: 'PVC',
    unitLabel: 'UN',
    selectedExtras: [],
  };
}

/** Monta um fornecedor mock */
function makeSupplier(ipi = 0) {
  return {
    _id: 's1',
    name: 'Fornecedor',
    tradeName: 'Forn',
    cnpj: '12.345.678/0001-99',
    ipi,
    logoUrl: null,
    city: 'São Paulo',
  };
}

// ─── Property 1: subtotal é soma dos itens ───────────────────────────────────

// Feature: quotations, Property 1: subtotal é soma dos itens
test('Property 1 — subtotal do orçamento é sempre a soma dos subtotais dos itens', async () => {
  await fc.assert(
    fc.asyncProperty(
      // Gera array de 1 a 5 itens com preço unitário e quantidade positivos
      fc.array(
        fc.record({
          unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          quantity:  fc.integer({ min: 1, max: 10000 }),
        }),
        { minLength: 1, maxLength: 5 },
      ),
      async (itemInputs) => {
        jest.clearAllMocks();

        const supplierId = 's1';
        const product = makeProduct(supplierId, 10);
        const supplier = makeSupplier(0);

        // Configura mocks para cada item
        Product.findById.mockResolvedValue(product);
        Supplier.findById.mockResolvedValue(supplier);

        // calculateProductPrice retorna valores controlados por itemInputs
        itemInputs.forEach(({ unitPrice, quantity }) => {
          calculateProductPrice.mockReturnValueOnce({
            unitPrice,
            subtotal: unitPrice * quantity,
          });
        });

        const items = itemInputs.map(({ quantity }) => ({
          productId: 'p1',
          quantity,
        }));

        const req = {
          body: { adHocClient: { name: 'Avulso' }, items, save: false },
          user: { id: 'repId', profile: 'representante' },
        };
        const res = makeRes();

        await createQuotation(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        const { quotation } = res.json.mock.calls[0][0];

        // Propriedade: subtotal == soma dos subtotais dos itens
        const expectedSubtotal = itemInputs.reduce(
          (acc, { unitPrice, quantity }) => acc + unitPrice * quantity,
          0,
        );

        expect(quotation.subtotal).toBeCloseTo(expectedSubtotal, 5);
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 2: ipiValue e total ────────────────────────────────────────────

// Feature: quotations, Property 2: ipiValue e total
test('Property 2 — ipiValue = subtotal * (ipi/100) e total = subtotal + ipiValue', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }), // subtotal
      fc.float({ min: 0, max: Math.fround(50), noNaN: true }),         // ipi %
      async (subtotalValue, ipiPercent) => {
        jest.clearAllMocks();

        const product = makeProduct('s1', subtotalValue);
        const supplier = makeSupplier(ipiPercent);

        Product.findById.mockResolvedValue(product);
        Supplier.findById.mockResolvedValue(supplier);
        calculateProductPrice.mockReturnValue({
          unitPrice: subtotalValue,
          subtotal: subtotalValue,
        });

        const req = {
          body: {
            adHocClient: { name: 'Avulso' },
            items: [{ productId: 'p1', quantity: 1 }],
            save: false,
          },
          user: { id: 'repId', profile: 'representante' },
        };
        const res = makeRes();

        await createQuotation(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        const { quotation } = res.json.mock.calls[0][0];

        const expectedIpiValue = subtotalValue * (ipiPercent / 100);
        const expectedTotal    = subtotalValue + expectedIpiValue;

        expect(quotation.ipiValue).toBeCloseTo(expectedIpiValue, 5);
        expect(quotation.total).toBeCloseTo(expectedTotal, 5);
      },
    ),
    { numRuns: 100 },
  );
});

// Feature: quotations, Property 2 (caso especial) — ipi=0 → ipiValue=0 e total=subtotal
test('Property 2 (ipi=0) — quando ipi é zero, ipiValue=0 e total=subtotal', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
      async (subtotalValue) => {
        jest.clearAllMocks();

        const product  = makeProduct('s1', subtotalValue);
        const supplier = makeSupplier(0); // ipi = 0

        Product.findById.mockResolvedValue(product);
        Supplier.findById.mockResolvedValue(supplier);
        calculateProductPrice.mockReturnValue({
          unitPrice: subtotalValue,
          subtotal: subtotalValue,
        });

        const req = {
          body: {
            adHocClient: { name: 'Avulso' },
            items: [{ productId: 'p1', quantity: 1 }],
            save: false,
          },
          user: { id: 'repId', profile: 'representante' },
        };
        const res = makeRes();

        await createQuotation(req, res);

        const { quotation } = res.json.mock.calls[0][0];

        expect(quotation.ipiValue).toBe(0);
        expect(quotation.total).toBeCloseTo(subtotalValue, 5);
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 3: snapshot do cliente é imutável após criação ─────────────────

// Feature: quotations, Property 3: snapshot do cliente é imutável após criação
test('Property 3 — clientSnapshot no orçamento salvo é idêntico ao cliente no momento da criação', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        name:     fc.string({ minLength: 1, maxLength: 50 }),
        tradeName: fc.string({ maxLength: 50 }),
        cnpj:     fc.string({ maxLength: 20 }),
        city:     fc.string({ maxLength: 30 }),
      }),
      async (clientData) => {
        jest.clearAllMocks();

        const mockClient = { _id: 'c1', ...clientData };
        const product    = makeProduct('s1', 10);
        const supplier   = makeSupplier(0);

        Client.findById.mockResolvedValue(mockClient);
        Product.findById.mockResolvedValue(product);
        Supplier.findById.mockResolvedValue(supplier);
        calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });

        let capturedSnapshot = null;
        Quotation.create.mockImplementation((data) => {
          capturedSnapshot = data.clientSnapshot;
          return Promise.resolve({ _id: 'q1', ...data });
        });

        const req = {
          body: {
            clientId: 'c1',
            items: [{ productId: 'p1', quantity: 10 }],
            save: true,
          },
          user: { id: 'repId', profile: 'representante' },
        };
        const res = makeRes();

        await createQuotation(req, res);

        // Snapshot deve conter os dados do cliente no momento da criação
        expect(capturedSnapshot.name).toBe(clientData.name);
        expect(capturedSnapshot.tradeName).toBe(clientData.tradeName);
        expect(capturedSnapshot.cnpj).toBe(clientData.cnpj);
        expect(capturedSnapshot.city).toBe(clientData.city);
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 4: snapshot do produto é fiel ao produto original ──────────────

// Feature: quotations, Property 4: snapshot do produto é fiel ao produto original
test('Property 4 — productSnapshot no item é fiel aos campos do produto original', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        supplierCode:    fc.string({ maxLength: 20 }),
        clientCode:      fc.string({ maxLength: 20 }),
        name:            fc.string({ minLength: 1, maxLength: 50 }),
        description:     fc.string({ maxLength: 100 }),
        saleMode:        fc.constantFrom('unit', 'kg', 'thousand'),
        calculationMode: fc.constant('quantity_times_unit_price'),
        unitLabel:       fc.string({ maxLength: 10 }),
      }),
      async (productFields) => {
        jest.clearAllMocks();

        const product = {
          _id: 'p1',
          ...productFields,
          supplierId: { toString: () => 's1' },
          commercialData: { unitPrice: 10 },
          technicalData: {},
          productType: 'custom',
          material: 'PVC',
          selectedExtras: [],
        };
        const supplier = makeSupplier(0);

        Product.findById.mockResolvedValue(product);
        Supplier.findById.mockResolvedValue(supplier);
        calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });

        const req = {
          body: {
            adHocClient: { name: 'Avulso' },
            items: [{ productId: 'p1', quantity: 10 }],
            save: false,
          },
          user: { id: 'repId', profile: 'representante' },
        };
        const res = makeRes();

        await createQuotation(req, res);

        const { quotation } = res.json.mock.calls[0][0];
        const snap = quotation.items[0].productSnapshot;

        expect(snap.supplierCode).toBe(productFields.supplierCode);
        expect(snap.clientCode).toBe(productFields.clientCode);
        expect(snap.name).toBe(productFields.name);
        expect(snap.description).toBe(productFields.description);
        expect(snap.saleMode).toBe(productFields.saleMode);
        expect(snap.calculationMode).toBe(productFields.calculationMode);
        expect(snap.unitLabel).toBe(productFields.unitLabel);
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 5: cálculo de preço é consistente com calculateProductPrice ────

// Feature: quotations, Property 5: cálculo de preço é consistente com calculateProductPrice
test('Property 5 — unitPrice e subtotal do item são idênticos ao resultado de calculateProductPrice', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }), // unitPrice
      fc.integer({ min: 1, max: 10000 }),                // quantity
      async (unitPrice, quantity) => {
        jest.clearAllMocks();

        const expectedSubtotal = unitPrice * quantity;
        const product  = makeProduct('s1', unitPrice);
        const supplier = makeSupplier(0);

        Product.findById.mockResolvedValue(product);
        Supplier.findById.mockResolvedValue(supplier);
        // calculateProductPrice retorna o resultado esperado
        calculateProductPrice.mockReturnValue({ unitPrice, subtotal: expectedSubtotal });

        const req = {
          body: {
            adHocClient: { name: 'Avulso' },
            items: [{ productId: 'p1', quantity }],
            save: false,
          },
          user: { id: 'repId', profile: 'representante' },
        };
        const res = makeRes();

        await createQuotation(req, res);

        const { quotation } = res.json.mock.calls[0][0];
        const item = quotation.items[0];

        // O controller deve usar exatamente o que calculateProductPrice retornou
        expect(item.unitPrice).toBe(unitPrice);
        expect(item.subtotal).toBe(expectedSubtotal);
        expect(calculateProductPrice).toHaveBeenCalledWith(product, quantity);
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 6: currentOrderNumber nunca é incrementado ─────────────────────

// Feature: quotations, Property 6: currentOrderNumber do fornecedor nunca é incrementado
test('Property 6 — Supplier.findByIdAndUpdate nunca é chamado durante criação de orçamento', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(), // save: true ou false
      async (saveFlag) => {
        jest.clearAllMocks();

        const product  = makeProduct('s1', 10);
        const supplier = makeSupplier(5);

        Product.findById.mockResolvedValue(product);
        Supplier.findById.mockResolvedValue(supplier);
        calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });
        Quotation.create.mockResolvedValue({ _id: 'q1' });

        const req = {
          body: {
            adHocClient: { name: 'Avulso' },
            items: [{ productId: 'p1', quantity: 10 }],
            save: saveFlag,
          },
          user: { id: 'repId', profile: 'representante' },
        };
        const res = makeRes();

        await createQuotation(req, res);

        // Independente de save, findByIdAndUpdate nunca deve ser chamado
        expect(Supplier.findByIdAndUpdate).not.toHaveBeenCalled();
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 7: representativeId é sempre o usuário autenticado ─────────────

// Feature: quotations, Property 7: representativeId é sempre o usuário autenticado
test('Property 7 — representativeId no orçamento salvo é sempre o req.user.id', async () => {
  await fc.assert(
    fc.asyncProperty(
      // Gera IDs de usuário aleatórios (strings não vazias)
      fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
      async (userId) => {
        jest.clearAllMocks();

        const product  = makeProduct('s1', 10);
        const supplier = makeSupplier(0);

        Product.findById.mockResolvedValue(product);
        Supplier.findById.mockResolvedValue(supplier);
        calculateProductPrice.mockReturnValue({ unitPrice: 10, subtotal: 100 });

        let capturedRepresentativeId = null;
        Quotation.create.mockImplementation((data) => {
          capturedRepresentativeId = data.representativeId;
          return Promise.resolve({ _id: 'q1', ...data });
        });

        const req = {
          body: {
            adHocClient: { name: 'Avulso' },
            items: [{ productId: 'p1', quantity: 10 }],
            save: true,
          },
          user: { id: userId, profile: 'representante' },
        };
        const res = makeRes();

        await createQuotation(req, res);

        expect(capturedRepresentativeId).toBe(userId);
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 8: isolamento de acesso por representante ──────────────────────

// Feature: quotations, Property 8: isolamento de acesso por representante
test('Property 8 — representante A não pode acessar orçamento de representante B (HTTP 403)', async () => {
  await fc.assert(
    fc.asyncProperty(
      // Gera dois IDs distintos
      fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
      fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
      async (idA, idB) => {
        // Garante que os IDs são distintos
        fc.pre(idA !== idB);

        jest.clearAllMocks();

        // Orçamento pertence ao representante B
        Quotation.findById.mockResolvedValue({
          _id: 'q1',
          representativeId: { toString: () => idB },
        });

        // Representante A tenta acessar
        const req = {
          params: { id: 'q1' },
          user: { id: idA, profile: 'representante' },
        };
        const res = makeRes();

        await getQuotationById(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado' });
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 9: listagem filtra por representante autenticado ───────────────

// Feature: quotations, Property 9: listagem filtra por representante autenticado
test('Property 9 — getQuotations sempre filtra por representativeId para perfil representante', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
      async (userId) => {
        jest.clearAllMocks();

        const q = {
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        Quotation.find.mockReturnValue(q);
        Quotation.countDocuments.mockResolvedValue(0);

        const req = {
          query: {},
          user: { id: userId, profile: 'representante' },
        };
        const res = makeRes();

        await getQuotations(req, res);

        // O filtro passado ao Quotation.find deve conter representativeId = userId
        const filterArg = Quotation.find.mock.calls[0][0];
        expect(filterArg.representativeId).toBe(userId);
      },
    ),
    { numRuns: 100 },
  );
});

// ─── Property 10: filtro de produtos por cliente e fornecedor ────────────────

// Feature: quotations, Property 10: filtro de produtos por cliente e fornecedor
test('Property 10 — getClientProductsForQuotation filtra por clientId, active:true e supplierId quando fornecido', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0), // clientId
      fc.option(
        fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
        { nil: undefined },
      ), // supplierId opcional
      async (clientId, supplierId) => {
        jest.clearAllMocks();

        Client.findById.mockResolvedValue({ _id: clientId, name: 'Cliente' });

        const selectMock = jest.fn().mockResolvedValue([]);
        Product.find.mockReturnValue({ select: selectMock });

        const query = { clientId };
        if (supplierId !== undefined) query.supplierId = supplierId;

        const req = {
          query,
          user: { id: 'repId', profile: 'representante' },
        };
        const res = makeRes();

        await getClientProductsForQuotation(req, res);

        const filterArg = Product.find.mock.calls[0][0];

        // Sempre deve filtrar por clientId e active: true
        expect(filterArg.clientId).toBe(clientId);
        expect(filterArg.active).toBe(true);

        // Quando supplierId fornecido, deve estar no filtro
        if (supplierId !== undefined) {
          expect(filterArg.supplierId).toBe(supplierId);
        } else {
          expect(filterArg).not.toHaveProperty('supplierId');
        }
      },
    ),
    { numRuns: 100 },
  );
});
