import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, Layers, TrendingUp, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDashboardFilters } from '../../../contexts/DashboardFilterContext';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { ChartStyleSelector } from '../../../components/dashboard/ChartStyleSelector';
import { useTheme } from '../../../contexts/ThemeContext';

const CHART_STYLES = [
  { id: 'grouped', label: 'Barras Agrupadas', icon: BarChart3 },
  { id: 'stacked', label: 'Barras Empilhadas', icon: Layers },
  { id: 'line', label: 'Linhas', icon: TrendingUp },
];

const COLOR_ADMIN = '#1E40AF';
const COLOR_REPRESENTATIVE = '#EAB308';

const ITEMS_PER_PAGE = 20;

/**
 * Formata valor monetário no padrão brasileiro (R$ X.XXX,XX)
 */
function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata o label do período para exibição no eixo X
 */
function formatPeriodLabel(item, granularity) {
  if (granularity === 'annual') {
    return String(item.period?.year ?? '');
  }
  const month = item.period?.month;
  const year = item.period?.year;
  if (!month || !year) return '';
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  return `${monthNames[month - 1]}/${year}`;
}

/**
 * Tooltip customizado com totais de ambas comissões e período
 */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const adminEntry = payload.find((p) => p.dataKey === 'adminCommission');
  const repEntry = payload.find((p) => p.dataKey === 'representativeCommission');

  return (
    <div className="rounded-lg border border-[#e3e3d1] bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-[#4b5757] mb-1">{label}</p>
      {adminEntry && (
        <p className="text-sm font-semibold" style={{ color: COLOR_ADMIN }}>
          Comissão Admin: {formatCurrency(adminEntry.value)}
        </p>
      )}
      {repEntry && (
        <p className="text-sm font-semibold" style={{ color: COLOR_REPRESENTATIVE }}>
          Comissão Representante: {formatCurrency(repEntry.value)}
        </p>
      )}
    </div>
  );
}

/**
 * Skeleton placeholder exibido durante o carregamento
 */
function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-1/3 rounded bg-[#e3e3d1]" />
      <div className="h-[250px] w-full rounded-lg bg-[#e3e3d1]/60" />
    </div>
  );
}

/**
 * Painel de drill-down com lista de comissões do período selecionado
 */
function DrillDownPanel({ period, data, onClose }) {
  const [page, setPage] = useState(1);

  // Filtra comissões do período selecionado (simulação com dados disponíveis)
  const items = data || [];
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const paginatedItems = items.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  return (
    <div className="mt-4 rounded-lg border border-[#e3e3d1] bg-[#f5f5ee] p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#4b5757]">
          Detalhamento — {period}
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[#4b5757] hover:bg-[#e3e3d1] transition-colors"
          aria-label="Fechar detalhamento"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {paginatedItems.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Nenhuma comissão encontrada para este período.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e3e3d1] text-left text-xs font-medium text-[#4b5757]">
                  <th className="pb-2 pr-4">Pedido</th>
                  <th className="pb-2 pr-4">Representante</th>
                  <th className="pb-2 pr-4">Comissão Admin</th>
                  <th className="pb-2 pr-4">Comissão Representante</th>
                  <th className="pb-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, idx) => (
                  <tr
                    key={item._id || idx}
                    className="border-b border-[#e3e3d1]/50 last:border-0"
                  >
                    <td className="py-2 pr-4 text-[#4b5757]">
                      {item.orderNumber || '—'}
                    </td>
                    <td className="py-2 pr-4 text-[#4b5757]">
                      {item.representativeName || '—'}
                    </td>
                    <td className="py-2 pr-4 font-medium" style={{ color: COLOR_ADMIN }}>
                      {formatCurrency(item.adminCommission)}
                    </td>
                    <td className="py-2 pr-4 font-medium" style={{ color: COLOR_REPRESENTATIVE }}>
                      {formatCurrency(item.representativeCommission)}
                    </td>
                    <td className="py-2 text-[#4b5757]">
                      {item.orderDate
                        ? new Date(item.orderDate).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e3e3d1]">
              <span className="text-xs text-[#4b5757]">
                Página {page} de {totalPages} ({items.length} registros)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md p-1 text-[#4b5757] hover:bg-[#e3e3d1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-md p-1 text-[#4b5757] hover:bg-[#e3e3d1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Renderiza o gráfico no estilo selecionado
 */
function renderChart(style, data, onBarClick) {
  const commonProps = {
    data,
    margin: { top: 10, right: 20, left: 10, bottom: 5 },
  };

  const xAxisProps = {
    dataKey: 'periodLabel',
    tick: { fontSize: 11, fill: '#4b5757' },
    tickLine: false,
    axisLine: { stroke: '#e3e3d1' },
  };

  const yAxisProps = {
    tick: { fontSize: 11, fill: '#4b5757' },
    tickLine: false,
    axisLine: false,
    tickFormatter: (value) =>
      value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value),
  };

  const gridProps = {
    strokeDasharray: '3 3',
    stroke: '#e3e3d1',
    vertical: false,
  };

  const tooltipProps = {
    content: <CustomTooltip />,
  };

  const legendProps = {
    wrapperStyle: { fontSize: '12px', paddingTop: '8px' },
    iconType: 'circle',
    iconSize: 8,
  };

  switch (style) {
    case 'stacked':
      return (
        <BarChart {...commonProps} onClick={onBarClick}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          <Bar
            dataKey="adminCommission"
            stackId="commissions"
            fill={COLOR_ADMIN}
            radius={[0, 0, 0, 0]}
            name="Comissão Admin"
            cursor="pointer"
          />
          <Bar
            dataKey="representativeCommission"
            stackId="commissions"
            fill={COLOR_REPRESENTATIVE}
            radius={[4, 4, 0, 0]}
            name="Comissão Representante"
            cursor="pointer"
          />
        </BarChart>
      );

    case 'line':
      return (
        <LineChart {...commonProps} onClick={onBarClick}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          <Line
            type="monotone"
            dataKey="adminCommission"
            stroke={COLOR_ADMIN}
            strokeWidth={2}
            dot={{ r: 4, fill: COLOR_ADMIN }}
            activeDot={{ r: 6, cursor: 'pointer' }}
            name="Comissão Admin"
          />
          <Line
            type="monotone"
            dataKey="representativeCommission"
            stroke={COLOR_REPRESENTATIVE}
            strokeWidth={2}
            dot={{ r: 4, fill: COLOR_REPRESENTATIVE }}
            activeDot={{ r: 6, cursor: 'pointer' }}
            name="Comissão Representante"
          />
        </LineChart>
      );

    case 'grouped':
    default:
      return (
        <BarChart {...commonProps} onClick={onBarClick}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          <Bar
            dataKey="adminCommission"
            fill={COLOR_ADMIN}
            radius={[4, 4, 0, 0]}
            name="Comissão Admin"
            cursor="pointer"
          />
          <Bar
            dataKey="representativeCommission"
            fill={COLOR_REPRESENTATIVE}
            radius={[4, 4, 0, 0]}
            name="Comissão Representante"
            cursor="pointer"
          />
        </BarChart>
      );
  }
}

/**
 * CommissionsVariationChart — exibe a variação de Comissão_Admin e Comissão_Representante
 * como séries distintas ao longo do tempo.
 * Suporta estilos: GroupedBar, StackedBar, Line.
 * Implementa drill-down ao clicar em período (lista de comissões com paginação de 20 itens).
 * Tooltip com totais de ambas comissões e período.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
 */
export function CommissionsVariationChart() {
  const { month, year, granularity } = useDashboardFilters();
  const { isDark } = useTheme();
  const { data, loading, error, retry } = useDashboardData(
    '/dashboard/commissions-overview',
    { month, year, granularity },
  );
  const [chartStyle, setChartStyle] = useState('grouped');
  const [drillDown, setDrillDown] = useState(null);

  // Prepara dados para Recharts com label de período formatado
  const chartData = (data?.data || []).map((item) => ({
    ...item,
    periodLabel: formatPeriodLabel(item, granularity),
    adminCommission: item.totalAdminCommission ?? 0,
    representativeCommission: item.totalRepresentativeCommission ?? 0,
  }));

  // Handler para drill-down ao clicar em um período
  const handleChartClick = useCallback(
    (event) => {
      if (!event || !event.activePayload || event.activePayload.length === 0) return;

      const clickedData = event.activePayload[0].payload;
      const periodLabel = clickedData.periodLabel;
      const periodDetails = clickedData.details || [];

      setDrillDown({
        period: periodLabel,
        data: periodDetails,
      });
    },
    [],
  );

  const closeDrillDown = useCallback(() => {
    setDrillDown(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <section className={`rounded-xl border p-5 ${isDark ? "bg-[#2a2f2e] border-[#3d4543]" : "bg-white border-[#e3e3d1]"}`}>
        <ChartSkeleton />
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className={`rounded-xl border p-5 ${isDark ? "bg-[#2a2f2e] border-[#3d4543]" : "bg-white border-[#e3e3d1]"}`}>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-lg bg-[#58706d] px-4 py-2 text-sm font-medium text-white hover:bg-[#4b5757] transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  // Empty state
  if (!chartData.length) {
    return (
      <section className={`rounded-xl border p-5 ${isDark ? "bg-[#2a2f2e] border-[#3d4543]" : "bg-white border-[#e3e3d1]"}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#4b5757]">
            Variação de Comissões por Período
          </h3>
        </div>
        <p className="text-sm text-gray-400 text-center py-10">
          Nenhum dado disponível para o período selecionado
        </p>
      </section>
    );
  }

  return (
    <section className={`rounded-xl border p-5 ${isDark ? "bg-[#2a2f2e] border-[#3d4543]" : "bg-white border-[#e3e3d1]"}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#4b5757]">
          Variação de Comissões por Período
        </h3>
        <ChartStyleSelector
          styles={CHART_STYLES}
          activeStyle={chartStyle}
          onChange={setChartStyle}
        />
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartStyle, chartData, handleChartClick)}
        </ResponsiveContainer>
      </div>

      {drillDown && (
        <DrillDownPanel
          period={drillDown.period}
          data={drillDown.data}
          onClose={closeDrillDown}
        />
      )}
    </section>
  );
}
