function onlyNumbers(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

function parsePercentage(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  let normalized = String(value).trim();
  normalized = normalized.replace('%', '').trim();
  normalized = normalized.replace(/\s+/g, '');
  normalized = normalized.replace(',', '.');

  const result = Number(normalized);
  return Number.isNaN(result) ? null : result;
}

function parseBrazilianNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  let normalized = String(value).trim();

  normalized = normalized.replace(/R\$\s?/gi, '');
  normalized = normalized.replace(/\s+/g, '');

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '');
      normalized = normalized.replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  } else if (hasDot) {
    const parts = normalized.split('.');
    if (parts.length > 2) {
      normalized = normalized.replace(/\./g, '');
    }
  }

  const result = Number(normalized);
  return Number.isNaN(result) ? null : result;
}

module.exports = {
  onlyNumbers,
  parsePercentage,
  parseBrazilianNumber,
};
