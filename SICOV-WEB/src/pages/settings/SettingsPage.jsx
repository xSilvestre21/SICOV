import { useEffect, useState } from 'react';
import { Save, Settings, Moon, Sun } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../lib/api';

export function SettingsPage() {
  const [form, setForm] = useState({ defaultObservations: '', defaultSellerName: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const { isDark, toggleTheme } = useTheme();

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

  if (loading) return <div className={`text-center py-12 ${isDark ? 'text-[#9cb3a0]' : 'text-gray-400'}`}>Carregando...</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#58706d] flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>Configurações</h1>
          <p className={`text-sm ${isDark ? 'text-[#9cb3a0]' : 'text-[#7c8a6e]'}`}>Configurações gerais do sistema</p>
        </div>
      </div>

      {/* Dark Mode Toggle */}
      <Card>
        <CardHeader><h2 className={`text-sm font-semibold ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>Aparência</h2></CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon size={20} className="text-[#9cb3a0]" /> : <Sun size={20} className="text-[#7c8a6e]" />}
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>
                  Modo Escuro
                </p>
                <p className={`text-xs ${isDark ? 'text-[#6b8a6e]' : 'text-[#7c8a6e]'}`}>
                  {isDark ? 'Tema escuro ativado' : 'Tema claro ativado'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isDark ? 'bg-[#58706d]' : 'bg-[#b0b087]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDark ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardBody>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><h2 className={`text-sm font-semibold ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>Vendedora Padrão</h2></CardHeader>
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
          <CardHeader><h2 className={`text-sm font-semibold ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>Observações Padrão</h2></CardHeader>
          <CardBody>
            <p className={`text-xs mb-2 ${isDark ? 'text-[#6b8a6e]' : 'text-gray-400'}`}>Texto padrão que aparece nos orçamentos e pedidos.</p>
            <textarea
              value={form.defaultObservations}
              onChange={(e) => setForm((f) => ({ ...f, defaultObservations: e.target.value }))}
              rows={8}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none font-mono transition-colors ${
                isDark
                  ? 'bg-[#1e2322] border-[#3d4543] text-[#d4e4d1] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]'
                  : 'border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]'
              }`}
            />
          </CardBody>
        </Card>

        {error && <div className={`rounded-lg px-4 py-3 border ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}><p className="text-sm text-red-600">{error}</p></div>}
        {success && <div className={`rounded-lg px-4 py-3 border ${isDark ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}><p className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{success}</p></div>}

        <div className="flex justify-end">
          <Button type="submit" loading={saving}><Save size={16} /> Salvar Configurações</Button>
        </div>
      </form>
    </div>
  );
}
