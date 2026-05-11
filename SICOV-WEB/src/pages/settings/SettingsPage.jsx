import { useEffect, useState } from 'react';
import { Save, Settings } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';

export function SettingsPage() {
  const [form, setForm] = useState({ defaultObservations: '', defaultSellerName: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setForm({
        defaultObservations: data.defaultObservations || '',
        defaultSellerName: data.defaultSellerName || '',
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api.put('/settings', form);
      setSuccess('Configurações salvas com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#58706d] flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Configurações</h1>
          <p className="text-sm text-[#7c8a6e]">Configurações gerais do sistema</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Vendedora Padrão</h2></CardHeader>
          <CardBody>
            <Input
              label="Nome da vendedora que aparece nos PDFs"
              value={form.defaultSellerName}
              onChange={(e) => setForm((f) => ({ ...f, defaultSellerName: e.target.value }))}
              placeholder="Ex: Valquiria Silvestre"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações Padrão</h2></CardHeader>
          <CardBody>
            <p className="text-xs text-gray-400 mb-2">Texto padrão que aparece nos orçamentos e pedidos.</p>
            <textarea
              value={form.defaultObservations}
              onChange={(e) => setForm((f) => ({ ...f, defaultObservations: e.target.value }))}
              rows={8}
              className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] resize-none font-mono"
            />
          </CardBody>
        </Card>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3"><p className="text-sm text-emerald-600">{success}</p></div>}

        <div className="flex justify-end">
          <Button type="submit" loading={saving}><Save size={16} /> Salvar Configurações</Button>
        </div>
      </form>
    </div>
  );
}
