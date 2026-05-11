const Order = require('../models/order');
const Product = require('../models/product');
const Client = require('../models/client');
const Supplier = require('../models/supplier');
const Settings = require('../models/settings');
const User = require('../models/user');
const Commission = require('../models/commission');
const generateOrderPdf = require('../utils/orderPdfGenerator');
const { calculateProductPrice } = require('../utils/priceCalculator');

const DEFAULT_ADMIN_PERCENTAGE = 5;

/**
 * Calcula as comissões usando a lógica de dois níveis:
 * pool = base × adminPercentage / 100
 * representativeCommission = pool × representativePercentage / 100
 * adminCommission = pool - representativeCommission
 */
function calcCommissions(base, representativePercentage, adminPercentage) {
  const pool = parseFloat(((base * adminPercentage) / 100).toFixed(2));
  const representativeCommission = parseFloat(
    ((pool * representativePercentage) / 100).toFixed(2),
  );
  const adminCommission = parseFloat((pool - representativeCommission).toFixed(2));
  return { pool, representativeCommission, adminCommission };
}

function periodFromDate(date) {
  const d = new Date(date);
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

/** Busca o nome padrão da vendedora nas settings (com fallback seguro). */
async function getDefaultSellerName() {
  try {
    const settings = await Settings.findOne({ singleton: true });
    return settings?.defaultSellerName || 'Valquiria Silvestre';
  } catch {
    return 'Valquiria Silvestre';
  }
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
      sellerName: sellerName || await getDefaultSellerName(),
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

    // Cria automaticamente o Registro_Comissao usando o percentual padrão do representante
    try {
      const representative = await User.findById(req.user.id).select('defaultCommissionPercentage');
      const representativePercentage = representative?.defaultCommissionPercentage ?? 0;
      const referenceDate = deliveryDate || order.createdAt;
      const period = periodFromDate(referenceDate);
      const { pool, representativeCommission, adminCommission } = calcCommissions(
        subtotal,
        representativePercentage,
        DEFAULT_ADMIN_PERCENTAGE,
      );

      await Commission.create({
        orderId: order._id,
        representativeId: order.representativeId,
        orderValueWithoutIpi: subtotal,
        orderNumber: order.orderNumber,
        customerPurchaseOrder: customerPurchaseOrder ?? null,
        pool,
        realReceivedValue: null,
        representativePercentage,
        adminPercentage: DEFAULT_ADMIN_PERCENTAGE,
        representativeCommission,
        adminCommission,
        period,
        realDeliveryDate: null,
        projected: false,
      });
    } catch (commErr) {
      // Falha na criação da comissão não deve impedir a resposta do pedido
      console.error('[createOrder] Erro ao criar comissão automática:', commErr.message);
    }

    return res.status(201).json({
      message: 'Pedido criado com sucesso',
      order,
    });
  } catch (err) {
    console.error('[createOrder]', err.message);
    return res.status(500).json({
      message: 'Erro ao criar pedido',
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
    console.error('[markAsSentToSupplier]', err.message);
    return res.status(500).json({
      message: 'Erro ao atualizar envio',
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

    // Cancela a comissão vinculada (falha silenciosa para não bloquear o cancelamento)
    try {
      await Commission.updateMany(
        { orderId: order._id, projected: false },
        { $set: { status: 'cancelled' } },
      );
    } catch (commErr) {
      console.error('[cancelOrder] Erro ao cancelar comissão:', commErr.message);
    }

    return res.json({
      message: 'Pedido cancelado com sucesso',
      order,
    });
  } catch (err) {
    console.error('[cancelOrder]', err.message);
    return res.status(500).json({
      message: 'Erro ao cancelar pedido',
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
    console.error('[getOrders]', err.message);
    return res.status(500).json({
      message: 'Erro ao buscar pedidos',
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
    console.error('[getOrderById]', err.message);
    return res.status(500).json({
      message: 'Erro ao buscar pedido',
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

    // Atualiza a comissão vinculada se o subtotal mudou
    try {
      const commission = await Commission.findOne({ orderId: order._id, projected: false });
      if (commission && commission.orderValueWithoutIpi !== subtotal) {
        commission.orderValueWithoutIpi = subtotal;
        commission.customerPurchaseOrder =
          order.customerPurchaseOrder ?? commission.customerPurchaseOrder;

        // Recalcula com base no novo valor do pedido
        const newPool = parseFloat(
          ((subtotal * commission.adminPercentage) / 100).toFixed(2),
        );
        const newRepComm = parseFloat(
          ((newPool * commission.representativePercentage) / 100).toFixed(2),
        );
        const newAdminComm = parseFloat((newPool - newRepComm).toFixed(2));

        commission.pool = newPool;
        commission.representativeCommission = newRepComm;
        commission.adminCommission = newAdminComm;

        // Recalcula valores reais se realReceivedValue estiver definido
        if (commission.realReceivedValue !== null) {
          const realPool = parseFloat(
            ((commission.realReceivedValue * commission.adminPercentage) / 100).toFixed(2),
          );
          const realRepComm = parseFloat(
            ((realPool * commission.representativePercentage) / 100).toFixed(2),
          );
          commission.realPool = realPool;
          commission.realRepresentativeCommission = realRepComm;
          commission.realAdminCommission = parseFloat((realPool - realRepComm).toFixed(2));
        }

        await commission.save();
      }
    } catch (commErr) {
      console.error('[updateOrder] Erro ao atualizar comissão:', commErr.message);
    }

    return res.json({
      message: 'Pedido atualizado com sucesso',
      order,
    });
  } catch (err) {
    console.error('[updateOrder]', err.message);
    return res.status(500).json({
      message: 'Erro ao atualizar pedido',
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
    console.error('[getDuplicateOrderTemplate]', err.message);
    return res.status(500).json({
      message: 'Erro ao montar cópia do pedido',
    });
  }
}

async function getOrderPdf(req, res) {
  try {
    const { id } = req.params;

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
    console.error('[getOrderPdf]', err.message);
    return res.status(500).json({
      message: 'Erro ao gerar PDF do pedido',
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
