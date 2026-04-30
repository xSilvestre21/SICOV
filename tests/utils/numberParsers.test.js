const {
  onlyNumbers,
  parsePercentage,
  parseBrazilianNumber,
} = require('../../src/utils/numberParsers');

// ─── onlyNumbers ─────────────────────────────────────────────────────────────

describe('onlyNumbers', () => {
  it('remove todos os caracteres não numéricos', () => {
    expect(onlyNumbers('(11) 99999-9999')).toBe('11999999999');
  });

  it('remove pontos e traços de CNPJ', () => {
    expect(onlyNumbers('12.345.678/0001-99')).toBe('12345678000199');
  });

  it('remove pontos e traços de CEP', () => {
    expect(onlyNumbers('13478-733')).toBe('13478733');
  });

  it('retorna string vazia para valor falsy', () => {
    expect(onlyNumbers('')).toBe('');
    expect(onlyNumbers(null)).toBe('');
    expect(onlyNumbers(undefined)).toBe('');
  });

  it('retorna apenas dígitos de string já limpa', () => {
    expect(onlyNumbers('12345')).toBe('12345');
  });

  it('converte número para string e extrai dígitos', () => {
    expect(onlyNumbers(12345)).toBe('12345');
  });
});

// ─── parsePercentage ─────────────────────────────────────────────────────────

describe('parsePercentage', () => {
  it('retorna 0 para valor vazio', () => {
    expect(parsePercentage('')).toBe(0);
    expect(parsePercentage(null)).toBe(0);
    expect(parsePercentage(undefined)).toBe(0);
  });

  it('retorna o próprio número quando já é number', () => {
    expect(parsePercentage(9.75)).toBe(9.75);
    expect(parsePercentage(0)).toBe(0);
  });

  it('parseia string com símbolo de %', () => {
    expect(parsePercentage('9.75%')).toBe(9.75);
    expect(parsePercentage('10%')).toBe(10);
  });

  it('parseia string com vírgula como decimal', () => {
    expect(parsePercentage('9,75')).toBe(9.75);
  });

  it('parseia string sem símbolo', () => {
    expect(parsePercentage('15')).toBe(15);
  });

  it('retorna null para string não numérica', () => {
    expect(parsePercentage('abc')).toBeNull();
  });

  it('ignora espaços em branco', () => {
    expect(parsePercentage(' 5 % ')).toBe(5);
  });
});

// ─── parseBrazilianNumber ─────────────────────────────────────────────────────

describe('parseBrazilianNumber', () => {
  it('retorna 0 para valor vazio', () => {
    expect(parseBrazilianNumber('')).toBe(0);
    expect(parseBrazilianNumber(null)).toBe(0);
    expect(parseBrazilianNumber(undefined)).toBe(0);
  });

  it('retorna o próprio número quando já é number', () => {
    expect(parseBrazilianNumber(1234.56)).toBe(1234.56);
    expect(parseBrazilianNumber(0)).toBe(0);
  });

  it('parseia formato brasileiro com ponto como milhar e vírgula como decimal', () => {
    expect(parseBrazilianNumber('1.234,56')).toBe(1234.56);
    expect(parseBrazilianNumber('10.000,00')).toBe(10000);
  });

  it('parseia formato americano com vírgula como milhar e ponto como decimal', () => {
    expect(parseBrazilianNumber('1,234.56')).toBe(1234.56);
  });

  it('parseia número com apenas vírgula como decimal', () => {
    expect(parseBrazilianNumber('9,75')).toBe(9.75);
  });

  it('parseia número com apenas ponto como decimal', () => {
    expect(parseBrazilianNumber('9.75')).toBe(9.75);
  });

  it('parseia número com múltiplos pontos como separador de milhar', () => {
    expect(parseBrazilianNumber('1.000.000')).toBe(1000000);
  });

  it('remove prefixo R$', () => {
    expect(parseBrazilianNumber('R$ 1.234,56')).toBe(1234.56);
    expect(parseBrazilianNumber('R$1234,56')).toBe(1234.56);
  });

  it('retorna null para string não numérica', () => {
    expect(parseBrazilianNumber('abc')).toBeNull();
  });

  it('parseia inteiro simples', () => {
    expect(parseBrazilianNumber('100')).toBe(100);
  });
});
