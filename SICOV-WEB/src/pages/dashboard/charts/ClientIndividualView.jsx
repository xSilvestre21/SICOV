import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart3, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { ChartStyleSelector } from '../../../components/dashboard/ChartStyleSelector';
import { useDashboardFilters } from '../../../contexts/DashboardFilterContext';
import { useDashboardData } from '../../../hooks/useDashboardData';

const CHART_STYLES = [
  { id: 'line', label: 'Linhas', icon: TrendingUp },
  { id: 'bar', label: 'Barras', icon: BarChart3 },
];

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatPeriodLabel(period) {
  if (!period) return '';
  if (period.month) {
    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];
    return `${monthNames[period.month - 1]}/${period.year}`;
  }
  return String(period.year);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-[#e3e3d1] rounded-lg shadow-lg px-3 py-2">
      <p className="text-sm font-medium text-[#4b5757] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.dataKey === 'orderCount' ? entry.value : formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-[#e3e3d1] rounded-t"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <div className="h-4 bg-[#e3e3d1] rounded w-3/4 mx-auto" />
    </div>
  );
}

function EvolutionLineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3d1" />
        <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: '#4b5757' }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          name="Receita"
          stroke="#1E40AF"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orderCount"
          name="Pedidos"
          stroke="#9F1239"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EvolutionBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3d1" />
        <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: '#4b5757' }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="revenue"
          name="Receita"
          fill="#1E40AF"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId="right"
          dataKey="orderCount"
          name="Pedidos"
          fill="#9F1239"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * ClientIndividualView — displays detailed charts for a specific client:
 * - Evolution of orders (orderCount per period)
 * - Total revenue per period
 * - Total commissions (summary number)
 *
 * Supports Line and Bar chart styles via ChartStyleSelector.
 *
 * @param {Object} props
 * @param {string} props.clientId - The selected client's ID
 */
export function ClientIndividualView({ clientId }) {
  const { month, year, granularity } = useDashboardFilters();
  const { data, loading, error, retry } = useDashboardData(
    `/dashboard/client/${clientId}`,
    { month, year, granularity },
  );
  const [chartStyle, setChartStyle] = useState('line');

  const evolution = (data?.evolution || []).map((item) => ({
    ...item,
    periodLabel: formatPeriodLabel(item.period),
  }));

  const clientName = data?.client?.tradeName || data?.client?.name || '';
  const totalOrders = data?.totalOrders ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalCommissions = data?.totalCommissions ?? 0;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#4b5757]">
          {clientName ? `Visão Individual — ${clientName}` : 'Visão Individual do Cliente'}
        </h3>
        {!loading && !error && evolution.length > 0 && (
          <ChartStyleSelector
            styles={CHART_STYLES}
            activeStyle={chartStyle}
            onChange={setChartStyle}
          />
        )}
      </CardHeader>

      <CardBody>
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

        {!loading && !error && evolution.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[#7c8a6e]">
              Nenhum dado disponível para o período selecionado
            </p>
          </div>
        )}

        {!loading && !error && evolution.length > 0 && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg bg-[#e3e3d1]/30 p-3 text-center">
                <p className="text-xs text-[#7c8a6e] mb-1">Total de Pedidos</p>
                <p className="text-lg font-semibold text-[#4b5757]">{totalOrders}</p>
              </div>
              <div className="rounded-lg bg-[#e3e3d1]/30 p-3 text-center">
                <p className="text-xs text-[#7c8a6e] mb-1">Receita Total</p>
                <p className="text-lg font-semibold text-[#4b5757]">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg bg-[#e3e3d1]/30 p-3 text-center">
                <p className="text-xs text-[#7c8a6e] mb-1">Total de Comissões</p>
                <p className="text-lg font-semibold text-[#4b5757]">
                  {formatCurrency(totalCommissions)}
                </p>
              </div>
            </div>

            {/* Chart */}
            {chartStyle === 'line' && <EvolutionLineChart data={evolution} />}
            {chartStyle === 'bar' && <EvolutionBarChart data={evolution} />}
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default ClientIndividualView;
