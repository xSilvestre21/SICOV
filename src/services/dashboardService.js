/**
 * Dashboard Service
 *
 * Contém funções auxiliares de agregação para os endpoints do Dashboard.
 */

const Order = require('../models/order');
const Commission = require('../models/commission');
const User = require('../models/user');
const Client = require('../models/client');

/**
 * Constrói filtro de período para o modelo Commission (usa campo period.month / period.year).
 * Para granularidade 'monthly': filtra apenas pelo ano (retorna todos os meses do ano).
 * Para granularidade 'annual': filtra os últimos 5 anos.
 * Sem granularidade: filtra por mês e ano específicos.
 *
 * @param {number|undefined} month - Mês (1-12)
 * @param {number|undefined} year - Ano (2000-2100)
 * @param {string} [granularity] - 'monthly' ou 'annual'
 * @returns {object} Filtro MongoDB para commissions
 */
function buildPeriodFilter(month, year, granularity) {
  if (granularity === 'annual') {
    return { 'period.year': { $gte: year - 4, $lte: year } };
  }
  if (granularity === 'monthly' && year) {
    // Mostra todos os meses do ano selecionado (para gráficos de evolução)
    return { 'period.year': year };
  }
  if (month && year) {
    return { 'period.month': month, 'period.year': year };
  }
  const now = new Date();
  return { 'period.month': now.getMonth() + 1, 'period.year': now.getFullYear() };
}

/**
 * Constrói filtro de período para o modelo Order.
 * Usa deliveryDate como referência principal (define o período do pedido).
 * Pedidos sem deliveryDate usam createdAt como fallback.
 * Usa $or para capturar ambos os cenários de forma compatível com aggregation.
 *
 * @param {number|undefined} month - Mês (1-12)
 * @param {number|undefined} year - Ano (2000-2100)
 * @param {string} [granularity] - 'monthly' ou 'annual'
 * @returns {object} Filtro MongoDB para orders
 */
function buildOrderPeriodFilter(month, year, granularity) {
  let startDate, endDate;

  if (granularity === 'annual') {
    startDate = new Date(year - 4, 0, 1);
    endDate = new Date(year + 1, 0, 1);
  } else if (month && year) {
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 1);
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  // Pedidos com deliveryDate no período OU pedidos sem deliveryDate criados no período
  return {
    $or: [
      { deliveryDate: { $gte: startDate, $lt: endDate } },
      { deliveryDate: null, createdAt: { $gte: startDate, $lt: endDate } },
    ],
  };
}

/**
 * Constrói filtro de representante. Retorna filtro vazio para admin,
 * ou filtro por representativeId para representantes.
 * @param {object} user - Objeto do usuário autenticado (com _id e profile)
 * @returns {object} Filtro MongoDB
 */
function buildRepresentativeFilter(user) {
  if (user.profile === 'admin') return {};
  return { representativeId: user._id };
}

/**
 * Preenche meses sem dados com valores zerados (zero-fill).
 * Garante que o resultado sempre contenha exatamente 12 entries (jan-dez).
 * @param {Array} data - Array de objetos com campo period.month
 * @param {number} year - Ano de referência
 * @returns {Array} Array com 12 entries (uma por mês)
 */
function zeroFillMonths(data, year) {
  const map = new Map(data.map((d) => [d.period.month, d]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return (
      map.get(month) || {
        period: { month, year },
        totalAdminCommission: 0,
        totalRepresentativeCommission: 0,
        totalRevenue: 0,
      }
    );
  });
}

/**
 * Preenche anos sem dados com valores zerados (zero-fill).
 * Garante que o resultado sempre contenha exatamente 5 entries (últimos 5 anos).
 * @param {Array} data - Array de objetos com campo period.year
 * @param {number} endYear - Ano final do intervalo
 * @returns {Array} Array com 5 entries (uma por ano)
 */
function zeroFillYears(data, endYear) {
  const map = new Map(data.map((d) => [d.period.year, d]));
  return Array.from({ length: 5 }, (_, i) => {
    const year = endYear - 4 + i;
    return (
      map.get(year) || {
        period: { month: null, year },
        totalAdminCommission: 0,
        totalRepresentativeCommission: 0,
        totalRevenue: 0,
      }
    );
  });
}

/**
 * Remove campos de adminCommission dos dados quando o perfil não é admin.
 * Garante que representantes nunca vejam valores de comissão do administrador.
 * @param {object|Array} data - Dados a sanitizar (objeto ou array de objetos)
 * @param {string} profile - Perfil do usuário ('admin' ou 'representative')
 * @returns {object|Array} Dados sanitizados
 */
function sanitizeForRepresentative(data, profile) {
  if (profile === 'admin') return data;
  if (Array.isArray(data)) {
    return data.map((item) => {
      const { totalAdminCommission, adminCommission, ...rest } = item;
      return rest;
    });
  }
  const { totalAdminCommission, adminCommission, ...rest } = data;
  return rest;
}

/**
 * Agrega faturamento por cliente a partir de pedidos ativos.
 * Pipeline: match (active + período + representante) → group by clientId → sort desc → limit → project
 * @param {object} params
 * @param {number} [params.month] - Mês (1-12)
 * @param {number} [params.year] - Ano (2000-2100)
 * @param {object} [params.user] - Objeto do usuário autenticado (com _id e profile)
 * @param {number} [params.limit=20] - Quantidade máxima de clientes retornados
 * @returns {Promise<Array<{clientId: string, tradeName: string, totalRevenue: number}>>}
 */
async function aggregateClientsRevenue({ month, year, granularity, user, limit = 20 }) {
  // Usa comissões como fonte de verdade para determinar quais pedidos pertencem ao período
  const commissionPeriodFilter = granularity === 'annual'
    ? buildPeriodFilter(month, year, 'annual')
    : buildPeriodFilter(month, year);
  const representativeFilter = user.profile === 'admin' ? {} : { representativeId: user._id };

  // Step 1: Buscar orderIds das comissões do período (excluindo parcelas para não duplicar)
  const commissionPipeline = [
    {
      $match: {
        status: { $ne: 'cancelled' },
        installmentIndex: null, // Exclui parcelas (que duplicariam o pedido)
        ...commissionPeriodFilter,
        ...representativeFilter,
      },
    },
    { $group: { _id: null, orderIds: { $addToSet: '$orderId' } } },
  ];

  const commResult = await Commission.aggregate(commissionPipeline);
  const orderIds = commResult.length > 0 ? commResult[0].orderIds : [];

  if (orderIds.length === 0) return [];

  // Step 2: Agregar pedidos ativos vinculados a essas comissões
  const pipeline = [
    { $match: { _id: { $in: orderIds }, status: 'active' } },
    {
      $group: {
        _id: '$clientId',
        totalRevenue: { $sum: '$subtotal' },
        tradeName: { $first: '$clientSnapshot.tradeName' },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        clientId: '$_id',
        tradeName: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
      },
    },
  ];

  return Order.aggregate(pipeline);
}

/**
 * Agrega os top clientes por receita a partir de pedidos ativos.
 * Pipeline: match (active + período + representante) → group by clientId → sort desc → limit
 * @param {object} params
 * @param {number} [params.month] - Mês (1-12)
 * @param {number} [params.year] - Ano (2000-2100)
 * @param {string|undefined} [params.representativeId] - ID do representante (undefined para admin)
 * @param {number} [params.limit=10] - Quantidade máxima de clientes retornados (max 50)
 * @returns {Promise<Array<{clientId: string, tradeName: string, totalRevenue: number}>>}
 */
async function aggregateTopClients({ month, year, granularity, representativeId, limit = 10 }) {
  const effectiveLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  // Usa comissões como fonte de verdade para determinar quais pedidos pertencem ao período
  const commissionPeriodFilter = granularity === 'annual'
    ? buildPeriodFilter(month, year, 'annual')
    : buildPeriodFilter(month, year);
  const representativeFilter = representativeId ? { representativeId } : {};

  // Step 1: Buscar orderIds das comissões do período (excluindo parcelas para não duplicar)
  const commissionPipeline = [
    {
      $match: {
        status: { $ne: 'cancelled' },
        installmentIndex: null, // Exclui parcelas (que duplicariam o pedido)
        ...commissionPeriodFilter,
        ...representativeFilter,
      },
    },
    { $group: { _id: null, orderIds: { $addToSet: '$orderId' } } },
  ];

  const commResult = await Commission.aggregate(commissionPipeline);
  const orderIds = commResult.length > 0 ? commResult[0].orderIds : [];

  if (orderIds.length === 0) return [];

  // Step 2: Agregar pedidos ativos vinculados a essas comissões
  const pipeline = [
    { $match: { _id: { $in: orderIds }, status: 'active' } },
    {
      $group: {
        _id: '$clientId',
        totalRevenue: { $sum: '$subtotal' },
        tradeName: { $first: '$clientSnapshot.tradeName' },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: effectiveLimit },
    {
      $project: {
        _id: 0,
        clientId: '$_id',
        tradeName: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
      },
    },
  ];

  return Order.aggregate(pipeline);
}

/**
 * Agrega desempenho dos representantes: total de pedidos, valor vendido e comissão gerada.
 * Usa as comissões (que possuem o representativeId correto vinculado ao cliente) como base,
 * e faz lookup nos pedidos para obter métricas de valor vendido.
 * Isso garante que pedidos criados pelo admin sejam contabilizados para o representante
 * vinculado ao cliente, não para quem criou o pedido.
 *
 * @param {object} params
 * @param {number} [params.month] - Mês (1-12)
 * @param {number} [params.year] - Ano (2000-2100)
 * @param {string|undefined} [params.representativeId] - ID do representante (undefined para admin)
 * @returns {Promise<Array<{representativeId: string, name: string, orderCount: number, totalSold: number, totalCommission: number}>>}
 */
async function aggregateRepresentativesPerformance({ month, year, granularity, representativeId }) {
  const periodFilter = buildOrderPeriodFilter(month, year, granularity);
  // Para comissões: quando mensal, filtra pelo mês específico; quando anual, filtra pelo intervalo de anos
  const commissionPeriodFilter = granularity === 'annual'
    ? buildPeriodFilter(month, year, 'annual')
    : buildPeriodFilter(month, year);
  const representativeFilter = representativeId ? { representativeId } : {};

  // Step 1: Aggregate commissions to find the correct representative per order
  // Commissions have the correct representativeId (linked to the client, not who created the order)
  const commissionPipeline = [
    {
      $match: {
        status: 'active',
        installmentsCreated: { $ne: true },
        ...commissionPeriodFilter,
        ...representativeFilter,
      },
    },
    {
      $group: {
        _id: '$representativeId',
        totalCommission: { $sum: '$representativeCommission' },
        orderIds: { $addToSet: '$orderId' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        representativeId: '$_id',
        name: { $ifNull: ['$user.name', 'Desconhecido'] },
        totalCommission: { $round: ['$totalCommission', 2] },
        orderIds: 1,
      },
    },
  ];

  const commissionsData = await Commission.aggregate(commissionPipeline);

  // Step 2: For each representative, count active orders and sum subtotal from their linked orders
  // Não filtramos pedidos por período aqui — os pedidos já foram identificados via comissões do período
  const results = await Promise.all(
    commissionsData.map(async (rep) => {
      const orderMatch = {
        _id: { $in: rep.orderIds },
        status: 'active',
      };

      const orderAgg = await Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: null,
            orderCount: { $sum: 1 },
            totalSold: { $sum: '$subtotal' },
          },
        },
      ]);

      const orderData = orderAgg[0] || { orderCount: 0, totalSold: 0 };

      return {
        representativeId: rep.representativeId,
        name: rep.name,
        orderCount: orderData.orderCount,
        totalSold: Math.round(orderData.totalSold * 100) / 100,
        totalCommission: rep.totalCommission,
      };
    }),
  );

  // Also include representatives that have orders linked directly but no commissions yet
  // (edge case: orders exist but commission creation failed)

  // Look for orders linked to representatives via client.representativeId
  // by checking orders that have commissions pointing to different representatives
  const additionalOrdersPipeline = [
    { $match: { status: 'active', ...representativeFilter } },
    {
      $lookup: {
        from: 'commissions',
        localField: '_id',
        foreignField: 'orderId',
        as: 'commissions',
      },
    },
    {
      $match: {
        'commissions.0': { $exists: true },
      },
    },
    { $unwind: '$commissions' },
  ];

  // Prefixar campos do filtro de período com 'commissions.' para match após unwind
  const prefixedCommissionFilter = {};
  for (const [key, val] of Object.entries(commissionPeriodFilter)) {
    prefixedCommissionFilter[`commissions.${key}`] = val;
  }

  additionalOrdersPipeline.push(
    {
      $match: {
        'commissions.status': 'active',
        'commissions.installmentsCreated': { $ne: true },
        ...prefixedCommissionFilter,
      },
    },
    {
      $group: {
        _id: '$commissions.representativeId',
        orderCount: { $sum: 1 },
        totalSold: { $sum: '$subtotal' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        representativeId: '$_id',
        name: { $ifNull: ['$user.name', 'Desconhecido'] },
        orderCount: 1,
        totalSold: { $round: ['$totalSold', 2] },
      },
    },
    { $sort: { totalSold: -1 } },
  );

  const additionalData = await Order.aggregate(additionalOrdersPipeline);

  // Merge: use the commission-based data as primary (it has correct totalCommission)
  // and fill in any missing representatives from the order-based lookup
  const commissionMap = new Map(results.map((r) => [r.representativeId.toString(), r]));

  for (const item of additionalData) {
    const key = item.representativeId.toString();
    if (!commissionMap.has(key)) {
      commissionMap.set(key, {
        representativeId: item.representativeId,
        name: item.name,
        orderCount: item.orderCount,
        totalSold: item.totalSold,
        totalCommission: 0,
      });
    } else {
      // Update orderCount and totalSold from the more accurate order-based aggregation
      const existing = commissionMap.get(key);
      existing.orderCount = item.orderCount;
      existing.totalSold = item.totalSold;
    }
  }

  const finalResults = Array.from(commissionMap.values());
  finalResults.sort((a, b) => b.totalSold - a.totalSold);

  return finalResults;
}

/**
 * Agrega dados detalhados de um cliente específico para o endpoint /dashboard/client/:clientId.
 * Pipeline: match orders for client → aggregate totals and evolution.
 * Também agrega comissões do cliente via lookup nos pedidos.
 *
 * @param {object} params
 * @param {string} params.clientId - ID do cliente
 * @param {number} [params.month] - Mês (1-12)
 * @param {number} [params.year] - Ano (2000-2100)
 * @param {string} [params.granularity] - 'monthly' ou 'annual'
 * @param {string} [params.representativeId] - ID do representante (para controle de acesso)
 * @returns {Promise<object|null>} { client, totalOrders, totalRevenue, totalCommissions, evolution } ou null se cliente não existir
 */
async function aggregateClientDetail({ clientId, month, year, granularity, representativeId }) {
  const mongoose = require('mongoose');

  // Lookup client info
  const client = await Client.findById(clientId).select('name tradeName').lean();
  if (!client) {
    return null;
  }

  // Build base match filter for orders
  const orderMatch = {
    clientId: new mongoose.Types.ObjectId(clientId),
    status: 'active',
    ...buildOrderPeriodFilter(month, year, granularity),
  };

  // Apply representative filter for access control
  if (representativeId) {
    orderMatch.representativeId = new mongoose.Types.ObjectId(representativeId);
  }

  // Aggregate totals from orders
  const totalsPipeline = [
    { $match: orderMatch },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$subtotal' },
      },
    },
  ];

  const totalsResult = await Order.aggregate(totalsPipeline);
  const totalOrders = totalsResult.length > 0 ? totalsResult[0].totalOrders : 0;
  const totalRevenue =
    totalsResult.length > 0 ? Math.round(totalsResult[0].totalRevenue * 100) / 100 : 0;

  // Get order IDs for this client in the period (to lookup commissions)
  const orderIds = await Order.find(orderMatch).select('_id').lean();
  const orderIdList = orderIds.map((o) => o._id);

  // Aggregate commissions for this client's orders
  const commissionMatch = {
    orderId: { $in: orderIdList },
    status: { $ne: 'cancelled' },
    installmentsCreated: { $ne: true },
  };

  if (representativeId) {
    commissionMatch.representativeId = new mongoose.Types.ObjectId(representativeId);
  }

  const commissionTotalsPipeline = [
    { $match: commissionMatch },
    {
      $group: {
        _id: null,
        totalCommissions: { $sum: '$representativeCommission' },
      },
    },
  ];

  const commissionTotalsResult = await Commission.aggregate(commissionTotalsPipeline);
  const totalCommissions =
    commissionTotalsResult.length > 0
      ? Math.round(commissionTotalsResult[0].totalCommissions * 100) / 100
      : 0;

  // Build evolution by period (group orders by month/year from deliveryDate, fallback to createdAt)
  const evolutionPipeline = [
    { $match: orderMatch },
    {
      $addFields: {
        _periodDate: { $ifNull: ['$deliveryDate', '$createdAt'] },
      },
    },
    {
      $group: {
        _id: {
          month: { $month: '$_periodDate' },
          year: { $year: '$_periodDate' },
        },
        orderCount: { $sum: 1 },
        revenue: { $sum: '$subtotal' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ];

  const evolutionResult = await Order.aggregate(evolutionPipeline);

  // Get commissions grouped by period for this client's orders
  const commissionEvolutionPipeline = [
    { $match: commissionMatch },
    {
      $group: {
        _id: {
          month: '$period.month',
          year: '$period.year',
        },
        commissions: { $sum: '$representativeCommission' },
      },
    },
  ];

  const commissionEvolutionResult = await Commission.aggregate(commissionEvolutionPipeline);
  const commissionsByPeriod = new Map(
    commissionEvolutionResult.map((c) => [`${c._id.year}-${c._id.month}`, c.commissions]),
  );

  // Merge order evolution with commission data
  const evolution = evolutionResult.map((item) => {
    const periodKey = `${item._id.year}-${item._id.month}`;
    return {
      period: { month: item._id.month, year: item._id.year },
      orderCount: item.orderCount,
      revenue: Math.round(item.revenue * 100) / 100,
      commissions: Math.round((commissionsByPeriod.get(periodKey) || 0) * 100) / 100,
    };
  });

  // Zero-fill evolution based on granularity
  let filledEvolution;
  if (granularity === 'annual') {
    // Fill 5 years
    const evolutionMap = new Map(evolution.map((e) => [e.period.year, e]));
    filledEvolution = Array.from({ length: 5 }, (_, i) => {
      const y = year - 4 + i;
      return (
        evolutionMap.get(y) || {
          period: { month: null, year: y },
          orderCount: 0,
          revenue: 0,
          commissions: 0,
        }
      );
    });
  } else {
    // Fill 12 months for the given year
    const evolutionMap = new Map(
      evolution.filter((e) => e.period.year === year).map((e) => [e.period.month, e]),
    );
    filledEvolution = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return (
        evolutionMap.get(m) || {
          period: { month: m, year },
          orderCount: 0,
          revenue: 0,
          commissions: 0,
        }
      );
    });
  }

  return {
    client: { name: client.name, tradeName: client.tradeName || '' },
    totalOrders,
    totalRevenue,
    totalCommissions,
    evolution: filledEvolution,
  };
}


/**
 * Agrega dados de comissões para o overview do Dashboard.
 * Pipeline: match commissions (status != cancelled, installmentsCreated != true) → group by period → sum adminCommission e representativeCommission.
 * Aplica zero-fill conforme granularidade (monthly: 12 meses, annual: 5 anos).
 * @param {object} params
 * @param {number} [params.month] - Mês (1-12)
 * @param {number} [params.year] - Ano (2000-2100)
 * @param {string} [params.granularity] - 'monthly' ou 'annual'
 * @param {string} [params.representativeId] - ID do representante (filtro)
 * @returns {Promise<Array>} Array de objetos { period: {month, year}, totalAdminCommission, totalRepresentativeCommission }
 */
async function aggregateCommissionsOverview({ month, year, granularity, representativeId }) {
  const periodFilter = buildPeriodFilter(month, year, granularity);
  const representativeFilter = representativeId ? { representativeId } : {};

  // Agrupa por ano quando granularidade é anual, por mês/ano quando mensal
  const groupId = granularity === 'annual'
    ? { month: null, year: '$period.year' }
    : { month: '$period.month', year: '$period.year' };

  const pipeline = [
    {
      $match: {
        status: { $ne: 'cancelled' },
        installmentsCreated: { $ne: true },
        ...periodFilter,
        ...representativeFilter,
      },
    },
    {
      $group: {
        _id: groupId,
        totalAdminCommission: { $sum: '$adminCommission' },
        totalRepresentativeCommission: { $sum: '$representativeCommission' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id: 0,
        period: { month: '$_id.month', year: '$_id.year' },
        totalAdminCommission: { $round: ['$totalAdminCommission', 2] },
        totalRepresentativeCommission: { $round: ['$totalRepresentativeCommission', 2] },
      },
    },
  ];

  const results = await Commission.aggregate(pipeline);

  if (granularity === 'annual') {
    return zeroFillYears(results, year);
  }

  const fillYear = year || new Date().getFullYear();
  return zeroFillMonths(results, fillYear);
}

/**
 * Agrega dados de pedidos cancelados para o endpoint /dashboard/cancelled-orders.
 * Calcula total de cancelados, valor perdido e taxa de cancelamento.
 * Suporta agrupamento por período, cliente ou representante.
 *
 * @param {object} params
 * @param {number} [params.month] - Mês (1-12)
 * @param {number} [params.year] - Ano (2000-2100)
 * @param {string} [params.groupBy='period'] - Agrupamento: 'period', 'client' ou 'representative'
 * @param {string} [params.representativeId] - ID do representante (para controle de acesso)
 * @returns {Promise<{cancelledCount: number, cancelledValue: number, cancellationRate: number, data: Array}>}
 */
async function aggregateCancelledOrders({ month, year, granularity, groupBy = 'period', representativeId }) {
  // Usa comissões como fonte de verdade para determinar quais pedidos pertencem ao período
  const commissionPeriodFilter = granularity === 'annual'
    ? buildPeriodFilter(month, year, 'annual')
    : buildPeriodFilter(month, year);
  const repFilter = representativeId ? { representativeId } : {};

  // Step 1: Buscar todos os orderIds de comissões do período (excluindo parcelas para não duplicar)
  const allOrdersPipeline = [
    {
      $match: {
        installmentIndex: null, // Exclui parcelas
        ...commissionPeriodFilter,
        ...repFilter,
      },
    },
    { $group: { _id: null, orderIds: { $addToSet: '$orderId' } } },
  ];

  const allResult = await Commission.aggregate(allOrdersPipeline);
  const allOrderIds = allResult.length > 0 ? allResult[0].orderIds : [];

  if (allOrderIds.length === 0) {
    return { cancelledCount: 0, cancelledValue: 0, cancellationRate: 0, data: [] };
  }

  // Step 2: Contar total de pedidos no período
  const totalOrders = await Order.countDocuments({ _id: { $in: allOrderIds } });

  // Step 3: Determine groupBy field for aggregation
  const periodDateExpr = { $ifNull: ['$deliveryDate', '$createdAt'] };
  const groupByField = {
    period: { month: { $month: periodDateExpr }, year: { $year: periodDateExpr } },
    client: '$clientId',
    representative: '$representativeId',
  }[groupBy];

  // Step 4: Get cancelled orders metrics
  const pipeline = [
    { $match: { _id: { $in: allOrderIds }, status: 'cancelled' } },
    {
      $group: {
        _id: groupByField,
        cancelledCount: { $sum: 1 },
        cancelledValue: { $sum: '$subtotal' },
      },
    },
  ];

  const results = await Order.aggregate(pipeline);

  // Step 5: Calculate overall metrics
  const totalCancelled = results.reduce((sum, r) => sum + r.cancelledCount, 0);
  const totalCancelledValue = results.reduce((sum, r) => sum + r.cancelledValue, 0);
  const cancellationRate =
    totalOrders > 0 ? Math.round((totalCancelled / totalOrders) * 1000) / 10 : 0;

  return {
    cancelledCount: totalCancelled,
    cancelledValue: Math.round(totalCancelledValue * 100) / 100,
    cancellationRate,
    data: results.map((r) => ({
      groupKey: JSON.stringify(r._id),
      groupLabel: '',
      cancelledCount: r.cancelledCount,
      cancelledValue: Math.round(r.cancelledValue * 100) / 100,
      cancellationRate:
        totalOrders > 0 ? Math.round((r.cancelledCount / totalOrders) * 1000) / 10 : 0,
    })),
  };
}

module.exports = {
  buildPeriodFilter,
  buildOrderPeriodFilter,
  buildRepresentativeFilter,
  zeroFillMonths,
  zeroFillYears,
  sanitizeForRepresentative,
  aggregateClientsRevenue,
  aggregateTopClients,
  aggregateRepresentativesPerformance,
  aggregateClientDetail,
  aggregateCommissionsOverview,
  aggregateCancelledOrders,
};
