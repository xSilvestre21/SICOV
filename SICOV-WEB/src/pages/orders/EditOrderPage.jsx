import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function EditOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [customerPurchaseOrder, setCustomerPurchaseOrder] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  // Carrega o pedido e os produtos do cliente
  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(async ({ data: o }) => {
        setOrder(o);
        setNotes(o.notes || '');
        setDeliveryDate(o.deliveryDate ? o.deliveryDate.split('T')[0] : '');
        setCustomerPurchaseOrder(o.customerPurchaseOrder || '');
        setSellerName(o.sellerName || '');
        setItems(o.items.map((i) => ({ productId: i.productId, quantity: String(i.quantity) })));

        // Carrega produtos do cliente
        const { data: prodData } = await api.get('/products', {
          params: { clientId: o.clientId, active: 'true', limit: 200 },
        });
        setProducts(prodData.products || []);
      })
      .catch(() => navigate('/orders'))
      .finally(() => setLoadingData(false));
  }, [id, navigate]);

  const addItem = () => setItems((prev) => [...prev, { productId: '', quantity: '' }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) return setError('Adicione pelo menos um item.');
    const invalid = items.some((i) => !i.productId || !i.quantity || Number(i.quantity) <= 0);
    if (invalid) return setError('Preencha produto e quantidade em todos os itens.');

    setLoading(true);
    try {
      await api.put(`/orders/${id}`, {
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        notes: notes || undefined,
        deliveryDate: deliveryDate || undefined,
        customerPurchaseOrder: customerPurchaseOrder || undefined,
        sellerName: sellerName || undefined,
      });
      navigate(`/orders/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao atualizar pedido.');
    } finally { setLoading(false); }
  };

  if (loadingData) return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  if (!order) return null;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#58706d] hover:text-[#4b5757]">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Editar Pedido #{order.orderNumber}</h1>
          <p className="text-sm text-[#7c8a6e]">
            Cliente: {order.clientSnapshot?.tradeName || order.clientSnapshot?.name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Dados do pedido */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Informações do Pedido</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Pedido do Cliente (PC)"
              value={customerPurchaseOrder}
              onChange={(e) => setCustomerPurchaseOrder(e.target.value)}
            />
            <Input
              label="Prazo de Entrega"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
            <Input
              label="Vendedora"
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
            />
          </CardBody>
        </Card>

        {/* Itens */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Itens do Pedido</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <Plus size={14} /> Adicionar Item
            </Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-3 p-3 bg-[#f5f5ee] rounded-lg">
                <div className="flex-1">
                  <select
                    value={item.productId}
                    onChange={(e) => updateItem(index, 'productId', e.target.value)}
                    className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]"
                  >
                    <option value="">Selecione um produto...</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} {p.description ? `— ${p.description}` : ''} ({p.unitLabel || p.saleMode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Qtd"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    className="w-24 rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observações do pedido (opcional)"
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
          <Button type="submit" loading={loading}><Save size={16} /> Salvar Alterações</Button>
        </div>
      </form>
    </div>
  );
}
