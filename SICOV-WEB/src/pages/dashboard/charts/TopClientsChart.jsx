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
  Treemap,
} from 'recharts';
import { AlignLeft, PieChart as PieChartIcon, LayoutGrid, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { ChartStyleSelector } from '../../../components/dashboard/ChartStyleSelector';
import { useDashboardFilters } from '../../../contexts/DashboardFilterContext';
import { useDashboardData } from '../../../hooks/useDashboardData';

const CHART_STYLES = [
  { id: 'horizontalBar', label: 'Barras horizontais', icon: AlignLeft },
  { id: 'pie', label: 'Pizza', icon: PieChartIcon },
  { id: 'treemap', label: 'Treemap', icon: LayoutGrid },
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

function SkeletonChart() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex flex-col gap-2 h-48">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-6 bg-[#e3e3d1] rounded"
            style={{ width: `${90 - i * 10}%` }}
          />
        ))}
      </div>
      <div className="h-4 bg-[#e3e3d1] rounded w-3/4 mx-auto" />
    </div>
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

function TreemapCustomContent({ x, y, width, height, name, value, index }) {
  if (width < 40 || height < 30) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={COLORS[index % COLORS.length]}
        stroke="#fff"
        strokeWidth={2}
        rx={4}
      />
      {width > 60 && height > 40 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={11}
            fontWeight="bold"
          >
            {name?.length > Math.floor(width / 8)
              ? `${name.substring(0, Math.floor(width / 8))}…`
              : name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
          >
            {formatCurrency(value)}
          </text>
        </>
      )}
    </g>
  );
}

function TreemapView({ data }) {
  const treemapData = data.map((item) => ({
    name: item.tradeName,
    value: item.totalRevenue,
    tradeName: item.tradeName,
    totalRevenue: item.totalRevenue,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap
        data={treemapData}
        dataKey="value"
        nameKey="name"
        content={<TreemapCustomContent />}
      >
        <Tooltip
          content={({ payload }) => {
            if (!payload || !payload.length) return null;
            const item = payload[0].payload;
            return (
              <div className="bg-white border border-[#e3e3d1] rounded-lg shadow-lg px-3 py-2">
                <p className="text-sm font-medium text-[#4b5757]">{item.tradeName || item.name}</p>
                <p className="text-sm text-[#7c8a6e]">
                  {formatCurrency(item.totalRevenue || item.value)}
                </p>
              </div>
            );
          }}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}

export function TopClientsChart() {
  const { month, year, granularity } = useDashboardFilters();
  const { data, loading, error, retry } = useDashboardData('/dashboard/top-clients', {
    month,
    year,
    granularity,
    limit: 10,
  });
  const [chartStyle, setChartStyle] = useState('horizontalBar');

  const chartData = data?.data || [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#4b5757]">Top Clientes por Receita</h3>
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
            {chartStyle === 'horizontalBar' && <HorizontalBarChart data={chartData} />}
            {chartStyle === 'pie' && <PieChartView data={chartData} />}
            {chartStyle === 'treemap' && <TreemapView data={chartData} />}
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default TopClientsChart;
