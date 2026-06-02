const SALE_MODE_MAP = {
  kg: 'KG',
  thousand: 'MIL',
  unit: 'UN',
  box: 'CX',
  linear_meter: 'M',
  manual: '',
  // Já formatados
  KG: 'KG',
  MIL: 'MIL',
  ML: 'MIL',
  UN: 'UN',
  CX: 'CX',
  M: 'M',
};

export function formatSaleMode(value) {
  if (!value) return '';
  return SALE_MODE_MAP[value] || value;
}
