const fc = require('fast-check');
const {
  validateDashboardParams,
} = require('../../src/utils/dashboardValidation');

/**
 * Property 10: Invalid parameter validation
 * Validates: Requirements 13.11
 *
 * For any value of month outside [1, 12] or year outside [2000, 2100],
 * validateDashboardParams SHALL return a non-empty errors array.
 */
describe('Property 10: Invalid parameter validation', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  // Generates invalid month values: negative, zero, >12, floats, NaN
  const invalidMonthArb = fc.oneof(
    fc.integer({ max: 0 }), // negative or zero
    fc.integer({ min: 13 }), // greater than 12
    fc.double({ min: 0.01, max: 11.99, noNaN: true, noDefaultInfinity: true })
      .filter((v) => !Number.isInteger(v)), // floats in range but not integers
    fc.double({ min: 12.01, noNaN: true, noDefaultInfinity: true })
      .filter((v) => !Number.isInteger(v)), // floats above range
    fc.constant(NaN) // NaN
  );

  // Generates invalid year values: <2000, >2100, floats
  const invalidYearArb = fc.oneof(
    fc.integer({ max: 1999 }), // below 2000
    fc.integer({ min: 2101 }), // above 2100
    fc.double({ min: 2000.01, max: 2099.99, noNaN: true, noDefaultInfinity: true })
      .filter((v) => !Number.isInteger(v)), // floats within range but not integers
    fc.constant(NaN) // NaN
  );

  // Generates valid month values: integers 1-12
  const validMonthArb = fc.integer({ min: 1, max: 12 });

  // Generates valid year values: integers 2000-2100
  const validYearArb = fc.integer({ min: 2000, max: 2100 });

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('returns non-empty errors for any invalid month value', () => {
    fc.assert(
      fc.property(invalidMonthArb, (month) => {
        const errors = validateDashboardParams({ month });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors).toContain('month deve ser um inteiro entre 1 e 12');
      }),
      { numRuns: 100 }
    );
  });

  it('returns non-empty errors for any invalid year value', () => {
    fc.assert(
      fc.property(invalidYearArb, (year) => {
        const errors = validateDashboardParams({ year });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors).toContain('year deve ser um inteiro entre 2000 e 2100');
      }),
      { numRuns: 100 }
    );
  });

  it('returns errors for both invalid month and invalid year combined', () => {
    fc.assert(
      fc.property(invalidMonthArb, invalidYearArb, (month, year) => {
        const errors = validateDashboardParams({ month, year });
        expect(errors.length).toBe(2);
        expect(errors).toContain('month deve ser um inteiro entre 1 e 12');
        expect(errors).toContain('year deve ser um inteiro entre 2000 e 2100');
      }),
      { numRuns: 100 }
    );
  });

  it('returns empty errors array for all valid month and year combinations', () => {
    fc.assert(
      fc.property(validMonthArb, validYearArb, (month, year) => {
        const errors = validateDashboardParams({ month, year });
        expect(errors).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('returns month error only when month is invalid and year is valid', () => {
    fc.assert(
      fc.property(invalidMonthArb, validYearArb, (month, year) => {
        const errors = validateDashboardParams({ month, year });
        expect(errors.length).toBe(1);
        expect(errors).toContain('month deve ser um inteiro entre 1 e 12');
      }),
      { numRuns: 100 }
    );
  });

  it('returns year error only when year is invalid and month is valid', () => {
    fc.assert(
      fc.property(validMonthArb, invalidYearArb, (month, year) => {
        const errors = validateDashboardParams({ month, year });
        expect(errors.length).toBe(1);
        expect(errors).toContain('year deve ser um inteiro entre 2000 e 2100');
      }),
      { numRuns: 100 }
    );
  });
});
