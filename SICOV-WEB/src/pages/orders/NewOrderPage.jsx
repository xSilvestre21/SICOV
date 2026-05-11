import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function NewOrderPage() {
  const navigate = useNavigate();

  // State
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [customerPurchaseOrder, setCustomerPurchaseOrder] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Carrega clientes ao montar
  useEffect(() => {
    api.get('/clients', { params: { active: 'true', limit: 200 } })
      .then(({ data }) => setClients(data.clients || []))
      .catch(() => {});
  }, []);

  // Carrega produtos quando cliente muda
  useEffect(() => {
    if (!selectedClient) {
      setProducts([]);
      setItems([]);
      return;
    }
    setLoadingProducts(true);

    // Busca produtos e dados do cliente em paralelo
    Promise.all([
      api.get('/products', { params: { clientId: selectedClient, active: 'true', limit: 200 } }),
      api.get(`/clients/${selectedClient}`),
    ])
      .then(([productsRes, clientRes]) => {
        setProducts(productsRes.data.products || []);
        setItems([]);
        // Preenche observações com as notas do cliente (se houver e campo estiver vazio)
        const clientNotes = clientRes.data?.notes;
        if (clientNotes) {
          setNotes((prev) => prev ? prev : clientNotes);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [selectedClient]);

  // Adiciona item
  const addItem = () => {
    setItems((prev) => [...prev, { productId: '', quantity: '' }]);
  };

  // Remove item
  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Atualiza item
  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  // Calcula subtotal estimado
  const getItemSubtotal = (item) => {
    const product = products.find((p) => p._id === item.productId);
    if (!product || !item.quantity) return 0;
    const qty = Number(item.quantity);
    const cm = product.calculationMode;
    const cd = product.commercialData || {};

    if (cm === 'weight_times_price_per_kg') return qty * (cd.basePrice || 0);
    if (cm === 'quantity_times_unit_price') return qty * (cd.unitPrice || 0);
    if (cm === 'boxes_times_box_price') return qty * (cd.boxPrice || 0);
    if (cm === 'boxes_times_units_per_box_times_unit_price') {
      return qty * (product.technicalData?.unitsPerBox || 0) * (cd.unitPrice || 0);
    }
    if (cm === 'dimensions_density_factor') {
      // Estimativa simplificada: qty * factorKg
      return qty * (cd.factorKg || cd.basePrice || 0);
    }
    return 0;
  };

  const estimatedTotal = items.reduce((sum, item) => sum + getItemSubtotal(item), 0);

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedClient) return setError('Selecione um cliente.');
    if (items.length === 0) return setError('Adicione pelo menos um item.');

    const invalidItems = items.some((i) => !i.productId || !i.quantity || Number(i.quantity) <= 0);
    if (invalidItems) return setError('Preencha produto e quantidade em todos os itens.');

    setLoading(true);
    try {
      const payload = {
        clientId: selectedClient,
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        notes: notes || undefined,
        deliveryDate: deliveryDate || undefined,
        customerPurchaseOrder: customerPurchaseOrder || undefined,
      };

      const { data } = await api.post('/orders', payload);
      navigate(`/orders/${data.order._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#58706d] hover:text-[#4b5757]">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Novo Pedido</h1>
          <p className="text-sm text-[#7c8a6e]">Preencha os dados do pedido</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#4b5757]">Cliente</h2>
          </CardHeader>
          <CardBody>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.tradeName || c.name} {c.cnpj ? `(${c.cnpj})` : ''}
                </option>
              ))}
            </select>
          </CardBody>
        </Card>

        {/* Dados adicionais */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#4b5757]">Informações do Pedido</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Pedido do Cliente (PC)"
              placeholder="Ex: PC-2026-001"
              value={customerPurchaseOrder}
              onChange={(e) => setCustomerPurchaseOrder(e.target.value)}
            />
            <Input
              label="Prazo de Entrega"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </CardBody>
        </Card>

        {/* Itens */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Itens do Pedido</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addItem}
              disabled={!selectedClient || products.length === 0}
            >
              <Plus size={14} />
              Adicionar Item
            </Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {!selectedClient && (
              <p className="text-sm text-gray-400 text-center py-4">Selecione um cliente primeiro.</p>
            )}
            {selectedClient && loadingProducts && (
              <p className="text-sm text-gray-400 text-center py-4">Carregando produtos...</p>
            )}
            {selectedClient && !loadingProducts && products.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum produto ativo para este cliente.</p>
            )}

            {items.map((item, index) => {
              const product = products.find((p) => p._id === item.productId);
              const subtotal = getItemSubtotal(item);

              return (
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
                          {p.name} {p.description ? `— ${p.description}` : ''} ({p.saleMode})
                        </option>
                      ))}
                    </select>
                    {product && (
                      <p className="text-xs text-gray-400 mt-1">
                        {product.supplierCode ? `Cód. Forn: ${product.supplierCode}` : ''}
                        {product.clientCode ? ` · Cód. Cli: ${product.clientCode}` : ''}
                        {product.unitLabel ? ` · Un: ${product.unitLabel}` : ''}
                      </p>
                    )}
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
                    {subtotal > 0 && (
                      <span className="text-sm font-medium text-[#4b5757] min-w-[80px] text-right">
                        {formatCurrency(subtotal)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {items.length > 0 && (
              <div className="flex justify-end pt-2 border-t border-[#e3e3d1]">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Subtotal estimado</p>
                  <p className="text-lg font-bold text-[#4b5757]">{formatCurrency(estimatedTotal)}</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2>
          </CardHeader>
          <CardBody>
            {notes && selectedClient && (
              <p className="text-xs text-[#7c8a6e] mb-2">
                Pré-preenchido com as observações do cliente. Edite se necessário.
              </p>
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações do pedido (opcional)"
              rows={3}
              className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] resize-none"
            />
          </CardBody>
        </Card>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            <ShoppingCart size={16} />
            Criar Pedido
          </Button>
        </div>
      </form>
    </div>
  );
}
