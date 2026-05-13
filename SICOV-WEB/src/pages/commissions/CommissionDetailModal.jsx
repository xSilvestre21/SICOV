import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CommissionDetailModal({ commission, onClose, onUpdated }) {
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
              label="% Admin (pool)"
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
              <div><p className="text-xs text-gray-400">Pool</p><p className="font-medium text-[#4b5757]">{formatCurrency(poolOrder)}</p></div>
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
                <div><p className="text-xs text-gray-400">Pool</p><p className="font-medium text-[#4b5757]">{formatCurrency(poolReal)}</p></div>
                <div><p className="text-xs text-gray-400">Representante</p><p className="font-medium text-[#4b5757]">{formatCurrency(repCommReal)}</p></div>
                <div><p className="text-xs text-gray-400">Admin</p><p className="font-medium text-[#4b5757]">{formatCurrency(adminCommReal)}</p></div>
              </div>
              {/* Diferença */}
              <div className="pt-2 border-t border-[#e3e3d1] mt-2">
                <p className="text-xs text-gray-400">Diferença (pedido vs real)</p>
                <p className={`text-sm font-semibold ${repCommReal - repCommOrder >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {repCommReal - repCommOrder >= 0 ? '+' : ''}{formatCurrency(repCommReal - repCommOrder)} representante
                </p>
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

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2"><p className="text-sm text-red-600">{error}</p></div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2"><p className="text-sm text-emerald-600">{success}</p></div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
            <Button type="submit" loading={loading}><Save size={16} /> Salvar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
