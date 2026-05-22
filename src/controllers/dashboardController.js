const {
  validateDashboardParams,
  getDefaultPeriod,
} = require('../utils/dashboardValidation');
const {
  aggregateClientsRevenue,
  aggregateCommissionsOverview,
  aggregateRepresentativesPerformance,
  aggregateTopClients,
  aggregateClientDetail,
  aggregateCancelledOrders,
  aggregateSuppliersComparison,
  sanitizeForRepresentative,
} = require('../services/dashboardService');

/**
 * GET /dashboard/clients-revenue
 * Query params: month (1-12), year (4 digits)
 * Returns: { data: [{ clientId, tradeName, totalRevenue }] }
 */
async function getClientsRevenue(req, res) {
  try {
    const errors = validateDashboardParams(req.query);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('; ') });
    }

    const { granularity } = req.query;
    const { month: defaultMonth, year: defaultYear } = getDefaultPeriod();
    const month = req.query.month ? Number(req.query.month) : defaultMonth;
    const year = req.query.year ? Number(req.query.year) : defaultYear;

    const user = {
      _id: req.user.id,
      profile: req.user.profile,
    };

    const result = await aggregateClientsRevenue({ month, year, granularity, user });

    const sanitized = sanitizeForRepresentative(result, req.user.profile);

    return res.json({ data: sanitized });
  } catch (err) {
    console.error('[getClientsRevenue]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
}

/**
 * GET /dashboard/commissions-overview
 * Query params: month (1-12), year (4 digits), granularity ('monthly'|'annual')
 * Returns: { data: [{ period, totalAdminCommission, totalRepresentativeCommission }] }
 */
async function getCommissionsOverview(req, res) {
  try {
    const errors = validateDashboardParams(req.query);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('; ') });
    }

    const { granularity } = req.query;
    if (granularity && !['monthly', 'annual'].includes(granularity)) {
      return res.status(400).json({ message: 'granularity deve ser "monthly" ou "annual"' });
    }

    const { month: defaultMonth, year: defaultYear } = getDefaultPeriod();
    const month = req.query.month ? Number(req.query.month) : defaultMonth;
    const year = req.query.year ? Number(req.query.year) : defaultYear;

    const representativeId = req.user.profile !== 'admin' ? req.user.id : undefined;

    const result = await aggregateCommissionsOverview({
      month,
      year,
      granularity: granularity || 'monthly',
      representativeId,
    });

    const sanitized = sanitizeForRepresentative(result, req.user.profile);

    return res.json({ data: sanitized });
  } catch (err) {
    console.error('[getCommissionsOverview]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
}

/**
 * GET /dashboard/representatives-performance
 * Query params: month (1-12), year (4 digits)
 * Returns: { data: [{ representativeId, name, orderCount, totalSold, totalCommission }] }
 */
async function getRepresentativesPerformance(req, res) {
  try {
    const errors = validateDashboardParams(req.query);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('; ') });
    }

    const { granularity } = req.query;
    const { month: defaultMonth, year: defaultYear } = getDefaultPeriod();
    const month = req.query.month ? Number(req.query.month) : defaultMonth;
    const year = req.query.year ? Number(req.query.year) : defaultYear;

    const representativeId = req.user.profile !== 'admin' ? req.user.id : undefined;

    const result = await aggregateRepresentativesPerformance({
      month,
      year,
      granularity,
      representativeId,
    });

    const sanitized = sanitizeForRepresentative(result, req.user.profile);

    return res.json({ data: sanitized });
  } catch (err) {
    console.error('[getRepresentativesPerformance]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
}

/**
 * GET /dashboard/top-clients
 * Query params: month (1-12), year (4 digits), limit (1-50, default 10)
 * Returns: { data: [{ clientId, tradeName, totalRevenue }] }
 */
async function getTopClients(req, res) {
  try {
    const errors = validateDashboardParams(req.query);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('; ') });
    }

    const { limit, granularity } = req.query;
    if (limit !== undefined) {
      const l = Number(limit);
      if (!Number.isInteger(l) || l < 1 || l > 50) {
        return res.status(400).json({ message: 'limit deve ser um inteiro entre 1 e 50' });
      }
    }

    const { month: defaultMonth, year: defaultYear } = getDefaultPeriod();
    const month = req.query.month ? Number(req.query.month) : defaultMonth;
    const year = req.query.year ? Number(req.query.year) : defaultYear;

    const representativeId = req.user.profile !== 'admin' ? req.user.id : undefined;

    const result = await aggregateTopClients({
      month,
      year,
      granularity,
      representativeId,
      limit: limit ? Number(limit) : 10,
    });

    const sanitized = sanitizeForRepresentative(result, req.user.profile);

    return res.json({ data: sanitized });
  } catch (err) {
    console.error('[getTopClients]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
}

/**
 * GET /dashboard/client/:clientId
 * Params: clientId
 * Query params: month (1-12), year (4 digits), granularity ('monthly'|'annual')
 * Returns: { client, totalOrders, totalRevenue, totalCommissions, evolution }
 */
async function getClientDetail(req, res) {
  try {
    const errors = validateDashboardParams(req.query);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('; ') });
    }

    const { clientId } = req.params;
    if (!clientId) {
      return res.status(400).json({ message: 'clientId é obrigatório' });
    }

    const { granularity } = req.query;
    if (granularity && !['monthly', 'annual'].includes(granularity)) {
      return res.status(400).json({ message: 'granularity deve ser "monthly" ou "annual"' });
    }

    const { month: defaultMonth, year: defaultYear } = getDefaultPeriod();
    const month = req.query.month ? Number(req.query.month) : defaultMonth;
    const year = req.query.year ? Number(req.query.year) : defaultYear;

    const representativeId = req.user.profile !== 'admin' ? req.user.id : undefined;

    const result = await aggregateClientDetail({
      clientId,
      month,
      year,
      granularity: granularity || 'monthly',
      representativeId,
    });

    if (!result) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }

    const sanitized = sanitizeForRepresentative(result, req.user.profile);

    return res.json(sanitized);
  } catch (err) {
    console.error('[getClientDetail]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
}

/**
 * GET /dashboard/cancelled-orders
 * Query params: month (1-12), year (4 digits), groupBy ('period'|'client'|'representative')
 * Returns: { cancelledCount, cancelledValue, cancellationRate, data }
 */
async function getCancelledOrders(req, res) {
  try {
    const errors = validateDashboardParams(req.query);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('; ') });
    }

    const { groupBy, granularity } = req.query;
    if (groupBy && !['period', 'client', 'representative'].includes(groupBy)) {
      return res.status(400).json({
        message: 'groupBy deve ser "period", "client" ou "representative"',
      });
    }

    const { month: defaultMonth, year: defaultYear } = getDefaultPeriod();
    const month = req.query.month ? Number(req.query.month) : defaultMonth;
    const year = req.query.year ? Number(req.query.year) : defaultYear;

    const representativeId = req.user.profile !== 'admin' ? req.user.id : undefined;

    const result = await aggregateCancelledOrders({
      month,
      year,
      granularity,
      groupBy: groupBy || 'period',
      representativeId,
    });

    const sanitizedData = sanitizeForRepresentative(result.data, req.user.profile);

    return res.json({
      cancelledCount: result.cancelledCount,
      cancelledValue: result.cancelledValue,
      cancellationRate: result.cancellationRate,
      data: sanitizedData,
    });
  } catch (err) {
    console.error('[getCancelledOrders]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
}

/**
 * GET /dashboard/suppliers-comparison
 * Query params: month (1-12), year (4 digits), granularity ('monthly'|'annual')
 * Returns: { data: [{ supplierId, supplierName, totalRevenue, totalAdminCommission, totalRepresentativeCommission, totalPool, commissionPercentage, orderCount }] }
 * Admin only.
 */
async function getSuppliersComparison(req, res) {
  try {
    if (req.user.profile !== 'admin') {
      return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
    }

    const errors = validateDashboardParams(req.query);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('; ') });
    }

    const { granularity } = req.query;
    const { month: defaultMonth, year: defaultYear } = getDefaultPeriod();
    const month = req.query.month ? Number(req.query.month) : defaultMonth;
    const year = req.query.year ? Number(req.query.year) : defaultYear;

    const result = await aggregateSuppliersComparison({ month, year, granularity });

    return res.json({ data: result });
  } catch (err) {
    console.error('[getSuppliersComparison]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
}

module.exports = {
  getClientsRevenue,
  getCommissionsOverview,
  getRepresentativesPerformance,
  getTopClients,
  getClientDetail,
  getCancelledOrders,
  getSuppliersComparison,
};
