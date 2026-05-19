/**
 * Exporta dados para CSV e dispara download no navegador.
 *
 * @param {Array<object>} data - Array de objetos com os dados
 * @param {Array<{key: string, label: string}>} columns - Definição das colunas
 * @param {string} filename - Nome do arquivo (sem extensão)
 */
export function exportToCsv(data, columns, filename) {
  if (!data || data.length === 0) return;

  const separator = ';';
  const header = columns.map((c) => c.label).join(separator);

  const rows = data.map((row) =>
    columns.map((col) => {
      let value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') {
        // Formata números com vírgula decimal (padrão brasileiro)
        value = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      // Escapa aspas e envolve em aspas se contém separador
      const str = String(value);
      if (str.includes(separator) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(separator),
  );

  const bom = '\uFEFF'; // BOM para Excel reconhecer UTF-8
  const csv = bom + [header, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
