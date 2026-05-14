import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const statusMap = {
  active:    { label: 'Ativo',     variant: 'active' },
  cancelled: { label: 'Cancelado', variant: 'cancelled' },
};

export function OrdersListPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get('page') || 1);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (status) params.status = status;

      const { data } = await api.get('/orders', { params });
      setOrders(data.orders);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const setPage = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', p);
    setSearchParams(params);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const params = new URLSearchParams(searchParams);
    params.set('search', formData.get('search'));
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Pedidos</h1>
          <p className="text-sm text-[#7c8a6e]">{total} pedido{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/orders/new">
          <Button size="md">
            <Plus size={16} />
            Novo Pedido
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="search"
                defaultValue={search}
                placeholder="Buscar por cliente, fornecedor, nº pedido, PC..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
              />
            </div>
            <Button type="submit" variant="secondary" size="md">
              <Search size={14} />
            </Button>
          </form>

          <div className="flex gap-2">
            {['', 'active', 'cancelled'].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  status === s
                    ? 'bg-[#58706d] text-white border-[#58706d]'
                    : 'bg-white text-[#4b5757] border-[#e3e3d1] hover:border-[#58706d]'
                }`}
              >
                {s === '' ? 'Todos' : s === 'active' ? 'Ativos' : 'Cancelados'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum pedido encontrado.</div>
        ) : (
          <>
            {/* Lista de cards (desktop e mobile) */}
            <div className="divide-y divide-[#e3e3d1]">
              {orders.map((order) => {
                const s = statusMap[order.status] ?? { label: order.status, variant: 'default' };
                return (
                  <Link
                    key={order._id}
                    to={`/orders/${order._id}`}
                    className="flex items-center justify-between px-4 md:px-6 py-4 hover:bg-[#f5f5ee] transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-auto min-w-10 h-10 px-2 rounded-lg bg-[#e3e3d1] flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#4b5757]">#{order.orderNumber}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#4b5757] truncate">
                          {order.clientSnapshot?.tradeName || order.clientSnapshot?.name || '—'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400">
                            {order.supplierSnapshot?.tradeName || order.supplierSnapshot?.name || '—'}
                          </span>
                          {order.customerPurchaseOrder && (
                            <span className="text-xs text-gray-400">· PC: {order.customerPurchaseOrder}</span>
                          )}
                          <span className="text-xs text-gray-400">· {formatDate(order.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="text-right hidden sm:block">
                        <span className="text-sm font-semibold text-[#4b5757]">{formatCurrency(order.total)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={s.variant}>{s.label}</Badge>
                        {order.sentToSupplier ? (
                          <Badge variant="sent">Enviado</Badge>
                        ) : (
                          <Badge variant="pending">Pendente</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-[#4b5757]">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
