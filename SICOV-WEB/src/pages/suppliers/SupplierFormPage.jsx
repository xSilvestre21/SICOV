import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';

export function SupplierFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', tradeName: '', cnpj: '', stateRegistration: '',
    address: '', city: '', state: '', zipCode: '', phone: '', email: '',
    logoUrl: '', currentOrderNumber: '', ipi: '',
    priceTable: [], allowedRepresentatives: [],
  });
  const [representatives, setRepresentatives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/representatives', { params: { active: 'true' } })
      .then(({ data }) => setRepresentatives(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/suppliers/${id}`)
      .then(({ data: s }) => setForm({
        name: s.name || '', tradeName: s.tradeName || '', cnpj: s.cnpj || '',
        stateRegistration: s.stateRegistration || '', address: s.address || '',
        city: s.city || '', state: s.state || '', zipCode: s.zipCode || '',
        phone: s.phone || '', email: s.email || '', logoUrl: s.logoUrl || '',
        currentOrderNumber: s.currentOrderNumber ?? '', ipi: s.ipi ?? '',
        priceTable: s.priceTable || [],
        allowedRepresentatives: (s.allowedRepresentatives || []).map((r) => r._id || r),
      }))
      .catch(() => navigate('/suppliers'))
      .finally(() => setLoadingData(false));
  }, [id, isEdit, navigate]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const addPriceRow = () => setForm((f) => ({ ...f, priceTable: [...f.priceTable, { material: '', price: '', density: '' }] }));
  const removePriceRow = (i) => setForm((f) => ({ ...f, priceTable: f.priceTable.filter((_, idx) => idx !== i) }));
  const updatePriceRow = (i, field, value) => setForm((f) => ({ ...f, priceTable: f.priceTable.map((row, idx) => idx === i ? { ...row, [field]: value } : row) }));

  const toggleRep = (repId) => {
    setForm((f) => {
      const has = f.allowedRepresentatives.includes(repId);
      return { ...f, allowedRepresentatives: has ? f.allowedRepresentatives.filter((r) => r !== repId) : [...f.allowedRepresentatives, repId] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.cnpj.trim()) return setError('Nome e CNPJ são obrigatórios.');

    setLoading(true);
    try {
      const payload = {
        ...form,
        ipi: form.ipi !== '' ? form.ipi : 0,
        currentOrderNumber: form.currentOrderNumber !== '' ? form.currentOrderNumber : undefined,
        priceTable: form.priceTable.filter((r) => r.material && r.price !== ''),
      };

      if (isEdit) {
        await api.put(`/suppliers/${id}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }
      navigate('/suppliers');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar fornecedor.');
    } finally { setLoading(false); }
  };

  if (loadingData) return <div className="text-center py-12 text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#58706d] hover:text-[#4b5757]"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold text-[#4b5757]">{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados Principais</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Razão Social *" value={form.name} onChange={set('name')} required />
            <Input label="Nome Fantasia" value={form.tradeName} onChange={set('tradeName')} />
            <Input label="CNPJ *" value={form.cnpj} onChange={set('cnpj')} />
            <Input label="Inscrição Estadual" value={form.stateRegistration} onChange={set('stateRegistration')} />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Telefone" value={form.phone} onChange={set('phone')} />
            <Input label="IPI (%)" type="number" step="any" min="0" value={form.ipi} onChange={set('ipi')} />
            <Input label="Nº Pedido Atual" type="number" min="0" value={form.currentOrderNumber} onChange={set('currentOrderNumber')} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Endereço</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Input label="Endereço" value={form.address} onChange={set('address')} /></div>
            <Input label="Cidade" value={form.city} onChange={set('city')} />
            <Input label="UF" value={form.state} onChange={set('state')} maxLength={2} className="uppercase" />
            <Input label="CEP" value={form.zipCode} onChange={set('zipCode')} />
            <Input label="URL do Logo" value={form.logoUrl} onChange={set('logoUrl')} placeholder="Ex: src/assets/logos/logo.png" />
          </CardBody>
        </Card>

        {/* Tabela de preços */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Tabela de Preços</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addPriceRow}><Plus size={14} /> Adicionar</Button>
          </CardHeader>
          <CardBody className="space-y-2">
            {form.priceTable.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Nenhum material cadastrado.</p>}
            {form.priceTable.map((row, i) => (
              <div key={i} className="flex gap-2 items-center p-2 bg-[#f5f5ee] rounded-lg">
                <input value={row.material} onChange={(e) => updatePriceRow(i, 'material', e.target.value)} placeholder="Material" className="flex-1 rounded-lg border border-[#b0b087] px-3 py-1.5 text-sm outline-none focus:border-[#58706d] uppercase" />
                <input type="number" step="any" value={row.price} onChange={(e) => updatePriceRow(i, 'price', e.target.value)} placeholder="Preço/Kg" className="w-28 rounded-lg border border-[#b0b087] px-3 py-1.5 text-sm outline-none focus:border-[#58706d]" />
                <input type="number" step="any" value={row.density} onChange={(e) => updatePriceRow(i, 'density', e.target.value)} placeholder="Densidade" className="w-28 rounded-lg border border-[#b0b087] px-3 py-1.5 text-sm outline-none focus:border-[#58706d]" />
                <button type="button" onClick={() => removePriceRow(i)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Representantes autorizados */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Representantes Autorizados</h2></CardHeader>
          <CardBody>
            {representatives.length === 0 ? <p className="text-sm text-gray-400">Nenhum representante cadastrado.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {representatives.map((rep) => (
                  <label key={rep._id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f5f5ee] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowedRepresentatives.includes(rep._id)}
                      onChange={() => toggleRep(rep._id)}
                      className="rounded border-[#b0b087] text-[#58706d] focus:ring-[#58706d]"
                    />
                    <span className="text-sm text-[#4b5757]">{rep.name}</span>
                    <span className="text-xs text-gray-400">({rep.email})</span>
                  </label>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={loading}><Save size={16} /> {isEdit ? 'Salvar' : 'Criar Fornecedor'}</Button>
        </div>
      </form>
    </div>
  );
}
