const Product = require('../models/product');
const Supplier = require('../models/supplier');
const Client = require('../models/client');
const { parseBrazilianNumber } = require('../utils/numberParsers');

function normalizeMaterialName(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function normalizeSelectedExtras(selectedExtras) {
  if (!Array.isArray(selectedExtras)) return [];

  return selectedExtras
    .map((item) => {
      const value = parseBrazilianNumber(item.value);

      return {
        name: item.name ? String(item.name).trim() : '',
        chargeType: item.chargeType,
        value,
        source: item.source || 'manual',
        notes: item.notes ? String(item.notes).trim() : '',
      };
    })
    .filter(
      (item) =>
        item.name &&
        item.chargeType &&
        item.value !== null &&
        item.value >= 0 &&
        item.source,
    );
}

function normalizeMeasurements(measurements = {}) {
  return {
    width:
      measurements.width !== undefined
        ? parseBrazilianNumber(measurements.width)
        : undefined,
    length:
      measurements.length !== undefined
        ? parseBrazilianNumber(measurements.length)
        : undefined,
    thickness:
      measurements.thickness !== undefined
        ? parseBrazilianNumber(measurements.thickness)
        : undefined,
    gusset:
      measurements.gusset !== undefined
        ? parseBrazilianNumber(measurements.gusset)
        : undefined,
    height:
      measurements.height !== undefined
        ? parseBrazilianNumber(measurements.height)
        : undefined,
    diameter:
      measurements.diameter !== undefined
        ? parseBrazilianNumber(measurements.diameter)
        : undefined,
    weight:
      measurements.weight !== undefined
        ? parseBrazilianNumber(measurements.weight)
        : undefined,
  };
}

function buildTechnicalData(technicalData = {}) {
  return {
    measurements: normalizeMeasurements(technicalData.measurements || {}),
    unitsPerBox:
      technicalData.unitsPerBox !== undefined
        ? parseBrazilianNumber(technicalData.unitsPerBox)
        : undefined,
  };
}

function buildCommercialData(commercialData = {}) {
  return {
    basePrice:
      commercialData.basePrice !== undefined
        ? parseBrazilianNumber(commercialData.basePrice)
        : undefined,
    density:
      commercialData.density !== undefined
        ? parseBrazilianNumber(commercialData.density)
        : undefined,
    factorKg:
      commercialData.factorKg !== undefined
        ? parseBrazilianNumber(commercialData.factorKg)
        : undefined,
    unitPrice:
      commercialData.unitPrice !== undefined
        ? parseBrazilianNumber(commercialData.unitPrice)
        : undefined,
    boxPrice:
      commercialData.boxPrice !== undefined
        ? parseBrazilianNumber(commercialData.boxPrice)
        : undefined,
  };
}

function validateProductRules({
  productType,
  calculationMode,
  technicalData,
  commercialData,
}) {
  if (productType === 'plastic_bag') {
    const m = technicalData.measurements || {};

    if (
      m.width === null ||
      m.width === undefined ||
      m.length === null ||
      m.length === undefined ||
      m.thickness === null ||
      m.thickness === undefined
    ) {
      return 'Para sacos plásticos, largura, comprimento e espessura são obrigatórios';
    }

    if (
      commercialData.factorKg === null ||
      commercialData.factorKg === undefined
    ) {
      return 'Para sacos plásticos, o fator kg é obrigatório';
    }

    if (
      commercialData.density === null ||
      commercialData.density === undefined
    ) {
      return 'Para sacos plásticos, a densidade é obrigatória';
    }
  }

  if (productType === 'tape') {
    if (
      technicalData.unitsPerBox === null ||
      technicalData.unitsPerBox === undefined
    ) {
      return 'Para fitas, a quantidade por caixa é obrigatória';
    }

    if (
      calculationMode === 'boxes_times_units_per_box_times_unit_price' &&
      (commercialData.unitPrice === null ||
        commercialData.unitPrice === undefined)
    ) {
      return 'Para fitas com cálculo por unidade, o valor unitário é obrigatório';
    }

    if (
      calculationMode === 'boxes_times_box_price' &&
      (commercialData.boxPrice === null ||
        commercialData.boxPrice === undefined)
    ) {
      return 'Para fitas com cálculo por caixa, o valor da caixa é obrigatório';
    }
  }

  if (
    calculationMode === 'weight_times_price_per_kg' &&
    (commercialData.basePrice === null ||
      commercialData.basePrice === undefined)
  ) {
    return 'Para cálculo por kg, o preço base é obrigatório';
  }

  if (
    calculationMode === 'quantity_times_unit_price' &&
    (commercialData.unitPrice === null ||
      commercialData.unitPrice === undefined)
  ) {
    return 'Para cálculo por quantidade, o valor unitário é obrigatório';
  }

  return null;
}

async function ensureClientAccess(clientId, reqUser) {
  const client = await Client.findById(clientId);

  if (!client) {
    return { error: 'Cliente não encontrado' };
  }

  if (
    reqUser.profile !== 'admin' &&
    client.representativeId.toString() !== reqUser.id
  ) {
    return { error: 'Acesso negado ao cliente informado' };
  }

  if (client.active === false) {
    return { error: 'Não é possível usar um cliente inativo' };
  }

  return { client };
}

async function resolvePlasticBagCommercialData({ supplierId, material }) {
  const supplier = await Supplier.findById(supplierId);

  if (!supplier) {
    return { error: 'Fornecedor não encontrado' };
  }

  if (supplier.active === false) {
    return { error: 'Não é possível usar um fornecedor inativo' };
  }

  const normalizedMaterial = normalizeMaterialName(material);

  const materialEntry = supplier.priceTable.find(
    (item) => normalizeMaterialName(item.material) === normalizedMaterial,
  );

  if (!materialEntry) {
    return { error: 'Material não encontrado na tabela do fornecedor' };
  }

  if (materialEntry.density === undefined || materialEntry.density === null) {
    return {
      error:
        'O material selecionado no fornecedor não possui densidade cadastrada',
    };
  }

  return {
    supplier,
    density: materialEntry.density,
    factorKg: materialEntry.price,
  };
}

function applyTapeCalculatedFields(productType, technicalData, commercialData) {
  if (productType !== 'tape') return;

  if (
    technicalData.unitsPerBox !== undefined &&
    technicalData.unitsPerBox !== null &&
    commercialData.unitPrice !== undefined &&
    commercialData.unitPrice !== null
  ) {
    commercialData.boxPrice =
      technicalData.unitsPerBox * commercialData.unitPrice;
  }
}

async function createProduct(req, res) {
  try {
    const {
      clientId,
      supplierId,
      supplierCode,
      clientCode,
      name,
      description,
      productType,
      material,
      saleMode,
      calculationMode,
      unitLabel,
      notes,
      technicalData,
      commercialData,
      selectedExtras,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: 'Cliente é obrigatório' });
    }

    if (!supplierId) {
      return res.status(400).json({ message: 'Fornecedor é obrigatório' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Nome é obrigatório' });
    }

    if (!productType) {
      return res.status(400).json({ message: 'Tipo do produto é obrigatório' });
    }

    if (!saleMode) {
      return res.status(400).json({ message: 'Modo de venda é obrigatório' });
    }

    if (!calculationMode) {
      return res.status(400).json({ message: 'Modo de cálculo é obrigatório' });
    }

    const clientAccess = await ensureClientAccess(clientId, req.user);
    if (clientAccess.error) {
      return res.status(403).json({ message: clientAccess.error });
    }

    const builtTechnicalData = buildTechnicalData(technicalData || {});
    const builtCommercialData = buildCommercialData(commercialData || {});
    const normalizedExtras = normalizeSelectedExtras(selectedExtras);

    applyTapeCalculatedFields(
      productType,
      builtTechnicalData,
      builtCommercialData,
    );

    if (productType === 'plastic_bag') {
      if (!material) {
        return res.status(400).json({
          message: 'Para sacos plásticos, o material é obrigatório',
        });
      }

      const commercialResult = await resolvePlasticBagCommercialData({
        supplierId,
        material,
      });

      if (commercialResult.error) {
        return res.status(400).json({ message: commercialResult.error });
      }

      builtCommercialData.density = commercialResult.density;

      if (
        builtCommercialData.factorKg === null ||
        builtCommercialData.factorKg === undefined
      ) {
        builtCommercialData.factorKg = commercialResult.factorKg;
      }
    }

    const validationError = validateProductRules({
      productType,
      calculationMode,
      technicalData: builtTechnicalData,
      commercialData: builtCommercialData,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const product = await Product.create({
      clientId,
      supplierId,
      supplierCode,
      clientCode,
      name,
      description,
      productType,
      material: material ? normalizeMaterialName(material) : material,
      saleMode,
      calculationMode,
      unitLabel,
      active: true,
      notes,
      technicalData: builtTechnicalData,
      commercialData: builtCommercialData,
      selectedExtras: normalizedExtras,
    });

    return res.status(201).json({
      message: 'Produto criado com sucesso',
      product,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao criar produto',
      error: err.message,
    });
  }
}

async function getProducts(req, res) {
  try {
    const {
      active,
      clientId,
      supplierId,
      productType,
      material,
      search,
      width,
      length,
      thickness,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;

    if (clientId) filter.clientId = clientId;
    if (supplierId) filter.supplierId = supplierId;
    if (productType) filter.productType = productType;
    if (material) filter.material = String(material).trim().toUpperCase();

    if (width) {
      filter['technicalData.measurements.width'] = parseBrazilianNumber(width);
    }

    if (length) {
      filter['technicalData.measurements.length'] =
        parseBrazilianNumber(length);
    }

    if (thickness) {
      filter['technicalData.measurements.thickness'] =
        parseBrazilianNumber(thickness);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');

      const clients = await Client.find({
        $or: [{ name: searchRegex }, { tradeName: searchRegex }],
      }).select('_id');

      const clientIdsFromSearch = clients.map((c) => c._id);

      const suppliers = await Supplier.find({
        $or: [{ name: searchRegex }, { tradeName: searchRegex }],
      }).select('_id');

      const supplierIdsFromSearch = suppliers.map((s) => s._id);

      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { material: searchRegex },
        { supplierCode: searchRegex },
        { clientCode: searchRegex },
        { clientId: { $in: clientIdsFromSearch } },
        { supplierId: { $in: supplierIdsFromSearch } },
      ];
    }

    if (req.user.profile !== 'admin') {
      const clients = await Client.find({
        representativeId: req.user.id,
      }).select('_id');

      const clientIds = clients.map((client) => client._id);
      filter.clientId = { $in: clientIds };

      if (active === undefined) {
        filter.active = true;
      }
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('clientId', 'name tradeName active')
        .populate('supplierId', 'name tradeName active')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNumber),

      Product.countDocuments(filter),
    ]);

    return res.json({
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      products,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao obter produtos',
      error: err.message,
    });
  }
}

async function getProductById(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('clientId', 'name tradeName representativeId active')
      .populate('supplierId', 'name tradeName active');

    if (!product) {
      return res.status(404).json({
        message: 'Produto não encontrado',
      });
    }

    if (
      req.user.profile !== 'admin' &&
      product.clientId.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: 'Acesso negado',
      });
    }

    return res.json(product);
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao buscar produto',
      error: err.message,
    });
  }
}

async function updateProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: 'Produto não encontrado',
      });
    }

    const currentClientAccess = await ensureClientAccess(
      product.clientId,
      req.user,
    );
    if (currentClientAccess.error) {
      return res.status(403).json({ message: currentClientAccess.error });
    }

    const {
      clientId,
      supplierId,
      supplierCode,
      clientCode,
      name,
      description,
      productType,
      material,
      saleMode,
      calculationMode,
      unitLabel,
      notes,
      technicalData,
      commercialData,
      selectedExtras,
    } = req.body;

    const nextClientId = clientId !== undefined ? clientId : product.clientId;
    const nextSupplierId =
      supplierId !== undefined ? supplierId : product.supplierId;
    const nextProductType =
      productType !== undefined ? productType : product.productType;
    const nextMaterial = material !== undefined ? material : product.material;
    const nextCalculationMode =
      calculationMode !== undefined ? calculationMode : product.calculationMode;

    const newClientAccess = await ensureClientAccess(nextClientId, req.user);
    if (newClientAccess.error) {
      return res.status(403).json({ message: newClientAccess.error });
    }

    const nextTechnicalData =
      technicalData !== undefined
        ? buildTechnicalData(technicalData)
        : product.technicalData;

    const nextCommercialData =
      commercialData !== undefined
        ? buildCommercialData(commercialData)
        : product.commercialData;

    const nextSelectedExtras =
      selectedExtras !== undefined
        ? normalizeSelectedExtras(selectedExtras)
        : product.selectedExtras;

    applyTapeCalculatedFields(
      nextProductType,
      nextTechnicalData,
      nextCommercialData,
    );

    if (nextProductType === 'plastic_bag') {
      if (!nextMaterial) {
        return res.status(400).json({
          message: 'Para sacos plásticos, o material é obrigatório',
        });
      }

      const commercialResult = await resolvePlasticBagCommercialData({
        supplierId: nextSupplierId,
        material: nextMaterial,
      });

      if (commercialResult.error) {
        return res.status(400).json({ message: commercialResult.error });
      }

      nextCommercialData.density = commercialResult.density;
    }

    const validationError = validateProductRules({
      productType: nextProductType,
      calculationMode: nextCalculationMode,
      technicalData: nextTechnicalData,
      commercialData: nextCommercialData,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    product.clientId = nextClientId;
    product.supplierId = nextSupplierId;
    product.supplierCode =
      supplierCode !== undefined ? supplierCode : product.supplierCode;

    product.clientCode =
      clientCode !== undefined ? clientCode : product.clientCode;
    product.name = name !== undefined ? name : product.name;
    product.description =
      description !== undefined ? description : product.description;
    product.productType = nextProductType;
    product.material =
      nextMaterial !== undefined && nextMaterial !== null
        ? normalizeMaterialName(nextMaterial)
        : nextMaterial;
    product.saleMode = saleMode !== undefined ? saleMode : product.saleMode;
    product.calculationMode = nextCalculationMode;
    product.unitLabel = unitLabel !== undefined ? unitLabel : product.unitLabel;
    product.notes = notes !== undefined ? notes : product.notes;
    product.technicalData = nextTechnicalData;
    product.commercialData = nextCommercialData;
    product.selectedExtras = nextSelectedExtras;

    await product.save();

    const updatedProduct = await Product.findById(id)
      .populate('clientId', 'name tradeName active')
      .populate('supplierId', 'name tradeName active');

    return res.json({
      message: 'Produto atualizado com sucesso',
      product: updatedProduct,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao atualizar produto',
      error: err.message,
    });
  }
}

async function toggleProductActive(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: 'Produto não encontrado',
      });
    }

    const clientAccess = await ensureClientAccess(product.clientId, req.user);
    if (clientAccess.error) {
      return res.status(403).json({ message: clientAccess.error });
    }

    product.active = !product.active;
    await product.save();

    return res.json({
      message: product.active
        ? 'Produto reativado com sucesso'
        : 'Produto desativado com sucesso',
      product,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao alterar status do produto',
      error: err.message,
    });
  }
}

async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: 'Produto não encontrado',
      });
    }

    const clientAccess = await ensureClientAccess(product.clientId, req.user);
    if (clientAccess.error) {
      return res.status(403).json({ message: clientAccess.error });
    }

    await Product.findByIdAndDelete(id);

    return res.json({
      message: 'Produto excluído com sucesso',
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao excluir produto',
      error: err.message,
    });
  }
}

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductActive,
  deleteProduct,
};
