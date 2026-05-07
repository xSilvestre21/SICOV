const mongoose = require('mongoose');
const Commission = require('../models/commission');
const Order = require('../models/order');

const DEFAULT_ADMIN_PERCENTAGE = 5;

/**
 * Calcula as comissões usando a lógica de dois níveis:
 * 1. pool = base × adminPercentage / 100
 * 2. representativeCommission = pool × representativePercentage / 100
 * 3. adminCommission = pool - representativeCommission
 */
function calcCommissions(base, representativePercentage, adminPercentage) {
  const pool = parseFloat(((base * adminPercentage) / 100).toFixed(2));
  const representativeCommission = parseFloat(
    ((pool * representativePercentage) / 100).toFixed(2),
  );
  const adminCommission = parseFloat((pool - representativeCommission).toFixed(2));
  return { pool, representativeCommission, adminCommission };
}

/** Determina o período (mês/ano) a partir de uma Date. */
function periodFromDate(date) {
  const d = new Date(date);
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

/** Remove campos sensíveis da resposta para o perfil Representante. */
function sanitizeForRepresentative(commission) {
  const obj = commission.toObject ? commission.toObject() : { ...commission };
  delete obj.realReceivedValue;
  delete obj.adminPercentage;
  delete obj.adminCommission;
  delete obj.realPool;
  delete obj.realAdminCommission;
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /commissions
// ─────────────────────────────────────────────────────────────────────────────
async function createCommission(req, res) {
  try {
    const {
      orderId,
      representativePercentage,
      adminPercentage = DEFAULT_ADMIN_PERCENTAGE,
      realReceivedValue,
      realDeliveryDate,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'orderId é obrigatório' });
    }

    if (representativePercentage === undefined || representativePercentage === null) {
      return res
        .status(400)
        .json({ message: 'representativePercentage é obrigatório' });
    }

    if (typeof representativePercentage !== 'number' || representativePercentage < 0) {
      return res
        .status(400)
        .json({ message: 'representativePercentage deve ser um número >= 0' });
    }

    if (typeof adminPercentage !== 'number' || adminPercentage < 0) {
      return res
        .status(400)
        .json({ message: 'adminPercentage deve ser um número >= 0' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    const orderValueWithoutIpi = order.subtotal;

    // Cálculo baseado no valor do pedido (sempre presente)
    const { pool, representativeCommission, adminCommission } = calcCommissions(
      orderValueWithoutIpi,
      representativePercentage,
      adminPercentage,
    );

    // Cálculo baseado no valor real recebido (apenas quando informado)
    let realPool = null;
    let realRepresentativeCommission = null;
    let realAdminCommission = null;
    if (realReceivedValue !== undefined && realReceivedValue !== null) {
      const realCalc = calcCommissions(realReceivedValue, representativePercentage, adminPercentage);
      realPool = realCalc.pool;
      realRepresentativeCommission = realCalc.representativeCommission;
      realAdminCommission = realCalc.adminCommission;
    }

    const referenceDate = order.deliveryDate || order.createdAt;
    const period = periodFromDate(referenceDate);

    const commission = await Commission.create({
      orderId,
      representativeId: order.representativeId,
      orderValueWithoutIpi,
      orderNumber: order.orderNumber ?? null,
      customerPurchaseOrder: order.customerPurchaseOrder ?? null,
      pool,
      realReceivedValue: realReceivedValue ?? null,
      representativePercentage,
      adminPercentage,
      representativeCommission,
      adminCommission,
      realPool,
      realRepresentativeCommission,
      realAdminCommission,
      period,
      realDeliveryDate: realDeliveryDate ?? null,
      projected: false,
    });

    return res.status(201).json({
      message: 'Comissão registrada com sucesso',
      commission,
    });
  } catch (err) {
    console.error('[createCommission]', err.message);
    return res.status(500).json({ message: 'Erro ao registrar comissão' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /commissions
// ─────────────────────────────────────────────────────────────────────────────
async function getCommissions(req, res) {
  try {
    const {
      representativeId,
      month,
      year,
      projected,
      orderNumber,
      customerPurchaseOrder,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // Representante só vê os próprios registros
    if (req.user.profile !== 'admin') {
      filter.representativeId = req.user.id;
    } else if (representativeId) {
      filter.representativeId = representativeId;
    }

    if (month) filter['period.month'] = Number(month);
    if (year) filter['period.year'] = Number(year);

    if (projected === 'true') filter.projected = true;
    if (projected === 'false') filter.projected = false;

    if (orderNumber) filter.orderNumber = Number(orderNumber);
    if (customerPurchaseOrder) {
      filter.customerPurchaseOrder = new RegExp(customerPurchaseOrder, 'i');
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [commissions, total] = await Promise.all([
      Commission.find(filter)
        .sort({ 'period.year': -1, 'period.month': -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Commission.countDocuments(filter),
    ]);

    const data =
      req.user.profile !== 'admin'
        ? commissions.map(sanitizeForRepresentative)
        : commissions;

    return res.json({
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      commissions: data,
    });
  } catch (err) {
    console.error('[getCommissions]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar comissões' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /commissions/:id
// ─────────────────────────────────────────────────────────────────────────────
async function getCommissionById(req, res) {
  try {
    const { id } = req.params;

    const commission = await Commission.findById(id);
    if (!commission) {
      return res.status(404).json({ message: 'Comissão não encontrada' });
    }

    // Representante só acessa os próprios registros
    if (
      req.user.profile !== 'admin' &&
      commission.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const data =
      req.user.profile !== 'admin'
        ? sanitizeForRepresentative(commission)
        : commission;

    return res.json(data);
  } catch (err) {
    console.error('[getCommissionById]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar comissão' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /commissions/:id
// ─────────────────────────────────────────────────────────────────────────────
async function updateCommission(req, res) {
  try {
    const { id } = req.params;
    const {
      representativePercentage,
      adminPercentage,
      realReceivedValue,
      realDeliveryDate,
    } = req.body;

    const commission = await Commission.findById(id);
    if (!commission) {
      return res.status(404).json({ message: 'Comissão não encontrada' });
    }

    // Valida percentuais se informados
    if (
      representativePercentage !== undefined &&
      (typeof representativePercentage !== 'number' || representativePercentage < 0)
    ) {
      return res
        .status(400)
        .json({ message: 'representativePercentage deve ser um número >= 0' });
    }

    if (
      adminPercentage !== undefined &&
      (typeof adminPercentage !== 'number' || adminPercentage < 0)
    ) {
      return res
        .status(400)
        .json({ message: 'adminPercentage deve ser um número >= 0' });
    }

    // Aplica alterações
    if (representativePercentage !== undefined) {
      commission.representativePercentage = representativePercentage;
    }
    if (adminPercentage !== undefined) {
      commission.adminPercentage = adminPercentage;
    }
    if (realReceivedValue !== undefined) {
      commission.realReceivedValue = realReceivedValue;
    }
    if (realDeliveryDate !== undefined) {
      commission.realDeliveryDate = realDeliveryDate;
    }

    // Recalcula comissões se qualquer campo que afeta o cálculo foi alterado
    const needsRecalc =
      representativePercentage !== undefined ||
      adminPercentage !== undefined ||
      realReceivedValue !== undefined;

    if (needsRecalc) {
      // Cálculo baseado no valor do pedido (sempre atualizado)
      const {
        pool,
        representativeCommission,
        adminCommission,
      } = calcCommissions(
        commission.orderValueWithoutIpi,
        commission.representativePercentage,
        commission.adminPercentage,
      );

      commission.pool = pool;
      commission.representativeCommission = representativeCommission;
      commission.adminCommission = adminCommission;

      // Cálculo baseado no valor real recebido (apenas quando informado)
      if (commission.realReceivedValue !== null) {
        const realCalc = calcCommissions(
          commission.realReceivedValue,
          commission.representativePercentage,
          commission.adminPercentage,
        );
        commission.realPool = realCalc.pool;
        commission.realRepresentativeCommission = realCalc.representativeCommission;
        commission.realAdminCommission = realCalc.adminCommission;
      } else {
        commission.realPool = null;
        commission.realRepresentativeCommission = null;
        commission.realAdminCommission = null;
      }
    }

    await commission.save();

    return res.json({
      message: 'Comissão atualizada com sucesso',
      commission,
    });
  } catch (err) {
    console.error('[updateCommission]', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar comissão' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /commissions/:id
// ─────────────────────────────────────────────────────────────────────────────
async function deleteCommission(req, res) {
  try {
    const { id } = req.params;

    const commission = await Commission.findByIdAndDelete(id);
    if (!commission) {
      return res.status(404).json({ message: 'Comissão não encontrada' });
    }

    return res.json({ message: 'Comissão removida com sucesso' });
  } catch (err) {
    console.error('[deleteCommission]', err.message);
    return res.status(500).json({ message: 'Erro ao remover comissão' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /commissions/:id/installments
// ─────────────────────────────────────────────────────────────────────────────
async function createInstallments(req, res) {
  try {
    const { id } = req.params;
    const {
      intervals,
      representativePercentage,
      adminPercentage = DEFAULT_ADMIN_PERCENTAGE,
    } = req.body;

    // Validações
    if (!Array.isArray(intervals) || intervals.length === 0) {
      return res
        .status(400)
        .json({ message: 'intervals deve ser uma lista não vazia' });
    }

    const hasInvalidInterval = intervals.some(
      (v) => !Number.isInteger(v) || v <= 0,
    );
    if (hasInvalidInterval) {
      return res
        .status(400)
        .json({ message: 'Todos os intervalos devem ser inteiros positivos' });
    }

    if (representativePercentage === undefined || representativePercentage === null) {
      return res
        .status(400)
        .json({ message: 'representativePercentage é obrigatório' });
    }

    if (typeof representativePercentage !== 'number' || representativePercentage < 0) {
      return res
        .status(400)
        .json({ message: 'representativePercentage deve ser um número >= 0' });
    }

    if (typeof adminPercentage !== 'number' || adminPercentage < 0) {
      return res
        .status(400)
        .json({ message: 'adminPercentage deve ser um número >= 0' });
    }

    const parentCommission = await Commission.findById(id);
    if (!parentCommission) {
      return res.status(404).json({ message: 'Comissão não encontrada' });
    }

    const order = await Order.findById(parentCommission.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Pedido original não encontrado' });
    }

    const referenceDate = order.deliveryDate || order.createdAt;

    // Saldo pendente = valor do pedido sem IPI menos o que já foi recebido
    const alreadyReceived = parentCommission.realReceivedValue ?? 0;
    const pendingBalance = parentCommission.orderValueWithoutIpi - alreadyReceived;

    const installmentValue = parseFloat(
      (pendingBalance / intervals.length).toFixed(2),
    );

    const installments = intervals.map((intervalDays, index) => {
      const dueDate = new Date(referenceDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + intervalDays);

      const period = periodFromDate(dueDate);

      const { pool, representativeCommission, adminCommission } = calcCommissions(
        installmentValue,
        representativePercentage,
        adminPercentage,
      );

      return {
        orderId: parentCommission.orderId,
        representativeId: parentCommission.representativeId,
        orderValueWithoutIpi: installmentValue,
        pool,
        realReceivedValue: null,
        representativePercentage,
        adminPercentage,
        representativeCommission,
        adminCommission,
        period,
        realDeliveryDate: null,
        projected: true,
        dueDate,
        parentOrderId: parentCommission.orderId,
        installmentIndex: index + 1,
      };
    });

    const created = await Commission.insertMany(installments);

    return res.status(201).json({
      message: `${created.length} parcela(s) projetada(s) com sucesso`,
      installments: created,
    });
  } catch (err) {
    console.error('[createInstallments]', err.message);
    return res.status(500).json({ message: 'Erro ao projetar parcelas' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /commissions/summary
// ─────────────────────────────────────────────────────────────────────────────
async function getCommissionsSummary(req, res) {
  try {
    const { month, year, representativeId } = req.query;

    const matchStage = {};

    // Representante só vê o resumo dos seus próprios registros
    if (req.user.profile !== 'admin') {
      matchStage.representativeId = mongoose.isValidObjectId(req.user.id)
        ? new mongoose.Types.ObjectId(req.user.id)
        : req.user.id;
    } else if (representativeId) {
      matchStage.representativeId = mongoose.isValidObjectId(representativeId)
        ? new mongoose.Types.ObjectId(representativeId)
        : representativeId;
    }

    if (month) matchStage['period.month'] = Number(month);
    if (year) matchStage['period.year'] = Number(year);

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            period: '$period',
            representativeId: '$representativeId',
          },
          totalRepresentativeCommission: { $sum: '$representativeCommission' },
          totalAdminCommission: { $sum: '$adminCommission' },
          totalPool: { $sum: '$pool' },
          totalRealRepresentativeCommission: {
            $sum: { $ifNull: ['$realRepresentativeCommission', 0] },
          },
          totalRealAdminCommission: {
            $sum: { $ifNull: ['$realAdminCommission', 0] },
          },
          totalRealPool: {
            $sum: { $ifNull: ['$realPool', 0] },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          representativeId: '$_id.representativeId',
          totalRepresentativeCommission: { $round: ['$totalRepresentativeCommission', 2] },
          totalAdminCommission: { $round: ['$totalAdminCommission', 2] },
          totalPool: { $round: ['$totalPool', 2] },
          totalRealRepresentativeCommission: { $round: ['$totalRealRepresentativeCommission', 2] },
          totalRealAdminCommission: { $round: ['$totalRealAdminCommission', 2] },
          totalRealPool: { $round: ['$totalRealPool', 2] },
          count: 1,
        },
      },
      {
        $sort: { 'period.year': -1, 'period.month': -1 },
      },
    ];

    const results = await Commission.aggregate(pipeline);

    // Remover campos sensíveis para Representante
    const data =
      req.user.profile !== 'admin'
        ? results.map(({ totalAdminCommission, totalRealAdminCommission, ...rest }) => rest)
        : results;

    return res.json({ summary: data });
  } catch (err) {
    console.error('[getCommissionsSummary]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar resumo de comissões' });
  }
}

module.exports = {
  getCommissions,
  getCommissionById,
  updateCommission,
  deleteCommission,
  createInstallments,
  getCommissionsSummary,
};
