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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  return (
    <div className="bg-white border border-[#e3e3d1] rounded-lg shadow-lg px-3 py-2 max-w-xs">
      <p className="text-sm font-medium text-[#4b5757]">{item.supplierName}</p>
      <p className="text-sm text-[#7c8a6e]">Receita: {formatCurrency(item.totalRevenue)}</p>
      <p className="text-sm text-[#7c8a6e]">Comissão Total: {formatCurrency(item.totalPool)}</p>
      <p className="text-sm text-[#7c8a6e]">% Comissão: {item.commissionPercentage}%</p>
      <p className="text-sm text-[#7c8a6e]">Admin: {formatCurrency(item.totalAdminCommission)}</p>
      <p className="text-sm text-[#7c8a6e]">Rep: {formatCurrency(item.totalRepresentativeCommission)}</p>
      <p className="text-sm text-[#7c8a6e]">Pedidos: {item.orderCount}</p>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-end gap-2 h-48 justify-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-12 bg-[#e3e3d1] rounded-t"
            style={{ height: `${30 + Math.random() * 70}%` }}
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
          dataKey="supplierName"
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
        <Bar dataKey="totalRevenue" radius={[4, 4, 0, 0]} name="Receita">
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
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 40)}>
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
          dataKey="supplierName"
          tick={{ fontSize: 11, fill: '#4b5757' }}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="totalRevenue" radius={[0, 4, 4, 0]} name="Receita">
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
          nameKey="supplierName"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ supplierName, percent }) =>
            `${supplierName?.substring(0, 10)}${supplierName?.length > 10 ? '…' : ''} (${(percent * 100).toFixed(0)}%)`
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
            value?.length > 15 ? `${value.substring(0, 15)}…` : value
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SuppliersComparisonChart() {
  const { month, year, granularity } = useDashboardFilters();
  const { data, loading, error, retry } = useDashboardData('/dashboard/suppliers-comparison', {
    month,
    year,
    granularity,
  });
  const [chartStyle, setChartStyle] = useState('horizontalBar');

  const chartData = data?.data || [];

  // Calcula totais para o resumo
  const totalRevenue = chartData.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
  const totalPool = chartData.reduce((sum, s) => sum + (s.totalPool || 0), 0);
  const totalOrders = chartData.reduce((sum, s) => sum + (s.orderCount || 0), 0);
  const avgCommission = totalRevenue > 0 ? ((totalPool / totalRevenue) * 100).toFixed(1) : '0.0';

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#4b5757]">Comparativo de Fornecedores</h3>
        <div className="flex items-center gap-2">
          {!loading && !error && chartData.length > 0 && (
            <>
              <button
                onClick={() => exportToCsv(chartData, [
                  { key: 'supplierName', label: 'Fornecedor' },
                  { key: 'totalRevenue', label: 'Receita (R$)' },
                  { key: 'totalPool', label: 'Comissão Total (R$)' },
                  { key: 'totalAdminCommission', label: 'Comissão Admin (R$)' },
                  { key: 'totalRepresentativeCommission', label: 'Comissão Rep (R$)' },
                  { key: 'commissionPercentage', label: '% Comissão' },
                  { key: 'orderCount', label: 'Pedidos' },
                ], `fornecedores-${month}-${year}`)}
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
        {/* Summary metrics */}
        {!loading && !error && chartData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#e3e3d1]/30 rounded-lg p-3 text-center">
              <p className="text-xs text-[#7c8a6e]">Fornecedores</p>
              <p className="text-lg font-semibold text-[#4b5757]">{chartData.length}</p>
            </div>
            <div className="bg-[#e3e3d1]/30 rounded-lg p-3 text-center">
              <p className="text-xs text-[#7c8a6e]">Receita Total</p>
              <p className="text-sm sm:text-base font-semibold text-[#4b5757]">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-[#e3e3d1]/30 rounded-lg p-3 text-center">
              <p className="text-xs text-[#7c8a6e]">Comissão Total</p>
              <p className="text-sm sm:text-base font-semibold text-[#4b5757]">{formatCurrency(totalPool)}</p>
            </div>
            <div className="bg-[#e3e3d1]/30 rounded-lg p-3 text-center">
              <p className="text-xs text-[#7c8a6e]">% Média</p>
              <p className="text-lg font-semibold text-[#4b5757]">{avgCommission}%</p>
            </div>
          </div>
        )}

        {/* Table view with details */}
        {!loading && !error && chartData.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#e3e3d1]">
                  <th className="text-left py-2 px-2 text-[#7c8a6e] font-medium">Fornecedor</th>
                  <th className="text-right py-2 px-2 text-[#7c8a6e] font-medium">Receita</th>
                  <th className="text-right py-2 px-2 text-[#7c8a6e] font-medium">Comissão</th>
                  <th className="text-right py-2 px-2 text-[#7c8a6e] font-medium">%</th>
                  <th className="text-right py-2 px-2 text-[#7c8a6e] font-medium">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((s, i) => (
                  <tr key={s.supplierId || i} className="border-b border-[#e3e3d1]/50">
                    <td className="py-2 px-2 text-[#4b5757] font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="truncate max-w-[120px] sm:max-w-none">{s.supplierName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right text-[#4b5757]">{formatCurrency(s.totalRevenue)}</td>
                    <td className="py-2 px-2 text-right text-[#4b5757]">{formatCurrency(s.totalPool)}</td>
                    <td className="py-2 px-2 text-right text-[#4b5757]">{s.commissionPercentage}%</td>
                    <td className="py-2 px-2 text-right text-[#4b5757]">{s.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

export default SuppliersComparisonChart;
