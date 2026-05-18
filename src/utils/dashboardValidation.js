function validateDashboardParams(query) {
  const { month, year } = query;
  const errors = [];

  if (month !== undefined) {
    const m = Number(month);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      errors.push('month deve ser um inteiro entre 1 e 12');
    }
  }

  if (year !== undefined) {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      errors.push('year deve ser um inteiro entre 2000 e 2100');
    }
  }

  return errors;
}

function getDefaultPeriod() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

module.exports = { validateDashboardParams, getDefaultPeriod };
