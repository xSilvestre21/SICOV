const Order = require('../models/order');
const Product = require('../models/product');
const Client = require('../models/client');
const Supplier = require('../models/supplier');
const generateOrderPdf = require('../utils/orderPdfGenerator');

function calculateProductPrice(product, quantity) {
  const cd = product.commercialData || {};
  const td = product.technicalData || {};
  const measurements = td.measurements || {};

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

  if (!unitPrice || unitPrice <= 0) {
    throw new Error(`Produto ${product.name} não possui preço válido`);
  }

  const subtotal = unitPrice * quantity;

  return {
    unitPrice,
    subtotal,
  };
}

async function createOrder(req, res) {
  try {
    const {
      clientId,
      items,
      notes,
      deliveryDate,
      customerPurchaseOrder,
      sellerName,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: 'Cliente é obrigatório' });
    }

    if (!items || !items.length) {
      return res.status(400).json({ message: 'Itens são obrigatórios' });
    }

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }

    let supplierId = null;
    let supplier = null;

    let subtotal = 0;
    const processedItems = [];

    await Promise.all(
      items.map(async (item) => {
        const { productId, quantity } = item;

        if (!productId || !quantity) {
          throw new Error('Produto e quantidade são obrigatórios');
        }

        const product = await Product.findById(productId);

        if (!product) {
          throw new Error('Produto não encontrado');
        }

        if (!supplierId) {
          const { supplierId: productSupplierId } = product;
          supplierId = productSupplierId;
          supplier = await Supplier.findById(supplierId);
        } else if (supplierId.toString() !== product.supplierId.toString()) {
          throw new Error('Todos os produtos devem ser do mesmo fornecedor');
        }

        const { unitPrice, subtotal: itemSubtotal } = calculateProductPrice(
          product,
          quantity,
        );

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
        });
      }),
    );

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      supplierId,
      { $inc: { currentOrderNumber: 1 } },
      { returnDocument: 'after' },
    );

    if (!updatedSupplier) {
      return res.status(404).json({
        message: 'Fornecedor não encontrado',
      });
    }

    supplier = updatedSupplier;

    const orderNumber = supplier.currentOrderNumber;

    const ipi = supplier.ipi || 0;
    const ipiValue = subtotal * (ipi / 100);

    const total = subtotal + ipiValue;

    const order = await Order.create({
      orderNumber,
      clientId,
      supplierId,
      deliveryDate,
      customerPurchaseOrder,
      paymentTerm: client.paymentTerm,
      sellerName: sellerName || 'Valquiria Silvestre',
      representativeId: req.user.id,
      clientSnapshot: {
        name: client.name,
        tradeName: client.tradeName,
        cnpj: client.cnpj,
        stateRegistration: client.stateRegistration,
        address: client.address,
        city: client.city,
        state: client.state,
        district: client.district,
        zipCode: client.zipCode,
        phone: client.phone,
        email: client.email,
        paymentTerm: client.paymentTerm,
      },
      supplierSnapshot: {
        name: supplier.name,
        tradeName: supplier.tradeName,
        cnpj: supplier.cnpj,
        ipi: supplier.ipi,
        logoUrl: supplier.logoUrl,
      },
      items: processedItems,
      subtotal,
      ipiValue,
      total,
      notes,
    });

    return res.status(201).json({
      message: 'Pedido criado com sucesso',
      order,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao criar pedido',
      error: err.message,
    });
  }
}

async function markAsSentToSupplier(req, res) {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        message: 'Pedido não encontrado',
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        message: 'Pedido cancelado não pode ser alterado',
      });
    }

    order.sentToSupplier = !order.sentToSupplier;

    if (order.sentToSupplier) {
      order.sentToSupplierAt = new Date();
      order.sentToSupplierBy = req.user.id;
    } else {
      order.sentToSupplierAt = null;
      order.sentToSupplierBy = null;
    }

    await order.save();

    return res.json({
      message: order.sentToSupplier
        ? 'Pedido marcado como enviado ao fornecedor'
        : 'Envio desmarcado com sucesso',
      order,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao atualizar envio',
      error: err.message,
    });
  }
}

async function cancelOrder(req, res) {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        message: 'Pedido não encontrado',
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        message: 'Pedido já está cancelado',
      });
    }

    order.status = 'cancelled';
    order.sentToSupplier = false;
    order.sentToSupplierAt = null;
    order.sentToSupplierBy = null;

    await order.save();

    return res.json({
      message: 'Pedido cancelado com sucesso',
      order,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao cancelar pedido',
      error: err.message,
    });
  }
}

async function getOrders(req, res) {
  try {
    const {
      status,
      clientId,
      supplierId,
      sentToSupplier,
      orderNumber,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (clientId) {
      filter.clientId = clientId;
    }

    if (supplierId) {
      filter.supplierId = supplierId;
    }

    if (sentToSupplier === 'true') {
      filter.sentToSupplier = true;
    }

    if (sentToSupplier === 'false') {
      filter.sentToSupplier = false;
    }

    if (orderNumber) {
      filter.orderNumber = Number(orderNumber);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');

      filter.$or = [
        { 'clientSnapshot.name': searchRegex },
        { 'clientSnapshot.tradeName': searchRegex },
        { 'supplierSnapshot.name': searchRegex },
        { 'supplierSnapshot.tradeName': searchRegex },
        { notes: searchRegex },
        { customerPurchaseOrder: searchRegex },
      ];

      const numericSearch = Number(search);

      if (!Number.isNaN(numericSearch)) {
        filter.$or.push({ orderNumber: numericSearch });
      }
    }

    if (req.user.profile !== 'admin') {
      filter.representativeId = req.user.id;
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNumber),

      Order.countDocuments(filter),
    ]);

    return res.json({
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      orders,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao buscar pedidos',
      error: err.message,
    });
  }
}

async function getOrderById(req, res) {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        message: 'Pedido não encontrado',
      });
    }

    if (
      req.user.profile !== 'admin' &&
      order.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: 'Acesso negado',
      });
    }

    return res.json(order);
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao buscar pedido',
      error: err.message,
    });
  }
}

async function updateOrder(req, res) {
  try {
    const { id } = req.params;
    const { items, notes, deliveryDate, customerPurchaseOrder, sellerName } =
      req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        message: 'Pedido não encontrado',
      });
    }

    if (
      req.user.profile !== 'admin' &&
      order.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: 'Acesso negado',
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        message: 'Pedido cancelado não pode ser editado',
      });
    }

    if (order.sentToSupplier) {
      return res.status(400).json({
        message: 'Pedido já enviado ao fornecedor não pode ser editado',
      });
    }

    if (!items || !items.length) {
      return res.status(400).json({
        message: 'Itens são obrigatórios',
      });
    }

    const processedItems = [];
    let subtotal = 0;

    await Promise.all(
      items.map(async (item) => {
        const { productId, quantity } = item;

        if (!productId || !quantity) {
          throw new Error('Produto e quantidade são obrigatórios');
        }

        const product = await Product.findById(productId);

        if (!product) {
          throw new Error('Produto não encontrado');
        }

        if (product.supplierId.toString() !== order.supplierId.toString()) {
          throw new Error(
            'Não é permitido alterar o fornecedor de um pedido existente',
          );
        }

        const { unitPrice, subtotal: itemSubtotal } = calculateProductPrice(
          product,
          quantity,
        );

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
        });
      }),
    );

    const supplier = await Supplier.findById(order.supplierId);

    if (!supplier) {
      return res.status(404).json({
        message: 'Fornecedor do pedido não encontrado',
      });
    }

    const ipi = supplier.ipi || 0;
    const ipiValue = subtotal * (ipi / 100);
    const total = subtotal + ipiValue;

    order.items = processedItems;
    order.subtotal = subtotal;
    order.ipiValue = ipiValue;
    order.total = total;
    order.notes = notes !== undefined ? notes : order.notes;

    order.deliveryDate =
      deliveryDate !== undefined ? deliveryDate : order.deliveryDate;

    order.customerPurchaseOrder =
      customerPurchaseOrder !== undefined
        ? customerPurchaseOrder
        : order.customerPurchaseOrder;

    order.supplierSnapshot = {
      name: supplier.name,
      tradeName: supplier.tradeName,
      cnpj: supplier.cnpj,
      ipi: supplier.ipi,
      logoUrl: supplier.logoUrl,
    };

    order.sellerName = sellerName !== undefined ? sellerName : order.sellerName;

    await order.save();

    return res.json({
      message: 'Pedido atualizado com sucesso',
      order,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao atualizar pedido',
      error: err.message,
    });
  }
}

async function getDuplicateOrderTemplate(req, res) {
  try {
    const { id } = req.params;

    const oldOrder = await Order.findById(id);

    if (!oldOrder) {
      return res.status(404).json({
        message: 'Pedido original não encontrado',
      });
    }

    if (
      req.user.profile !== 'admin' &&
      oldOrder.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: 'Acesso negado',
      });
    }

    return res.json({
      clientId: oldOrder.clientId,
      items: oldOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      notes: oldOrder.notes,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao montar cópia do pedido',
      error: err.message,
    });
  }
}

async function getOrderPdf(req, res) {
  try {
    const { id } = req.params;

    // 🔥 REGRA: só admin pode gerar PDF
    if (req.user.profile !== 'admin') {
      return res.status(403).json({
        message: 'Apenas administradores podem gerar o PDF do pedido',
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        message: 'Pedido não encontrado',
      });
    }

    return generateOrderPdf(order, res);
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao gerar PDF do pedido',
      error: err.message,
    });
  }
}

module.exports = {
  createOrder,
  markAsSentToSupplier,
  cancelOrder,
  getOrders,
  getOrderById,
  updateOrder,
  getDuplicateOrderTemplate,
  getOrderPdf,
};
