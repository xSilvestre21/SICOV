import { useState } from 'react';
import { X, Save, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CommissionDetailModal({ commission, onClose, onUpdated }) {
  const { isAdmin } = useAuth();
  const [form, setForm] = useState({
    representativePercentage: commission.representativePercentage ?? '',
    adminPercentage: commission.adminPercentage ?? 5,
    realReceivedValue: commission.realReceivedValue ?? '',
    realDeliveryDate: commission.realDeliveryDate ? commission.realDeliveryDate.split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = {};
      if (form.representativePercentage !== '' && Number(form.representativePercentage) !== commission.representativePercentage) {
        payload.representativePercentage = Number(form.representativePercentage);
      }
      if (Number(form.adminPercentage) !== commission.adminPercentage) {
        payload.adminPercentage = Number(form.adminPercentage);
      }
      if (form.realReceivedValue !== '' && form.realReceivedValue !== null) {
        const val = Number(String(form.realReceivedValue).replace(',', '.'));
        if (val !== commission.realReceivedValue) payload.realReceivedValue = val;
      } else if (form.realReceivedValue === '' && commission.realReceivedValue !== null) {
        payload.realReceivedValue = null;
      }
      if (form.realDeliveryDate !== (commission.realDeliveryDate ? commission.realDeliveryDate.split('T')[0] : '')) {
        payload.realDeliveryDate = form.realDeliveryDate || null;
      }

      if (Object.keys(payload).length === 0) {
        setSuccess('Nenhuma alteração detectada.');
        setLoading(false);
        return;
      }

      const { data } = await api.put(`/commissions/${commission._id}`, payload);
      setSuccess('Comissão atualizada com sucesso!');
      setTimeout(() => onUpdated(data.commission), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao atualizar.');
    } finally { setLoading(false); }
  };

  // Cálculos em tempo real
  const adminPct = Number(form.adminPercentage) || 0;
  const repPct = Number(form.representativePercentage) || 0;
  const baseOrder = commission.orderValueWithoutIpi || 0;
  const baseReal = form.realReceivedValue !== '' && form.realReceivedValue !== null
    ? Number(String(form.realReceivedValue).replace(',', '.')) || 0
    : 0;

  const poolOrder = baseOrder * adminPct / 100;
  const repCommOrder = poolOrder * repPct / 100;
  const adminCommOrder = poolOrder - repCommOrder;

  const poolReal = baseReal > 0 ? baseReal * adminPct / 100 : 0;
  const repCommReal = poolReal * repPct / 100;
  const adminCommReal = poolReal - repCommReal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e3d1]">
          <div>
            <h2 className="text-lg font-bold text-[#4b5757]">Comissão — Pedido #{commission.orderNumber ?? '—'}</h2>
            <p className="text-xs text-gray-400">
              {commission.customerPurchaseOrder ? `PC: ${commission.customerPurchaseOrder} · ` : ''}
              {commission.period?.month}/{commission.period?.year}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-[#4b5757] rounded-lg hover:bg-[#e3e3d1]"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Valor do pedido (readonly) */}
          <div className="bg-[#f5f5ee] rounded-lg p-3">
            <p className="text-xs text-gray-400">Valor do Pedido (s/ IPI)</p>
            <p className="text-lg font-bold text-[#4b5757]">{formatCurrency(baseOrder)}</p>
          </div>

          {/* Percentuais */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="% Admin (comissão total)"
              type="number"
              step="0.1"
              min="0"
              value={form.adminPercentage}
              onChange={set('adminPercentage')}
            />
            <Input
              label="% Representante"
              type="number"
              step="0.1"
              min="0"
              value={form.representativePercentage}
              onChange={set('representativePercentage')}
            />
          </div>

          {/* Cálculo baseado no pedido */}
          <div className="bg-[#f5f5ee] rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-[#7c8a6e]">Cálculo (base pedido)</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-xs text-gray-400">Comissão Total</p><p className="font-medium text-[#4b5757]">{formatCurrency(poolOrder)}</p></div>
              <div><p className="text-xs text-gray-400">Representante</p><p className="font-medium text-[#4b5757]">{formatCurrency(repCommOrder)}</p></div>
              <div><p className="text-xs text-gray-400">Admin</p><p className="font-medium text-[#4b5757]">{formatCurrency(adminCommOrder)}</p></div>
            </div>
          </div>

          {/* Valor real recebido */}
          <div className="border-t border-[#e3e3d1] pt-4">
            <Input
              label="Valor Real Recebido (R$)"
              type="number"
              step="0.01"
              min="0"
              placeholder="Preencha quando receber o pagamento"
              value={form.realReceivedValue}
              onChange={set('realReceivedValue')}
            />
          </div>

          {/* Cálculo baseado no real (se preenchido) */}
          {baseReal > 0 && (
            <div className="bg-[#f5f5ee] rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-[#7c8a6e]">Cálculo (base real recebido)</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-gray-400">Comissão Total</p><p className="font-medium text-[#4b5757]">{formatCurrency(poolReal)}</p></div>
                <div><p className="text-xs text-gray-400">Representante</p><p className="font-medium text-[#4b5757]">{formatCurrency(repCommReal)}</p></div>
                <div><p className="text-xs text-gray-400">Admin</p><p className="font-medium text-[#4b5757]">{formatCurrency(adminCommReal)}</p></div>
              </div>
              {/* Diferença */}
              <div className="pt-2 border-t border-[#e3e3d1] mt-2">
                <p className="text-xs text-gray-400">Diferença (pedido vs real)</p>
                {isAdmin ? (
                  <p className={`text-sm font-semibold ${adminCommReal - adminCommOrder >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {adminCommReal - adminCommOrder >= 0 ? '+' : ''}{formatCurrency(adminCommReal - adminCommOrder)} admin
                  </p>
                ) : (
                  <p className={`text-sm font-semibold ${repCommReal - repCommOrder >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {repCommReal - repCommOrder >= 0 ? '+' : ''}{formatCurrency(repCommReal - repCommOrder)} representante
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Data real de entrega */}
          <Input
            label="Data Real de Entrega"
            type="date"
            value={form.realDeliveryDate}
            onChange={set('realDeliveryDate')}
          />

          {/* Indicador de atraso/adiantamento */}
          {form.realDeliveryDate && (commission.deliveryDate || commission.dueDate) && (() => {
            const expected = new Date(commission.dueDate || commission.deliveryDate);
            const actual = new Date(form.realDeliveryDate);
            const diffDays = Math.round((actual - expected) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">Entregue na data prevista</span>
                </div>
              );
            } else if (diffDays > 0) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle size={16} className="text-red-500" />
                  <span className="text-sm font-medium text-red-600">{diffDays} dia{diffDays !== 1 ? 's' : ''} de atraso</span>
                </div>
              );
            } else {
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <Clock size={16} className="text-blue-500" />
                  <span className="text-sm font-medium text-blue-600">{Math.abs(diffDays)} dia{Math.abs(diffDays) !== 1 ? 's' : ''} adiantado</span>
                </div>
              );
            }
          })()}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2"><p className="text-sm text-red-600">{error}</p></div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2"><p className="text-sm text-emerald-600">{success}</p></div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
            <Button type="submit" loading={loading}><Save size={16} /> Salvar</Button>
          </div>
        </form>

        {/* Seção de parcelamento — aparece para comissões originais (não para parcelas individuais) */}
        {isAdmin && (!commission.projected || commission.installmentsCreated || !commission.installmentIndex) && (
          <InstallmentsSection commission={commission} onCreated={onUpdated} />
        )}
      </div>
    </div>
  );
}


function InstallmentsSection({ commission, onCreated }) {
  const [showForm, setShowForm] = useState(false);
  const [intervals, setIntervals] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAlreadyInstallmented = commission.installmentsCreated || (commission.projected && !commission.installmentIndex);

  const handleCreate = async () => {
    setError('');
    setSuccess('');

    const parsed = intervals
      .split(/[,\s]+/)
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !isNaN(v) && v > 0);

    if (parsed.length === 0) {
      return setError('Informe os dias (ex: 30, 60, 90)');
    }

    setLoading(true);
    try {
      await api.post(`/commissions/${commission._id}/installments`, {
        intervals: parsed,
        representativePercentage: commission.representativePercentage,
        adminPercentage: commission.adminPercentage,
      });
      setSuccess(`${parsed.length} parcela(s) criada(s) com sucesso!`);
      setTimeout(() => onCreated(commission), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar parcelas.');
    } finally { setLoading(false); }
  };

  const handleDeleteInstallments = async () => {
    if (!confirm('Deletar todas as parcelas deste pedido?')) return;
    setDeleteLoading(true);
    setError('');
    try {
      // Busca e deleta parcelas vinculadas a este pedido
      const { data } = await api.get('/commissions', { params: { orderNumber: commission.orderNumber, status: 'all', limit: 100 } });
      const parcelas = (data.commissions || []).filter((c) => c.projected && c.installmentIndex && c.orderId === commission.orderId);
      for (const p of parcelas) {
        await api.delete(`/commissions/${p._id}`);
      }
      // Desmarca a comissão original como parcelada
      await api.put(`/commissions/${commission._id}`, { projected: false, installmentsCreated: false });
      setSuccess('Parcelas deletadas.');
      setTimeout(() => onCreated(commission), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao deletar parcelas.');
    } finally { setDeleteLoading(false); }
  };

  // Preview das datas
  const previewDates = (() => {
    if (!intervals) return [];
    const deliveryDate = commission.realDeliveryDate || commission.deliveryDate || commission.dueDate;
    if (!deliveryDate) return [];

    const parsed = intervals.split(/[,\s]+/).map((v) => parseInt(v.trim(), 10)).filter((v) => !isNaN(v) && v > 0);
    const base = new Date(deliveryDate);

    return parsed.map((days) => {
      const date = new Date(base);
      date.setUTCDate(date.getUTCDate() + days);
      return {
        days,
        supplierDate: date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
        period: { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() },
      };
    });
  })();

  return (
    <div className="px-6 pb-6 border-t border-[#e3e3d1]">
      <div className="flex items-center justify-between pt-4 mb-3">
        <p className="text-sm font-semibold text-[#4b5757]">Parcelamento</p>
        {!showForm && !isAlreadyInstallmented && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
            Parcelar
          </Button>
        )}
        {isAlreadyInstallmented && !showForm && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
              Editar Parcelas
            </Button>
          </div>
        )}
      </div>

      {/* Indicador de que já foi parcelada */}
      {isAlreadyInstallmented && !showForm && (
        <p className="text-xs text-[#7c8a6e] mb-2">Esta comissão foi parcelada. Clique em "Editar Parcelas" para alterar os dias.</p>
      )}

      {showForm && (
        <div className="space-y-3">
          {isAlreadyInstallmented && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">As parcelas existentes serão deletadas e recriadas com os novos dias.</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[#4b5757] mb-1 block">
              Dias após a entrega (separados por vírgula)
            </label>
            <input
              type="text"
              value={intervals}
              onChange={(e) => setIntervals(e.target.value)}
              placeholder="Ex: 30, 60, 90"
              className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]"
            />
            <p className="text-xs text-gray-400 mt-1">
              Base: {commission.realDeliveryDate ? new Date(commission.realDeliveryDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : commission.deliveryDate ? new Date(commission.deliveryDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'sem data de entrega'}
            </p>
          </div>

          {previewDates.length > 0 && (
            <div className="bg-[#f5f5ee] rounded-lg p-3">
              <p className="text-xs font-medium text-[#7c8a6e] mb-2">Preview das parcelas:</p>
              <div className="space-y-1">
                {previewDates.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-[#4b5757]">Parcela {i + 1} (+{p.days} dias)</span>
                    <span className="text-gray-500">Vencimento: {p.supplierDate} · Mês: {p.period.month}/{p.period.year}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-emerald-600">{success}</p>}

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            {isAlreadyInstallmented && (
              <Button variant="danger" size="sm" loading={deleteLoading} onClick={handleDeleteInstallments}>Deletar Parcelas</Button>
            )}
            <Button size="sm" loading={loading} onClick={async () => {
              if (isAlreadyInstallmented) await handleDeleteInstallments();
              if (!error) await handleCreate();
            }}>
              {isAlreadyInstallmented ? 'Recriar Parcelas' : 'Criar Parcelas'}
            </Button>
          </div>
        </div>
      )}

      {commission.projected && commission.installmentIndex && (
        <p className="text-xs text-[#7c8a6e]">Esta é a parcela {commission.installmentIndex}.</p>
      )}
    </div>
  );
}
