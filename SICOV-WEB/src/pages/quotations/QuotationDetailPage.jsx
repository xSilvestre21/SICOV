import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ShoppingCart, Edit } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR');
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

  const handleConvert = async () => {
    if (!confirm('Converter este orçamento em pedido?')) return;
    setActionLoading('convert');
    try {
      const { data } = await api.post(`/quotations/${id}/convert-to-order`);
      navigate(`/orders/${data.order._id}`);
    } catch (err) { alert(err.response?.data?.message || 'Erro ao converter.'); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  if (!quotation) return null;

  const client = quotation.clientSnapshot || {};
  const supplier = quotation.supplierSnapshot || {};

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/quotations')} className="text-[#58706d] hover:text-[#4b5757]"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold text-[#4b5757]">Orçamento</h1>
            <p className="text-sm text-[#7c8a6e]">{client.tradeName || client.name} · {formatDate(quotation.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/quotations/${id}/edit`)}>
            <Edit size={14} /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdf} loading={actionLoading === 'pdf'}><Download size={14} /> PDF</Button>
          <Button size="sm" onClick={handleConvert} loading={actionLoading === 'convert'}><ShoppingCart size={14} /> Converter em Pedido</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Cliente</h2></CardHeader>
          <CardBody className="text-sm space-y-1">
            <p className="font-medium text-[#4b5757]">{client.tradeName || client.name}</p>
            {client.cnpj && <p className="text-gray-500">CNPJ: {client.cnpj}</p>}
            {client.city && <p className="text-gray-500">{client.city}/{client.state}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Fornecedor</h2></CardHeader>
          <CardBody className="text-sm space-y-1">
            <p className="font-medium text-[#4b5757]">{supplier.tradeName || supplier.name}</p>
            {supplier.ipi != null && <p className="text-gray-500">IPI: {supplier.ipi}%</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Itens ({quotation.items?.length || 0})</h2></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f5ee] border-b border-[#e3e3d1]">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-[#4b5757]">Produto</th>
                <th className="text-right px-4 py-2 font-medium text-[#4b5757]">Qtd</th>
                <th className="text-right px-4 py-2 font-medium text-[#4b5757]">Unitário</th>
                <th className="text-right px-4 py-2 font-medium text-[#4b5757]">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e3d1]">
              {(quotation.items || []).map((item, i) => {
                const p = item.productSnapshot || {};
                return (
                  <tr key={i}>
                    <td className="px-4 py-2 text-[#4b5757]">{p.description || p.name || '—'}</td>
                    <td className="px-4 py-2 text-right">{Number(item.quantity).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-[#4b5757]">{formatCurrency(item.subtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#e3e3d1] px-4 py-3 flex justify-end">
          <div className="text-right text-sm space-y-1">
            <div className="flex gap-6"><span className="text-gray-500">Subtotal</span><span className="font-medium w-28 text-right">{formatCurrency(quotation.subtotal)}</span></div>
            <div className="flex gap-6"><span className="text-gray-500">IPI</span><span className="font-medium w-28 text-right">{formatCurrency(quotation.ipiValue)}</span></div>
            <div className="flex gap-6 pt-1 border-t border-[#e3e3d1]"><span className="font-semibold">Total</span><span className="font-bold text-lg w-28 text-right">{formatCurrency(quotation.total)}</span></div>
          </div>
        </div>
      </Card>

      {quotation.observations && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody><p className="text-sm text-gray-600 whitespace-pre-wrap">{quotation.observations}</p></CardBody>
        </Card>
      )}
    </div>
  );
}
