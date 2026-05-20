import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp, BarChart3, AreaChart as AreaIcon } from 'lucide-react';
import { useDashboardFilters } from '../../../contexts/DashboardFilterContext';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { ChartStyleSelector } from '../../../components/dashboard/ChartStyleSelector';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';

const CHART_STYLES = [
  { id: 'line', label: 'Linhas', icon: TrendingUp },
  { id: 'bar', label: 'Barras', icon: BarChart3 },
  { id: 'area', label: 'Área', icon: AreaIcon },
];

const CHART_COLOR = '#1E40AF';

const COLORS = [
  '#1E40AF', '#9F1239', '#065F46', '#EAB308', '#6D28D9',
  '#155E75', '#7C2D12', '#1E3A5F', '#831843', '#334155',
];

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
 * Tooltip customizado com valor formatado e período
 */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#e3e3d1] bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-[#4b5757] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm text-[#58706d] font-semibold">
          {formatCurrency(entry.value)}
        </p>
      ))}
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
 * CommissionsOverviewChart — exibe a evolução da Comissão_Admin ao longo do tempo.
 * Suporta estilos: Line, Bar, Area.
 * Tooltip com valor formatado (2 casas decimais) e período.
 *
 * Requirements: 3.4, 3.5, 3.6, 3.7
 */
export function CommissionsOverviewChart() {
  const { month, year, granularity } = useDashboardFilters();
  const { isDark } = useTheme();
  const { isAdmin } = useAuth();
  const { data, loading, error, retry } = useDashboardData(
    '/dashboard/commissions-overview',
    { month, year, granularity },
  );
  const [chartStyle, setChartStyle] = useState('line');

  // Prepara dados para Recharts com label de período formatado
  // Para representantes, mostra representativeCommission; para admin, adminCommission
  const chartData = (data?.data || []).map((item) => ({
    ...item,
    periodLabel: formatPeriodLabel(item, granularity),
    adminCommission: isAdmin
      ? (item.totalAdminCommission ?? 0)
      : (item.totalRepresentativeCommission ?? 0),
  }));

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
            {isAdmin ? 'Receita e Comissão do Administrador' : 'Receita e Comissão do Representante'}
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
          {isAdmin ? 'Receita e Comissão do Administrador' : 'Receita e Comissão do Representante'}
        </h3>
        <ChartStyleSelector
          styles={CHART_STYLES}
          activeStyle={chartStyle}
          onChange={setChartStyle}
        />
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartStyle, chartData)}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/**
 * Renderiza o gráfico no estilo selecionado
 */
function renderChart(style, data) {
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
      value >= 1000
        ? `${(value / 1000).toFixed(1)}k`
        : value.toFixed(2),
  };

  const gridProps = {
    strokeDasharray: '3 3',
    stroke: '#e3e3d1',
    vertical: false,
  };

  const tooltipProps = {
    content: <CustomTooltip />,
  };

  switch (style) {
    case 'bar':
      return (
        <BarChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Bar
            dataKey="adminCommission"
            radius={[4, 4, 0, 0]}
            name="Comissão Admin"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      );

    case 'area':
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Area
            type="monotone"
            dataKey="adminCommission"
            stroke={CHART_COLOR}
            fill={CHART_COLOR}
            fillOpacity={0.2}
            name="Comissão Admin"
          />
        </AreaChart>
      );

    case 'line':
    default:
      return (
        <LineChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Line
            type="monotone"
            dataKey="adminCommission"
            stroke={CHART_COLOR}
            strokeWidth={2}
            dot={{ r: 4, fill: CHART_COLOR }}
            activeDot={{ r: 6 }}
            name="Comissão Admin"
          />
        </LineChart>
      );
  }
}
