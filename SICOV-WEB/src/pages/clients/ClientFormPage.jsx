import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

function maskCnpj(value) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function maskPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function maskZipCode(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function ClientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', tradeName: '', email: '', phone: '', cnpj: '',
    stateRegistration: '', address: '', city: '', state: '', district: '',
    zipCode: '', paymentTerm: '', billingAddress: '', carrier: '', notes: '',
    representativeId: '',
  });
  const [representatives, setRepresentatives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAdmin) {
      api.get('/users/representatives', { params: { active: 'true' } })
        .then(({ data }) => setRepresentatives(data))
        .catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/clients/${id}`)
      .then(({ data }) => {
        setForm({
          name: data.name || '',
          tradeName: data.tradeName || '',
          email: data.email || '',
          phone: data.phone || '',
          cnpj: data.cnpj || '',
          stateRegistration: data.stateRegistration || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          district: data.district || '',
          zipCode: data.zipCode || '',
          paymentTerm: data.paymentTerm || '',
          billingAddress: data.billingAddress || '',
          carrier: data.carrier || '',
          notes: data.notes || '',
          representativeId: data.representativeId || '',
        });
      })
      .catch(() => navigate('/clients'))
      .finally(() => setLoadingData(false));
  }, [id, isEdit, navigate]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setMasked = (field, maskFn) => (e) => setForm((f) => ({ ...f, [field]: maskFn(e.target.value) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Nome é obrigatório.');
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/clients/${id}`, form);
      } else {
        await api.post('/clients', form);
      }
      navigate('/clients');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar cliente.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <div className="text-center py-12 text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#58706d] hover:text-[#4b5757]">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h1>
          <p className="text-sm text-[#7c8a6e]">Preencha os dados do cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados Principais</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Razão Social *" value={form.name} onChange={set('name')} required />
            <Input label="Nome Fantasia" value={form.tradeName} onChange={set('tradeName')} />
            <Input label="CNPJ" value={form.cnpj} onChange={setMasked('cnpj', maskCnpj)} placeholder="00.000.000/0000-00" />
            <Input label="Inscrição Estadual" value={form.stateRegistration} onChange={set('stateRegistration')} />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Telefone" value={form.phone} onChange={setMasked('phone', maskPhone)} placeholder="(00) 00000-0000" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Endereço</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Endereço" value={form.address} onChange={set('address')} />
            </div>
            <Input label="Bairro" value={form.district} onChange={set('district')} />
            <Input label="Cidade" value={form.city} onChange={set('city')} />
            <Input label="UF" value={form.state} onChange={set('state')} maxLength={2} className="uppercase" />
            <Input label="CEP" value={form.zipCode} onChange={setMasked('zipCode', maskZipCode)} placeholder="00000-000" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Comercial</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Condição de Pagamento" value={form.paymentTerm} onChange={set('paymentTerm')} placeholder="Ex: Boleto 30 dias" />
            <Input label="Transportadora" value={form.carrier} onChange={set('carrier')} />
            <div className="sm:col-span-2">
              <Input label="Endereço de Cobrança" value={form.billingAddress} onChange={set('billingAddress')} />
            </div>
            {isAdmin && (
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#4b5757] mb-1 block">Representante</label>
                <select
                  value={form.representativeId}
                  onChange={set('representativeId')}
                  className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]"
                >
                  <option value="">Selecione...</option>
                  {representatives.map((r) => (
                    <option key={r._id} value={r._id}>{r.name} ({r.email})</option>
                  ))}
                </select>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              placeholder="Observações internas (opcional)"
              className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] resize-none"
            />
          </CardBody>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            <Save size={16} />
            {isEdit ? 'Salvar Alterações' : 'Criar Cliente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
