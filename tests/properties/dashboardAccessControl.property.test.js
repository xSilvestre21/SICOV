const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../src/models/order');
const Commission = require('../../src/models/commission');
const {
  aggregateClientsRevenue,
  aggregateTopClients,
  aggregateCancelledOrders,
} = require('../../src/services/dashboardService');

/**
 * Property 6: Representative access control filtering
 * Validates: Requirements 10.8, 12.1, 12.2, 12.5, 12.6, 13.8
 *
 * For any authenticated user with profile "representative", ALL dashboard endpoints
 * SHALL return only data associated with orders where representativeId matches the
 * authenticated user's ID. No data belonging to other representatives SHALL ever be
 * included in the response.
 */
describe('Property 6: Representative access control filtering', () => {
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
    (hex) => new mongoose.Types.ObjectId(hex),
  );

  // Generates a positive monetary value for subtotal
  const subtotalArb = fc
    .double({
      min: 0.01,
      max: 99999.99,
      noNaN: true,
      noDefaultInfinity: true,
    })
    .map((v) => Math.round(v * 100) / 100);

  // Fixed month/year for period filtering
  const FIXED_MONTH = 6;
  const FIXED_YEAR = 2024;

  // Generates a createdAt date within the fixed period (June 2024)
  const createdAtArb = fc
    .integer({ min: 1, max: 28 })
    .map((day) => new Date(FIXED_YEAR, FIXED_MONTH - 1, day, 12, 0, 0));

  // Fixed supplierId for all orders
  const FIXED_SUPPLIER_ID = new mongoose.Types.ObjectId();

  // Generates a single order for a given representative and client
  const orderArb = (representativeId, clientId) =>
    fc
      .record({
        status: fc.constantFrom('active', 'cancelled'),
        subtotal: subtotalArb,
        createdAt: createdAtArb,
      })
      .map((fields) => ({
        clientId,
        representativeId,
        supplierId: FIXED_SUPPLIER_ID,
        clientSnapshot: { tradeName: `Client_${clientId.toString().slice(0, 6)}` },
        items: [],
        ipiValue: 0,
        total: fields.subtotal,
        ...fields,
      }));

  /**
   * Generates orders for 2-4 representatives, each with 1-3 clients and 1-4 orders per client.
   * Returns { repIds, orders } where repIds[0] is the "target" representative.
   */
  const ordersForMultipleRepsArb = fc
    .integer({ min: 2, max: 4 })
    .chain((numReps) => {
      const repIds = Array.from({ length: numReps }, () => new mongoose.Types.ObjectId());
      // Each representative gets 1-3 clients with 1-4 orders each
      const repOrderArbs = repIds.map((repId) =>
        fc.integer({ min: 1, max: 3 }).chain((numClients) => {
          const clientIds = Array.from(
            { length: numClients },
            () => new mongoose.Types.ObjectId(),
          );
          return fc
            .tuple(
              ...clientIds.map((clientId) =>
                fc.array(orderArb(repId, clientId), { minLength: 1, maxLength: 4 }),
              ),
            )
            .map((arrays) => arrays.flat());
        }),
      );
      return fc.tuple(...repOrderArbs).map((orderArrays) => ({
        repIds,
        orders: orderArrays.flat(),
      }));
    });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  let globalOrderCounter = 0;
  async function insertOrders(orders) {
    const ordersWithNumbers = orders.map((order) => ({
      ...order,
      orderNumber: ++globalOrderCounter,
    }));
    const inserted = await Order.insertMany(ordersWithNumbers);

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

    return ordersWithNumbers;
  }

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('aggregateClientsRevenue returns only data for the authenticated representative', async () => {
    await fc.assert(
      fc.asyncProperty(ordersForMultipleRepsArb, async ({ repIds, orders }) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const repA = repIds[0];
        const user = { _id: repA, profile: 'representative' };

        const result = await aggregateClientsRevenue({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          user,
          limit: 20,
        });

        // Get all clientIds that belong to representative A (active orders only)
        const repAClientIds = new Set(
          orders
            .filter(
              (o) =>
                o.representativeId.toString() === repA.toString() && o.status === 'active',
            )
            .map((o) => o.clientId.toString()),
        );

        // Get all clientIds that belong to OTHER representatives
        const otherRepClientIds = new Set(
          orders
            .filter((o) => o.representativeId.toString() !== repA.toString())
            .map((o) => o.clientId.toString()),
        );

        // ALL returned data must belong to representative A's clients
        for (const entry of result) {
          expect(repAClientIds.has(entry.clientId.toString())).toBe(true);
        }

        // NO data from other representatives' exclusive clients should appear
        for (const entry of result) {
          // If a client only belongs to other reps, it should not appear
          const clientId = entry.clientId.toString();
          const belongsToRepA = repAClientIds.has(clientId);
          expect(belongsToRepA).toBe(true);
        }

        // Verify revenue values only include rep A's orders
        for (const entry of result) {
          const expectedRevenue = orders
            .filter(
              (o) =>
                o.clientId.toString() === entry.clientId.toString() &&
                o.representativeId.toString() === repA.toString() &&
                o.status === 'active',
            )
            .reduce((sum, o) => sum + o.subtotal, 0);
          expect(entry.totalRevenue).toBeCloseTo(expectedRevenue, 1);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('aggregateTopClients returns only data for the specified representative', async () => {
    await fc.assert(
      fc.asyncProperty(ordersForMultipleRepsArb, async ({ repIds, orders }) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const repA = repIds[0];

        const result = await aggregateTopClients({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          representativeId: repA,
          limit: 10,
        });

        // Get all clientIds that belong to representative A (active orders only)
        const repAClientIds = new Set(
          orders
            .filter(
              (o) =>
                o.representativeId.toString() === repA.toString() && o.status === 'active',
            )
            .map((o) => o.clientId.toString()),
        );

        // ALL returned clients must belong to representative A
        for (const entry of result) {
          expect(repAClientIds.has(entry.clientId.toString())).toBe(true);
        }

        // Verify revenue values only include rep A's active orders
        for (const entry of result) {
          const expectedRevenue = orders
            .filter(
              (o) =>
                o.clientId.toString() === entry.clientId.toString() &&
                o.representativeId.toString() === repA.toString() &&
                o.status === 'active',
            )
            .reduce((sum, o) => sum + o.subtotal, 0);
          expect(entry.totalRevenue).toBeCloseTo(expectedRevenue, 1);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('aggregateCancelledOrders returns only data for the specified representative', async () => {
    await fc.assert(
      fc.asyncProperty(ordersForMultipleRepsArb, async ({ repIds, orders }) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const repA = repIds[0];

        const result = await aggregateCancelledOrders({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          groupBy: 'period',
          representativeId: repA,
        });

        // Count expected cancelled orders for rep A
        const repACancelled = orders.filter(
          (o) =>
            o.representativeId.toString() === repA.toString() && o.status === 'cancelled',
        );
        const expectedCancelledCount = repACancelled.length;
        const expectedCancelledValue = repACancelled.reduce((sum, o) => sum + o.subtotal, 0);

        // Total orders for rep A (for rate calculation)
        const repATotalOrders = orders.filter(
          (o) => o.representativeId.toString() === repA.toString(),
        ).length;

        // Verify cancelled count matches only rep A's cancelled orders
        expect(result.cancelledCount).toBe(expectedCancelledCount);

        // Verify cancelled value matches only rep A's cancelled orders
        expect(result.cancelledValue).toBeCloseTo(expectedCancelledValue, 1);

        // Verify cancellation rate is based on rep A's total orders
        const expectedRate =
          repATotalOrders > 0
            ? Math.round((expectedCancelledCount / repATotalOrders) * 1000) / 10
            : 0;
        expect(result.cancellationRate).toBeCloseTo(expectedRate, 1);
      }),
      { numRuns: 20 },
    );
  });

  it('no data from other representatives is ever included in any endpoint', async () => {
    await fc.assert(
      fc.asyncProperty(ordersForMultipleRepsArb, async ({ repIds, orders }) => {
        await Order.deleteMany({});
        await insertOrders(orders);

        const repA = repIds[0];
        const otherRepIds = repIds.slice(1).map((id) => id.toString());

        // Test aggregateClientsRevenue
        const user = { _id: repA, profile: 'representative' };
        const revenueResult = await aggregateClientsRevenue({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          user,
          limit: 20,
        });

        // Collect clientIds that ONLY belong to other reps (not shared with rep A)
        const repAClientIds = new Set(
          orders
            .filter((o) => o.representativeId.toString() === repA.toString())
            .map((o) => o.clientId.toString()),
        );

        const exclusiveOtherClientIds = new Set(
          orders
            .filter(
              (o) =>
                otherRepIds.includes(o.representativeId.toString()) &&
                !repAClientIds.has(o.clientId.toString()),
            )
            .map((o) => o.clientId.toString()),
        );

        // None of the exclusive other-rep clients should appear in results
        for (const entry of revenueResult) {
          expect(exclusiveOtherClientIds.has(entry.clientId.toString())).toBe(false);
        }

        // Test aggregateTopClients
        const topResult = await aggregateTopClients({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          representativeId: repA,
          limit: 10,
        });

        for (const entry of topResult) {
          expect(exclusiveOtherClientIds.has(entry.clientId.toString())).toBe(false);
        }

        // Test aggregateCancelledOrders - verify count doesn't include other reps
        const cancelledResult = await aggregateCancelledOrders({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          groupBy: 'period',
          representativeId: repA,
        });

        const otherRepCancelledCount = orders.filter(
          (o) =>
            otherRepIds.includes(o.representativeId.toString()) &&
            o.status === 'cancelled',
        ).length;

        // If other reps have cancelled orders, the total should NOT include them
        const repACancelledCount = orders.filter(
          (o) =>
            o.representativeId.toString() === repA.toString() && o.status === 'cancelled',
        ).length;

        expect(cancelledResult.cancelledCount).toBe(repACancelledCount);
      }),
      { numRuns: 20 },
    );
  });
});
