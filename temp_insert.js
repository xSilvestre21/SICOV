const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'dashboardService.js');
let content = fs.readFileSync(filePath, 'utf8');

const newFunction = `
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
        _id: { month: '$period.month', year: '$period.year' },
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
`;

// Insert the function before module.exports
const moduleExportsIndex = content.lastIndexOf('module.exports');
content = content.slice(0, moduleExportsIndex) + newFunction + '\n' + content.slice(moduleExportsIndex);

// Add aggregateCommissionsOverview to exports
content = content.replace(
  /aggregateClientDetail,\s*\n\s*\};/,
  'aggregateClientDetail,\n  aggregateCommissionsOverview,\n};'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done - aggregateCommissionsOverview added successfully');
