import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  XCircle,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR');
}

function formatCnpj(v) {
  if (!v) return '—';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return v;
}

function formatNumber(v) {
  if (v === null || v === undefined) return null;
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

const typeLabels = {
  plastic_bag: 'Saco Plástico', tape: 'Fita', stretch: 'Stretch',
  shrink: 'Shrink', bobbin: 'Bobina', custom: 'Personalizado',
};

const modeLabels = {
  kg: 'Kg', thousand: 'Milheiro', unit: 'Unidade',
  box: 'Caixa', linear_meter: 'Metro Linear', manual: 'Manual',
};

function ItemDetail({ item, ipiRate, orderSubtotal, orderIpiValue }) {
  const [expanded, setExpanded] = useState(false);
  const p = item.productSnapshot || {};
  const m = p.technicalData?.measurements || {};
  const cd = p.commercialData || {};

  const itemIpi = orderSubtotal > 0 ? (item.subtotal / orderSubtotal) * orderIpiValue : 0;
  const itemTotal = item.subtotal + itemIpi;

  const hasDetails = p.productType || cd.factorKg || cd.density || cd.basePrice || m.width || m.length || m.thickness || (p.selectedExtras?.length > 0);

  return (
    <div className="border-b border-[#e3e3d1] last:border-b-0">
      {/* Linha principal */}
      <div
        className={`flex items-center justify-between px-4 md:px-6 py-3 ${hasDetails ? 'cursor-pointer hover:bg-[#f5f5ee]' : ''} transition-colors`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {hasDetails && (
            <span className="text-gray-400 shrink-0">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#4b5757] truncate">
              {p.description || p.name || '—'}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {p.supplierCode && <span className="text-xs text-gray-400">Forn: {p.supplierCode}</span>}
              {p.clientCode && <span className="text-xs text-gray-400">· Cli: {p.clientCode}</span>}
              {p.productType && <span className="text-xs text-[#7c8a6e]">· {typeLabels[p.productType] || p.productType}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-sm">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">Qtd</p>
            <p className="font-medium text-[#4b5757]">{Number(item.quantity).toLocaleString('pt-BR')} {p.unitLabel || p.saleMode || ''}</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs text-gray-400">Unitário</p>
            <p className="text-gray-600">{formatCurrency(item.unitPrice)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Subtotal</p>
            <p className="font-semibold text-[#4b5757]">{formatCurrency(item.subtotal)}</p>
          </div>
        </div>
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="px-4 md:px-6 pb-4 pt-1 ml-7 bg-[#f9f9f4] border-t border-[#e3e3d1]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            {/* Dados comerciais */}
            {cd.factorKg != null && (
              <div>
                <p className="text-xs text-gray-400">Fator Kg (R$/kg)</p>
                <p className="font-medium text-[#4b5757]">{formatCurrency(cd.factorKg)}</p>
              </div>
            )}
            {cd.basePrice != null && (
              <div>
                <p className="text-xs text-gray-400">Preço Base</p>
                <p className="font-medium text-[#4b5757]">{formatCurrency(cd.basePrice)}</p>
              </div>
            )}
            {cd.unitPrice != null && (
              <div>
                <p className="text-xs text-gray-400">Preço Unitário</p>
                <p className="font-medium text-[#4b5757]">{formatCurrency(cd.unitPrice)}</p>
              </div>
            )}
            {cd.boxPrice != null && (
              <div>
                <p className="text-xs text-gray-400">Preço Caixa</p>
                <p className="font-medium text-[#4b5757]">{formatCurrency(cd.boxPrice)}</p>
              </div>
            )}
            {cd.density != null && (
              <div>
                <p className="text-xs text-gray-400">Densidade</p>
                <p className="font-medium text-[#4b5757]">{formatNumber(cd.density)}</p>
              </div>
            )}

            {/* Medidas */}
            {m.width != null && (
              <div>
                <p className="text-xs text-gray-400">Largura</p>
                <p className="font-medium text-[#4b5757]">{formatNumber(m.width)}</p>
              </div>
            )}
            {m.length != null && (
              <div>
                <p className="text-xs text-gray-400">Comprimento</p>
                <p className="font-medium text-[#4b5757]">{formatNumber(m.length)}</p>
              </div>
            )}
            {m.thickness != null && (
              <div>
                <p className="text-xs text-gray-400">Espessura</p>
                <p className="font-medium text-[#4b5757]">{formatNumber(m.thickness)}</p>
              </div>
            )}
            {m.gusset != null && (
              <div>
                <p className="text-xs text-gray-400">Sanfona</p>
                <p className="font-medium text-[#4b5757]">{formatNumber(m.gusset)}</p>
              </div>
            )}
            {m.weight != null && (
              <div>
                <p className="text-xs text-gray-400">Peso</p>
                <p className="font-medium text-[#4b5757]">{formatNumber(m.weight)}</p>
              </div>
            )}

            {/* Outros */}
            {p.material && (
              <div>
                <p className="text-xs text-gray-400">Material</p>
                <p className="font-medium text-[#4b5757]">{p.material}</p>
              </div>
            )}
            {p.saleMode && (
              <div>
                <p className="text-xs text-gray-400">Modo de Venda</p>
                <p className="font-medium text-[#4b5757]">{modeLabels[p.saleMode] || p.saleMode}</p>
              </div>
            )}
            {p.calculationMode && (
              <div>
                <p className="text-xs text-gray-400">Modo de Cálculo</p>
                <p className="font-medium text-[#4b5757] text-xs">{p.calculationMode.replace(/_/g, ' ')}</p>
              </div>
            )}

            {/* IPI do item */}
            <div>
              <p className="text-xs text-gray-400">IPI do Item</p>
              <p className="font-medium text-[#4b5757]">{formatCurrency(itemIpi)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total c/ IPI</p>
              <p className="font-bold text-[#4b5757]">{formatCurrency(itemTotal)}</p>
            </div>
          </div>

          {/* Extras */}
          {p.selectedExtras?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#e3e3d1]">
              <p className="text-xs text-gray-400 mb-1">Extras aplicados:</p>
              <div className="flex flex-wrap gap-2">
                {p.selectedExtras.map((extra, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#e3e3d1] text-[#4b5757]">
                    {extra.name}: {formatCurrency(extra.value)} ({extra.chargeType?.replace(/_/g, ' ')})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch(() => navigate('/orders'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      if (action === 'cancel') {
        const { data } = await api.patch(`/orders/${id}/cancel`);
        setOrder(data.order);
      } else if (action === 'sent') {
        const { data } = await api.patch(`/orders/${id}/sent-to-supplier`);
        setOrder(data.order);
      } else if (action === 'pdf') {
        const response = await api.get(`/orders/${id}/pdf`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `pedido-${order.orderNumber}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Erro ao executar ação.');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  }

  if (!order) return null;

  const client = order.clientSnapshot || {};
  const supplier = order.supplierSnapshot || {};
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/orders')} className="text-[#58706d] hover:text-[#4b5757]">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#4b5757]">Pedido #{order.orderNumber}</h1>
              <Badge variant={isCancelled ? 'cancelled' : 'active'}>
                {isCancelled ? 'Cancelado' : 'Ativo'}
              </Badge>
              {order.sentToSupplier && <Badge variant="sent">Enviado</Badge>}
            </div>
            <p className="text-sm text-[#7c8a6e]">Criado em {formatDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          {isAdmin && !isCancelled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('sent')}
              loading={actionLoading === 'sent'}
            >
              <Send size={14} />
              {order.sentToSupplier ? 'Desmarcar Envio' : 'Marcar Enviado'}
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('pdf')}
              loading={actionLoading === 'pdf'}
            >
              <Download size={14} />
              PDF
            </Button>
          )}
          {isAdmin && !isCancelled && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm('Tem certeza que deseja cancelar este pedido?')) {
                  handleAction('cancel');
                }
              }}
              loading={actionLoading === 'cancel'}
            >
              <XCircle size={14} />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cliente */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#4b5757]">Cliente</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <p className="font-medium text-[#4b5757]">{client.tradeName || client.name}</p>
            {client.name !== client.tradeName && client.tradeName && (
              <p className="text-gray-500">{client.name}</p>
            )}
            <p className="text-gray-500">CNPJ: {formatCnpj(client.cnpj)}</p>
            {client.address && <p className="text-gray-500">{client.address}</p>}
            {client.city && (
              <p className="text-gray-500">{client.city}{client.state ? `/${client.state}` : ''}</p>
            )}
            {client.email && <p className="text-gray-500">{client.email}</p>}
          </CardBody>
        </Card>

        {/* Fornecedor + dados do pedido */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#4b5757]">Dados do Pedido</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Fornecedor</span>
              <span className="font-medium text-[#4b5757]">{supplier.tradeName || supplier.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">PC do Cliente</span>
              <span className="font-medium text-[#4b5757]">{order.customerPurchaseOrder || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Prazo de Entrega</span>
              <span className="font-medium text-[#4b5757]">{formatDate(order.deliveryDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cond. Pagamento</span>
              <span className="font-medium text-[#4b5757]">{order.paymentTerm || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vendedora</span>
              <span className="font-medium text-[#4b5757]">{order.sellerName || '—'}</span>
            </div>
            {order.sentToSupplier && order.sentToSupplierAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Enviado em</span>
                <span className="font-medium text-[#4b5757]">{formatDate(order.sentToSupplierAt)}</span>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Itens — clicáveis para expandir */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Itens ({order.items?.length || 0})</h2>
            <p className="text-xs text-gray-400">Clique em um item para ver detalhes</p>
          </div>
        </CardHeader>
        <div>
          {(order.items || []).map((item, i) => (
            <ItemDetail
              key={i}
              item={item}
              ipiRate={supplier.ipi || 0}
              orderSubtotal={order.subtotal}
              orderIpiValue={order.ipiValue}
            />
          ))}
        </div>

        {/* Totais */}
        <div className="border-t border-[#e3e3d1] px-4 md:px-6 py-4">
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-gray-500">Subtotal s/ IPI</span>
              <span className="font-medium text-[#4b5757] w-28 text-right">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex gap-8">
              <span className="text-gray-500">IPI ({supplier.ipi || 0}%)</span>
              <span className="font-medium text-[#4b5757] w-28 text-right">{formatCurrency(order.ipiValue)}</span>
            </div>
            <div className="flex gap-8 pt-2 border-t border-[#e3e3d1]">
              <span className="font-semibold text-[#4b5757]">Total Geral</span>
              <span className="font-bold text-lg text-[#4b5757] w-28 text-right">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Observações */}
      {order.notes && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
