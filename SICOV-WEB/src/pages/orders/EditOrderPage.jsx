import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProductSearch } from '../../components/ui/ProductSearch';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calculateUnitPrice(product, quantity = 1) {
  const cd = product.commercialData || {};
  const td = product.technicalData || {};
  const m = td.measurements || {};
  const selectedExtras = product.selectedExtras || [];
  let unitPrice = 0;

  if (product.calculationMode === 'dimensions_density_factor') {
    if (!cd.factorKg) return 0;
    if (product.saleMode === 'kg') unitPrice = cd.factorKg;
    else if (product.saleMode === 'thousand') {
      if (!m.width || !m.length || !m.thickness || !cd.density) return 0;
      unitPrice = m.width * m.length * m.thickness * cd.density * cd.factorKg;
    } else unitPrice = cd.factorKg;
  } else if (product.calculationMode === 'quantity_times_unit_price') unitPrice = cd.unitPrice || 0;
  else if (product.calculationMode === 'boxes_times_box_price') unitPrice = cd.boxPrice || 0;
  else if (product.calculationMode === 'boxes_times_units_per_box_times_unit_price') {
    if (!td.unitsPerBox || !cd.unitPrice) return 0;
    unitPrice = td.unitsPerBox * cd.unitPrice;
  } else if (product.calculationMode === 'weight_times_price_per_kg') unitPrice = cd.basePrice || 0;
  else if (product.calculationMode === 'manual_price') unitPrice = cd.basePrice || cd.unitPrice || cd.boxPrice || 0;

  for (const extra of selectedExtras) {
    if (!extra.value || extra.value <= 0) continue;
    if (extra.chargeType === 'per_kg') {
      if (product.saleMode === 'kg') unitPrice += extra.value;
      else if (product.saleMode === 'thousand') {
        const kgPer = (m.width || 0) * (m.length || 0) * (m.thickness || 0) * (cd.density || 0);
        unitPrice += extra.value * kgPer;
      }
    } else if (extra.chargeType === 'per_thousand') {
      if (product.saleMode === 'thousand') unitPrice += extra.value;
      else if (product.saleMode === 'kg') {
        const kgPer = (m.width || 0) * (m.length || 0) * (m.thickness || 0) * (cd.density || 0);
        if (kgPer > 0) unitPrice += extra.value / kgPer;
      }
    } else if (extra.chargeType === 'per_unit' || extra.chargeType === 'per_box' || extra.chargeType === 'per_linear_meter') {
      unitPrice += extra.value;
    } else if (extra.chargeType === 'fixed') {
      if (quantity > 0) unitPrice += extra.value / quantity;
    }
  }
  return unitPrice;
}

export function EditOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [supplierIpi, setSupplierIpi] = useState(0);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [customerPurchaseOrder, setCustomerPurchaseOrder] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(async ({ data: o }) => {
        setOrder(o);
        setNotes(o.notes || '');
        setDeliveryDate(o.deliveryDate ? o.deliveryDate.split('T')[0] : '');
        setCustomerPurchaseOrder(o.customerPurchaseOrder || '');
        setSellerName(o.sellerName || '');
        setItems(o.items.map((i) => ({
          productId: i.productId,
          quantity: String(i.quantity),
          hasIpi: i.hasIpi !== false,
        })));

        // Carrega produtos do cliente
        const { data: prodData } = await api.get('/products', {
          params: { clientId: o.clientId, active: 'true', limit: 200 },
        });
        setProducts(prodData.products || []);

        // Carrega IPI do fornecedor
        if (o.supplierId) {
          const supId = typeof o.supplierId === 'object' ? o.supplierId._id : o.supplierId;
          api.get(`/suppliers/${supId}`).then(({ data }) => setSupplierIpi(data.ipi ?? 0)).catch(() => {});
        }
      })
      .catch(() => navigate('/orders'))
      .finally(() => setLoadingData(false));
  }, [id, navigate]);

  const addItem = () => setItems((prev) => [...prev, { productId: '', quantity: '', hasIpi: true }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const getItemUnitPrice = (item) => {
    const product = products.find((p) => p._id === item.productId);
    if (!product) return 0;
    return calculateUnitPrice(product, Number(item.quantity) || 1);
  };

  const getItemSubtotal = (item) => {
    const qty = Number(item.quantity) || 0;
    return getItemUnitPrice(item) * qty;
  };

  const estimatedTotal = items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
  const subtotalWithIpi = items.filter((i) => i.hasIpi !== false).reduce((sum, item) => sum + getItemSubtotal(item), 0);
  const ipiValue = subtotalWithIpi * (supplierIpi / 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) return setError('Adicione pelo menos um item.');
    const invalid = items.some((i) => !i.productId || !i.quantity || Number(i.quantity) <= 0);
    if (invalid) return setError('Preencha produto e quantidade em todos os itens.');

    setLoading(true);
    try {
      await api.put(`/orders/${id}`, {
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), hasIpi: i.hasIpi !== false })),
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
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Informações do Pedido</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Pedido do Cliente (PC)" value={customerPurchaseOrder} onChange={(e) => setCustomerPurchaseOrder(e.target.value)} />
            <Input label="Prazo de Entrega" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            <Input label="Vendedora" value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Itens do Pedido</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}><Plus size={14} /> Adicionar Item</Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {items.map((item, index) => {
              const product = products.find((p) => p._id === item.productId);
              const unitPrice = getItemUnitPrice(item);
              const subtotal = getItemSubtotal(item);

              return (
                <div key={index} className="flex flex-col sm:flex-row gap-3 p-3 bg-[#f5f5ee] rounded-lg">
                  <div className="flex-1">
                    <ProductSearch
                      products={products}
                      selectedProductId={item.productId}
                      onSelect={(id) => updateItem(index, 'productId', id)}
                    />
                    {product && unitPrice > 0 && (
                      <p className="text-xs text-gray-400 mt-1">Preço un.: {formatCurrency(unitPrice)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" step="any" placeholder="Qtd" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="w-24 rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]" />
                    <label className="flex items-center gap-1 text-xs text-[#4b5757] cursor-pointer" title="Incide IPI?">
                      <input type="checkbox" checked={item.hasIpi !== false} onChange={(e) => updateItem(index, 'hasIpi', e.target.checked)} className="rounded border-[#b0b087] text-[#58706d] focus:ring-[#58706d]" />
                      IPI
                    </label>
                    {subtotal > 0 && <span className="text-sm font-medium text-[#4b5757] min-w-[90px] text-right">{formatCurrency(subtotal)}</span>}
                    <button type="button" onClick={() => removeItem(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}

            {items.length > 0 && (
              <div className="flex justify-end pt-2 border-t border-[#e3e3d1]">
                <div className="text-right space-y-1">
                  <div>
                    <p className="text-xs text-gray-400">Subtotal (s/ IPI)</p>
                    <p className="text-base font-semibold text-[#4b5757]">{formatCurrency(estimatedTotal)}</p>
                  </div>
                  {supplierIpi > 0 && (
                    <>
                      <div>
                        <p className="text-xs text-gray-400">IPI ({supplierIpi}%)</p>
                        <p className="text-sm text-[#4b5757]">{formatCurrency(ipiValue)}</p>
                      </div>
                      <div className="pt-1 border-t border-[#e3e3d1]">
                        <p className="text-xs text-gray-400">Total estimado</p>
                        <p className="text-lg font-bold text-[#4b5757]">{formatCurrency(estimatedTotal + ipiValue)}</p>
                      </div>
                    </>
                  )}
                  {supplierIpi === 0 && (
                    <div>
                      <p className="text-xs text-gray-400">Total estimado</p>
                      <p className="text-lg font-bold text-[#4b5757]">{formatCurrency(estimatedTotal)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observações do pedido (opcional)" className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] resize-none" />
          </CardBody>
        </Card>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={loading}><Save size={16} /> Salvar Alterações</Button>
        </div>
      </form>
    </div>
  );
}
