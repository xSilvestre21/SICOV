import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  FileText,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

function StatCard({ icon: Icon, label, value, color, to, hidden }) {
  const content = (
    <CardBody className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-2xl font-bold text-[#4b5757] ${hidden ? 'blur-md select-none' : ''}`}>{value ?? '—'}</p>
      </div>
    </CardBody>
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      {to ? <Link to={to}>{content}</Link> : content}
    </Card>
  );
}

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function DashboardPage() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [valuesHidden, setValuesHidden] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const [ordersRes, commissionsRes] = await Promise.all([
          api.get('/orders?limit=5'),
          api.get(`/commissions/summary?month=${currentMonth}&year=${currentYear}`),
        ]);

        setRecentOrders(ordersRes.data.orders || []);

        const items = commissionsRes.data.summary || [];
        const summary = items.reduce((acc, item) => ({
          totalPool: (acc.totalPool || 0) + (item.totalPool || 0),
          totalAdminCommission: (acc.totalAdminCommission || 0) + (item.totalAdminCommission || 0),
          totalRepComm: (acc.totalRepComm || 0) + (item.totalRepresentativeCommission || 0),
        }), {});
        setStats({
          totalOrders: ordersRes.data.total,
          totalPool: summary.totalPool ?? 0,
          totalAdminComm: summary.totalAdminCommission ?? 0,
          totalRepComm: summary.totalRepComm ?? 0,
        });
      } catch {
        // silencioso — mostra dados parciais
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusMap = {
    active:    { label: 'Ativo',     variant: 'active' },
    cancelled: { label: 'Cancelado', variant: 'cancelled' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Início</h1>
          <p className="text-sm text-[#7c8a6e] mt-1">Visão geral do sistema</p>
        </div>
        <button
          onClick={() => setValuesHidden(!valuesHidden)}
          className="p-2 text-[#7c8a6e] hover:text-[#4b5757] hover:bg-[#e3e3d1] rounded-lg transition-colors"
          title={valuesHidden ? 'Mostrar valores' : 'Ocultar valores'}
        >
          {valuesHidden ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={ShoppingCart}
          label="Total de Pedidos"
          value={loading ? '...' : stats?.totalOrders}
          color="bg-[#58706d]"
          to="/orders"
          hidden={valuesHidden}
        />
        {isAdmin ? (
          <>
            <StatCard
              icon={DollarSign}
              label="Sua Comissão (mês atual)"
              value={loading ? '...' : formatCurrency(stats?.totalAdminComm)}
              color="bg-[#7c8a6e]"
              to="/commissions"
              hidden={valuesHidden}
            />
            <StatCard
              icon={TrendingUp}
              label="Representantes (mês atual)"
              value={loading ? '...' : formatCurrency(stats?.totalRepComm)}
              color="bg-[#b0b087]"
              to="/commissions"
              hidden={valuesHidden}
            />
          </>
        ) : (
          <StatCard
            icon={DollarSign}
            label="Minha Comissão (mês atual)"
            value={loading ? '...' : formatCurrency(stats?.totalRepComm)}
            color="bg-[#7c8a6e]"
            to="/commissions"
            hidden={valuesHidden}
          />
        )}
      </div>

      {/* Atalhos rápidos */}
      <div>
        <h2 className="text-base font-semibold text-[#4b5757] mb-3">Ações rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/orders/new',     icon: ShoppingCart, label: 'Novo Pedido' },
            { to: '/quotations/new', icon: FileText,     label: 'Novo Orçamento' },
            { to: '/clients',        icon: Users,        label: 'Clientes' },
            { to: '/commissions',    icon: DollarSign,   label: 'Comissões' },
          ].map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-[#e3e3d1] hover:border-[#58706d] hover:shadow-sm transition-all text-center"
            >
              <Icon size={22} className="text-[#58706d]" />
              <span className="text-xs font-medium text-[#4b5757]">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Pedidos recentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[#4b5757]">Pedidos recentes</h2>
          <Link to="/orders" className="text-sm text-[#58706d] hover:underline">
            Ver todos
          </Link>
        </div>

        <Card>
          {loading ? (
            <CardBody>
              <p className="text-sm text-gray-400 text-center py-4">Carregando...</p>
            </CardBody>
          ) : recentOrders.length === 0 ? (
            <CardBody>
              <p className="text-sm text-gray-400 text-center py-4">Nenhum pedido encontrado.</p>
            </CardBody>
          ) : (
            <div className="divide-y divide-[#e3e3d1]">
              {recentOrders.map((order) => {
                const s = statusMap[order.status] ?? { label: order.status, variant: 'default' };
                return (
                  <Link
                    key={order._id}
                    to={`/orders/${order._id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-[#f5f5ee] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-auto min-w-8 h-8 px-2 rounded-lg bg-[#e3e3d1] flex items-center justify-center">
                        <span className="text-xs font-bold text-[#4b5757]">
                          #{order.orderNumber}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#4b5757]">
                          {order.clientSnapshot?.tradeName || order.clientSnapshot?.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {order.supplierSnapshot?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold text-[#4b5757] ${valuesHidden ? 'blur-sm select-none' : ''}`}>
                        {formatCurrency(order.total)}
                      </span>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
