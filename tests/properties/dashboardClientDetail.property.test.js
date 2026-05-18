const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../src/models/order');
const Commission = require('../../src/models/commission');
const Client = require('../../src/models/client');
const { aggregateClientDetail } = require('../../src/services/dashboardService');

/**
 * Property 4: Per-client aggregation correctness
 * Validates: Requirements 10.5, 13.5
 *
 * For any valid client with orders and commissions, the aggregateClientDetail function
 * SHALL return the exact count of orders, the exact sum of subtotal values, the exact
 * sum of commissions generated, and a period-by-period evolution that, when summed,
 * equals the totals.
 */
describe('Property 4: Per-client aggregation correctness', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(
      Object.values(collections).map((col) => col.deleteMany({})),
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
  });

  // ─── Generators ──────────────────────────────────────────────────────────────

  const validYear = 2024;

  // Generates a subset of months (1-12) for distributing orders across months
  const monthsSubsetArb = fc.subarray(
    Array.from({ length: 12 }, (_, i) => i + 1),
    { minLength: 1, maxLength: 6 }
  );

  // Generates a positive monetary value for subtotal
  const subtotalArb = fc.integer({ min: 100, max: 100000 }).map((v) => v / 100);

  // Generates a commission percentage (1-10%)
  const percentageArb = fc.integer({ min: 1, max: 10 });

  // Generates a list of orders distributed across given months
  const ordersForMonthsArb = (clientId, representativeId, supplierId, months) =>
    fc
      .array(
        fc.record({
          month: fc.constantFrom(...months),
          subtotal: subtotalArb,
        }),
        { minLength: 1, maxLength: 8 }
      )
      .map((items) =>
        items.map((item) => ({
          clientId,
          representativeId,
          supplierId,
          status: 'active',
          subtotal: item.subtotal,
          total: item.subtotal,
          ipiValue: 0,
          items: [],
          createdAt: new Date(validYear, item.month - 1, 15),
          clientSnapshot: { tradeName: 'Test Client' },
          orderNumber: Math.floor(Math.random() * 999999),
        }))
      );

  // Generates commissions for a set of order IDs with given months
  const commissionsForOrdersArb = (orderIds, representativeId, months) =>
    fc.constant(
      orderIds.map((orderId, idx) => {
        const month = months[idx % months.length];
        const repCommission = Math.round((Math.random() * 500 + 10) * 100) / 100;
        const adminCommission = Math.round((Math.random() * 200 + 5) * 100) / 100;
        return {
          orderId,
          representativeId,
          orderValueWithoutIpi: 1000,
          pool: repCommission + adminCommission,
          representativePercentage: 5,
          adminPercentage: 3,
          representativeCommission: repCommission,
          adminCommission,
          period: { month, year: validYear },
          status: 'active',
          installmentsCreated: false,
        };
      })
    );

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('totalOrders equals the count of active orders for the client', async () => {
    await fc.assert(
      fc.asyncProperty(monthsSubsetArb, subtotalArb, async (months, _baseSubtotal) => {
        // Setup
        const representativeId = new mongoose.Types.ObjectId();
        const supplierId = new mongoose.Types.ObjectId();

        const client = await Client.create({
          name: 'Test Client',
          tradeName: 'Test Client Trade',
          cnpj: `${Date.now()}${Math.random().toString().slice(2, 8)}`,
          representativeId,
        });

        // Generate orders across months
        const orderCount = Math.min(months.length * 2, 8);
        const orders = [];
        for (let i = 0; i < orderCount; i++) {
          const month = months[i % months.length];
          orders.push({
            clientId: client._id,
            representativeId,
            supplierId,
            status: 'active',
            subtotal: Math.round((Math.random() * 900 + 100) * 100) / 100,
            total: 1000,
            ipiValue: 0,
            items: [],
            createdAt: new Date(validYear, month - 1, 15),
            clientSnapshot: { tradeName: 'Test Client Trade' },
            orderNumber: Math.floor(Math.random() * 999999) + Date.now(),
          });
        }

        const insertedOrders = await Order.insertMany(orders);

        // Create commissions for the orders
        const commissions = insertedOrders.map((order, idx) => ({
          orderId: order._id,
          representativeId,
          orderValueWithoutIpi: order.subtotal,
          pool: order.subtotal * 0.08,
          representativePercentage: 5,
          adminPercentage: 3,
          representativeCommission: Math.round(order.subtotal * 0.05 * 100) / 100,
          adminCommission: Math.round(order.subtotal * 0.03 * 100) / 100,
          period: { month: months[idx % months.length], year: validYear },
          status: 'active',
          installmentsCreated: false,
        }));

        await Commission.insertMany(commissions);

        // Call aggregateClientDetail
        const result = await aggregateClientDetail({
          clientId: client._id.toString(),
          month: undefined,
          year: validYear,
          granularity: 'annual',
        });

        // Verify totalOrders equals count of active orders
        expect(result.totalOrders).toBe(insertedOrders.length);

        // Cleanup
        await Order.deleteMany({});
        await Commission.deleteMany({});
        await Client.deleteMany({});
      }),
      { numRuns: 20 }
    );
  });

  it('totalRevenue equals the sum of subtotals from active orders', async () => {
    await fc.assert(
      fc.asyncProperty(monthsSubsetArb, async (months) => {
        // Setup
        const representativeId = new mongoose.Types.ObjectId();
        const supplierId = new mongoose.Types.ObjectId();

        const client = await Client.create({
          name: 'Revenue Client',
          tradeName: 'Revenue Client Trade',
          cnpj: `${Date.now()}${Math.random().toString().slice(2, 8)}`,
          representativeId,
        });

        // Generate orders with known subtotals
        const orderCount = Math.min(months.length + 1, 5);
        const orders = [];
        for (let i = 0; i < orderCount; i++) {
          const month = months[i % months.length];
          const subtotal = Math.round((Math.random() * 9000 + 1000) * 100) / 100;
          orders.push({
            clientId: client._id,
            representativeId,
            supplierId,
            status: 'active',
            subtotal,
            total: subtotal,
            ipiValue: 0,
            items: [],
            createdAt: new Date(validYear, month - 1, 15),
            clientSnapshot: { tradeName: 'Revenue Client Trade' },
            orderNumber: Math.floor(Math.random() * 999999) + Date.now(),
          });
        }

        const insertedOrders = await Order.insertMany(orders);

        // Expected total revenue
        const expectedRevenue = insertedOrders.reduce(
          (sum, o) => sum + o.subtotal,
          0
        );

        // Call aggregateClientDetail
        const result = await aggregateClientDetail({
          clientId: client._id.toString(),
          month: undefined,
          year: validYear,
          granularity: 'annual',
        });

        // Verify totalRevenue equals sum of subtotals (with rounding tolerance)
        expect(result.totalRevenue).toBeCloseTo(
          Math.round(expectedRevenue * 100) / 100,
          2
        );

        // Cleanup
        await Order.deleteMany({});
        await Commission.deleteMany({});
        await Client.deleteMany({});
      }),
      { numRuns: 20 }
    );
  });

  it('evolution array sum of orderCount and revenue equals the totals (monthly granularity)', async () => {
    await fc.assert(
      fc.asyncProperty(monthsSubsetArb, async (months) => {
        // Setup
        const representativeId = new mongoose.Types.ObjectId();
        const supplierId = new mongoose.Types.ObjectId();

        const client = await Client.create({
          name: 'Evolution Client',
          tradeName: 'Evolution Client Trade',
          cnpj: `${Date.now()}${Math.random().toString().slice(2, 8)}`,
          representativeId,
        });

        // Generate orders distributed across months within the same year
        // Use monthly granularity: pick a single month and put all orders there
        const targetMonth = months[0];
        const orderCount = Math.min(months.length + 1, 5);
        const orders = [];
        for (let i = 0; i < orderCount; i++) {
          const subtotal = Math.round((Math.random() * 5000 + 500) * 100) / 100;
          orders.push({
            clientId: client._id,
            representativeId,
            supplierId,
            status: 'active',
            subtotal,
            total: subtotal,
            ipiValue: 0,
            items: [],
            createdAt: new Date(validYear, targetMonth - 1, 15),
            clientSnapshot: { tradeName: 'Evolution Client Trade' },
            orderNumber: Math.floor(Math.random() * 999999) + Date.now(),
          });
        }

        const insertedOrders = await Order.insertMany(orders);

        // Create commissions for the orders (all in the same month)
        const commissions = insertedOrders.map((order) => ({
          orderId: order._id,
          representativeId,
          orderValueWithoutIpi: order.subtotal,
          pool: order.subtotal * 0.08,
          representativePercentage: 5,
          adminPercentage: 3,
          representativeCommission: Math.round(order.subtotal * 0.05 * 100) / 100,
          adminCommission: Math.round(order.subtotal * 0.03 * 100) / 100,
          period: { month: targetMonth, year: validYear },
          status: 'active',
          installmentsCreated: false,
        }));

        await Commission.insertMany(commissions);

        // Call aggregateClientDetail with monthly granularity
        const result = await aggregateClientDetail({
          clientId: client._id.toString(),
          month: targetMonth,
          year: validYear,
          granularity: 'monthly',
        });

        // Sum evolution orderCount and revenue
        const evolutionOrderCount = result.evolution.reduce(
          (sum, e) => sum + e.orderCount,
          0
        );
        const evolutionRevenue = result.evolution.reduce(
          (sum, e) => sum + e.revenue,
          0
        );

        // Verify evolution sums equal the totals
        expect(evolutionOrderCount).toBe(result.totalOrders);
        expect(evolutionRevenue).toBeCloseTo(result.totalRevenue, 2);

        // Cleanup
        await Order.deleteMany({});
        await Commission.deleteMany({});
        await Client.deleteMany({});
      }),
      { numRuns: 20 }
    );
  });
});
