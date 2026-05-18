const fc = require('fast-check');
const {
  zeroFillMonths,
  zeroFillYears,
} = require('../../src/services/dashboardService');

/**
 * Property 2: Commissions-overview aggregation with granularity completeness
 * Validates: Requirements 3.1, 3.2, 3.3, 4.1, 13.2
 *
 * For any set of active commissions and a given year, zeroFillMonths SHALL return
 * exactly 12 entries (one per month, 1-12 in order) and zeroFillYears SHALL return
 * exactly 5 entries (one per year). Existing data is preserved and missing periods
 * are filled with zeros. The sum of zero-filled data equals the sum of original data.
 */
describe('Property 2: Commissions-overview aggregation with granularity completeness', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  // Generates a valid year for testing
  const validYearArb = fc.integer({ min: 2004, max: 2100 });

  // Generates a positive monetary value (commission/revenue)
  const monetaryValueArb = fc.double({
    min: 0.01,
    max: 999999.99,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Generates a single commission entry for a specific month
  const commissionEntryArb = (month, year) =>
    fc.record({
      period: fc.constant({ month, year }),
      totalAdminCommission: monetaryValueArb,
      totalRepresentativeCommission: monetaryValueArb,
      totalRevenue: monetaryValueArb,
    });

  // Generates sparse monthly commission data (random subset of months 1-12)
  const sparseMonthlyDataArb = (year) =>
    fc
      .subarray(
        Array.from({ length: 12 }, (_, i) => i + 1),
        { minLength: 0, maxLength: 12 }
      )
      .chain((months) =>
        fc.tuple(
          ...months.map((m) => commissionEntryArb(m, year))
        ).map((entries) => (entries.length === 0 ? [] : entries))
      );

  // Generates a single commission entry for a specific year
  const yearlyCommissionEntryArb = (year) =>
    fc.record({
      period: fc.constant({ month: null, year }),
      totalAdminCommission: monetaryValueArb,
      totalRepresentativeCommission: monetaryValueArb,
      totalRevenue: monetaryValueArb,
    });

  // Generates sparse yearly commission data (random subset of years within 5-year range)
  const sparseYearlyDataArb = (endYear) => {
    const years = Array.from({ length: 5 }, (_, i) => endYear - 4 + i);
    return fc
      .subarray(years, { minLength: 0, maxLength: 5 })
      .chain((selectedYears) =>
        selectedYears.length === 0
          ? fc.constant([])
          : fc.tuple(
              ...selectedYears.map((y) => yearlyCommissionEntryArb(y))
            )
      );
  };

  // ─── Property Tests: zeroFillMonths ──────────────────────────────────────────

  describe('zeroFillMonths', () => {
    it('always returns exactly 12 entries for any sparse monthly data', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((year) =>
            sparseMonthlyDataArb(year).map((data) => ({ year, data }))
          ),
          ({ year, data }) => {
            const result = zeroFillMonths(data, year);
            expect(result).toHaveLength(12);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns months 1-12 in sequential order', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((year) =>
            sparseMonthlyDataArb(year).map((data) => ({ year, data }))
          ),
          ({ year, data }) => {
            const result = zeroFillMonths(data, year);
            for (let i = 0; i < 12; i++) {
              expect(result[i].period.month).toBe(i + 1);
              expect(result[i].period.year).toBe(year);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves existing data values for months that have data', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((year) =>
            sparseMonthlyDataArb(year).map((data) => ({ year, data }))
          ),
          ({ year, data }) => {
            const result = zeroFillMonths(data, year);
            for (const entry of data) {
              const resultEntry = result[entry.period.month - 1];
              expect(resultEntry.totalAdminCommission).toBe(
                entry.totalAdminCommission
              );
              expect(resultEntry.totalRepresentativeCommission).toBe(
                entry.totalRepresentativeCommission
              );
              expect(resultEntry.totalRevenue).toBe(entry.totalRevenue);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('fills missing months with zero values', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((year) =>
            sparseMonthlyDataArb(year).map((data) => ({ year, data }))
          ),
          ({ year, data }) => {
            const result = zeroFillMonths(data, year);
            const existingMonths = new Set(data.map((d) => d.period.month));
            for (let i = 0; i < 12; i++) {
              const month = i + 1;
              if (!existingMonths.has(month)) {
                expect(result[i].totalAdminCommission).toBe(0);
                expect(result[i].totalRepresentativeCommission).toBe(0);
                expect(result[i].totalRevenue).toBe(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sum of zero-filled data equals sum of original data (no data lost or added)', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((year) =>
            sparseMonthlyDataArb(year).map((data) => ({ year, data }))
          ),
          ({ year, data }) => {
            const result = zeroFillMonths(data, year);

            const originalSum = data.reduce(
              (acc, d) => ({
                admin: acc.admin + d.totalAdminCommission,
                rep: acc.rep + d.totalRepresentativeCommission,
                revenue: acc.revenue + d.totalRevenue,
              }),
              { admin: 0, rep: 0, revenue: 0 }
            );

            const resultSum = result.reduce(
              (acc, d) => ({
                admin: acc.admin + d.totalAdminCommission,
                rep: acc.rep + d.totalRepresentativeCommission,
                revenue: acc.revenue + d.totalRevenue,
              }),
              { admin: 0, rep: 0, revenue: 0 }
            );

            expect(resultSum.admin).toBeCloseTo(originalSum.admin, 5);
            expect(resultSum.rep).toBeCloseTo(originalSum.rep, 5);
            expect(resultSum.revenue).toBeCloseTo(originalSum.revenue, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ─── Property Tests: zeroFillYears ───────────────────────────────────────────

  describe('zeroFillYears', () => {
    it('always returns exactly 5 entries for any sparse yearly data', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((endYear) =>
            sparseYearlyDataArb(endYear).map((data) => ({ endYear, data }))
          ),
          ({ endYear, data }) => {
            const result = zeroFillYears(data, endYear);
            expect(result).toHaveLength(5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns years in sequential order covering endYear-4 to endYear', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((endYear) =>
            sparseYearlyDataArb(endYear).map((data) => ({ endYear, data }))
          ),
          ({ endYear, data }) => {
            const result = zeroFillYears(data, endYear);
            for (let i = 0; i < 5; i++) {
              expect(result[i].period.year).toBe(endYear - 4 + i);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves existing data values for years that have data', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((endYear) =>
            sparseYearlyDataArb(endYear).map((data) => ({ endYear, data }))
          ),
          ({ endYear, data }) => {
            const result = zeroFillYears(data, endYear);
            for (const entry of data) {
              const resultEntry = result.find(
                (r) => r.period.year === entry.period.year
              );
              expect(resultEntry).toBeDefined();
              expect(resultEntry.totalAdminCommission).toBe(
                entry.totalAdminCommission
              );
              expect(resultEntry.totalRepresentativeCommission).toBe(
                entry.totalRepresentativeCommission
              );
              expect(resultEntry.totalRevenue).toBe(entry.totalRevenue);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('fills missing years with zero values', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((endYear) =>
            sparseYearlyDataArb(endYear).map((data) => ({ endYear, data }))
          ),
          ({ endYear, data }) => {
            const result = zeroFillYears(data, endYear);
            const existingYears = new Set(data.map((d) => d.period.year));
            for (const entry of result) {
              if (!existingYears.has(entry.period.year)) {
                expect(entry.totalAdminCommission).toBe(0);
                expect(entry.totalRepresentativeCommission).toBe(0);
                expect(entry.totalRevenue).toBe(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sum of zero-filled data equals sum of original data (no data lost or added)', () => {
      fc.assert(
        fc.property(
          validYearArb.chain((endYear) =>
            sparseYearlyDataArb(endYear).map((data) => ({ endYear, data }))
          ),
          ({ endYear, data }) => {
            const result = zeroFillYears(data, endYear);

            const originalSum = data.reduce(
              (acc, d) => ({
                admin: acc.admin + d.totalAdminCommission,
                rep: acc.rep + d.totalRepresentativeCommission,
                revenue: acc.revenue + d.totalRevenue,
              }),
              { admin: 0, rep: 0, revenue: 0 }
            );

            const resultSum = result.reduce(
              (acc, d) => ({
                admin: acc.admin + d.totalAdminCommission,
                rep: acc.rep + d.totalRepresentativeCommission,
                revenue: acc.revenue + d.totalRevenue,
              }),
              { admin: 0, rep: 0, revenue: 0 }
            );

            expect(resultSum.admin).toBeCloseTo(originalSum.admin, 5);
            expect(resultSum.rep).toBeCloseTo(originalSum.rep, 5);
            expect(resultSum.revenue).toBeCloseTo(originalSum.revenue, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
