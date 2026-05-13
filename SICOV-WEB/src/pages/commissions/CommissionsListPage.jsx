import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { CommissionDetailModal } from './CommissionDetailModal';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CommissionsListPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [commissions, setCommissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [suppliers, setSuppliers] = useState([]);

  const page = Number(searchParams.get('page') || 1);
  const month = searchParams.get('month') || '';
  const year = searchParams.get('year') || '';
  const status = searchParams.get('status') || '';
  const orderNumber = searchParams.get('orderNumber') || '';
  const supplierId = searchParams.get('supplierId') || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (month) params.month = month;
      if (year) params.year = year;
      if (status) params.status = status;
      if (orderNumber) params.orderNumber = orderNumber;
      if (supplierId) params.supplierId = supplierId;

      const [listRes, summaryRes] = await Promise.all([
        api.get('/commissions', { params }),
        api.get('/commissions/summary', { params: { month, year, supplierId } }),
      ]);

      setCommissions(listRes.data.commissions);
      setTotal(listRes.data.total);
      setTotalPages(listRes.data.totalPages);
      setSummary(() => {
        const items = summaryRes.data.summary || [];
        if (items.length === 0) return null;
        // Soma todos os grupos (pode haver vários representantes)
        return items.reduce((acc, item) => ({
          totalOrderValue: (acc.totalOrderValue || 0) + (item.totalOrderValue || 0),
          totalPool: (acc.totalPool || 0) + (item.totalPool || 0),
          totalAdminCommission: (acc.totalAdminCommission || 0) + (item.totalAdminCommission || 0),
          totalRepresentativeCommission: (acc.totalRepresentativeCommission || 0) + (item.totalRepresentativeCommission || 0),
          totalRealPool: (acc.totalRealPool || 0) + (item.totalRealPool || 0),
          totalRealAdminCommission: (acc.totalRealAdminCommission || 0) + (item.totalRealAdminCommission || 0),
          totalRealRepresentativeCommission: (acc.totalRealRepresentativeCommission || 0) + (item.totalRealRepresentativeCommission || 0),
          count: (acc.count || 0) + (item.count || 0),
        }), {});
      });
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [page, month, year, status, orderNumber, supplierId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Carrega fornecedores para o filtro
  useEffect(() => {
    api.get('/suppliers', { params: { active: 'true', limit: 100 } })
      .then(({ data }) => setSuppliers(data.suppliers || []))
      .catch(() => {});
  }, []);

  const setPage = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', p);
    setSearchParams(params);
  };

  const handleFilter = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const params = new URLSearchParams();
    const m = formData.get('month');
    const y = formData.get('year');
    const on = formData.get('orderNumber');
    const sid = formData.get('supplierId');
    if (m) params.set('month', m);
    if (y) params.set('year', y);
    if (on) params.set('orderNumber', on);
    if (sid) params.set('supplierId', sid);
    if (status) params.set('status', status);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleStatusFilter = (s) => {
    const params = new URLSearchParams(searchParams);
    if (s) params.set('status', s);
    else params.delete('status');
    params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#4b5757]">Comissões</h1>
        <p className="text-sm text-[#7c8a6e]">{total} registro{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Summary cards — só aparecem quando mês está filtrado */}
      {summary && month && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Valor total dos pedidos */}
          <Card>
            <CardBody className="space-y-3">
              <p className="text-xs font-medium text-[#7c8a6e] uppercase tracking-wide">Valor Total dos Pedidos (s/ IPI)</p>
              <p className="text-2xl font-bold text-[#4b5757]">{formatCurrency(summary.totalOrderValue)}</p>
              {(summary.totalRealPool || 0) > 0 && (
                <div className="pt-2 border-t border-[#e3e3d1]">
                  <p className="text-xs text-gray-400">Total Real Recebido</p>
                  <p className="text-lg font-bold text-[#4b5757]">{formatCurrency((summary.totalRealPool || 0) / (summary.totalPool > 0 ? summary.totalPool / summary.totalOrderValue : 0.05))}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Comissão Admin */}
          <Card>
            <CardBody className="space-y-3">
              <p className="text-xs font-medium text-[#7c8a6e] uppercase tracking-wide">Comissão</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Base Pedido</p>
                  <p className="text-xl font-bold text-[#4b5757]">{formatCurrency(summary.totalAdminCommission)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Base Real</p>
                  <p className="text-xl font-bold text-[#4b5757]">{formatCurrency(summary.totalRealAdminCommission || 0)}</p>
                </div>
              </div>
              {summary.totalAdminCommission > 0 && (summary.totalRealAdminCommission || 0) > 0 && (
                <div className="pt-2 border-t border-[#e3e3d1]">
                  <p className="text-xs text-gray-400">Diferença</p>
                  <p className={`text-sm font-semibold ${(summary.totalRealAdminCommission - summary.totalAdminCommission) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {(summary.totalRealAdminCommission - summary.totalAdminCommission) >= 0 ? '+' : ''}
                    {formatCurrency(summary.totalRealAdminCommission - summary.totalAdminCommission)}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <form onSubmit={handleFilter} className="flex flex-col sm:flex-row gap-3">
          <input
            name="month"
            type="number"
            min="1"
            max="12"
            defaultValue={month}
            placeholder="Mês"
            className="w-20 px-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
          />
          <input
            name="year"
            type="number"
            min="2020"
            max="2030"
            defaultValue={year}
            placeholder="Ano"
            className="w-24 px-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
          />
          <input
            name="orderNumber"
            type="text"
            defaultValue={orderNumber}
            placeholder="Nº Pedido"
            className="w-28 px-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
          />
          <select
            name="supplierId"
            defaultValue={supplierId}
            className="px-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
          >
            <option value="">Todos fornecedores</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.tradeName || s.name}</option>)}
          </select>
          <Button type="submit" variant="secondary" size="md">
            <Search size={14} />
            Filtrar
          </Button>

          <div className="flex gap-2 sm:ml-auto">
            {['', 'cancelled', 'all'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  status === s
                    ? 'bg-[#58706d] text-white border-[#58706d]'
                    : 'bg-white text-[#4b5757] border-[#e3e3d1] hover:border-[#58706d]'
                }`}
              >
                {s === '' ? 'Ativas' : s === 'cancelled' ? 'Canceladas' : 'Todas'}
              </button>
            ))}
          </div>
        </form>
      </Card>

      {/* Lista */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : commissions.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhuma comissão encontrada.</div>
        ) : (
          <div className="divide-y divide-[#e3e3d1]">
            {commissions.map((c) => (
              <div key={c._id} className="px-4 md:px-6 py-4 hover:bg-[#f5f5ee] transition-colors cursor-pointer" onClick={() => setSelectedCommission(c)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#e3e3d1] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#4b5757]">
                        #{c.orderNumber ?? '—'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#4b5757]">
                          Pedido #{c.orderNumber ?? '—'}
                        </p>
                        {c.projected && <Badge variant="pending">Projetada</Badge>}
                        {c.status === 'cancelled' && <Badge variant="cancelled">Cancelada</Badge>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.supplierName ? `${c.supplierName} · ` : ''}
                        {c.customerPurchaseOrder ? `PC: ${c.customerPurchaseOrder} · ` : ''}
                        {c.period?.month}/{c.period?.year}
                        {isAdmin
                          ? (c.adminPercentage !== undefined ? ` · ${c.adminPercentage}%` : '')
                          : (c.representativePercentage !== undefined ? ` · ${c.representativePercentage}%` : '')
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                    <span className="text-sm font-semibold text-[#4b5757]">
                      {formatCurrency(c.adminCommission)}
                    </span>
                    <span className="text-xs text-gray-400">
                      de {formatCurrency(c.orderValueWithoutIpi)}
                    </span>
                    {c.realAdminCommission != null && c.realAdminCommission > 0 && (
                      <span className="text-xs text-[#7c8a6e]">
                        Real: {formatCurrency(c.realAdminCommission)}
                      </span>
                    )}
                    {c.representativeCommission > 0 && (
                      <span className="text-xs text-gray-300">
                        Rep: {formatCurrency(c.representativeCommission)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-[#4b5757]">Página {page} de {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {/* Modal de detalhes/edição */}
      {selectedCommission && (
        <CommissionDetailModal
          commission={selectedCommission}
          onClose={() => setSelectedCommission(null)}
          onUpdated={(updated) => {
            setCommissions((prev) => prev.map((c) => c._id === updated._id ? updated : c));
            setSelectedCommission(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
