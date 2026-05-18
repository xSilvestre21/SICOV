const {
  validateDashboardParams,
  getDefaultPeriod,
} = require('../../src/utils/dashboardValidation');

// ─── validateDashboardParams ─────────────────────────────────────────────────

describe('validateDashboardParams', () => {
  it('retorna array vazio quando nenhum parâmetro é fornecido', () => {
    expect(validateDashboardParams({})).toEqual([]);
  });

  it('retorna array vazio para month e year válidos', () => {
    expect(validateDashboardParams({ month: '6', year: '2024' })).toEqual([]);
    expect(validateDashboardParams({ month: 1, year: 2000 })).toEqual([]);
    expect(validateDashboardParams({ month: 12, year: 2100 })).toEqual([]);
  });

  it('retorna erro para month menor que 1', () => {
    const errors = validateDashboardParams({ month: '0' });
    expect(errors).toContain('month deve ser um inteiro entre 1 e 12');
  });

  it('retorna erro para month maior que 12', () => {
    const errors = validateDashboardParams({ month: '13' });
    expect(errors).toContain('month deve ser um inteiro entre 1 e 12');
  });

  it('retorna erro para month não inteiro', () => {
    const errors = validateDashboardParams({ month: '3.5' });
    expect(errors).toContain('month deve ser um inteiro entre 1 e 12');
  });

  it('retorna erro para month não numérico', () => {
    const errors = validateDashboardParams({ month: 'abc' });
    expect(errors).toContain('month deve ser um inteiro entre 1 e 12');
  });

  it('retorna erro para year menor que 2000', () => {
    const errors = validateDashboardParams({ year: '1999' });
    expect(errors).toContain('year deve ser um inteiro entre 2000 e 2100');
  });

  it('retorna erro para year maior que 2100', () => {
    const errors = validateDashboardParams({ year: '2101' });
    expect(errors).toContain('year deve ser um inteiro entre 2000 e 2100');
  });

  it('retorna erro para year não inteiro', () => {
    const errors = validateDashboardParams({ year: '2024.5' });
    expect(errors).toContain('year deve ser um inteiro entre 2000 e 2100');
  });

  it('retorna erro para year não numérico', () => {
    const errors = validateDashboardParams({ year: 'xyz' });
    expect(errors).toContain('year deve ser um inteiro entre 2000 e 2100');
  });

  it('retorna múltiplos erros quando ambos parâmetros são inválidos', () => {
    const errors = validateDashboardParams({ month: '0', year: '1999' });
    expect(errors).toHaveLength(2);
    expect(errors).toContain('month deve ser um inteiro entre 1 e 12');
    expect(errors).toContain('year deve ser um inteiro entre 2000 e 2100');
  });

  it('não valida month quando undefined', () => {
    const errors = validateDashboardParams({ year: '2024' });
    expect(errors).toEqual([]);
  });

  it('não valida year quando undefined', () => {
    const errors = validateDashboardParams({ month: '6' });
    expect(errors).toEqual([]);
  });
});

// ─── getDefaultPeriod ────────────────────────────────────────────────────────

describe('getDefaultPeriod', () => {
  it('retorna um objeto com month e year', () => {
    const period = getDefaultPeriod();
    expect(period).toHaveProperty('month');
    expect(period).toHaveProperty('year');
  });

  it('retorna month entre 1 e 12', () => {
    const { month } = getDefaultPeriod();
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  it('retorna year entre 2000 e 2100', () => {
    const { year } = getDefaultPeriod();
    expect(year).toBeGreaterThanOrEqual(2000);
    expect(year).toBeLessThanOrEqual(2100);
  });

  it('retorna o mês e ano atuais do servidor', () => {
    const now = new Date();
    const period = getDefaultPeriod();
    expect(period.month).toBe(now.getMonth() + 1);
    expect(period.year).toBe(now.getFullYear());
  });
});
