const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../src/models/order');
const Commission = require('../../src/models/commission');
const { aggregateClientsRevenue } = require('../../src/services/dashboardService');

/**
 * Property 1: Clients-revenue aggregation excludes cancelled orders
 * Validates: Requirements 2.1, 2.2, 6.1, 13.1, 13.4
 *
 * For any set of orders with mixed statuses (active/cancelled) and multiple clients,
 * aggregateClientsRevenue SHALL return only the sum of subtotal values from orders
 * with status "active", grouped by client, sorted in descending order by totalRevenue,
 * and limited to the specified maximum (20).
 */
describe('Property 1: Clients-revenue aggregation excludes cancelled orders', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Commission.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
  });

  // ─── Generators ──────────────────────────────────────────────────────────────

  // Generates a valid ObjectId
  const objectIdArb = fc.hexaString({ minLength: 24, maxLength: 24 }).map(
    (hex) => new mongoose.Types.ObjectId(hex)
  );

  // Generates a positive monetary value for subtotal
  const subtotalArb = fc.double({
    min: 0.01,
    max: 99999.99,
    noNaN: true,
    noDefaultInfinity: true,
  }).map((v) => Math.round(v * 100) / 100);

  // Generates a valid status (active or cancelled)
  const statusArb = fc.constantFrom('active', 'cancelled');

  // Fixed month/year for period filtering
  const FIXED_MONTH = 6;
  const FIXED_YEAR = 2024;

  // Generates a createdAt date within the fixed period (June 2024)
  const createdAtArb = fc.integer({ min: 1, max: 28 }).map(
    (day) => new Date(FIXED_YEAR, FIXED_MONTH - 1, day, 12, 0, 0)
  );

  // Fixed representativeId and supplierId for all orders
  const FIXED_REPRESENTATIVE_ID = new mongoose.Types.ObjectId();
  const FIXED_SUPPLIER_ID = new mongoose.Types.ObjectId();

  // Generates a single order document (without orderNumber — assigned later)
  const orderArb = (clientId) =>
    fc.record({
      status: statusArb,
      subtotal: subtotalArb,
      createdAt: createdAtArb,
    }).map((fields) => ({
      clientId,
      representativeId: FIXED_REPRESENTATIVE_ID,
      supplierId: FIXED_SUPPLIER_ID,
      clientSnapshot: { tradeName: `Client_${clientId.toString().slice(0, 6)}` },
      items: [],
      ipiValue: 0,
      total: fields.subtotal,
      ...fields,
    }));

  // Generates a list of orders for multiple clients (2-5 clients, 1-5 orders each)
  const ordersForMultipleClientsArb = fc
    .integer({ min: 2, max: 5 })
    .chain((numClients) => {
      const clientIds = Array.from({ length: numClients }, () => new mongoose.Types.ObjectId());
      return fc.tuple(
        ...clientIds.map((clientId) =>
          fc.array(orderArb(clientId), { minLength: 1, maxLength: 5 })
        )
      ).map((orderArrays) => ({
        clientIds,
        orders: orderArrays.flat(),
      }));
    });

  // Admin user for testing (sees all data)
  const adminUser = { _id: FIXED_REPRESENTATIVE_ID, profile: 'admin' };

  /**
   * Helper: assigns unique orderNumbers to orders and inserts them into DB.
   * Also creates corresponding commissions for each order (required by the aggregation).
   */
  let globalOrderCounter = 0;
  async function insertOrders(orders) {
    const ordersWithNumbers = orders.map((order) => ({
      ...order,
      orderNumber: ++globalOrderCounter,
    }));
    const inserted = await Order.insertMany(ordersWithNumbers);

    // Create commissions for each order (aggregateClientsRevenue uses commissions to find orders)
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

    return ordersWithNumbers;
  }

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('only includes orders with status "active" in revenue sums', async () => {
    await fc.assert(
      fc.asyncProperty(ordersForMultipleClientsArb, async ({ clientIds, orders }) => {
        // Clean and insert orders
        await Order.deleteMany({});
        await insertOrders(orders);

        // Call the aggregation function
        const result = await aggregateClientsRevenue({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          user: adminUser,
          limit: 20,
        });

        // Compute expected revenue per client (only active orders)
        const expectedByClient = new Map();
        for (const order of orders) {
          if (order.status === 'active') {
            const key = order.clientId.toString();
            expectedByClient.set(key, (expectedByClient.get(key) || 0) + order.subtotal);
          }
        }

        // Verify: each result entry matches expected active-only sum
        for (const entry of result) {
          const expectedRevenue = expectedByClient.get(entry.clientId.toString()) || 0;
          expect(entry.totalRevenue).toBeCloseTo(expectedRevenue, 1);
        }

        // Verify: no client with only cancelled orders appears in results
        for (const clientId of clientIds) {
          const hasActiveOrders = orders.some(
            (o) => o.clientId.toString() === clientId.toString() && o.status === 'active'
          );
          const inResult = result.some(
            (r) => r.clientId.toString() === clientId.toString()
          );
          if (!hasActiveOrders) {
            expect(inResult).toBe(false);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it('results are sorted in descending order by totalRevenue', async () => {
    await fc.assert(
      fc.asyncProperty(ordersForMultipleClientsArb, async ({ orders }) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const result = await aggregateClientsRevenue({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          user: adminUser,
          limit: 20,
        });

        // Verify descending order
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].totalRevenue).toBeGreaterThanOrEqual(result[i].totalRevenue);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('respects the limit of 20 clients maximum', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate more than 20 clients to test limit
        fc.integer({ min: 21, max: 25 }).chain((numClients) => {
          const clientIds = Array.from({ length: numClients }, () => new mongoose.Types.ObjectId());
          return fc.tuple(
            ...clientIds.map((clientId) =>
              orderArb(clientId).map((order) => ({ ...order, status: 'active' }))
            )
          ).map((orderArray) => ({
            clientIds,
            orders: orderArray,
          }));
        }),
        async ({ orders }) => {
          await Order.deleteMany({});
          await insertOrders(orders);

          const result = await aggregateClientsRevenue({
            month: FIXED_MONTH,
            year: FIXED_YEAR,
            user: adminUser,
            limit: 20,
          });

          // Verify limit is respected
          expect(result.length).toBeLessThanOrEqual(20);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('total revenue per client equals exact sum of active order subtotals', async () => {
    await fc.assert(
      fc.asyncProperty(ordersForMultipleClientsArb, async ({ orders }) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const result = await aggregateClientsRevenue({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          user: adminUser,
          limit: 20,
        });

        // Compute expected totals manually
        const expectedByClient = new Map();
        for (const order of orders) {
          if (order.status === 'active') {
            const key = order.clientId.toString();
            expectedByClient.set(key, (expectedByClient.get(key) || 0) + order.subtotal);
          }
        }

        // Total revenue in result should equal total of all active orders
        const resultTotal = result.reduce((sum, r) => sum + r.totalRevenue, 0);
        const expectedTotal = [...expectedByClient.values()].reduce((sum, v) => sum + v, 0);

        // If limit is not exceeded, totals should match
        if (expectedByClient.size <= 20) {
          expect(resultTotal).toBeCloseTo(expectedTotal, 1);
        }
      }),
      { numRuns: 20 }
    );
  });
});
