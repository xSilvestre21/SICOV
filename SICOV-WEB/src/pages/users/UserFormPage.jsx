import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';

export function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({ name: '', email: '', password: '', defaultCommissionPercentage: '' });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/users/representatives/${id}`)
      .then(({ data }) => setForm({ name: data.name || '', email: data.email || '', password: '', defaultCommissionPercentage: data.defaultCommissionPercentage ?? '' }))
      .catch(() => navigate('/users'))
      .finally(() => setLoadingData(false));
  }, [id, isEdit, navigate]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) return setError('Nome e email são obrigatórios.');
    if (!isEdit && !form.password) return setError('Senha é obrigatória para novo representante.');

    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;
      if (form.defaultCommissionPercentage !== '') payload.defaultCommissionPercentage = Number(form.defaultCommissionPercentage);

      if (isEdit) {
        await api.put(`/users/representatives/${id}`, payload);
      } else {
        await api.post('/users/create-representative', payload);
      }
      navigate('/users');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar.');
    } finally { setLoading(false); }
  };

  if (loadingData) return <div className="text-center py-12 text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#58706d] hover:text-[#4b5757]"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold text-[#4b5757]">{isEdit ? 'Editar Representante' : 'Novo Representante'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardBody className="space-y-4">
            <Input label="Nome *" value={form.name} onChange={set('name')} required />
            <Input label="Email *" type="email" value={form.email} onChange={set('email')} required />
            <Input label={isEdit ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'} type="password" value={form.password} onChange={set('password')} placeholder="Mínimo 8 caracteres" />
            <Input label="Comissão Padrão (%)" type="number" min="0" max="100" step="0.1" value={form.defaultCommissionPercentage} onChange={set('defaultCommissionPercentage')} placeholder="Ex: 25" />
          </CardBody>
        </Card>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={loading}><Save size={16} /> {isEdit ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </div>
  );
}
