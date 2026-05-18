const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Commission = require('../../src/models/commission');
const { aggregateCommissionsOverview } = require('../../src/services/dashboardService');

/**
 * Property 8: Cancelled commissions excluded from all aggregations
 * Validates: Requirements 13.9
 *
 * For any set of commissions with mixed statuses (active/cancelled),
 * ALL dashboard endpoints that aggregate commission data SHALL exclude
 * commissions with status "cancelled" from their calculations.
 * Only commissions with status "active" (and not marked as installmentsCreated: true)
 * SHALL be included.
 */
describe('Property 8: Cancelled commissions excluded from all aggregations', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    await Commission.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
  });

  // ─── Generators ──────────────────────────────────────────────────────────────

  const objectIdArb = fc
    .hexaString({ minLength: 24, maxLength: 24 })
    .map((hex) => new mongoose.Types.ObjectId(hex));

  // Generates a positive monetary value
  const monetaryArb = fc
    .double({ min: 0.01, max: 99999.99, noNaN: true, noDefaultInfinity: true })
    .map((v) => Math.round(v * 100) / 100);

  // Generates a percentage value (0-100)
  const percentageArb = fc
    .double({ min: 0.01, max: 50, noNaN: true, noDefaultInfinity: true })
    .map((v) => Math.round(v * 100) / 100);

  // Fixed period for testing
  const FIXED_MONTH = 6;
  const FIXED_YEAR = 2024;

  // Fixed IDs
  const FIXED_REPRESENTATIVE_ID = new mongoose.Types.ObjectId();
  const FIXED_ORDER_ID = new mongoose.Types.ObjectId();

  // Generates a commission with a specific status
  const commissionWithStatusArb = (status) =>
    fc
      .record({
        adminCommission: monetaryArb,
        representativeCommission: monetaryArb,
        orderValueWithoutIpi: monetaryArb,
        pool: monetaryArb,
        representativePercentage: percentageArb,
        adminPercentage: percentageArb,
      })
      .map((fields) => ({
        orderId: new mongoose.Types.ObjectId(),
        representativeId: FIXED_REPRESENTATIVE_ID,
        orderValueWithoutIpi: fields.orderValueWithoutIpi,
        pool: fields.pool,
        representativePercentage: fields.representativePercentage,
        adminPercentage: fields.adminPercentage,
        representativeCommission: fields.representativeCommission,
        adminCommission: fields.adminCommission,
        period: { month: FIXED_MONTH, year: FIXED_YEAR },
        status,
        installmentsCreated: false,
      }));

  // Generates a mixed list of commissions (some active, some cancelled)
  const mixedCommissionsArb = fc
    .tuple(
      fc.array(commissionWithStatusArb('active'), { minLength: 1, maxLength: 8 }),
      fc.array(commissionWithStatusArb('cancelled'), { minLength: 1, maxLength: 8 })
    )
    .map(([active, cancelled]) => ({ active, cancelled, all: [...active, ...cancelled] }));

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('cancelled commissions are completely excluded from aggregateCommissionsOverview sums', async () => {
    await fc.assert(
      fc.asyncProperty(mixedCommissionsArb, async ({ active, cancelled, all }) => {
        await Commission.deleteMany({});
        await Commission.insertMany(all);

        const result = await aggregateCommissionsOverview({
          month: FIXED_MONTH,
          year: FIXED_YEAR,
          granularity: 'monthly',
          representativeId: undefined,
        });

        // Compute expected sums from ONLY active commissions
        const expectedAdminCommission = active.reduce(
          (sum, c) => sum + c.adminCommission,
          0
        );
        const expectedRepresentativeCommission = active.reduce(
          (sum, c) => sum + c.representativeCommission,
          0
        );

        // Find the entry for our fixed month
        const entry = result.find(
          (r) => r.period.month === FIXED_MONTH && r.period.year === FIXED_YEAR
        );

        expect(entry).toBeDefined();
        expect(entry.totalAdminCommission).toBeCloseTo(expectedAdminCommission, 1);
        expect(entry.totalRepresentativeCommission).toBeCloseTo(
          expectedRepresentativeCommission,
          1
        );
      }),
      { numRuns: 20 }
    );
  });

  it('aggregation result is zero when all commissions are cancelled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(commissionWithStatusArb('cancelled'), { minLength: 1, maxLength: 10 }),
        async (cancelledCommissions) => {
          await Commission.deleteMany({});
          await Commission.insertMany(cancelledCommissions);

          const result = await aggregateCommissionsOverview({
            month: FIXED_MONTH,
            year: FIXED_YEAR,
            granularity: 'monthly',
            representativeId: undefined,
          });

          // The entry for our month should have zero values (zero-filled)
          const entry = result.find(
            (r) => r.period.month === FIXED_MONTH && r.period.year === FIXED_YEAR
          );

          expect(entry).toBeDefined();
          expect(entry.totalAdminCommission).toBe(0);
          expect(entry.totalRepresentativeCommission).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('commissions with installmentsCreated=true are also excluded from sums', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.array(commissionWithStatusArb('active'), { minLength: 1, maxLength: 5 }),
          fc.array(
            commissionWithStatusArb('active').map((c) => ({
              ...c,
              installmentsCreated: true,
            })),
            { minLength: 1, maxLength: 5 }
          )
        ),
        async ([activeNormal, activeInstallments]) => {
          await Commission.deleteMany({});
          await Commission.insertMany([...activeNormal, ...activeInstallments]);

          const result = await aggregateCommissionsOverview({
            month: FIXED_MONTH,
            year: FIXED_YEAR,
            granularity: 'monthly',
            representativeId: undefined,
          });

          // Only activeNormal should be included (not installmentsCreated ones)
          const expectedAdminCommission = activeNormal.reduce(
            (sum, c) => sum + c.adminCommission,
            0
          );
          const expectedRepresentativeCommission = activeNormal.reduce(
            (sum, c) => sum + c.representativeCommission,
            0
          );

          const entry = result.find(
            (r) => r.period.month === FIXED_MONTH && r.period.year === FIXED_YEAR
          );

          expect(entry).toBeDefined();
          expect(entry.totalAdminCommission).toBeCloseTo(expectedAdminCommission, 1);
          expect(entry.totalRepresentativeCommission).toBeCloseTo(
            expectedRepresentativeCommission,
            1
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  it('only active commissions without installmentsCreated contribute to totals', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.array(commissionWithStatusArb('active'), { minLength: 1, maxLength: 4 }),
          fc.array(commissionWithStatusArb('cancelled'), { minLength: 1, maxLength: 4 }),
          fc.array(
            commissionWithStatusArb('active').map((c) => ({
              ...c,
              installmentsCreated: true,
            })),
            { minLength: 1, maxLength: 4 }
          )
        ),
        async ([activeNormal, cancelled, activeInstallments]) => {
          await Commission.deleteMany({});
          const allCommissions = [...activeNormal, ...cancelled, ...activeInstallments];
          await Commission.insertMany(allCommissions);

          const result = await aggregateCommissionsOverview({
            month: FIXED_MONTH,
            year: FIXED_YEAR,
            granularity: 'monthly',
            representativeId: undefined,
          });

          // Only activeNormal (status=active AND installmentsCreated!=true) should count
          const expectedAdmin = activeNormal.reduce((sum, c) => sum + c.adminCommission, 0);
          const expectedRep = activeNormal.reduce(
            (sum, c) => sum + c.representativeCommission,
            0
          );

          const entry = result.find(
            (r) => r.period.month === FIXED_MONTH && r.period.year === FIXED_YEAR
          );

          expect(entry).toBeDefined();
          expect(entry.totalAdminCommission).toBeCloseTo(expectedAdmin, 1);
          expect(entry.totalRepresentativeCommission).toBeCloseTo(expectedRep, 1);

          // Verify the total is strictly less than what it would be if cancelled/installments were included
          const totalIfAll = allCommissions.reduce((sum, c) => sum + c.adminCommission, 0);
          if (cancelled.length > 0 || activeInstallments.length > 0) {
            expect(entry.totalAdminCommission).toBeLessThanOrEqual(
              Math.round(totalIfAll * 100) / 100
            );
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
