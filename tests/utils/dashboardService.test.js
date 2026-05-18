const {
  buildPeriodFilter,
  buildOrderPeriodFilter,
  buildRepresentativeFilter,
  zeroFillMonths,
  zeroFillYears,
  sanitizeForRepresentative,
} = require('../../src/services/dashboardService');

// ─── buildPeriodFilter ───────────────────────────────────────────────────────

describe('buildPeriodFilter', () => {
  it('retorna filtro de 5 anos quando granularity é annual', () => {
    const filter = buildPeriodFilter(6, 2025, 'annual');
    expect(filter).toEqual({ 'period.year': { $gte: 2021, $lte: 2025 } });
  });

  it('retorna filtro de mês e ano específicos quando ambos fornecidos', () => {
    const filter = buildPeriodFilter(3, 2024);
    expect(filter).toEqual({ 'period.month': 3, 'period.year': 2024 });
  });

  it('retorna filtro do mês/ano atual quando month e year não fornecidos', () => {
    const now = new Date();
    const filter = buildPeriodFilter(undefined, undefined);
    expect(filter).toEqual({
      'period.month': now.getMonth() + 1,
      'period.year': now.getFullYear(),
    });
  });

  it('retorna filtro do mês/ano atual quando month é 0 (falsy)', () => {
    const now = new Date();
    const filter = buildPeriodFilter(0, 2024);
    expect(filter).toEqual({
      'period.month': now.getMonth() + 1,
      'period.year': now.getFullYear(),
    });
  });
});

// ─── buildOrderPeriodFilter ──────────────────────────────────────────────────

describe('buildOrderPeriodFilter', () => {
  it('retorna filtro $or com deliveryDate e createdAt fallback para granularity annual', () => {
    const filter = buildOrderPeriodFilter(6, 2025, 'annual');
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].deliveryDate.$gte).toEqual(new Date(2021, 0, 1));
    expect(filter.$or[0].deliveryDate.$lt).toEqual(new Date(2026, 0, 1));
    expect(filter.$or[1].deliveryDate).toBeNull();
    expect(filter.$or[1].createdAt.$gte).toEqual(new Date(2021, 0, 1));
    expect(filter.$or[1].createdAt.$lt).toEqual(new Date(2026, 0, 1));
  });

  it('retorna filtro $or para mês específico', () => {
    const filter = buildOrderPeriodFilter(3, 2024);
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].deliveryDate.$gte).toEqual(new Date(2024, 2, 1));
    expect(filter.$or[0].deliveryDate.$lt).toEqual(new Date(2024, 3, 1));
    expect(filter.$or[1].deliveryDate).toBeNull();
    expect(filter.$or[1].createdAt.$gte).toEqual(new Date(2024, 2, 1));
    expect(filter.$or[1].createdAt.$lt).toEqual(new Date(2024, 3, 1));
  });

  it('retorna filtro do mês atual quando month e year não fornecidos', () => {
    const now = new Date();
    const filter = buildOrderPeriodFilter(undefined, undefined);
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].deliveryDate.$gte).toEqual(
      new Date(now.getFullYear(), now.getMonth(), 1),
    );
    expect(filter.$or[0].deliveryDate.$lt).toEqual(
      new Date(now.getFullYear(), now.getMonth() + 1, 1),
    );
  });

  it('trata janeiro corretamente (month=1)', () => {
    const filter = buildOrderPeriodFilter(1, 2024);
    expect(filter.$or[0].deliveryDate.$gte).toEqual(new Date(2024, 0, 1));
    expect(filter.$or[0].deliveryDate.$lt).toEqual(new Date(2024, 1, 1));
  });

  it('trata dezembro corretamente (month=12)', () => {
    const filter = buildOrderPeriodFilter(12, 2024);
    expect(filter.$or[0].deliveryDate.$gte).toEqual(new Date(2024, 11, 1));
    expect(filter.$or[0].deliveryDate.$lt).toEqual(new Date(2025, 0, 1));
  });

  it('usa deliveryDate com fallback para createdAt via $or', () => {
    const filter = buildOrderPeriodFilter(7, 2026);
    expect(filter.$or[1].deliveryDate).toBeNull();
    expect(filter.$or[1].createdAt).toBeDefined();
  });
});

// ─── buildRepresentativeFilter ───────────────────────────────────────────────

describe('buildRepresentativeFilter', () => {
  it('retorna objeto vazio para perfil admin', () => {
    const user = { _id: 'user123', profile: 'admin' };
    expect(buildRepresentativeFilter(user)).toEqual({});
  });

  it('retorna filtro por representativeId para perfil representative', () => {
    const user = { _id: 'rep456', profile: 'representative' };
    expect(buildRepresentativeFilter(user)).toEqual({
      representativeId: 'rep456',
    });
  });

  it('retorna filtro por representativeId para qualquer perfil não-admin', () => {
    const user = { _id: 'user789', profile: 'manager' };
    expect(buildRepresentativeFilter(user)).toEqual({
      representativeId: 'user789',
    });
  });
});

// ─── zeroFillMonths ──────────────────────────────────────────────────────────

describe('zeroFillMonths', () => {
  it('retorna exatamente 12 entries para array vazio', () => {
    const result = zeroFillMonths([], 2024);
    expect(result).toHaveLength(12);
  });

  it('preenche meses sem dados com zeros', () => {
    const data = [
      {
        period: { month: 3, year: 2024 },
        totalAdminCommission: 100,
        totalRepresentativeCommission: 200,
        totalRevenue: 5000,
      },
    ];
    const result = zeroFillMonths(data, 2024);
    expect(result).toHaveLength(12);
    expect(result[2]).toEqual(data[0]); // março (index 2)
    expect(result[0]).toEqual({
      period: { month: 1, year: 2024 },
      totalAdminCommission: 0,
      totalRepresentativeCommission: 0,
      totalRevenue: 0,
    });
  });

  it('preserva dados existentes nos meses corretos', () => {
    const data = [
      {
        period: { month: 1, year: 2024 },
        totalAdminCommission: 50,
        totalRepresentativeCommission: 100,
        totalRevenue: 3000,
      },
      {
        period: { month: 12, year: 2024 },
        totalAdminCommission: 75,
        totalRepresentativeCommission: 150,
        totalRevenue: 4000,
      },
    ];
    const result = zeroFillMonths(data, 2024);
    expect(result[0]).toEqual(data[0]);
    expect(result[11]).toEqual(data[1]);
  });

  it('retorna meses em ordem crescente (1 a 12)', () => {
    const result = zeroFillMonths([], 2024);
    for (let i = 0; i < 12; i++) {
      expect(result[i].period.month).toBe(i + 1);
    }
  });
});

// ─── zeroFillYears ───────────────────────────────────────────────────────────

describe('zeroFillYears', () => {
  it('retorna exatamente 5 entries para array vazio', () => {
    const result = zeroFillYears([], 2025);
    expect(result).toHaveLength(5);
  });

  it('preenche anos sem dados com zeros', () => {
    const data = [
      {
        period: { month: null, year: 2023 },
        totalAdminCommission: 500,
        totalRepresentativeCommission: 1000,
        totalRevenue: 50000,
      },
    ];
    const result = zeroFillYears(data, 2025);
    expect(result).toHaveLength(5);
    expect(result[2]).toEqual(data[0]); // 2023 é o 3º ano (2021, 2022, 2023)
  });

  it('cobre intervalo de endYear-4 até endYear', () => {
    const result = zeroFillYears([], 2025);
    expect(result[0].period.year).toBe(2021);
    expect(result[4].period.year).toBe(2025);
  });

  it('preserva dados existentes nos anos corretos', () => {
    const data = [
      {
        period: { month: null, year: 2021 },
        totalAdminCommission: 100,
        totalRepresentativeCommission: 200,
        totalRevenue: 10000,
      },
      {
        period: { month: null, year: 2025 },
        totalAdminCommission: 300,
        totalRepresentativeCommission: 600,
        totalRevenue: 30000,
      },
    ];
    const result = zeroFillYears(data, 2025);
    expect(result[0]).toEqual(data[0]);
    expect(result[4]).toEqual(data[1]);
  });

  it('entries zeradas possuem month: null', () => {
    const result = zeroFillYears([], 2025);
    result.forEach((entry) => {
      expect(entry.period.month).toBeNull();
    });
  });
});

// ─── sanitizeForRepresentative ───────────────────────────────────────────────

describe('sanitizeForRepresentative', () => {
  it('retorna dados inalterados para perfil admin', () => {
    const data = {
      totalAdminCommission: 500,
      adminCommission: 100,
      totalRevenue: 5000,
    };
    expect(sanitizeForRepresentative(data, 'admin')).toEqual(data);
  });

  it('remove totalAdminCommission e adminCommission de objeto para representante', () => {
    const data = {
      totalAdminCommission: 500,
      adminCommission: 100,
      totalRevenue: 5000,
      period: { month: 1, year: 2024 },
    };
    const result = sanitizeForRepresentative(data, 'representative');
    expect(result).not.toHaveProperty('totalAdminCommission');
    expect(result).not.toHaveProperty('adminCommission');
    expect(result).toHaveProperty('totalRevenue', 5000);
    expect(result).toHaveProperty('period');
  });

  it('remove totalAdminCommission e adminCommission de array para representante', () => {
    const data = [
      {
        totalAdminCommission: 500,
        adminCommission: 100,
        totalRevenue: 5000,
      },
      {
        totalAdminCommission: 300,
        adminCommission: 50,
        totalRevenue: 3000,
      },
    ];
    const result = sanitizeForRepresentative(data, 'representative');
    expect(result).toHaveLength(2);
    result.forEach((item) => {
      expect(item).not.toHaveProperty('totalAdminCommission');
      expect(item).not.toHaveProperty('adminCommission');
      expect(item).toHaveProperty('totalRevenue');
    });
  });

  it('retorna array inalterado para perfil admin', () => {
    const data = [
      { totalAdminCommission: 500, adminCommission: 100, totalRevenue: 5000 },
    ];
    expect(sanitizeForRepresentative(data, 'admin')).toEqual(data);
  });

  it('funciona com objeto sem campos de admin commission', () => {
    const data = { totalRevenue: 5000, period: { month: 1, year: 2024 } };
    const result = sanitizeForRepresentative(data, 'representative');
    expect(result).toEqual({ totalRevenue: 5000, period: { month: 1, year: 2024 } });
  });
});
