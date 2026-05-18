const fc = require('fast-check');
const {
  sanitizeForRepresentative,
} = require('../../src/services/dashboardService');

/**
 * Property 7: Admin commission sanitization for representatives
 * Validates: Requirements 12.4
 *
 * For any response from any dashboard endpoint when the authenticated user has
 * profile "representative", the response SHALL NOT contain any field named
 * `adminCommission` or `totalAdminCommission`.
 */
describe('Property 7: Admin commission sanitization for representatives', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  // Generates a random numeric value for commission fields
  const commissionValueArb = fc.oneof(
    fc.integer({ min: 0, max: 1000000 }),
    fc.double({ min: 0, max: 1000000, noNaN: true, noDefaultInfinity: true })
  );

  // Generates random non-admin fields (fields that should be preserved)
  const nonAdminFieldsArb = fc.record({
    totalRepresentativeCommission: commissionValueArb,
    totalRevenue: commissionValueArb,
    representativeCommission: commissionValueArb,
    orderId: fc.string({ minLength: 1, maxLength: 24 }),
    clientName: fc.string({ minLength: 1, maxLength: 50 }),
    period: fc.record({
      month: fc.integer({ min: 1, max: 12 }),
      year: fc.integer({ min: 2000, max: 2100 }),
    }),
  });

  // Generates an object that always includes adminCommission and totalAdminCommission
  const objectWithAdminFieldsArb = nonAdminFieldsArb.chain((baseFields) =>
    fc.record({
      adminCommission: commissionValueArb,
      totalAdminCommission: commissionValueArb,
    }).map((adminFields) => ({ ...baseFields, ...adminFields }))
  );

  // Generates an array of objects with admin commission fields
  const arrayWithAdminFieldsArb = fc.array(objectWithAdminFieldsArb, {
    minLength: 1,
    maxLength: 20,
  });

  // ─── Property Tests ──────────────────────────────────────────────────────────

  it('removes adminCommission and totalAdminCommission from single objects for representative profile', () => {
    fc.assert(
      fc.property(objectWithAdminFieldsArb, (data) => {
        const result = sanitizeForRepresentative(data, 'representative');

        expect(result).not.toHaveProperty('adminCommission');
        expect(result).not.toHaveProperty('totalAdminCommission');
      }),
      { numRuns: 100 }
    );
  });

  it('removes adminCommission and totalAdminCommission from all items in arrays for representative profile', () => {
    fc.assert(
      fc.property(arrayWithAdminFieldsArb, (data) => {
        const result = sanitizeForRepresentative(data, 'representative');

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(data.length);

        result.forEach((item) => {
          expect(item).not.toHaveProperty('adminCommission');
          expect(item).not.toHaveProperty('totalAdminCommission');
        });
      }),
      { numRuns: 100 }
    );
  });

  it('preserves all fields unchanged for admin profile (single object)', () => {
    fc.assert(
      fc.property(objectWithAdminFieldsArb, (data) => {
        const result = sanitizeForRepresentative(data, 'admin');

        expect(result).toEqual(data);
        expect(result).toHaveProperty('adminCommission');
        expect(result).toHaveProperty('totalAdminCommission');
      }),
      { numRuns: 100 }
    );
  });

  it('preserves all fields unchanged for admin profile (array of objects)', () => {
    fc.assert(
      fc.property(arrayWithAdminFieldsArb, (data) => {
        const result = sanitizeForRepresentative(data, 'admin');

        expect(result).toEqual(data);
        result.forEach((item) => {
          expect(item).toHaveProperty('adminCommission');
          expect(item).toHaveProperty('totalAdminCommission');
        });
      }),
      { numRuns: 100 }
    );
  });

  it('preserves all non-admin fields intact after sanitization for representative profile (single object)', () => {
    fc.assert(
      fc.property(objectWithAdminFieldsArb, (data) => {
        const result = sanitizeForRepresentative(data, 'representative');

        // All non-admin fields should be preserved
        expect(result.totalRepresentativeCommission).toBe(data.totalRepresentativeCommission);
        expect(result.totalRevenue).toBe(data.totalRevenue);
        expect(result.representativeCommission).toBe(data.representativeCommission);
        expect(result.orderId).toBe(data.orderId);
        expect(result.clientName).toBe(data.clientName);
        expect(result.period).toEqual(data.period);
      }),
      { numRuns: 100 }
    );
  });

  it('preserves all non-admin fields intact after sanitization for representative profile (array)', () => {
    fc.assert(
      fc.property(arrayWithAdminFieldsArb, (data) => {
        const result = sanitizeForRepresentative(data, 'representative');

        result.forEach((item, index) => {
          expect(item.totalRepresentativeCommission).toBe(data[index].totalRepresentativeCommission);
          expect(item.totalRevenue).toBe(data[index].totalRevenue);
          expect(item.representativeCommission).toBe(data[index].representativeCommission);
          expect(item.orderId).toBe(data[index].orderId);
          expect(item.clientName).toBe(data[index].clientName);
          expect(item.period).toEqual(data[index].period);
        });
      }),
      { numRuns: 100 }
    );
  });
});
