import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { ChartStyleSelector } from '../../../components/dashboard/ChartStyleSelector';
import { useDashboardFilters } from '../../../contexts/DashboardFilterContext';
import { useDashboardData } from '../../../hooks/useDashboardData';

const CHART_STYLES = [
  { id: 'bar', label: 'Barras', icon: BarChart3 },
  { id: 'line', label: 'Linhas', icon: LineChartIcon },
  { id: 'pie', label: 'Pizza', icon: PieChartIcon },
];

const GROUP_BY_OPTIONS = [
  { value: 'period', label: 'Por Período' },
  { value: 'client', label: 'Por Cliente' },
  { value: 'representative', label: 'Por Representante' },
];

const COLORS = [
  '#1E40AF', '#9F1239', '#065F46', '#EAB308', '#6D28D9',
  '#155E75', '#7C2D12', '#1E3A5F', '#831843', '#334155',
];

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRate(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  return (
    <div className="bg-white border border-[#e3e3d1] rounded-lg shadow-lg px-3 py-2">
      <p className="text-sm font-medium text-[#4b5757]">{item.groupLabel}</p>
      <p className="text-sm text-[#7c8a6e]">
        Quantidade: {item.cancelledCount}
      </p>
      <p className="text-sm text-[#7c8a6e]">
        Valor: {formatCurrency(item.cancelledValue)}
      </p>
      <p className="text-sm text-[#7c8a6e]">
        Taxa: {formatRate(item.cancellationRate)}
      </p>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-end gap-2 h-48 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-10 bg-[#e3e3d1] rounded-t"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <div className="h-4 bg-[#e3e3d1] rounded w-3/4 mx-auto" />
    </div>
  );
}

function BarChartView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3d1" />
        <XAxis
          dataKey="groupLabel"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 11, fill: '#4b5757' }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="cancelledCount" radius={[4, 4, 0, 0]} name="Cancelados">
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3d1" />
        <XAxis
          dataKey="groupLabel"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 11, fill: '#4b5757' }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="cancelledCount"
          stroke="#9F1239"
          strokeWidth={2}
          dot={{ fill: '#9F1239', r: 4 }}
          activeDot={{ r: 6 }}
          name="Cancelados"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="cancelledCount"
          nameKey="groupLabel"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ groupLabel, percent }) =>
            `${groupLabel?.substring(0, 12)}${groupLabel?.length > 12 ? '…' : ''} (${(percent * 100).toFixed(0)}%)`
          }
          labelLine={{ stroke: '#b0b087' }}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) =>
            value?.length > 18 ? `${value.substring(0, 18)}…` : value
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CancelledOrdersChart() {
  const { month, year, granularity } = useDashboardFilters();
  const [groupBy, setGroupBy] = useState('period');
  const [chartStyle, setChartStyle] = useState('bar');

  const { data, loading, error, retry } = useDashboardData('/dashboard/cancelled-orders', {
    month,
    year,
    granularity,
    groupBy,
  });

  const chartData = data?.data || [];
  const cancelledCount = data?.cancelledCount ?? 0;
  const cancelledValue = data?.cancelledValue ?? 0;
  const cancellationRate = data?.cancellationRate ?? 0;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#4b5757]">Pedidos Cancelados</h3>
        <div className="flex items-center gap-2">
          {!loading && !error && chartData.length > 0 && (
            <ChartStyleSelector
              styles={CHART_STYLES}
              activeStyle={chartStyle}
              onChange={setChartStyle}
            />
          )}
        </div>
      </CardHeader>

      <CardBody>
        {/* Group By Selector */}
        {!loading && !error && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-[#7c8a6e]">Agrupar:</span>
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#e3e3d1]/50 p-1">
              {GROUP_BY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGroupBy(value)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                    groupBy === value
                      ? 'bg-[#58706d] text-white shadow-sm'
                      : 'text-[#4b5757] hover:bg-[#e3e3d1]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Overall Metrics */}
        {!loading && !error && chartData.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-[#e3e3d1]/30 rounded-lg p-3 text-center">
              <p className="text-xs text-[#7c8a6e]">Qtd. Cancelados</p>
              <p className="text-lg font-semibold text-[#4b5757]">{cancelledCount}</p>
            </div>
            <div className="bg-[#e3e3d1]/30 rounded-lg p-3 text-center">
              <p className="text-xs text-[#7c8a6e]">Valor Cancelado</p>
              <p className="text-base sm:text-lg font-semibold text-[#4b5757]">
                {formatCurrency(cancelledValue)}
              </p>
            </div>
            <div className="bg-[#e3e3d1]/30 rounded-lg p-3 text-center">
              <p className="text-xs text-[#7c8a6e]">Taxa de Cancelamento</p>
              <p className="text-lg font-semibold text-[#4b5757]">
                {formatRate(cancellationRate)}
              </p>
            </div>
          </div>
        )}

        {loading && <SkeletonChart />}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#58706d] rounded-lg hover:bg-[#4b5757] transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && chartData.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[#7c8a6e]">
              Nenhum dado de cancelamento disponível para o período selecionado
            </p>
          </div>
        )}

        {!loading && !error && chartData.length > 0 && (
          <>
            {chartStyle === 'bar' && <BarChartView data={chartData} />}
            {chartStyle === 'line' && <LineChartView data={chartData} />}
            {chartStyle === 'pie' && <PieChartView data={chartData} />}
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default CancelledOrdersChart;
