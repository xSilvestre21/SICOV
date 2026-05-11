import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, FileText } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function NewQuotationPage() {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/clients', { params: { active: 'true', limit: 200 } })
      .then(({ data }) => setClients(data.clients || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClient) { setProducts([]); setItems([]); return; }
    setLoadingProducts(true);
    api.get('/quotations/client-products', { params: { clientId: selectedClient } })
      .then(({ data }) => { setProducts(data || []); setItems([]); })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedClient]);

  const addItem = () => setItems((prev) => [...prev, { productId: '', quantity: '' }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedClient) return setError('Selecione um cliente.');
    if (items.length === 0) return setError('Adicione pelo menos um item.');
    const invalid = items.some((i) => !i.productId || !i.quantity || Number(i.quantity) <= 0);
    if (invalid) return setError('Preencha produto e quantidade em todos os itens.');

    setLoading(true);
    try {
      const { data } = await api.post('/quotations', {
        clientId: selectedClient,
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        save: true,
      });
      navigate(`/quotations/${data.quotation._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar orçamento.');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#58706d] hover:text-[#4b5757]"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Novo Orçamento</h1>
          <p className="text-sm text-[#7c8a6e]">Selecione cliente e produtos</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Cliente</h2></CardHeader>
          <CardBody>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]">
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.tradeName || c.name}</option>)}
            </select>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Itens</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem} disabled={!selectedClient || products.length === 0}><Plus size={14} /> Adicionar</Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {!selectedClient && <p className="text-sm text-gray-400 text-center py-4">Selecione um cliente primeiro.</p>}
            {selectedClient && loadingProducts && <p className="text-sm text-gray-400 text-center py-4">Carregando produtos...</p>}
            {selectedClient && !loadingProducts && products.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum produto disponível.</p>}

            {items.map((item, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-3 p-3 bg-[#f5f5ee] rounded-lg">
                <select value={item.productId} onChange={(e) => updateItem(i, 'productId', e.target.value)} className="flex-1 rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]">
                  <option value="">Selecione...</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name} {p.description ? `— ${p.description}` : ''}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" step="any" placeholder="Qtd" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="w-24 rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]" />
                  <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={loading}><FileText size={16} /> Criar Orçamento</Button>
        </div>
      </form>
    </div>
  );
}
