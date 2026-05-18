const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../src/models/order');
const Commission = require('../../src/models/commission');
const { aggregateCancelledOrders } = require('../../src/services/dashboardService');

/**
 * Property 5: Cancelled-orders metrics correctness
 * Validates: Requirements 11.1, 11.3, 13.6
 *
 * For any set of orders with mixed statuses within a period, the aggregateCancelledOrders
 * function SHALL return a cancelledCount equal to the number of orders with status "cancelled",
 * a cancelledValue equal to the sum of their subtotal values, and a cancellationRate equal to
 * (cancelledCount / totalOrders) × 100 rounded to 1 decimal place.
 */
describe('Property 5: Cancelled-orders metrics correctness', () => {
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

  // Fixed month/year for all orders in a test run to ensure they fall within the same period filter
  const FIXED_MONTH = 6;
  const FIXED_YEAR = 2024;

  // Generate a date within the fixed month/year
  const dateInPeriodArb = fc.integer({ min: 1, max: 28 }).map(
    (day) => new Date(FIXED_YEAR, FIXED_MONTH - 1, day, 12, 0, 0)
  );

  // Generate a single order with mixed status
  const orderArb = fc.record({
    clientId: objectIdArb,
    supplierId: objectIdArb,
    representativeId: objectIdArb,
    status: statusArb,
    subtotal: subtotalArb,
    createdAt: dateInPeriodArb,
  });

  // Generate a list of orders (at least 1 to avoid division by zero edge case)
  const ordersArb = fc.array(orderArb, { minLength: 1, maxLength: 30 });

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
    const inserted = await Order.insertMany(docs);

    // Create commissions for each order (dashboard service uses commissions to find orders)
    const commissions = inserted.map((order) => ({
      orderId: order._id,
      representativeId: order.representativeId,
      orderValueWithoutIpi: order.subtotal,
      orderNumber: order.orderNumber,
      pool: order.subtotal * 0.05,
      representativePercentage: 50,
      adminPercentage: 5,
      representativeCommission: order.subtotal * 0.05 * 0.5,
      adminCommission: order.subtotal * 0.05 * 0.5,
      period: { month: FIXED_MONTH, year: FIXED_YEAR },
      status: order.status === 'cancelled' ? 'cancelled' : 'active',
      projected: false,
    }));
    await Commission.insertMany(commissions);
  }

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('cancelledCount equals the number of orders with status cancelled', async () => {
    await fc.assert(
      fc.asyncProperty(ordersArb, async (orders) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const result = await aggregateCancelledOrders({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
        });

        const expectedCancelledCount = orders.filter(
          (o) => o.status === 'cancelled'
        ).length;

        expect(result.cancelledCount).toBe(expectedCancelledCount);
      }),
      { numRuns: 20 }
    );
  });

  it('cancelledValue equals the sum of subtotals of cancelled orders', async () => {
    await fc.assert(
      fc.asyncProperty(ordersArb, async (orders) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const result = await aggregateCancelledOrders({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
        });

        const expectedCancelledValue = orders
          .filter((o) => o.status === 'cancelled')
          .reduce((sum, o) => sum + o.subtotal, 0);

        expect(result.cancelledValue).toBeCloseTo(expectedCancelledValue, 1);
      }),
      { numRuns: 20 }
    );
  });

  it('cancellationRate equals (cancelledCount / totalOrders) * 100 rounded to 1 decimal', async () => {
    await fc.assert(
      fc.asyncProperty(ordersArb, async (orders) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const result = await aggregateCancelledOrders({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
        });

        const totalOrders = orders.length;
        const cancelledCount = orders.filter(
          (o) => o.status === 'cancelled'
        ).length;

        const expectedRate =
          totalOrders > 0
            ? Math.round((cancelledCount / totalOrders) * 1000) / 10
            : 0;

        expect(result.cancellationRate).toBeCloseTo(expectedRate, 5);
      }),
      { numRuns: 20 }
    );
  });
});
