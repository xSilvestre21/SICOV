import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Power, Package } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

const typeLabels = {
  plastic_bag: 'Saco Plástico', tape: 'Fita', stretch: 'Stretch',
  shrink: 'Shrink', bobbin: 'Bobina', custom: 'Personalizado',
};

const modeLabels = {
  kg: 'Kg', thousand: 'Milheiro', unit: 'Unidade',
  box: 'Caixa', linear_meter: 'Metro Linear', manual: 'Manual',
};

function formatCurrency(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    api.get(`/products/${id}`)
      .then(({ data }) => setProduct(data))
      .catch(() => navigate('/products'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleToggle = async () => {
    setActionLoading('toggle');
    try {
      const { data } = await api.patch(`/products/${id}/toggle-active`);
      setProduct(data.product);
    } catch (err) { alert(err.response?.data?.message || 'Erro.'); }
    finally { setActionLoading(''); }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir este produto permanentemente?')) return;
    setActionLoading('delete');
    try {
      await api.delete(`/products/${id}`);
      navigate('/products');
    } catch (err) { alert(err.response?.data?.message || 'Erro.'); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  if (!product) return null;

  const m = product.technicalData?.measurements || {};
  const cd = product.commercialData || {};

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/products')} className="text-[#58706d] hover:text-[#4b5757]">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#4b5757]">{product.name}</h1>
              <Badge variant={product.active ? 'active' : 'inactive'}>
                {product.active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <p className="text-sm text-[#7c8a6e]">{typeLabels[product.productType] || product.productType}</p>
          </div>
        </div>
        {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Link to={`/products/${id}/edit`}>
            <Button variant="outline" size="sm"><Edit size={14} /> Editar</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleToggle} loading={actionLoading === 'toggle'}>
            <Power size={14} /> {product.active ? 'Desativar' : 'Reativar'}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={actionLoading === 'delete'}>
            <Trash2 size={14} /> Excluir
          </Button>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Informações Gerais</h2></CardHeader>
          <CardBody className="space-y-2 text-sm">
            <InfoRow label="Descrição" value={product.description} />
            <InfoRow label="Material" value={product.material} />
            <InfoRow label="Modo de Venda" value={modeLabels[product.saleMode] || product.saleMode} />
            <InfoRow label="Unidade" value={product.unitLabel} />
            <InfoRow label="Cód. Fornecedor" value={product.supplierCode} />
            <InfoRow label="Cód. Cliente" value={product.clientCode} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Vínculos</h2></CardHeader>
          <CardBody className="space-y-2 text-sm">
            <InfoRow label="Cliente" value={product.clientId?.tradeName || product.clientId?.name} />
            <InfoRow label="Fornecedor" value={product.supplierId?.tradeName || product.supplierId?.name} />
          </CardBody>
        </Card>
      </div>

      {(m.width || m.length || m.thickness || m.weight || m.height || m.diameter) && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados Técnicos</h2></CardHeader>
          <CardBody className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {m.width != null && <InfoRow label="Largura" value={m.width} />}
            {m.length != null && <InfoRow label="Comprimento" value={m.length} />}
            {m.thickness != null && <InfoRow label="Espessura" value={m.thickness} />}
            {m.gusset != null && <InfoRow label="Sanfona" value={m.gusset} />}
            {m.height != null && <InfoRow label="Altura" value={m.height} />}
            {m.diameter != null && <InfoRow label="Diâmetro" value={m.diameter} />}
            {m.weight != null && <InfoRow label="Peso" value={m.weight} />}
            {product.technicalData?.unitsPerBox != null && <InfoRow label="Un/Caixa" value={product.technicalData.unitsPerBox} />}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados Comerciais</h2></CardHeader>
        <CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {cd.basePrice != null && <InfoRow label="Preço Base (R$/kg)" value={formatCurrency(cd.basePrice)} />}
          {cd.unitPrice != null && <InfoRow label="Preço Unitário" value={formatCurrency(cd.unitPrice)} />}
          {cd.boxPrice != null && <InfoRow label="Preço Caixa" value={formatCurrency(cd.boxPrice)} />}
          {cd.density != null && <InfoRow label="Densidade" value={cd.density} />}
          {cd.factorKg != null && <InfoRow label="Fator Kg" value={formatCurrency(cd.factorKg)} />}
        </CardBody>
      </Card>

      {product.selectedExtras?.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Extras</h2></CardHeader>
          <CardBody>
            <div className="divide-y divide-[#e3e3d1]">
              {product.selectedExtras.map((extra, i) => (
                <div key={i} className="flex justify-between py-2 text-sm">
                  <span className="text-[#4b5757]">{extra.name}</span>
                  <span className="text-gray-500">{formatCurrency(extra.value)} ({extra.chargeType})</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {product.notes && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody><p className="text-sm text-gray-600 whitespace-pre-wrap">{product.notes}</p></CardBody>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-[#4b5757] font-medium">{value || '—'}</p>
    </div>
  );
}
