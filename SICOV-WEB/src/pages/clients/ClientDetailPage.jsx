import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Power, Phone, Mail, MapPin } from 'lucide-react';
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
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return v;
}

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    api.get(`/clients/${id}`)
      .then(({ data }) => setClient(data))
      .catch(() => navigate('/clients'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleToggleActive = async () => {
    setActionLoading('toggle');
    try {
      const { data } = await api.patch(`/clients/${id}/toggle-active`);
      setClient(data.client);
    } catch (err) {
      alert(err.response?.data?.message || 'Erro.');
    } finally {
      setActionLoading('');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir o cliente "${client.name}"? Esta ação não pode ser desfeita.`)) return;
    setActionLoading('delete');
    try {
      await api.delete(`/clients/${id}`);
      navigate('/clients');
    } catch (err) {
      alert(err.response?.data?.message || 'Erro ao excluir.');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  if (!client) return null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/clients')} className="text-[#58706d] hover:text-[#4b5757]">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#4b5757]">{client.tradeName || client.name}</h1>
              <Badge variant={client.active ? 'active' : 'inactive'}>
                {client.active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            {client.tradeName && client.name !== client.tradeName && (
              <p className="text-sm text-[#7c8a6e]">{client.name}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/clients/${id}/edit`}>
            <Button variant="outline" size="sm"><Edit size={14} /> Editar</Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleActive}
            loading={actionLoading === 'toggle'}
          >
            <Power size={14} />
            {client.active ? 'Desativar' : 'Reativar'}
          </Button>
          {isAdmin && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              loading={actionLoading === 'delete'}
            >
              <Trash2 size={14} /> Excluir
            </Button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados Cadastrais</h2></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <InfoRow label="CNPJ" value={formatCnpj(client.cnpj)} />
            <InfoRow label="Inscrição Estadual" value={client.stateRegistration} />
            {client.phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone size={14} className="text-[#7c8a6e]" />
                {formatPhone(client.phone)}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-gray-600">
                <Mail size={14} className="text-[#7c8a6e]" />
                {client.email}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Endereço</h2></CardHeader>
          <CardBody className="space-y-2 text-sm text-gray-600">
            {client.address && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-[#7c8a6e] mt-0.5 shrink-0" />
                <div>
                  <p>{client.address}</p>
                  {client.district && <p>{client.district}</p>}
                  <p>
                    {[client.city, client.state].filter(Boolean).join('/')}
                    {client.zipCode ? ` — CEP ${client.zipCode}` : ''}
                  </p>
                </div>
              </div>
            )}
            {!client.address && <p className="text-gray-400">Endereço não informado.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Comercial</h2></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <InfoRow label="Condição de Pagamento" value={client.paymentTerm} />
          <InfoRow label="Transportadora" value={client.carrier} />
          <div className="sm:col-span-2">
            <InfoRow label="Endereço de Cobrança" value={client.billingAddress} />
          </div>
        </CardBody>
      </Card>

      {client.notes && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
          </CardBody>
        </Card>
      )}

      {/* Link para pedidos deste cliente */}
      <div className="flex gap-3">
        <Link to={`/orders?search=${encodeURIComponent(client.tradeName || client.name)}`}>
          <Button variant="secondary" size="sm">Ver pedidos deste cliente</Button>
        </Link>
        <Link to={`/products?clientId=${client._id}`}>
          <Button variant="secondary" size="sm">Ver produtos</Button>
        </Link>
      </div>
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
