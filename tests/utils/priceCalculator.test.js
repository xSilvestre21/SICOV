const { calculateProductPrice } = require('../../src/utils/priceCalculator');

describe('calculateProductPrice', () => {
  // ── dimensions_density_factor ──────────────────────────────────────────────

  describe('calculationMode: dimensions_density_factor', () => {
    it('retorna factorKg como unitPrice quando saleMode é kg', () => {
      const product = {
        name: 'Saco KG',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'kg',
        commercialData: { factorKg: 8.5 },
        technicalData: { measurements: {} },
      };

      const result = calculateProductPrice(product, 100);

      expect(result.unitPrice).toBe(8.5);
      expect(result.subtotal).toBe(850);
    });

    it('calcula por milheiro usando dimensões e densidade', () => {
      const product = {
        name: 'Saco Milheiro',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'thousand',
        commercialData: { factorKg: 10, density: 0.95 },
        technicalData: {
          measurements: { width: 0.2, length: 0.3, thickness: 0.0001 },
        },
      };

      // kgPerThousand = 0.2 * 0.3 * 0.0001 * 0.95 = 0.0000057
      // unitPrice = 0.0000057 * 10 = 0.000057
      const result = calculateProductPrice(product, 1000);

      expect(result.unitPrice).toBeCloseTo(0.2 * 0.3 * 0.0001 * 0.95 * 10, 10);
      expect(result.subtotal).toBeCloseTo(result.unitPrice * 1000, 5);
    });

    it('lança erro quando factorKg está ausente', () => {
      const product = {
        name: 'Saco Sem Fator',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'kg',
        commercialData: {},
        technicalData: { measurements: {} },
      };

      expect(() => calculateProductPrice(product, 10)).toThrow(
        'não possui fator kg',
      );
    });

    it('lança erro quando medidas estão ausentes para saleMode thousand', () => {
      const product = {
        name: 'Saco Sem Medidas',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'thousand',
        commercialData: { factorKg: 10, density: 0.95 },
        technicalData: { measurements: {} }, // sem width/length/thickness
      };

      expect(() => calculateProductPrice(product, 10)).toThrow(
        'não possui medidas ou densidade',
      );
    });

    it('lança erro quando density está ausente para saleMode thousand', () => {
      const product = {
        name: 'Saco Sem Densidade',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'thousand',
        commercialData: { factorKg: 10 }, // sem density
        technicalData: {
          measurements: { width: 0.2, length: 0.3, thickness: 0.0001 },
        },
      };

      expect(() => calculateProductPrice(product, 10)).toThrow(
        'não possui medidas ou densidade',
      );
    });
  });

  // ── quantity_times_unit_price ──────────────────────────────────────────────

  describe('calculationMode: quantity_times_unit_price', () => {
    it('retorna unitPrice e calcula subtotal corretamente', () => {
      const product = {
        name: 'Produto Unitário',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 5.5 },
        technicalData: {},
      };

      const result = calculateProductPrice(product, 200);

      expect(result.unitPrice).toBe(5.5);
      expect(result.subtotal).toBe(1100);
    });

    it('lança erro quando unitPrice é zero', () => {
      const product = {
        name: 'Produto Sem Preço',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 0 },
        technicalData: {},
      };

      expect(() => calculateProductPrice(product, 10)).toThrow(
        'não possui preço válido',
      );
    });
  });

  // ── boxes_times_box_price ──────────────────────────────────────────────────

  describe('calculationMode: boxes_times_box_price', () => {
    it('retorna boxPrice e calcula subtotal corretamente', () => {
      const product = {
        name: 'Produto Caixa',
        calculationMode: 'boxes_times_box_price',
        saleMode: 'box',
        commercialData: { boxPrice: 45.0 },
        technicalData: {},
      };

      const result = calculateProductPrice(product, 10);

      expect(result.unitPrice).toBe(45.0);
      expect(result.subtotal).toBe(450.0);
    });
  });

  // ── boxes_times_units_per_box_times_unit_price ─────────────────────────────

  describe('calculationMode: boxes_times_units_per_box_times_unit_price', () => {
    it('calcula unitPrice como unitsPerBox * unitPrice', () => {
      const product = {
        name: 'Fita',
        calculationMode: 'boxes_times_units_per_box_times_unit_price',
        saleMode: 'box',
        commercialData: { unitPrice: 2.0 },
        technicalData: { unitsPerBox: 36 },
      };

      const result = calculateProductPrice(product, 5);

      expect(result.unitPrice).toBe(72); // 36 * 2
      expect(result.subtotal).toBe(360); // 72 * 5
    });

    it('lança erro quando unitsPerBox está ausente', () => {
      const product = {
        name: 'Fita Sem Caixa',
        calculationMode: 'boxes_times_units_per_box_times_unit_price',
        saleMode: 'box',
        commercialData: { unitPrice: 2.0 },
        technicalData: {}, // sem unitsPerBox
      };

      expect(() => calculateProductPrice(product, 5)).toThrow(
        'não possui quantidade por caixa ou valor unitário',
      );
    });

    it('lança erro quando unitPrice está ausente', () => {
      const product = {
        name: 'Fita Sem Preço',
        calculationMode: 'boxes_times_units_per_box_times_unit_price',
        saleMode: 'box',
        commercialData: {}, // sem unitPrice
        technicalData: { unitsPerBox: 36 },
      };

      expect(() => calculateProductPrice(product, 5)).toThrow(
        'não possui quantidade por caixa ou valor unitário',
      );
    });
  });

  // ── weight_times_price_per_kg ──────────────────────────────────────────────

  describe('calculationMode: weight_times_price_per_kg', () => {
    it('retorna basePrice como unitPrice', () => {
      const product = {
        name: 'Stretch',
        calculationMode: 'weight_times_price_per_kg',
        saleMode: 'kg',
        commercialData: { basePrice: 12.5 },
        technicalData: {},
      };

      const result = calculateProductPrice(product, 50);

      expect(result.unitPrice).toBe(12.5);
      expect(result.subtotal).toBe(625);
    });
  });

  // ── manual_price ──────────────────────────────────────────────────────────

  describe('calculationMode: manual_price', () => {
    it('usa basePrice quando disponível', () => {
      const product = {
        name: 'Produto Manual',
        calculationMode: 'manual_price',
        saleMode: 'unit',
        commercialData: { basePrice: 99.9, unitPrice: 50, boxPrice: 30 },
        technicalData: {},
      };

      const result = calculateProductPrice(product, 2);

      expect(result.unitPrice).toBe(99.9);
    });

    it('usa unitPrice quando basePrice não existe', () => {
      const product = {
        name: 'Produto Manual',
        calculationMode: 'manual_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 50, boxPrice: 30 },
        technicalData: {},
      };

      const result = calculateProductPrice(product, 2);

      expect(result.unitPrice).toBe(50);
    });

    it('usa boxPrice quando basePrice e unitPrice não existem', () => {
      const product = {
        name: 'Produto Manual',
        calculationMode: 'manual_price',
        saleMode: 'box',
        commercialData: { boxPrice: 30 },
        technicalData: {},
      };

      const result = calculateProductPrice(product, 3);

      expect(result.unitPrice).toBe(30);
      expect(result.subtotal).toBe(90);
    });
  });

  // ── Erros gerais ──────────────────────────────────────────────────────────

  describe('erros gerais', () => {
    it('lança erro quando preço calculado é zero', () => {
      const product = {
        name: 'Produto Zero',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: {},
        technicalData: {},
      };

      expect(() => calculateProductPrice(product, 10)).toThrow(
        'não possui preço válido',
      );
    });

    it('lança erro quando preço calculado é negativo', () => {
      const product = {
        name: 'Produto Negativo',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: -5 },
        technicalData: {},
      };

      expect(() => calculateProductPrice(product, 10)).toThrow(
        'não possui preço válido',
      );
    });
  });

  // ── selectedExtras ────────────────────────────────────────────────────────

  describe('selectedExtras', () => {
    it('ignora extras com value <= 0', () => {
      const product = {
        name: 'Produto',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 10 },
        technicalData: {},
        selectedExtras: [
          { chargeType: 'per_unit', value: 0 },
          { chargeType: 'per_unit', value: -5 },
        ],
      };

      const result = calculateProductPrice(product, 5);
      expect(result.unitPrice).toBe(10);
    });

    it('ignora extras sem value (undefined)', () => {
      const product = {
        name: 'Produto',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 10 },
        technicalData: {},
        selectedExtras: [
          { chargeType: 'per_unit', value: undefined },
        ],
      };

      const result = calculateProductPrice(product, 5);
      expect(result.unitPrice).toBe(10);
    });

    it('aplica extra per_unit somando ao unitPrice', () => {
      const product = {
        name: 'Produto',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 10 },
        technicalData: {},
        selectedExtras: [
          { chargeType: 'per_unit', value: 2.5 },
        ],
      };

      const result = calculateProductPrice(product, 5);
      expect(result.unitPrice).toBe(12.5);
      expect(result.subtotal).toBe(62.5);
    });

    it('aplica extra per_box somando ao unitPrice', () => {
      const product = {
        name: 'Produto',
        calculationMode: 'boxes_times_box_price',
        saleMode: 'box',
        commercialData: { boxPrice: 45 },
        technicalData: {},
        selectedExtras: [
          { chargeType: 'per_box', value: 5 },
        ],
      };

      const result = calculateProductPrice(product, 10);
      expect(result.unitPrice).toBe(50);
      expect(result.subtotal).toBe(500);
    });

    it('aplica extra per_linear_meter somando ao unitPrice', () => {
      const product = {
        name: 'Produto',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 10 },
        technicalData: {},
        selectedExtras: [
          { chargeType: 'per_linear_meter', value: 3 },
        ],
      };

      const result = calculateProductPrice(product, 5);
      expect(result.unitPrice).toBe(13);
    });

    it('aplica extra fixed dividindo pelo quantity', () => {
      const product = {
        name: 'Produto',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 10 },
        technicalData: {},
        selectedExtras: [
          { chargeType: 'fixed', value: 50 },
        ],
      };

      const result = calculateProductPrice(product, 10);
      expect(result.unitPrice).toBe(15); // 10 + 50/10
      expect(result.subtotal).toBe(150);
    });

    it('nao aplica extra fixed quando quantity é 0', () => {
      const product = {
        name: 'Produto',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 10 },
        technicalData: {},
        selectedExtras: [
          { chargeType: 'fixed', value: 50 },
        ],
      };

      // quantity=0 would cause division by zero, so fixed extra is skipped
      // but unitPrice=10 is still valid
      const result = calculateProductPrice(product, 0);
      // unitPrice stays 10 (fixed not applied since quantity=0)
      // but subtotal = 10 * 0 = 0... and then it throws because unitPrice > 0 but subtotal = 0
      // Actually the check is on unitPrice, not subtotal. Let's verify:
      expect(result.unitPrice).toBe(10);
      expect(result.subtotal).toBe(0);
    });

    it('aplica extra per_kg quando saleMode é kg', () => {
      const product = {
        name: 'Produto KG',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'kg',
        commercialData: { factorKg: 8 },
        technicalData: { measurements: {} },
        selectedExtras: [
          { chargeType: 'per_kg', value: 1.5 },
        ],
      };

      const result = calculateProductPrice(product, 100);
      expect(result.unitPrice).toBe(9.5); // 8 + 1.5
    });

    it('aplica extra per_kg convertido para milheiro quando saleMode é thousand', () => {
      const product = {
        name: 'Saco Milheiro',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'thousand',
        commercialData: { factorKg: 10, density: 0.95 },
        technicalData: {
          measurements: { width: 0.2, length: 0.3, thickness: 0.0001 },
        },
        selectedExtras: [
          { chargeType: 'per_kg', value: 2 },
        ],
      };

      // kgPerThousand = 0.2 * 0.3 * 0.0001 * 0.95 = 0.0000057
      // baseUnitPrice = 0.0000057 * 10 = 0.000057
      // extra per_kg for thousand: 2 * kgPerThousand = 2 * 0.0000057 = 0.0000114
      // total unitPrice = 0.000057 + 0.0000114 = 0.0000684
      const kgPerThousand = 0.2 * 0.3 * 0.0001 * 0.95;
      const expectedUnitPrice = kgPerThousand * 10 + 2 * kgPerThousand;
      const result = calculateProductPrice(product, 1000);
      expect(result.unitPrice).toBeCloseTo(expectedUnitPrice, 10);
    });

    it('aplica extra per_thousand quando saleMode é thousand', () => {
      const product = {
        name: 'Saco Milheiro',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'thousand',
        commercialData: { factorKg: 10, density: 0.95 },
        technicalData: {
          measurements: { width: 0.2, length: 0.3, thickness: 0.0001 },
        },
        selectedExtras: [
          { chargeType: 'per_thousand', value: 5 },
        ],
      };

      const kgPerThousand = 0.2 * 0.3 * 0.0001 * 0.95;
      const baseUnitPrice = kgPerThousand * 10;
      const result = calculateProductPrice(product, 1000);
      expect(result.unitPrice).toBeCloseTo(baseUnitPrice + 5, 10);
    });

    it('aplica extra per_thousand convertido para kg quando saleMode é kg', () => {
      const product = {
        name: 'Produto KG',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'kg',
        commercialData: { factorKg: 8, density: 0.95 },
        technicalData: {
          measurements: { width: 0.2, length: 0.3, thickness: 0.0001 },
        },
        selectedExtras: [
          { chargeType: 'per_thousand', value: 10 },
        ],
      };

      // kgPerThousand = 0.2 * 0.3 * 0.0001 * 0.95 = 0.0000057
      // extra per_thousand for kg: 10 / kgPerThousand
      const kgPerThousand = 0.2 * 0.3 * 0.0001 * 0.95;
      const expectedUnitPrice = 8 + 10 / kgPerThousand;
      const result = calculateProductPrice(product, 100);
      expect(result.unitPrice).toBeCloseTo(expectedUnitPrice, 5);
    });

    it('nao aplica extra per_thousand para kg quando kgPerThousand é 0', () => {
      const product = {
        name: 'Produto KG',
        calculationMode: 'dimensions_density_factor',
        saleMode: 'kg',
        commercialData: { factorKg: 8 },
        technicalData: {
          measurements: { width: 0, length: 0, thickness: 0 },
        },
        selectedExtras: [
          { chargeType: 'per_thousand', value: 10 },
        ],
      };

      // kgPerThousand = 0 → division by zero guard → extra not applied
      const result = calculateProductPrice(product, 100);
      expect(result.unitPrice).toBe(8);
    });

    it('aplica múltiplos extras cumulativamente', () => {
      const product = {
        name: 'Produto',
        calculationMode: 'quantity_times_unit_price',
        saleMode: 'unit',
        commercialData: { unitPrice: 10 },
        technicalData: {},
        selectedExtras: [
          { chargeType: 'per_unit', value: 2 },
          { chargeType: 'per_unit', value: 3 },
          { chargeType: 'fixed', value: 50 },
        ],
      };

      const result = calculateProductPrice(product, 10);
      // 10 + 2 + 3 + 50/10 = 20
      expect(result.unitPrice).toBe(20);
      expect(result.subtotal).toBe(200);
    });
  });
});
