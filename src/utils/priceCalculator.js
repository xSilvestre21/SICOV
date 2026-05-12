function calculateProductPrice(product, quantity) {
  const cd = product.commercialData || {};
  const td = product.technicalData || {};
  const measurements = td.measurements || {};
  const selectedExtras = product.selectedExtras || [];

  let unitPrice = 0;

  if (product.calculationMode === 'dimensions_density_factor') {
    const { width, length, thickness } = measurements;

    if (!cd.factorKg) {
      throw new Error(`Produto ${product.name} não possui fator kg`);
    }

    if (product.saleMode === 'kg') {
      unitPrice = cd.factorKg;
    }

    if (product.saleMode === 'thousand') {
      if (!width || !length || !thickness || !cd.density) {
        throw new Error(
          `Produto ${product.name} não possui medidas ou densidade para cálculo por milheiro`,
        );
      }

      const kgPerThousand = width * length * thickness * cd.density;
      unitPrice = kgPerThousand * cd.factorKg;
    }
  }

  if (product.calculationMode === 'quantity_times_unit_price') {
    unitPrice = cd.unitPrice || 0;
  }

  if (product.calculationMode === 'boxes_times_box_price') {
    unitPrice = cd.boxPrice || 0;
  }

  if (
    product.calculationMode === 'boxes_times_units_per_box_times_unit_price'
  ) {
    if (!td.unitsPerBox || !cd.unitPrice) {
      throw new Error(
        `Produto ${product.name} não possui quantidade por caixa ou valor unitário`,
      );
    }

    unitPrice = td.unitsPerBox * cd.unitPrice;
  }

  if (product.calculationMode === 'weight_times_price_per_kg') {
    unitPrice = cd.basePrice || 0;
  }

  if (product.calculationMode === 'manual_price') {
    unitPrice = cd.basePrice || cd.unitPrice || cd.boxPrice || 0;
  }

  // Aplica extras ao preço unitário
  for (const extra of selectedExtras) {
    if (!extra.value || extra.value <= 0) continue;

    if (extra.chargeType === 'per_kg') {
      // Extra por kg: soma diretamente ao preço unitário quando saleMode é kg
      if (product.saleMode === 'kg') {
        unitPrice += extra.value;
      } else if (product.saleMode === 'thousand') {
        // Converte para milheiro usando o peso por milheiro
        const kgPerThousand = (measurements.width || 0) * (measurements.length || 0) * (measurements.thickness || 0) * (cd.density || 0);
        unitPrice += extra.value * kgPerThousand;
      }
    } else if (extra.chargeType === 'per_thousand') {
      if (product.saleMode === 'thousand') {
        unitPrice += extra.value;
      } else if (product.saleMode === 'kg') {
        // Converte de milheiro para kg
        const kgPerThousand = (measurements.width || 0) * (measurements.length || 0) * (measurements.thickness || 0) * (cd.density || 0);
        if (kgPerThousand > 0) unitPrice += extra.value / kgPerThousand;
      }
    } else if (extra.chargeType === 'per_unit') {
      unitPrice += extra.value;
    } else if (extra.chargeType === 'per_box') {
      unitPrice += extra.value;
    } else if (extra.chargeType === 'per_linear_meter') {
      unitPrice += extra.value;
    } else if (extra.chargeType === 'fixed') {
      // Extra fixo: divide pelo total de unidades para distribuir no preço unitário
      if (quantity > 0) unitPrice += extra.value / quantity;
    }
  }

  if (!unitPrice || unitPrice <= 0) {
    throw new Error(`Produto ${product.name} não possui preço válido`);
  }

  const subtotal = unitPrice * quantity;

  return {
    unitPrice,
    subtotal,
  };
}

module.exports = { calculateProductPrice };
