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
import { BarChart3, PieChart as PieChartIcon, AlignLeft, RefreshCw, Download } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { ChartStyleSelector } from '../../../components/dashboard/ChartStyleSelector';
import { useDashboardFilters } from '../../../contexts/DashboardFilterContext';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { exportToCsv } from '../../../utils/exportCsv';

const CHART_STYLES = [
  { id: 'bar', label: 'Barras verticais', icon: BarChart3 },
  { id: 'pie', label: 'Pizza', icon: PieChartIcon },
  { id: 'horizontalBar', label: 'Barras horizontais', icon: AlignLeft },
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
      <p className="text-sm font-medium text-[#4b5757]">{item.tradeName}</p>
      <p className="text-sm text-[#7c8a6e]">{formatCurrency(item.totalRevenue)}</p>
    </div>
  );
}

const SKELETON_HEIGHTS = [65, 80, 45, 90, 55, 72, 38, 85];

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

function VerticalBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3d1" />
        <XAxis
          dataKey="tradeName"
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
        <Bar dataKey="totalRevenue" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3d1" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <YAxis
          type="category"
          dataKey="tradeName"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="totalRevenue" radius={[0, 4, 4, 0]}>
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
          dataKey="totalRevenue"
          nameKey="tradeName"
          cx="50%"
          cy="50%"
          outerRadius={120}
          label={false}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.tradeName || ''}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ClientsRevenueChart() {
  const { month, year, granularity } = useDashboardFilters();
  const { data, loading, error, retry } = useDashboardData('/dashboard/clients-revenue', {
    month,
    year,
    granularity,
  });
  const [chartStyle, setChartStyle] = useState('bar');

  const chartData = data?.data || [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#4b5757]">Faturamento por Cliente</h3>
        <div className="flex items-center gap-2">
          {!loading && !error && chartData.length > 0 && (
            <>
              <button
                onClick={() => exportToCsv(chartData, [
                  { key: 'tradeName', label: 'Cliente' },
                  { key: 'totalRevenue', label: 'Faturamento (R$)' },
                ], `faturamento-clientes-${month}-${year}`)}
                className="p-1.5 text-[#7c8a6e] hover:text-[#4b5757] rounded-lg hover:bg-[#e3e3d1] transition-colors"
                title="Exportar CSV"
              >
                <Download size={14} />
              </button>
              <ChartStyleSelector
                styles={CHART_STYLES}
                activeStyle={chartStyle}
                onChange={setChartStyle}
              />
            </>
          )}
        </div>
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
            {chartStyle === 'bar' && <VerticalBarChart data={chartData} />}
            {chartStyle === 'pie' && <PieChartView data={chartData} />}
            {chartStyle === 'horizontalBar' && <HorizontalBarChart data={chartData} />}
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default ClientsRevenueChart;
