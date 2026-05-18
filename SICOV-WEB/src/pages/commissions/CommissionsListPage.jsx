import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, DollarSign, Eye, EyeOff } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { CommissionDetailModal } from './CommissionDetailModal';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const blurClass = (hidden) => hidden ? 'blur-md select-none' : '';

export function CommissionsListPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [commissions, setCommissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState(null);
  const [repSummary, setRepSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [valuesHidden, setValuesHidden] = useState(true);
  const [representatives, setRepresentatives] = useState([]);

  const page = Number(searchParams.get('page') || 1);
  const month = searchParams.get('month') || '';
  const year = searchParams.get('year') || '';
  const status = searchParams.get('status') || 'all';
  const orderNumber = searchParams.get('orderNumber') || '';
  const supplierId = searchParams.get('supplierId') || '';
  const representativeId = searchParams.get('representativeId') || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (month) params.month = month;
      if (year) params.year = year;
      if (status) params.status = status;
      if (orderNumber) params.orderNumber = orderNumber;
      if (supplierId) params.supplierId = supplierId;
      if (representativeId) params.representativeId = representativeId;

      const [listRes, summaryRes] = await Promise.all([
        api.get('/commissions', { params }),
        api.get('/commissions/summary', { params: { month, year, supplierId, representativeId } }),
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
      // Guarda resumo por representante
      setRepSummary(summaryRes.data.summary || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [page, month, year, status, orderNumber, supplierId, representativeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Carrega fornecedores e representantes para os filtros
  useEffect(() => {
    api.get('/suppliers', { params: { active: 'true', limit: 100 } })
      .then(({ data }) => setSuppliers(data.suppliers || []))
      .catch(() => {});
    api.get('/users/representatives')
      .then(({ data }) => setRepresentatives(data || []))
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
    const rid = formData.get('representativeId');
    if (m) params.set('month', m);
    if (y) params.set('year', y);
    if (on) params.set('orderNumber', on);
    if (sid) params.set('supplierId', sid);
    if (rid) params.set('representativeId', rid);
    if (status) params.set('status', status);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleStatusFilter = (s) => {
    const params = new URLSearchParams(searchParams);
    if (s === 'all') {
      params.delete('status');
    } else {
      params.set('status', s);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Comissões</h1>
          <p className="text-sm text-[#7c8a6e]">{total} registro{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setValuesHidden(!valuesHidden)}
          className="p-2 text-[#7c8a6e] hover:text-[#4b5757] hover:bg-[#e3e3d1] rounded-lg transition-colors"
          title={valuesHidden ? 'Mostrar valores' : 'Ocultar valores'}
        >
          {valuesHidden ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {/* Summary cards — só aparecem quando mês está filtrado */}
      {summary && month && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Valor total dos pedidos */}
          <Card>
            <CardBody className="space-y-3">
              <p className="text-xs font-medium text-[#7c8a6e] uppercase tracking-wide">Valor Total dos Pedidos (s/ IPI)</p>
              <p className={`text-2xl font-bold text-[#4b5757] ${blurClass(valuesHidden)}`}>{formatCurrency(summary.totalOrderValue)}</p>
              {(summary.totalRealPool || 0) > 0 && (
                <div className="pt-2 border-t border-[#e3e3d1]">
                  <p className="text-xs text-gray-400">Total Real Recebido</p>
                  <p className={`text-lg font-bold text-[#4b5757] ${blurClass(valuesHidden)}`}>{formatCurrency((summary.totalRealPool || 0) / (summary.totalPool > 0 ? summary.totalPool / summary.totalOrderValue : 0.05))}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Comissão */}
          <Card>
            <CardBody className="space-y-3">
              <p className="text-xs font-medium text-[#7c8a6e] uppercase tracking-wide">
                {isAdmin ? 'Sua Comissão' : 'Sua Comissão'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Base Pedido</p>
                  <p className={`text-xl font-bold text-[#4b5757] ${blurClass(valuesHidden)}`}>
                    {formatCurrency(isAdmin ? summary.totalAdminCommission : summary.totalRepresentativeCommission)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Base Real</p>
                  <p className={`text-xl font-bold text-[#4b5757] ${blurClass(valuesHidden)}`}>
                    {formatCurrency(isAdmin ? (summary.totalRealAdminCommission || 0) : (summary.totalRealRepresentativeCommission || 0))}
                  </p>
                </div>
              </div>
              {(() => {
                const base = isAdmin ? summary.totalAdminCommission : summary.totalRepresentativeCommission;
                const real = isAdmin ? (summary.totalRealAdminCommission || 0) : (summary.totalRealRepresentativeCommission || 0);
                const diff = real - base;
                if (real === 0) return null;
                return (
                  <div className="pt-2 border-t border-[#e3e3d1]">
                    <p className="text-xs text-gray-400">Diferença (real - pedido)</p>
                    <p className={`text-sm font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'} ${blurClass(valuesHidden)}`}>
                      {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                    </p>
                  </div>
                );
              })()}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Resumo por representante — só aparece com mês filtrado e representantes existentes */}
      {isAdmin && month && (() => {
        const repOnly = repSummary.filter((rep) =>
          representatives.some((r) => r._id === rep.representativeId?.toString() || r._id === rep.representativeId)
        );
        return repOnly.length > 0 ? (
          <Card>
            <CardBody>
              <p className="text-xs font-medium text-[#7c8a6e] uppercase tracking-wide mb-3">Por Representante</p>
              <div className="divide-y divide-[#e3e3d1]">
                {repOnly.map((rep, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-[#4b5757]">{rep.representativeName || 'Sem representante'}</p>
                      <p className={`text-xs text-gray-400 ${blurClass(valuesHidden)}`}>{rep.count} pedido{rep.count !== 1 ? 's' : ''} · Total: {formatCurrency(rep.totalOrderValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold text-[#4b5757] ${blurClass(valuesHidden)}`}>{formatCurrency(rep.totalRepresentativeCommission)}</p>
                      {(rep.totalRealRepresentativeCommission || 0) > 0 && (
                        <p className={`text-xs font-medium ${(rep.totalRealRepresentativeCommission - rep.totalRepresentativeCommission) >= 0 ? 'text-emerald-600' : 'text-red-500'} ${blurClass(valuesHidden)}`}>
                          Real: {formatCurrency(rep.totalRealRepresentativeCommission)} ({(rep.totalRealRepresentativeCommission - rep.totalRepresentativeCommission) >= 0 ? '+' : ''}{formatCurrency(rep.totalRealRepresentativeCommission - rep.totalRepresentativeCommission)})
                        </p>
                      )}
                      <p className={`text-xs text-gray-400 ${blurClass(valuesHidden)}`}>entrega p/ admin: {formatCurrency(rep.totalAdminCommission)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ) : null;
      })()}

      {/* Filtros */}
      <Card className="p-4">
        <form onSubmit={handleFilter} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              name="month"
              type="number"
              min="1"
              max="12"
              defaultValue={month}
              placeholder="Mês"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
            />
            <input
              name="year"
              type="number"
              min="2020"
              max="2030"
              defaultValue={year}
              placeholder="Ano"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
            />
            <input
              name="orderNumber"
              type="text"
              defaultValue={orderNumber}
              placeholder="Nº Pedido"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
            />
            <select
              name="supplierId"
              defaultValue={supplierId}
              className="w-full px-3 py-2 text-sm text-gray-500 rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
            >
              <option value="">Todos fornecedores</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.tradeName || s.name}</option>)}
            </select>
            {isAdmin && (
              <select
                name="representativeId"
                defaultValue={representativeId}
                className="w-full px-3 py-2 text-sm text-gray-500 rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
              >
                <option value="">Todos representantes</option>
                {representatives.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            )}
            <Button type="submit" variant="secondary" size="md" className="col-span-2 sm:col-span-1">
              <Search size={14} />
              Filtrar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'active', 'cancelled'].map((s) => (
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
                {s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : 'Canceladas'}
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
              <div
                key={c._id}
                className={`px-4 md:px-6 py-4 transition-colors ${
                  c.status === 'cancelled'
                    ? 'bg-red-50/70 cursor-default'
                    : 'hover:bg-[#f5f5ee] cursor-pointer'
                }`}
                onClick={() => c.status !== 'cancelled' && setSelectedCommission(c)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`relative w-auto min-w-9 h-9 px-2 rounded-lg flex items-center justify-center shrink-0 ${
                      c.realDeliveryDate && (c.deliveryDate || c.dueDate) ? (() => {
                        const expected = new Date(c.dueDate || c.deliveryDate);
                        const actual = new Date(c.realDeliveryDate);
                        const diff = Math.round((actual - expected) / (1000 * 60 * 60 * 24));
                        return diff === 0 ? 'bg-emerald-200' : diff > 0 ? 'bg-red-200' : 'bg-blue-200';
                      })() : 'bg-[#e3e3d1]'
                    }`}>
                      <span className={`text-xs font-bold ${
                        c.realDeliveryDate && (c.deliveryDate || c.dueDate) ? (() => {
                          const expected = new Date(c.dueDate || c.deliveryDate);
                          const actual = new Date(c.realDeliveryDate);
                          const diff = Math.round((actual - expected) / (1000 * 60 * 60 * 24));
                          return diff === 0 ? 'text-emerald-700' : diff > 0 ? 'text-red-700' : 'text-blue-700';
                        })() : 'text-[#4b5757]'
                      }`}>
                        #{c.orderNumber ?? '—'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#4b5757]">
                          Pedido #{c.orderNumber ?? '—'}
                        </p>
                        {isAdmin && c.representativeName && (
                          <span className="text-sm font-semibold text-[#58706d]">
                            — {c.representativeName}
                          </span>
                        )}
                        {c.installmentsCreated && <Badge variant="default">Parcelada</Badge>}
                        {c.projected && !c.installmentsCreated && <Badge variant="pending">Parcela {c.installmentIndex || ''}</Badge>}
                        {c.status === 'cancelled' && <Badge variant="cancelled">Cancelada</Badge>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.supplierName ? `${c.supplierName}` : ''}
                        {c.customerPurchaseOrder ? ` · PC: ${c.customerPurchaseOrder}` : ''}
                        {' · '}{c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : `${c.period?.month}/${c.period?.year}`}
                        {isAdmin
                          ? (c.adminPercentage !== undefined ? ` · ${c.adminPercentage}%` : '')
                          : (c.representativePercentage !== undefined ? ` · ${c.representativePercentage}%` : '')
                        }
                      </p>
                    </div>
                  </div>

                  <div className={`flex flex-col items-end gap-0.5 shrink-0 ml-3 ${c.status === 'cancelled' ? 'opacity-50' : ''}`}>
                    <span className={`text-sm font-semibold text-[#4b5757] ${blurClass(valuesHidden)}`}>
                      {formatCurrency(isAdmin ? c.adminCommission : c.representativeCommission)}
                    </span>
                    <span className={`text-xs text-gray-400 ${blurClass(valuesHidden)}`}>
                      de {formatCurrency(c.orderValueWithoutIpi)}
                    </span>
                    {isAdmin && c.realAdminCommission != null && c.realAdminCommission > 0 && (
                      <span className={`text-xs text-[#7c8a6e] ${blurClass(valuesHidden)}`}>
                        Real: {formatCurrency(c.realAdminCommission)}
                      </span>
                    )}
                    {!isAdmin && c.realRepresentativeCommission != null && c.realRepresentativeCommission > 0 && (
                      <span className={`text-xs text-[#7c8a6e] ${blurClass(valuesHidden)}`}>
                        Real: {formatCurrency(c.realRepresentativeCommission)}
                      </span>
                    )}
                    {c.representativeCommission > 0 && (
                      <span className={`text-xs text-gray-300 ${blurClass(valuesHidden)}`}>
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
