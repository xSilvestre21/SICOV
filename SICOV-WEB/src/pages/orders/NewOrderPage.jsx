import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ShoppingCart, Search, X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProductSearch } from '../../components/ui/ProductSearch';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Replica a lógica do backend (priceCalculator.js) para estimar o preço unitário.
 */
function calculateUnitPrice(product, quantity = 1) {
  const cd = product.commercialData || {};
  const td = product.technicalData || {};
  const m = td.measurements || {};
  const selectedExtras = product.selectedExtras || [];

  let unitPrice = 0;

  if (product.calculationMode === 'dimensions_density_factor') {
    if (!cd.factorKg) return 0;

    if (product.saleMode === 'kg') {
      unitPrice = cd.factorKg;
    } else if (product.saleMode === 'thousand') {
      if (!m.width || !m.length || !m.thickness || !cd.density) return 0;
      const kgPerThousand = m.width * m.length * m.thickness * cd.density;
      unitPrice = kgPerThousand * cd.factorKg;
    } else {
      unitPrice = cd.factorKg;
    }
  } else if (product.calculationMode === 'quantity_times_unit_price') {
    unitPrice = cd.unitPrice || 0;
  } else if (product.calculationMode === 'boxes_times_box_price') {
    unitPrice = cd.boxPrice || 0;
  } else if (product.calculationMode === 'boxes_times_units_per_box_times_unit_price') {
    if (!td.unitsPerBox || !cd.unitPrice) return 0;
    unitPrice = td.unitsPerBox * cd.unitPrice;
  } else if (product.calculationMode === 'weight_times_price_per_kg') {
    unitPrice = cd.basePrice || 0;
  } else if (product.calculationMode === 'manual_price') {
    unitPrice = cd.basePrice || cd.unitPrice || cd.boxPrice || 0;
  }

  // Aplica extras ao preço unitário
  for (const extra of selectedExtras) {
    if (!extra.value || extra.value <= 0) continue;

    if (extra.chargeType === 'per_kg') {
      if (product.saleMode === 'kg') {
        unitPrice += extra.value;
      } else if (product.saleMode === 'thousand') {
        const kgPerThousand = (m.width || 0) * (m.length || 0) * (m.thickness || 0) * (cd.density || 0);
        unitPrice += extra.value * kgPerThousand;
      }
    } else if (extra.chargeType === 'per_thousand') {
      if (product.saleMode === 'thousand') {
        unitPrice += extra.value;
      } else if (product.saleMode === 'kg') {
        const kgPerThousand = (m.width || 0) * (m.length || 0) * (m.thickness || 0) * (cd.density || 0);
        if (kgPerThousand > 0) unitPrice += extra.value / kgPerThousand;
      }
    } else if (extra.chargeType === 'per_unit' || extra.chargeType === 'per_box' || extra.chargeType === 'per_linear_meter') {
      unitPrice += extra.value;
    } else if (extra.chargeType === 'fixed') {
      if (quantity > 0) unitPrice += extra.value / quantity;
    }
  }

  return unitPrice;
}

function formatCnpj(v) {
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return v;
}

// ─── Componente de busca de cliente ──────────────────────────────────────────

function ClientSearch({ clients, selectedClient, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = clients.find((c) => c._id === selectedClient);

  const filtered = useMemo(() => {
    if (!query.trim()) return clients.slice(0, 30);
    const q = query.toLowerCase();
    return clients.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.tradeName || '').toLowerCase().includes(q) ||
        (c.cnpj || '').includes(q),
    ).slice(0, 30);
  }, [clients, query]);

  const handleSelect = (client) => {
    onSelect(client._id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onSelect('');
    setQuery('');
  };

  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 p-3 bg-[#f5f5ee] rounded-lg border border-[#e3e3d1]">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#4b5757] truncate">
            {selected.tradeName || selected.name}
          </p>
          <p className="text-xs text-gray-400">{formatCnpj(selected.cnpj)} {selected.city ? `· ${selected.city}/${selected.state}` : ''}</p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Digite o nome do cliente para buscar..."
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
        />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#e3e3d1] rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">Nenhum cliente encontrado.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#f5f5ee] transition-colors border-b border-[#e3e3d1] last:border-b-0"
                >
                  <p className="text-sm font-medium text-[#4b5757]">{c.tradeName || c.name}</p>
                  <p className="text-xs text-gray-400">{formatCnpj(c.cnpj)} {c.city ? `· ${c.city}/${c.state}` : ''}</p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function NewOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get('duplicate');
  const fromQuotationId = searchParams.get('fromQuotation');

  // State
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [supplierIpi, setSupplierIpi] = useState(0);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [customerPurchaseOrder, setCustomerPurchaseOrder] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [duplicateLoaded, setDuplicateLoaded] = useState(false);

  // Carrega clientes ao montar
  useEffect(() => {
    api.get('/clients', { params: { active: 'true', limit: 500 } })
      .then(({ data }) => setClients(data.clients || []))
      .catch(() => {});
  }, []);

  // Carrega dados do pedido a duplicar
  useEffect(() => {
    if (!duplicateId || duplicateLoaded) return;
    api.get(`/orders/${duplicateId}/duplicate-template`)
      .then(({ data }) => {
        setSelectedClient(data.clientId);
        setNotes(data.notes || '');
        window.__sicov_duplicate_items = data.items || [];
        setDuplicateLoaded(true);
      })
      .catch(() => {});
  }, [duplicateId, duplicateLoaded]);

  // Carrega dados do orçamento para converter em pedido
  useEffect(() => {
    if (!fromQuotationId || duplicateLoaded) return;
    api.get(`/quotations/${fromQuotationId}`)
      .then(({ data }) => {
        if (data.clientId) setSelectedClient(data.clientId);
        setNotes(data.observations || '');
        // Itens serão preenchidos após os produtos carregarem
        window.__sicov_duplicate_items = (data.items || [])
          .filter((i) => i.productId) // só itens cadastrados
          .map((i) => ({ productId: i.productId, quantity: i.quantity, hasIpi: i.hasIpi !== false }));
        setDuplicateLoaded(true);
      })
      .catch(() => {});
  }, [fromQuotationId, duplicateLoaded]);

  // Carrega clientes ao montar
  useEffect(() => {
    api.get('/clients', { params: { active: 'true', limit: 500 } })
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
        const loadedProducts = productsRes.data.products || [];
        setProducts(loadedProducts);

        // Pega o IPI do fornecedor
        if (loadedProducts.length > 0) {
          const sup = loadedProducts[0].supplierId;
          const supId = typeof sup === 'object' && sup !== null ? sup._id : sup;
          if (supId) {
            api.get(`/suppliers/${supId}`).then(({ data }) => {
              setSupplierIpi(data.ipi ?? 0);
            }).catch(() => {});
          }
        }

        // Se estamos duplicando, preenche os itens do pedido original
        if (window.__sicov_duplicate_items && window.__sicov_duplicate_items.length > 0) {
          const dupItems = window.__sicov_duplicate_items.map((i) => ({
            productId: i.productId,
            quantity: String(i.quantity),
          }));
          setItems(dupItems);
          window.__sicov_duplicate_items = null;
        } else {
          setItems([]);
        }

        // Preenche observações com as notas do cliente (se houver e campo estiver vazio)
        const clientNotes = clientRes.data?.notes;
        if (clientNotes && !notes) {
          setNotes(clientNotes);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [selectedClient]);

  // Adiciona item
  const addItem = () => {
    setItems((prev) => [...prev, { productId: '', quantity: '', hasIpi: true }]);
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

  // Calcula subtotal estimado usando a mesma lógica do backend
  const getItemSubtotal = (item) => {
    const product = products.find((p) => p._id === item.productId);
    if (!product || !item.quantity) return 0;
    const qty = Number(item.quantity);
    const unitPrice = calculateUnitPrice(product, qty);
    return unitPrice * qty;
  };

  const getItemUnitPrice = (item) => {
    const product = products.find((p) => p._id === item.productId);
    if (!product) return 0;
    const qty = Number(item.quantity) || 1;
    return calculateUnitPrice(product, qty);
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
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), hasIpi: i.hasIpi !== false })),
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
          <h1 className="text-2xl font-bold text-[#4b5757]">{fromQuotationId ? 'Converter Orçamento em Pedido' : duplicateId ? 'Duplicar Pedido' : 'Novo Pedido'}</h1>
          <p className="text-sm text-[#7c8a6e]">
            {fromQuotationId ? 'Preencha a data de entrega e o PC para finalizar' : duplicateId ? 'Pedido duplicado — preencha a data e o PC' : 'Preencha os dados do pedido'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#4b5757]">Cliente</h2>
          </CardHeader>
          <CardBody>
            <ClientSearch
              clients={clients}
              selectedClient={selectedClient}
              onSelect={setSelectedClient}
            />
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
              const unitPrice = getItemUnitPrice(item);

              return (
                <div key={index} className="flex flex-col sm:flex-row gap-3 p-3 bg-[#f5f5ee] rounded-lg">
                  <div className="flex-1">
                    <ProductSearch
                      products={products}
                      selectedProductId={item.productId}
                      onSelect={(id) => updateItem(index, 'productId', id)}
                    />
                    {product && unitPrice > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Preço un.: {formatCurrency(unitPrice)}
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
                    <label className="flex items-center gap-1 text-xs text-[#4b5757] cursor-pointer" title="Incide IPI?">
                      <input
                        type="checkbox"
                        checked={item.hasIpi !== false}
                        onChange={(e) => updateItem(index, 'hasIpi', e.target.checked)}
                        className="rounded border-[#b0b087] text-[#58706d] focus:ring-[#58706d]"
                      />
                      IPI
                    </label>
                    {subtotal > 0 && (
                      <span className="text-sm font-medium text-[#4b5757] min-w-[90px] text-right">
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
                <div className="text-right space-y-1">
                  <div>
                    <p className="text-xs text-gray-400">Subtotal (s/ IPI)</p>
                    <p className="text-base font-semibold text-[#4b5757]">{formatCurrency(estimatedTotal)}</p>
                  </div>
                  {supplierIpi > 0 && (() => {
                    const subtotalComIpi = items.reduce((sum, item) => {
                      if (item.hasIpi === false) return sum;
                      return sum + getItemSubtotal(item);
                    }, 0);
                    const ipiValue = subtotalComIpi * (supplierIpi / 100);
                    return (
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
                    );
                  })()}
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
