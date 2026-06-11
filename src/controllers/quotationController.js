const Quotation = require('../models/quotation');
const Order = require('../models/order');
const Product = require('../models/product');
const Client = require('../models/client');
const Supplier = require('../models/supplier');
const generateQuotationPdf = require('../utils/quotationPdfGenerator');
const { calculateProductPrice } = require('../utils/priceCalculator');

// ── Helper: processa lista de itens e retorna { processedItems, subtotal, supplierId } ──

async function processItems(items) {
  let supplierId = null;
  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    const { productId, adHocProduct, quantity, hasIpi = true } = item;

    if (adHocProduct) {
      // ── Item avulso ────────────────────────────────────────────────────
      if (!adHocProduct.name) {
        throw Object.assign(new Error('Nome do produto avulso é obrigatório'), { status: 400 });
      }
      if (!item.supplierId) {
        throw Object.assign(new Error('supplierId é obrigatório para produto avulso'), { status: 400 });
      }
      if (!item.unitPrice || item.unitPrice <= 0) {
        throw Object.assign(new Error('Preço unitário é obrigatório para produto avulso'), { status: 400 });
      }

      const itemSupplierId = item.supplierId.toString();
      if (!supplierId) {
        supplierId = item.supplierId;
      } else if (supplierId.toString() !== itemSupplierId) {
        throw Object.assign(new Error('Todos os produtos devem ser do mesmo fornecedor'), { status: 400 });
      }

      const unitPrice = Number(item.unitPrice);
      const itemSubtotal = unitPrice * quantity;
      subtotal += itemSubtotal;

      processedItems.push({
        productId: null,
        productSnapshot: {
          name: adHocProduct.name,
          description: adHocProduct.description,
          saleMode: adHocProduct.saleMode,
          unitLabel: adHocProduct.unitLabel,
          supplierCode: adHocProduct.supplierCode,
          clientCode: adHocProduct.clientCode,
          calculationMode: adHocProduct.calculationMode,
          material: adHocProduct.material,
          technicalData: adHocProduct.technicalData,
          commercialData: adHocProduct.commercialData,
        },
        quantity,
        unitPrice,
        subtotal: itemSubtotal,
        hasIpi,
      });
    } else {
      // ── Produto cadastrado ─────────────────────────────────────────────
      const product = await Product.findById(productId);
      if (!product) {
        throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
      }

      if (!supplierId) {
        supplierId = product.supplierId;
      } else if (supplierId.toString() !== product.supplierId.toString()) {
        throw Object.assign(new Error('Todos os produtos devem ser do mesmo fornecedor'), { status: 400 });
      }

      let unitPrice, itemSubtotal;
      try {
        // Busca tabela de preços do fornecedor para resolver faixas de peso
        const supplier = await Supplier.findById(product.supplierId).select('priceTable').lean();
        const result = calculateProductPrice(product, quantity, supplier?.priceTable);
        unitPrice = result.unitPrice;
        itemSubtotal = result.subtotal;
      } catch (calcErr) {
        throw Object.assign(new Error(calcErr.message), { status: 400 });
      }

      subtotal += itemSubtotal;

      processedItems.push({
        productId,
        productSnapshot: {
          supplierCode: product.supplierCode,
          clientCode: product.clientCode,
          name: product.name,
          description: product.description,
          productType: product.productType,
          material: product.material,
          saleMode: product.saleMode,
          calculationMode: product.calculationMode,
          unitLabel: product.unitLabel,
          technicalData: product.technicalData,
          commercialData: product.commercialData,
          selectedExtras: product.selectedExtras,
        },
        quantity,
        unitPrice,
        subtotal: itemSubtotal,
        hasIpi,
      });
    }
  }

  return { processedItems, subtotal, supplierId };
}

// ── createQuotation ──────────────────────────────────────────────────────────

async function createQuotation(req, res) {
  try {
    const {
      clientId,
      adHocClient,
      items,
      save = false,
      attn,
      observations,
      sellerName,
      deliveryDate,
      paymentTerm,
    } = req.body;

    // 1. Validar e montar clientSnapshot
    let clientSnapshot;

    if (clientId) {
      const client = await Client.findById(clientId);
      if (!client) return res.status(404).json({ message: 'Cliente não encontrado' });
      clientSnapshot = {
        name: client.name, tradeName: client.tradeName, cnpj: client.cnpj,
        stateRegistration: client.stateRegistration, address: client.address,
        city: client.city, state: client.state, district: client.district,
        zipCode: client.zipCode, phone: client.phone, email: client.email,
        paymentTerm: client.paymentTerm, notes: client.notes,
      };
    } else if (adHocClient && adHocClient.name) {
      clientSnapshot = {
        name: adHocClient.name, tradeName: adHocClient.tradeName, cnpj: adHocClient.cnpj,
        stateRegistration: adHocClient.stateRegistration, address: adHocClient.address,
        city: adHocClient.city, state: adHocClient.state, district: adHocClient.district,
        zipCode: adHocClient.zipCode, phone: adHocClient.phone, email: adHocClient.email,
        paymentTerm: adHocClient.paymentTerm, notes: adHocClient.notes,
      };
    } else {
      return res.status(400).json({ message: 'Nome do cliente é obrigatório' });
    }

    // 2. Validar items
    if (!items || !items.length) {
      return res.status(400).json({ message: 'Itens são obrigatórios' });
    }

    // 3. Processar itens
    let processedItems, subtotal, supplierId;
    try {
      ({ processedItems, subtotal, supplierId } = await processItems(items));
    } catch (err) {
      // Erros com status são erros de validação de negócio (400/404)
      // Erros sem status são erros inesperados — deixa propagar para o outer catch (500)
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      throw err;
    }
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) return res.status(404).json({ message: 'Fornecedor não encontrado' });

    const supplierSnapshot = {
      name: supplier.name, tradeName: supplier.tradeName, cnpj: supplier.cnpj,
      ipi: supplier.ipi, logoUrl: supplier.logoUrl, city: supplier.city,
    };

    // 5. Calcular totais
    const ipi = supplier.ipi || 0;
    const subtotalWithIpi = processedItems
      .filter((i) => i.hasIpi !== false)
      .reduce((sum, i) => sum + i.subtotal, 0);
    const ipiValue = subtotalWithIpi * (ipi / 100);
    const total = subtotal + ipiValue;

    const quotationData = {
      clientId: clientId || null,
      supplierId,
      clientSnapshot,
      supplierSnapshot,
      items: processedItems,
      subtotal,
      ipiValue,
      total,
      attn,
      observations,
      sellerName: sellerName || req.user.name,
      deliveryDate,
      paymentTerm,
    };

    // 6. Salvar ou retornar calculado
    if (save === true) {
      quotationData.representativeId = req.user.id;
      const quotation = await Quotation.create(quotationData);
      return res.status(201).json({ message: 'Orçamento criado com sucesso', quotation });
    }

    return res.status(200).json({ quotation: quotationData });
  } catch (err) {
    console.error('[createQuotation]', err.message);
    return res.status(500).json({ message: 'Erro ao criar orçamento' });
  }
}

// ── updateQuotation ──────────────────────────────────────────────────────────

async function updateQuotation(req, res) {
  try {
    const { id } = req.params;
    const {
      clientId,
      adHocClient,
      items,
      attn,
      observations,
      sellerName,
      deliveryDate,
      paymentTerm,
      changes, // descrição livre das alterações feitas
    } = req.body;

    // 1. Buscar orçamento existente
    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ message: 'Orçamento não encontrado' });
    }

    // 2. Controle de acesso
    if (
      req.user.profile !== 'admin' &&
      quotation.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // 3. Atualizar clientSnapshot se cliente foi alterado
    if (clientId) {
      const client = await Client.findById(clientId);
      if (!client) return res.status(404).json({ message: 'Cliente não encontrado' });
      quotation.clientId = clientId;
      quotation.clientSnapshot = {
        name: client.name, tradeName: client.tradeName, cnpj: client.cnpj,
        stateRegistration: client.stateRegistration, address: client.address,
        city: client.city, state: client.state, district: client.district,
        zipCode: client.zipCode, phone: client.phone, email: client.email,
        paymentTerm: client.paymentTerm, notes: client.notes,
      };
    } else if (adHocClient && adHocClient.name) {
      quotation.clientId = null;
      quotation.clientSnapshot = {
        name: adHocClient.name, tradeName: adHocClient.tradeName, cnpj: adHocClient.cnpj,
        stateRegistration: adHocClient.stateRegistration, address: adHocClient.address,
        city: adHocClient.city, state: adHocClient.state, district: adHocClient.district,
        zipCode: adHocClient.zipCode, phone: adHocClient.phone, email: adHocClient.email,
        paymentTerm: adHocClient.paymentTerm, notes: adHocClient.notes,
      };
    }

    // 4. Reprocessar itens se foram alterados
    if (items && items.length) {
      let processedItems, subtotal, supplierId;
      try {
        ({ processedItems, subtotal, supplierId } = await processItems(items));
      } catch (err) {
        if (err.status) {
          return res.status(err.status).json({ message: err.message });
        }
        throw err;
      }

      // Buscar fornecedor atualizado para recalcular IPI
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) return res.status(404).json({ message: 'Fornecedor não encontrado' });

      const ipi = supplier.ipi || 0;
      const subtotalWithIpi = processedItems
        .filter((i) => i.hasIpi !== false)
        .reduce((sum, i) => sum + i.subtotal, 0);
      const ipiValue = subtotalWithIpi * (ipi / 100);

      quotation.supplierId = supplierId;
      quotation.supplierSnapshot = {
        name: supplier.name, tradeName: supplier.tradeName, cnpj: supplier.cnpj,
        ipi: supplier.ipi, logoUrl: supplier.logoUrl, city: supplier.city,
      };
      quotation.items    = processedItems;
      quotation.subtotal = subtotal;
      quotation.ipiValue = ipiValue;
      quotation.total    = subtotal + ipiValue;
    }

    // 5. Atualizar campos simples (apenas os que foram enviados)
    if (attn        !== undefined) quotation.attn        = attn;
    if (observations !== undefined) quotation.observations = observations;
    if (sellerName  !== undefined) quotation.sellerName  = sellerName;
    if (deliveryDate !== undefined) quotation.deliveryDate = deliveryDate;
    if (paymentTerm !== undefined) quotation.paymentTerm = paymentTerm;

    // 6. Registrar no histórico de edições
    quotation.editHistory.push({
      editedBy: req.user.id,
      editedAt: new Date(),
      changes: changes || 'Orçamento atualizado',
    });

    await quotation.save();

    return res.json({ message: 'Orçamento atualizado com sucesso', quotation });
  } catch (err) {
    console.error('[updateQuotation]', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar orçamento' });
  }
}

// ── getQuotations ────────────────────────────────────────────────────────────

async function getQuotations(req, res) {
  try {
    const { supplierId, search, page = 1, limit = 10 } = req.query;

    const filter = {};

    // Representante vê apenas seus próprios orçamentos
    if (req.user.profile !== 'admin') {
      filter.representativeId = req.user.id;
    }

    if (supplierId) {
      filter.supplierId = supplierId;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');

      filter.$or = [
        { 'clientSnapshot.name': searchRegex },
        { 'clientSnapshot.tradeName': searchRegex },
      ];
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [quotations, total] = await Promise.all([
      Quotation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .populate('representativeId', 'name'),
      Quotation.countDocuments(filter),
    ]);

    return res.json({
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      quotations,
    });
  } catch (err) {
    console.error('[getQuotations]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar orçamentos' });
  }
}

// ── getQuotationById ─────────────────────────────────────────────────────────

async function getQuotationById(req, res) {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id);

    if (!quotation) {
      return res.status(404).json({ message: 'Orçamento não encontrado' });
    }

    if (
      req.user.profile !== 'admin' &&
      quotation.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    return res.json(quotation);
  } catch (err) {
    console.error('[getQuotationById]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar orçamento' });
  }
}

// ── getQuotationPdf ──────────────────────────────────────────────────────────

async function getQuotationPdf(req, res) {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id);

    if (!quotation) {
      return res.status(404).json({ message: 'Orçamento não encontrado' });
    }

    if (
      req.user.profile !== 'admin' &&
      quotation.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    return generateQuotationPdf(quotation, res);
  } catch (err) {
    console.error('[getQuotationPdf]', err.message);
    return res.status(500).json({ message: 'Erro ao gerar PDF do orçamento' });
  }
}

// ── generateQuotationPdf (sem salvar) ────────────────────────────────────────

async function generateQuotationPdfFromBody(req, res) {
  try {
    const quotationData = req.body;

    return generateQuotationPdf(quotationData, res);
  } catch (err) {
    console.error('[generateQuotationPdfFromBody]', err.message);
    return res.status(500).json({ message: 'Erro ao gerar PDF do orçamento' });
  }
}

// ── getClientProductsForQuotation ────────────────────────────────────────────

async function getClientProductsForQuotation(req, res) {
  try {
    const { clientId, supplierId } = req.query;

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }

    const filter = { clientId, active: true };

    if (supplierId) {
      filter.supplierId = supplierId;
    }

    const products = await Product.find(filter).select(
      '_id name description supplierCode clientCode saleMode calculationMode unitLabel supplierId technicalData commercialData selectedExtras',
    );

    return res.json(products);
  } catch (err) {
    console.error('[getClientProductsForQuotation]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar produtos' });
  }
}

// ── convertToOrder ───────────────────────────────────────────────────────────

async function convertToOrder(req, res) {
  try {
    const { id } = req.params;
    const {
      deliveryDate,
      customerPurchaseOrder,
      notes,
      paymentTerm,
      sellerName,
    } = req.body || {};

    // 1. Buscar cotação
    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ message: 'Orçamento não encontrado' });
    }

    // 2. Controle de acesso
    if (
      req.user.profile !== 'admin' &&
      quotation.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // 3. Validar que a cotação tem clientId cadastrado
    if (!quotation.clientId) {
      return res.status(400).json({
        message: 'Não é possível converter: cotação com cliente avulso. Cadastre o cliente primeiro.',
      });
    }

    // 4. Validar que todos os itens têm productId (nenhum avulso)
    const adHocItems = quotation.items.filter((item) => !item.productId);
    if (adHocItems.length > 0) {
      return res.status(400).json({
        message: `Não é possível converter: ${adHocItems.length} item(ns) avulso(s) sem produto cadastrado. Cadastre os produtos primeiro.`,
      });
    }

    // 5. Buscar cliente atualizado
    const client = await Client.findById(quotation.clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }

    // 6. Incrementar currentOrderNumber do fornecedor
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      quotation.supplierId,
      { $inc: { currentOrderNumber: 1 } },
      { returnDocument: 'after' },
    );
    if (!updatedSupplier) {
      return res.status(404).json({ message: 'Fornecedor não encontrado' });
    }

    const orderNumber = updatedSupplier.currentOrderNumber;

    // 7. Montar itens do pedido a partir dos snapshots da cotação
    // Recalcula preços buscando os produtos atuais do banco
    let subtotal = 0;
    const orderItems = [];

    for (const item of quotation.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          message: `Produto ${item.productSnapshot?.name || item.productId} não encontrado no banco`,
        });
      }

      let unitPrice, itemSubtotal;
      try {
        const supplier = await Supplier.findById(product.supplierId).select('priceTable').lean();
        const result = calculateProductPrice(product, item.quantity, supplier?.priceTable);
        unitPrice    = result.unitPrice;
        itemSubtotal = result.subtotal;
      } catch (calcErr) {
        return res.status(400).json({ message: calcErr.message });
      }

      subtotal += itemSubtotal;

      orderItems.push({
        productId: item.productId,
        productSnapshot: {
          supplierCode:    product.supplierCode,
          clientCode:      product.clientCode,
          name:            product.name,
          description:     product.description,
          productType:     product.productType,
          material:        product.material,
          saleMode:        product.saleMode,
          calculationMode: product.calculationMode,
          unitLabel:       product.unitLabel,
          technicalData:   product.technicalData,
          commercialData:  product.commercialData,
          selectedExtras:  product.selectedExtras,
        },
        quantity:  item.quantity,
        unitPrice,
        subtotal:  itemSubtotal,
        hasIpi: item.hasIpi !== false,
      });
    }

    const ipi      = updatedSupplier.ipi || 0;
    const subtotalWithIpi = orderItems
      .filter((i) => i.hasIpi !== false)
      .reduce((sum, i) => sum + i.subtotal, 0);
    const ipiValue = subtotalWithIpi * (ipi / 100);
    const total    = subtotal + ipiValue;

    // 8. Criar o pedido
    const order = await Order.create({
      orderNumber,
      clientId:             quotation.clientId,
      supplierId:           quotation.supplierId,
      representativeId:     req.user.id,
      deliveryDate:         deliveryDate         || quotation.deliveryDate,
      customerPurchaseOrder: customerPurchaseOrder || null,
      paymentTerm:          paymentTerm           || client.paymentTerm,
      sellerName:           sellerName            || quotation.sellerName || 'Valquiria Silvestre',
      notes:                notes                 || client.notes || null,
      clientSnapshot: {
        name:             client.name,
        tradeName:        client.tradeName,
        cnpj:             client.cnpj,
        stateRegistration: client.stateRegistration,
        address:          client.address,
        city:             client.city,
        state:            client.state,
        district:         client.district,
        zipCode:          client.zipCode,
        phone:            client.phone,
        email:            client.email,
        paymentTerm:      client.paymentTerm,
      },
      supplierSnapshot: {
        name:     updatedSupplier.name,
        tradeName: updatedSupplier.tradeName,
        cnpj:     updatedSupplier.cnpj,
        ipi:      updatedSupplier.ipi,
        logoUrl:  updatedSupplier.logoUrl,
      },
      items:    orderItems,
      subtotal,
      ipiValue,
      total,
    });

    return res.status(201).json({
      message: `Pedido Nº ${orderNumber} criado com sucesso a partir do orçamento`,
      order,
    });
  } catch (err) {
    console.error('[convertToOrder]', err.message);
    return res.status(500).json({ message: 'Erro ao converter orçamento em pedido' });
  }
}

/**
 * DELETE /quotations/:id
 * Apaga permanentemente um orçamento (apenas admin).
 */
async function deleteQuotation(req, res) {
  try {
    const { id } = req.params;

    if (req.user.profile !== 'admin') {
      return res.status(403).json({ message: 'Apenas administradores podem apagar orçamentos.' });
    }

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ message: 'Orçamento não encontrado.' });
    }

    await Quotation.deleteOne({ _id: quotation._id });

    return res.json({ message: 'Orçamento apagado permanentemente.' });
  } catch (err) {
    console.error('[deleteQuotation]', err.message);
    return res.status(500).json({ message: 'Erro ao apagar orçamento.' });
  }
}

module.exports = {
  createQuotation,
  updateQuotation,
  convertToOrder,
  deleteQuotation,
  getQuotations,
  getQuotationById,
  getQuotationPdf,
  generateQuotationPdfFromBody,
  getClientProductsForQuotation,
};
