import { useState } from 'react';
import {
  BarChart,
  Bar,
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
import { BarChart3, PieChart as PieChartIcon, List, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { ChartStyleSelector } from '../../../components/dashboard/ChartStyleSelector';
import { useDashboardFilters } from '../../../contexts/DashboardFilterContext';
import { useDashboardData } from '../../../hooks/useDashboardData';

const CHART_STYLES = [
  { id: 'bar', label: 'Barras', icon: BarChart3 },
  { id: 'pie', label: 'Pizza', icon: PieChartIcon },
  { id: 'rankingTable', label: 'Tabela Ranking', icon: List },
];

const COLORS = [
  '#1E40AF', '#9F1239', '#065F46', '#EAB308', '#6D28D9',
  '#155E75', '#7C2D12', '#1E3A5F', '#831843', '#334155',
];

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  return (
    <div className="bg-white border border-[#e3e3d1] rounded-lg shadow-lg px-3 py-2">
      <p className="text-sm font-medium text-[#4b5757]">{item.name}</p>
      <p className="text-sm text-[#7c8a6e]">
        Pedidos: {item.orderCount}
      </p>
      <p className="text-sm text-[#7c8a6e]">
        Valor total vendido: {formatCurrency(item.totalSold)}
      </p>
      <p className="text-sm text-[#7c8a6e]">
        Comissão gerada: {formatCurrency(item.totalCommission)}
      </p>
    </div>
  );
}

const SKELETON_HEIGHTS = [65, 45, 80, 55, 72, 38];

function SkeletonChart() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-end gap-2 h-48">
        {SKELETON_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-[#e3e3d1] rounded-t"
            style={{ height: `${h}%` }}
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
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3d1" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#4b5757' }}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="totalSold" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="totalSold"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, percent }) =>
            `${name?.substring(0, 12)}${name?.length > 12 ? '…' : ''} (${(percent * 100).toFixed(0)}%)`
          }
          labelLine={{ stroke: '#b0b087' }}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [formatCurrency(value), 'Valor vendido']}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
        />
        <Legend
          formatter={(value) =>
            value?.length > 18 ? `${value.substring(0, 18)}…` : value
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RankingTable({ data }) {
  const sorted = [...data].sort((a, b) => b.totalSold - a.totalSold);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e3e3d1]">
            <th className="text-left py-2 px-3 text-[#4b5757] font-semibold">#</th>
            <th className="text-left py-2 px-3 text-[#4b5757] font-semibold">Representante</th>
            <th className="text-right py-2 px-3 text-[#4b5757] font-semibold">Pedidos</th>
            <th className="text-right py-2 px-3 text-[#4b5757] font-semibold">Valor Vendido</th>
            <th className="text-right py-2 px-3 text-[#4b5757] font-semibold">Comissão</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, index) => (
            <tr
              key={item.representativeId || index}
              className="border-b border-[#e3e3d1] last:border-b-0 hover:bg-[#f5f5ee] transition-colors"
            >
              <td className="py-2 px-3 text-[#7c8a6e] font-medium">{index + 1}</td>
              <td className="py-2 px-3 text-[#4b5757] font-medium">{item.name}</td>
              <td className="py-2 px-3 text-right text-[#4b5757]">{item.orderCount}</td>
              <td className="py-2 px-3 text-right text-[#4b5757]">{formatCurrency(item.totalSold)}</td>
              <td className="py-2 px-3 text-right text-[#7c8a6e]">{formatCurrency(item.totalCommission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RepresentativesPerformanceChart() {
  const { month, year, granularity } = useDashboardFilters();
  const { data, loading, error, retry } = useDashboardData(
    '/dashboard/representatives-performance',
    { month, year, granularity },
  );
  const [chartStyle, setChartStyle] = useState('bar');

  const chartData = data?.data || [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#4b5757]">Desempenho dos Representantes</h3>
        {!loading && !error && chartData.length > 0 && (
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

        {!loading && !error && chartData.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[#7c8a6e]">
              Nenhum dado disponível para o período selecionado
            </p>
          </div>
        )}

        {!loading && !error && chartData.length > 0 && (
          <>
            {chartStyle === 'bar' && <BarChartView data={chartData} />}
            {chartStyle === 'pie' && <PieChartView data={chartData} />}
            {chartStyle === 'rankingTable' && <RankingTable data={chartData} />}
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default RepresentativesPerformanceChart;
