const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../src/models/order');
const {
  aggregateClientsRevenue,
  aggregateCancelledOrders,
} = require('../../src/services/dashboardService');

/**
 * Property 9: Default period parameters
 * Validates: Requirements 13.7
 *
 * For any request to any dashboard endpoint that omits the month and year query parameters,
 * the endpoint SHALL behave identically to a request with month set to the current server month
 * and year set to the current server year.
 */
describe('Property 9: Default period parameters', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(
      Object.values(collections).map((col) => col.deleteMany({}))
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
  });

  // ─── Generators ──────────────────────────────────────────────────────────────

  const objectIdArb = fc.hexaString({ minLength: 24, maxLength: 24 }).map(
    (hex) => new mongoose.Types.ObjectId(hex)
  );

  const statusArb = fc.constantFrom('active', 'cancelled');

  const subtotalArb = fc.double({
    min: 0.01,
    max: 99999.99,
    noNaN: true,
    noDefaultInfinity: true,
  }).map((v) => Math.round(v * 100) / 100);

  // Use current month/year so orders fall within the default period
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Generate a date within the current month/year
  const dateInCurrentMonthArb = fc.integer({ min: 1, max: 28 }).map(
    (day) => new Date(currentYear, currentMonth - 1, day, 12, 0, 0)
  );

  // Generate a single order within the current month
  const orderArb = fc.record({
    clientId: objectIdArb,
    supplierId: objectIdArb,
    representativeId: objectIdArb,
    status: statusArb,
    subtotal: subtotalArb,
    createdAt: dateInCurrentMonthArb,
  });

  // Generate a list of orders (at least 1)
  const ordersArb = fc.array(orderArb, { minLength: 1, maxLength: 20 });

  // ─── Helper ──────────────────────────────────────────────────────────────────

  let orderNumberCounter = 1;

  async function insertOrders(orders) {
    const docs = orders.map((o) => ({
      orderNumber: orderNumberCounter++,
      clientId: o.clientId,
      supplierId: o.supplierId,
      representativeId: o.representativeId,
      status: o.status,
      subtotal: o.subtotal,
      total: o.subtotal,
      ipiValue: 0,
      items: [],
      createdAt: o.createdAt,
      clientSnapshot: { tradeName: 'Test Client' },
      supplierSnapshot: { tradeName: 'Test Supplier' },
    }));
    await Order.insertMany(docs);
  }

  const adminUser = { _id: new mongoose.Types.ObjectId(), profile: 'admin' };

  // Helper to normalize array results for comparison (sort by clientId to avoid non-deterministic order)
  function sortByClientId(arr) {
    return [...arr].sort((a, b) => String(a.clientId).localeCompare(String(b.clientId)));
  }

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('aggregateClientsRevenue without month/year returns same result as with explicit current month/year', async () => {
    await fc.assert(
      fc.asyncProperty(ordersArb, async (orders) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        // Call without month/year (should default to current month/year)
        const resultWithoutParams = await aggregateClientsRevenue({
          user: adminUser,
        });

        // Call with explicit current month/year
        const resultWithParams = await aggregateClientsRevenue({
          month: currentMonth,
          year: currentYear,
          user: adminUser,
        });

        // Sort by clientId to avoid non-deterministic ordering when revenues are equal
        expect(sortByClientId(resultWithoutParams)).toEqual(sortByClientId(resultWithParams));
      }),
      { numRuns: 20 }
    );
  });

  it('aggregateCancelledOrders without month/year returns same result as with explicit current month/year', async () => {
    await fc.assert(
      fc.asyncProperty(ordersArb, async (orders) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        // Call without month/year (should default to current month/year)
        const resultWithoutParams = await aggregateCancelledOrders({});

        // Call with explicit current month/year
        const resultWithParams = await aggregateCancelledOrders({
          month: currentMonth,
          year: currentYear,
        });

        expect(resultWithoutParams).toEqual(resultWithParams);
      }),
      { numRuns: 20 }
    );
  });
});
