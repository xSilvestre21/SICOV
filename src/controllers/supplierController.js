const Supplier = require('../models/supplier');
const User = require('../models/user');
const {
  onlyNumbers,
  parsePercentage,
  parseBrazilianNumber,
} = require('../utils/numberParsers');

function normalizeMaterialName(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function normalizePriceTable(priceTable) {
  if (!Array.isArray(priceTable)) return [];

  return priceTable
    .map((item) => {
      const material = normalizeMaterialName(item.material);
      const price = parseBrazilianNumber(item.price);

      let density;
      if (
        item.density !== undefined &&
        item.density !== null &&
        item.density !== ''
      ) {
        density = parseBrazilianNumber(item.density);
      }

      return {
        material,
        price,
        density,
      };
    })
    .filter((item) => {
      const hasValidMaterial = !!item.material;
      const hasValidPrice = item.price !== null && item.price >= 0;
      const hasValidDensity =
        item.density === undefined ||
        (item.density !== null && item.density > 0);

      return hasValidMaterial && hasValidPrice && hasValidDensity;
    });
}

function hasDuplicateMaterials(priceTable) {
  const materials = priceTable.map((item) => item.material);
  const uniqueMaterials = new Set(materials);

  return uniqueMaterials.size !== materials.length;
}

async function createSupplier(req, res) {
  try {
    const {
      name,
      tradeName,
      cnpj,
      stateRegistration,
      address,
      city,
      state,
      zipCode,
      phone,
      email,
      logoUrl,
      currentOrderNumber,
      ipi,
      priceTable,
      allowedRepresentatives,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        message: 'Nome é obrigatório',
      });
    }

    if (!cnpj) {
      return res.status(400).json({
        message: 'CNPJ é obrigatório',
      });
    }

    const parsedIpi = parsePercentage(ipi);

    if (parsedIpi === null || parsedIpi < 0) {
      return res.status(400).json({
        message: 'IPI inválido',
      });
    }

    const normalizedPriceTable = normalizePriceTable(priceTable);

    if (
      Array.isArray(priceTable) &&
      hasDuplicateMaterials(normalizedPriceTable)
    ) {
      return res.status(400).json({
        message: 'Não é permitido repetir material na tabela de preços',
      });
    }

    let validAllowedRepresentatives = [];

    if (
      Array.isArray(allowedRepresentatives) &&
      allowedRepresentatives.length > 0
    ) {
      const representatives = await User.find({
        _id: { $in: allowedRepresentatives },
        profile: 'representative',
      }).select('_id');

      validAllowedRepresentatives = representatives.map((rep) => rep._id);
    }

    const normalizedCnpj = onlyNumbers(cnpj);

    const existingSupplier = await Supplier.findOne({ cnpj: normalizedCnpj });

    if (existingSupplier) {
      return res.status(409).json({
        message: 'Já existe um fornecedor com esse CNPJ',
      });
    }

    const supplier = await Supplier.create({
      name,
      tradeName,
      cnpj: normalizedCnpj,
      stateRegistration: stateRegistration !== undefined ? stateRegistration : '',
      address,
      city,
      state: state ? state.toUpperCase() : '',
      zipCode: onlyNumbers(zipCode),
      phone: onlyNumbers(phone),
      email,
      logoUrl,
      currentOrderNumber:
        currentOrderNumber !== undefined
          ? parseBrazilianNumber(currentOrderNumber)
          : 0,
      ipi: parsedIpi,
      priceTable: normalizedPriceTable,
      allowedRepresentatives: validAllowedRepresentatives,
      active: true,
    });

    return res.status(201).json({
      message: 'Fornecedor criado com sucesso',
      supplier,
    });
  } catch (err) {
    console.error('[createSupplier]', err.message);
    return res.status(500).json({
      message: 'Erro ao criar fornecedor',
    });
  }
}

async function getSuppliers(req, res) {
  try {
    const {
      active,
      search,
      representativeId,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (req.user.profile !== 'admin') {
      filter.allowedRepresentatives = req.user.id;
    }

    if (req.user.profile === 'admin' && representativeId) {
      filter.allowedRepresentatives = representativeId;
    }

    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;

    if (search) {
      const searchRegex = new RegExp(search, 'i');

      filter.$or = [
        { name: searchRegex },
        { tradeName: searchRegex },
        { cnpj: searchRegex },
        { city: searchRegex },
        { state: searchRegex },
      ];
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limitNumber),

      Supplier.countDocuments(filter),
    ]);

    return res.json({
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      suppliers,
    });
  } catch (err) {
    console.error('[getSuppliers]', err.message);
    return res.status(500).json({
      message: 'Erro ao buscar fornecedores',
    });
  }
}

async function getSupplierById(req, res) {
  try {
    const { id } = req.params;

    let supplier;

    if (req.user.profile === 'admin') {
      supplier = await Supplier.findById(id).populate(
        'allowedRepresentatives',
        'name email profile active',
      );
    } else {
      supplier = await Supplier.findOne({
        _id: id,
        allowedRepresentatives: req.user.id,
        active: true,
      }).populate('allowedRepresentatives', 'name email profile active');
    }

    if (!supplier) {
      return res.status(404).json({
        message: 'Fornecedor não encontrado',
      });
    }

    return res.json(supplier);
  } catch (err) {
    console.error('[getSupplierById]', err.message);
    return res.status(500).json({
      message: 'Erro ao obter fornecedor',
    });
  }
}

async function updateSupplier(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      tradeName,
      cnpj,
      stateRegistration,
      address,
      city,
      state,
      zipCode,
      phone,
      email,
      logoUrl,
      currentOrderNumber,
      ipi,
      priceTable,
      allowedRepresentatives,
    } = req.body;

    const supplier = await Supplier.findById(id);

    if (!supplier) {
      return res.status(404).json({
        message: 'Fornecedor não encontrado',
      });
    }

    let validAllowedRepresentatives = supplier.allowedRepresentatives;

    if (Array.isArray(allowedRepresentatives)) {
      const representatives = await User.find({
        _id: { $in: allowedRepresentatives },
        profile: 'representative',
      }).select('_id');

      validAllowedRepresentatives = representatives.map((rep) => rep._id);
    }

    let normalizedCnpj = supplier.cnpj;

    if (cnpj !== undefined) {
      normalizedCnpj = onlyNumbers(cnpj);

      if (!normalizedCnpj) {
        return res.status(400).json({
          message: 'CNPJ é obrigatório',
        });
      }

      const existingSupplier = await Supplier.findOne({
        cnpj: normalizedCnpj,
        _id: { $ne: id },
      });

      if (existingSupplier) {
        return res.status(409).json({
          message: 'Já existe um fornecedor com esse CNPJ',
        });
      }
    }

    let parsedIpi = supplier.ipi;

    if (ipi !== undefined) {
      parsedIpi = parsePercentage(ipi);

      if (parsedIpi === null || parsedIpi < 0) {
        return res.status(400).json({
          message: 'IPI inválido',
        });
      }
    }

    let normalizedPriceTable = supplier.priceTable;

    if (priceTable !== undefined) {
      normalizedPriceTable = normalizePriceTable(priceTable);

      if (hasDuplicateMaterials(normalizedPriceTable)) {
        return res.status(400).json({
          message: 'Não é permitido repetir material na tabela de preços',
        });
      }
    }

    supplier.name = name !== undefined ? name : supplier.name;
    supplier.tradeName =
      tradeName !== undefined ? tradeName : supplier.tradeName;
    supplier.cnpj = normalizedCnpj;
    supplier.stateRegistration =
      stateRegistration !== undefined
        ? stateRegistration
        : supplier.stateRegistration;
    supplier.address = address !== undefined ? address : supplier.address;
    supplier.city = city !== undefined ? city : supplier.city;
    supplier.state = state !== undefined ? state.toUpperCase() : supplier.state;
    supplier.zipCode =
      zipCode !== undefined ? onlyNumbers(zipCode) : supplier.zipCode;
    supplier.phone = phone !== undefined ? onlyNumbers(phone) : supplier.phone;
    supplier.email = email !== undefined ? email : supplier.email;
    supplier.logoUrl = logoUrl !== undefined ? logoUrl : supplier.logoUrl;
    supplier.currentOrderNumber =
      currentOrderNumber !== undefined
        ? parseBrazilianNumber(currentOrderNumber)
        : supplier.currentOrderNumber;
    supplier.ipi = parsedIpi;
    supplier.priceTable = normalizedPriceTable;
    supplier.allowedRepresentatives = validAllowedRepresentatives;

    await supplier.save();

    const updatedSupplier = await Supplier.findById(id).populate(
      'allowedRepresentatives',
      'name email profile active',
    );

    return res.json({
      message: 'Fornecedor atualizado com sucesso',
      supplier: updatedSupplier,
    });
  } catch (err) {
    console.error('[updateSupplier]', err.message);
    return res.status(500).json({
      message: 'Erro ao atualizar fornecedor',
    });
  }
}

async function toggleSupplierActive(req, res) {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);

    if (!supplier) {
      return res.status(404).json({
        message: 'Fornecedor não encontrado',
      });
    }

    supplier.active = !supplier.active;

    await supplier.save();

    return res.json({
      message: supplier.active
        ? 'Fornecedor reativado com sucesso'
        : 'Fornecedor desativado com sucesso',
      supplier,
    });
  } catch (err) {
    console.error('[toggleSupplierActive]', err.message);
    return res.status(500).json({
      message: 'Erro ao alterar status do fornecedor',
    });
  }
}

async function deleteSupplier(req, res) {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);

    if (!supplier) {
      return res.status(404).json({
        message: 'Fornecedor não encontrado',
      });
    }

    await Supplier.findByIdAndDelete(id);

    return res.json({
      message: 'Fornecedor excluído com sucesso',
    });
  } catch (err) {
    console.error('[deleteSupplier]', err.message);
    return res.status(500).json({
      message: 'Erro ao excluir fornecedor',
    });
  }
}

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  toggleSupplierActive,
};
