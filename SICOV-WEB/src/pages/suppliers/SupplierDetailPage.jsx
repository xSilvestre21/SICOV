import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Power } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

function formatCnpj(v) {
  if (!v) return '—';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return v;
}

function formatPhone(v) {
  if (!v) return '—';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return v;
}

function formatCep(v) {
  if (!v) return '—';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return v;
}

function formatCurrency(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SupplierDetailPage() {
  const { isAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    api.get(`/suppliers/${id}`)
      .then(({ data }) => setSupplier(data))
      .catch(() => navigate('/suppliers'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleToggle = async () => {
    setActionLoading('toggle');
    try { const { data } = await api.patch(`/suppliers/${id}/toggle-active`); setSupplier(data.supplier); }
    catch (err) { alert(err.response?.data?.message || 'Erro.'); }
    finally { setActionLoading(''); }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir este fornecedor permanentemente?')) return;
    setActionLoading('delete');
    try { await api.delete(`/suppliers/${id}`); navigate('/suppliers'); }
    catch (err) { alert(err.response?.data?.message || 'Erro.'); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  if (!supplier) return null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/suppliers')} className="text-[#58706d] hover:text-[#4b5757]"><ArrowLeft size={20} /></button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#4b5757]">{supplier.tradeName || supplier.name}</h1>
              <Badge variant={supplier.active ? 'active' : 'inactive'}>{supplier.active ? 'Ativo' : 'Inativo'}</Badge>
            </div>
            {supplier.tradeName && <p className="text-sm text-[#7c8a6e]">{supplier.name}</p>}
          </div>
        </div>
        {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Link to={`/suppliers/${id}/edit`}><Button variant="outline" size="sm"><Edit size={14} /> Editar</Button></Link>
          <Button variant="outline" size="sm" onClick={handleToggle} loading={actionLoading === 'toggle'}><Power size={14} /> {supplier.active ? 'Desativar' : 'Reativar'}</Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={actionLoading === 'delete'}><Trash2 size={14} /> Excluir</Button>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados Cadastrais</h2></CardHeader>
          <CardBody className="space-y-2 text-sm">
            <InfoRow label="CNPJ" value={formatCnpj(supplier.cnpj)} />
            <InfoRow label="IE" value={supplier.stateRegistration} />
            <InfoRow label="IPI" value={`${supplier.ipi}%`} />
            <InfoRow label="Nº Pedido Atual" value={supplier.currentOrderNumber} />
            <InfoRow label="Email" value={supplier.email} />
            <InfoRow label="Telefone" value={formatPhone(supplier.phone)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Endereço</h2></CardHeader>
          <CardBody className="space-y-2 text-sm">
            <InfoRow label="Endereço" value={supplier.address} />
            <InfoRow label="Cidade/UF" value={[supplier.city, supplier.state].filter(Boolean).join('/')} />
            <InfoRow label="CEP" value={formatCep(supplier.zipCode)} />
            <InfoRow label="Logo" value={supplier.logoUrl} />
          </CardBody>
        </Card>
      </div>

      {supplier.priceTable?.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Tabela de Preços</h2></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f5ee] border-b border-[#e3e3d1]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-[#4b5757]">Material</th>
                  <th className="text-right px-4 py-2 font-medium text-[#4b5757]">Fator Kg</th>
                  <th className="text-right px-4 py-2 font-medium text-[#4b5757]">Limite</th>
                  <th className="text-right px-4 py-2 font-medium text-[#4b5757]">Densidade</th>
                  {supplier.priceTable.some((r) => r.weightFrom != null || r.weightTo != null) && (
                    <th className="text-right px-4 py-2 font-medium text-[#4b5757]">Faixa (kg)</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e3d1]">
                {supplier.priceTable.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-medium text-[#4b5757]">{row.material}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{row.factorKg != null ? formatCurrency(row.factorKg) : '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{row.limitFactorKg != null ? formatCurrency(row.limitFactorKg) : '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{row.density != null ? Number(row.density).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : '—'}</td>
                    {supplier.priceTable.some((r) => r.weightFrom != null || r.weightTo != null) && (
                      <td className="px-4 py-2 text-right text-gray-600">
                        {row.weightFrom != null || row.weightTo != null
                          ? `${row.weightFrom ?? 0} – ${row.weightTo ?? '∞'}`
                          : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {supplier.minimumOrderTable?.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Pedido Mínimo por Faixa de Medida</h2></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f5ee] border-b border-[#e3e3d1]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-[#4b5757]">Faixa de Medida</th>
                  <th className="text-right px-4 py-2 font-medium text-[#4b5757]">Pedido Mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e3d1]">
                {supplier.minimumOrderTable.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-[#4b5757]">
                      {row.measureFrom && row.measureTo
                        ? `${row.measureFrom} a ${row.measureTo} cm`
                        : row.measureFrom
                          ? `Acima de ${row.measureFrom} cm`
                          : row.measureTo
                            ? `Até ${row.measureTo} cm`
                            : '—'
                      }
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-[#4b5757]">{row.minimumKg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isAdmin && supplier.allowedRepresentatives?.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Representantes Autorizados</h2></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {supplier.allowedRepresentatives.map((rep) => (
                <Badge key={rep._id || rep} variant="default">{rep.name || rep}</Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {supplier.extras?.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Extras Disponíveis</h2></CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {supplier.extras.map((extra, i) => {
                const chargeLabel = { per_kg: '/kg', per_thousand: '/mil', per_unit: '/un', per_box: '/cx', per_linear_meter: '/m', fixed: ' fixo' }[extra.chargeType] || '';
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#e3e3d1]/20 border border-[#e3e3d1]/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#4b5757]">{extra.name}</p>
                      <p className="text-xs text-[#7c8a6e]">R$ {Number(extra.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{chargeLabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {supplier.notes && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody>
            <p className="text-sm text-[#4b5757] whitespace-pre-wrap">{supplier.notes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return <div><p className="text-xs text-gray-400">{label}</p><p className="text-[#4b5757] font-medium">{value || '—'}</p></div>;
}
