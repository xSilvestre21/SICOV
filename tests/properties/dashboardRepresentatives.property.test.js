const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../src/models/order');
const Commission = require('../../src/models/commission');
const User = require('../../src/models/user');
const {
  aggregateRepresentativesPerformance,
} = require('../../src/services/dashboardService');

/**
 * Property 3: Representatives-performance aggregation correctness
 * Validates: Requirements 5.1, 5.2, 13.3
 *
 * For any set of active orders and their associated commissions within a given period,
 * the aggregateRepresentativesPerformance function SHALL return, for each representative,
 * the exact count of active orders, the exact sum of subtotal values, and the exact sum
 * of representativeCommission values. Results are sorted by totalSold descending.
 */
describe('Property 3: Representatives-performance aggregation correctness', () => {
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

  // Fixed period for all tests to ensure consistent filtering
  const TEST_MONTH = 6;
  const TEST_YEAR = 2024;

  // Generates a positive monetary value for subtotals
  const subtotalArb = fc.double({
    min: 10,
    max: 100000,
    noNaN: true,
    noDefaultInfinity: true,
  }).map((v) => Math.round(v * 100) / 100);

  // Generates a positive monetary value for commissions
  const commissionValueArb = fc.double({
    min: 1,
    max: 5000,
    noNaN: true,
    noDefaultInfinity: true,
  }).map((v) => Math.round(v * 100) / 100);

  // Generates the number of representatives (2-5)
  const repCountArb = fc.integer({ min: 2, max: 5 });

  // Generates the number of orders per representative (1-4)
  const ordersPerRepArb = fc.integer({ min: 1, max: 4 });

  // Generates a test scenario with multiple representatives, their orders and commissions
  const scenarioArb = repCountArb.chain((repCount) =>
    fc
      .tuple(
        // For each representative, generate a number of orders
        fc.array(ordersPerRepArb, { minLength: repCount, maxLength: repCount }),
        // For each representative's orders, generate subtotals
        fc.array(
          fc.array(subtotalArb, { minLength: 1, maxLength: 4 }),
          { minLength: repCount, maxLength: repCount },
        ),
        // For each representative's orders, generate commission values
        fc.array(
          fc.array(commissionValueArb, { minLength: 1, maxLength: 4 }),
          { minLength: repCount, maxLength: repCount },
        ),
      )
      .map(([orderCounts, subtotalArrays, commissionArrays]) => {
        // Ensure subtotal and commission arrays match order counts
        const reps = [];
        for (let i = 0; i < repCount; i++) {
          const numOrders = orderCounts[i];
          const subtotals = subtotalArrays[i].slice(0, numOrders);
          const commissions = commissionArrays[i].slice(0, numOrders);
          // Pad if needed
          while (subtotals.length < numOrders) subtotals.push(subtotalArrays[i][0]);
          while (commissions.length < numOrders) commissions.push(commissionArrays[i][0]);
          reps.push({ subtotals, commissions });
        }
        return reps;
      }),
  );

  // ─── Helper: Insert test data ────────────────────────────────────────────────

  async function insertTestData(repsData) {
    const representativeIds = [];
    const allOrders = [];
    const allCommissions = [];

    // Create users (representatives)
    for (let i = 0; i < repsData.length; i++) {
      const user = await User.create({
        name: `Representative ${i + 1}`,
        email: `rep${i + 1}_${Date.now()}_${i}@test.com`,
        password: 'hashedpassword123',
        profile: 'representative',
        active: true,
      });
      representativeIds.push(user._id);
    }

    // Create a shared clientId and supplierId for orders
    const clientId = new mongoose.Types.ObjectId();
    const supplierId = new mongoose.Types.ObjectId();

    // Create orders and commissions for each representative
    for (let repIdx = 0; repIdx < repsData.length; repIdx++) {
      const repId = representativeIds[repIdx];
      const { subtotals, commissions } = repsData[repIdx];

      for (let orderIdx = 0; orderIdx < subtotals.length; orderIdx++) {
        // Create order within the test period
        const orderDate = new Date(TEST_YEAR, TEST_MONTH - 1, 15);
        const order = await Order.create({
          orderNumber: repIdx * 100 + orderIdx + 1,
          clientId,
          supplierId,
          representativeId: repId,
          subtotal: subtotals[orderIdx],
          ipiValue: 0,
          total: subtotals[orderIdx],
          status: 'active',
          items: [
            {
              productId: new mongoose.Types.ObjectId(),
              quantity: 1,
              unitPrice: subtotals[orderIdx],
              subtotal: subtotals[orderIdx],
            },
          ],
          clientSnapshot: { tradeName: `Client Test` },
          supplierSnapshot: { name: 'Supplier Test' },
          createdAt: orderDate,
        });
        allOrders.push(order);

        // Create commission for this order
        const commission = await Commission.create({
          orderId: order._id,
          representativeId: repId,
          orderValueWithoutIpi: subtotals[orderIdx],
          pool: commissions[orderIdx] * 2,
          representativePercentage: 50,
          adminPercentage: 5,
          representativeCommission: commissions[orderIdx],
          adminCommission: commissions[orderIdx] * 0.5,
          period: { month: TEST_MONTH, year: TEST_YEAR },
          status: 'active',
          installmentsCreated: false,
        });
        allCommissions.push(commission);
      }
    }

    return { representativeIds, allOrders, allCommissions };
  }

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('returns correct orderCount for each representative', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (repsData) => {
        // Clean DB before each iteration
        await Order.deleteMany({});
        await Commission.deleteMany({});
        await User.deleteMany({});

        const { representativeIds } = await insertTestData(repsData);

        const result = await aggregateRepresentativesPerformance({
          month: TEST_MONTH,
          year: TEST_YEAR,
        });

        // Verify each representative's orderCount
        for (let i = 0; i < repsData.length; i++) {
          const repResult = result.find(
            (r) => r.representativeId.toString() === representativeIds[i].toString(),
          );
          expect(repResult).toBeDefined();
          expect(repResult.orderCount).toBe(repsData[i].subtotals.length);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('returns correct totalSold (sum of subtotals) for each representative', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (repsData) => {
        await Order.deleteMany({});
        await Commission.deleteMany({});
        await User.deleteMany({});

        const { representativeIds } = await insertTestData(repsData);

        const result = await aggregateRepresentativesPerformance({
          month: TEST_MONTH,
          year: TEST_YEAR,
        });

        for (let i = 0; i < repsData.length; i++) {
          const repResult = result.find(
            (r) => r.representativeId.toString() === representativeIds[i].toString(),
          );
          expect(repResult).toBeDefined();

          const expectedTotalSold =
            Math.round(
              repsData[i].subtotals.reduce((sum, s) => sum + s, 0) * 100,
            ) / 100;
          expect(repResult.totalSold).toBeCloseTo(expectedTotalSold, 1);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('returns correct totalCommission (sum of representativeCommission) for each representative', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (repsData) => {
        await Order.deleteMany({});
        await Commission.deleteMany({});
        await User.deleteMany({});

        const { representativeIds } = await insertTestData(repsData);

        const result = await aggregateRepresentativesPerformance({
          month: TEST_MONTH,
          year: TEST_YEAR,
        });

        for (let i = 0; i < repsData.length; i++) {
          const repResult = result.find(
            (r) => r.representativeId.toString() === representativeIds[i].toString(),
          );
          expect(repResult).toBeDefined();

          const expectedTotalCommission =
            Math.round(
              repsData[i].commissions.reduce((sum, c) => sum + c, 0) * 100,
            ) / 100;
          expect(repResult.totalCommission).toBeCloseTo(expectedTotalCommission, 1);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('results are sorted by totalSold in descending order', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (repsData) => {
        await Order.deleteMany({});
        await Commission.deleteMany({});
        await User.deleteMany({});

        await insertTestData(repsData);

        const result = await aggregateRepresentativesPerformance({
          month: TEST_MONTH,
          year: TEST_YEAR,
        });

        // Verify descending order by totalSold
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].totalSold).toBeGreaterThanOrEqual(result[i].totalSold);
        }
      }),
      { numRuns: 20 },
    );
  });
});
