import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ShoppingCart, Edit, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { formatSaleMode } from '../../utils/formatSaleMode';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
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

const calcModeLabels = {
  dimensions_density_factor: 'Dimensões × Densidade × Fator',
  weight_times_price_per_kg: 'Peso × Preço/Kg',
  quantity_times_unit_price: 'Quantidade × Preço Unitário',
  boxes_times_box_price: 'Caixas × Preço/Caixa',
  boxes_times_units_per_box_times_unit_price: 'Caixas × Un/Caixa × Preço Un.',
  pallet: 'Palete (Qtd × Peso × Preço/kg)',
  manual_price: 'Preço Manual',
};

function ItemDetail({ item, ipiRate, orderSubtotal, orderIpiValue }) {
  const [expanded, setExpanded] = useState(false);
  const p = item.productSnapshot || {};
  const m = p.technicalData?.measurements || {};
  const cd = p.commercialData || {};

  const itemIpi = (item.hasIpi !== false && orderSubtotal > 0)
    ? (item.subtotal / orderSubtotal) * orderIpiValue
    : 0;
  const itemTotal = item.subtotal + itemIpi;

  const hasDetails = p.productType || cd.factorKg || cd.density || cd.basePrice || m.width || m.length || m.thickness || (p.selectedExtras?.length > 0);

  return (
    <div className="border-b border-[#e3e3d1] last:border-b-0">
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
              {p.name ? (p.description ? `${p.name} - ${p.description}` : p.name) : (p.description || '—')}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {p.supplierCode && <span className="text-xs text-gray-400">Forn: {p.supplierCode}</span>}
              {p.clientCode && <span className="text-xs text-gray-400">· Cli: {p.clientCode}</span>}
              {p.productType && <span className="text-xs text-[#7c8a6e]">· {typeLabels[p.productType] || p.productType}</span>}
              {item.hasIpi === false && <Badge variant="default">Sem IPI</Badge>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-sm">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">Qtd</p>
            <p className="font-medium text-[#4b5757]">{Number(item.quantity).toLocaleString('pt-BR')} {formatSaleMode(p.unitLabel || p.saleMode)}</p>
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

      {expanded && (
        <div className="px-4 md:px-6 pb-4 pt-1 pl-11 bg-[#f9f9f4] border-t border-[#e3e3d1]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            {cd.factorKg != null && <div><p className="text-xs text-gray-400">Fator Kg (R$/kg)</p><p className="font-medium text-[#4b5757]">{formatCurrency(cd.factorKg)}</p></div>}
            {cd.basePrice != null && <div><p className="text-xs text-gray-400">Preço Base</p><p className="font-medium text-[#4b5757]">{formatCurrency(cd.basePrice)}</p></div>}
            {cd.unitPrice != null && <div><p className="text-xs text-gray-400">Preço Unitário</p><p className="font-medium text-[#4b5757]">{formatCurrency(cd.unitPrice)}</p></div>}
            {cd.boxPrice != null && <div><p className="text-xs text-gray-400">Preço Caixa</p><p className="font-medium text-[#4b5757]">{formatCurrency(cd.boxPrice)}</p></div>}
            {cd.density != null && <div><p className="text-xs text-gray-400">Densidade</p><p className="font-medium text-[#4b5757]">{formatNumber(cd.density)}</p></div>}
            {m.width != null && <div><p className="text-xs text-gray-400">Largura</p><p className="font-medium text-[#4b5757]">{formatNumber(m.width)}</p></div>}
            {m.length != null && <div><p className="text-xs text-gray-400">Comprimento</p><p className="font-medium text-[#4b5757]">{formatNumber(m.length)}</p></div>}
            {m.thickness != null && <div><p className="text-xs text-gray-400">Espessura</p><p className="font-medium text-[#4b5757]">{formatNumber(m.thickness)}</p></div>}
            {m.gusset != null && <div><p className="text-xs text-gray-400">Sanfona</p><p className="font-medium text-[#4b5757]">{formatNumber(m.gusset)}</p></div>}
            {m.weight != null && <div><p className="text-xs text-gray-400">Peso</p><p className="font-medium text-[#4b5757]">{formatNumber(m.weight)}</p></div>}
            {p.material && <div><p className="text-xs text-gray-400">Material</p><p className="font-medium text-[#4b5757]">{p.material}</p></div>}
            {p.saleMode && <div><p className="text-xs text-gray-400">Modo de Venda</p><p className="font-medium text-[#4b5757]">{modeLabels[p.saleMode] || p.saleMode}</p></div>}
            {p.calculationMode && <div><p className="text-xs text-gray-400">Modo de Cálculo</p><p className="font-medium text-[#4b5757] text-xs">{calcModeLabels[p.calculationMode] || p.calculationMode}</p></div>}
            <div><p className="text-xs text-gray-400">IPI do Item</p><p className="font-medium text-[#4b5757]">{formatCurrency(itemIpi)}</p></div>
            <div><p className="text-xs text-gray-400">Total c/ IPI</p><p className="font-bold text-[#4b5757]">{formatCurrency(itemTotal)}</p></div>
          </div>

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

export function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    api.get(`/quotations/${id}`)
      .then(({ data }) => setQuotation(data))
      .catch(() => navigate('/quotations'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handlePdf = async () => {
    setActionLoading('pdf');
    try {
      const response = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `orcamento-${id}.pdf`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert(err.response?.data?.message || 'Erro ao gerar PDF.'); }
    finally { setActionLoading(''); }
  };

  const handleConvert = () => {
    navigate(`/orders/new?fromQuotation=${id}`);
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  if (!quotation) return null;

  const client = quotation.clientSnapshot || {};
  const supplier = quotation.supplierSnapshot || {};

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/quotations')} className="text-[#58706d] hover:text-[#4b5757]"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold text-[#4b5757]">Orçamento</h1>
            <p className="text-sm text-[#7c8a6e]">{client.tradeName || client.name} · {formatDate(quotation.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/quotations/${id}/edit`)}>
            <Edit size={14} /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdf} loading={actionLoading === 'pdf'}><Download size={14} /> PDF</Button>
          <Button size="sm" onClick={handleConvert} disabled={!quotation.clientId || quotation.items?.some((i) => !i.productId)}>
            <ShoppingCart size={14} /> Converter em Pedido
          </Button>
          {isAdmin && (
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!confirm('Tem certeza que deseja APAGAR permanentemente este orçamento?')) return;
                try {
                  await api.delete(`/quotations/${id}`);
                  navigate('/quotations');
                } catch (err) { alert(err.response?.data?.message || 'Erro ao apagar.'); }
              }}
            >
              <Trash2 size={14} /> Apagar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Cliente</h2></CardHeader>
          <CardBody className="text-sm space-y-1">
            <p className="font-medium text-[#4b5757]">{client.tradeName || client.name}</p>
            {quotation.attn && <p className="text-[#7c8a6e]">A/C: {quotation.attn}</p>}
            {client.cnpj && <p className="text-gray-500">CNPJ: {client.cnpj}</p>}
            {client.city && <p className="text-gray-500">{client.city}/{client.state}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Fornecedor</h2></CardHeader>
          <CardBody className="text-sm space-y-1">
            <p className="font-medium text-[#4b5757]">{supplier.tradeName || supplier.name}</p>
            {supplier.ipi != null && <p className="text-gray-500">IPI: {supplier.ipi}%</p>}
            {quotation.sellerName && <p className="text-[#7c8a6e]">Vendedor(a): {quotation.sellerName}</p>}
          </CardBody>
        </Card>
      </div>

      {/* Itens expandíveis */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Itens ({quotation.items?.length || 0})</h2>
            <p className="text-xs text-gray-400">Clique em um item para ver detalhes</p>
          </div>
        </CardHeader>
        <div>
          {(quotation.items || []).map((item, i) => (
            <ItemDetail
              key={i}
              item={item}
              ipiRate={supplier.ipi || 0}
              orderSubtotal={quotation.subtotal}
              orderIpiValue={quotation.ipiValue}
            />
          ))}
        </div>

        {/* Totais */}
        <div className="border-t border-[#e3e3d1] px-4 md:px-6 py-4">
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-gray-500">Subtotal s/ IPI</span>
              <span className="font-medium text-[#4b5757] w-28 text-right">{formatCurrency(quotation.subtotal)}</span>
            </div>
            <div className="flex gap-8">
              <span className="text-gray-500">IPI ({supplier.ipi || 0}%)</span>
              <span className="font-medium text-[#4b5757] w-28 text-right">{formatCurrency(quotation.ipiValue)}</span>
            </div>
            <div className="flex gap-8 pt-2 border-t border-[#e3e3d1]">
              <span className="font-semibold text-[#4b5757]">Total Geral</span>
              <span className="font-bold text-lg text-[#4b5757] w-28 text-right">{formatCurrency(quotation.total)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Observações */}
      {quotation.observations && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody><p className="text-sm text-gray-600 whitespace-pre-wrap">{quotation.observations}</p></CardBody>
        </Card>
      )}

      {/* Histórico de edições */}
      {quotation.editHistory?.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Histórico de Edições</h2></CardHeader>
          <CardBody>
            <div className="space-y-2">
              {quotation.editHistory.map((edit, i) => (
                <div key={i} className="text-xs text-gray-500">
                  {new Date(edit.editedAt).toLocaleString('pt-BR')} — {edit.changes || 'Atualizado'}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
