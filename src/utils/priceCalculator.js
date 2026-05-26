function calculateProductPrice(product, quantity, supplierPriceTable) {
  const cd = product.commercialData || {};
  const td = product.technicalData || {};
  const measurements = td.measurements || {};
  const selectedExtras = product.selectedExtras || [];

  let unitPrice = 0;

  if (product.calculationMode === 'dimensions_density_factor') {
    const { width, length, thickness } = measurements;

    let factorKg = cd.factorKg;

    // Se o fornecedor tem faixas de peso, resolve o fator correto
    if (supplierPriceTable && supplierPriceTable.length > 0 && product.material) {
      const materialRows = supplierPriceTable.filter(
        (row) => row.material && row.material.toLowerCase() === product.material.toLowerCase()
      );

      if (materialRows.length > 0 && materialRows.some((r) => r.weightFrom != null || r.weightTo != null)) {
        // Calcula o peso total do pedido
        let totalWeight = quantity; // default: saleMode kg
        if (product.saleMode === 'thousand' && width && length && thickness && cd.density) {
          const kgPerThousand = width * length * thickness * cd.density;
          totalWeight = quantity * kgPerThousand;
        }

        // Encontra a faixa correta
        const matchedRow = materialRows.find((row) => {
          const from = row.weightFrom ?? 0;
          const to = row.weightTo ?? Infinity;
          return totalWeight >= from && totalWeight <= to;
        });

        if (matchedRow && matchedRow.factorKg) {
          factorKg = matchedRow.factorKg;
        }
      }
    }

    if (!factorKg) {
      throw new Error(`Produto ${product.name} não possui fator kg`);
    }

    if (product.saleMode === 'kg') {
      unitPrice = factorKg;
    }

    if (product.saleMode === 'thousand') {
      if (!width || !length || !thickness || !cd.density) {
        throw new Error(
          `Produto ${product.name} não possui medidas ou densidade para cálculo por milheiro`,
        );
      }

      const kgPerThousand = width * length * thickness * cd.density;
      unitPrice = kgPerThousand * factorKg;
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

  if (product.calculationMode === 'pallet') {
    // Preço do palete = quantidade_por_palete × peso × preço_por_kg
    const palletQty = cd.palletQuantity || 0;
    const palletWeight = cd.palletWeight || 0;
    const pricePerKg = cd.basePrice || 0;

    if (!palletQty || !palletWeight || !pricePerKg) {
      throw new Error(
        `Produto ${product.name} não possui dados completos para cálculo por palete (quantidade, peso e preço/kg)`,
      );
    }

    unitPrice = palletQty * palletWeight * pricePerKg;
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
