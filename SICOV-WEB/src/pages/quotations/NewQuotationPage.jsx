import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, FileText, Search, X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProductSearch } from '../../components/ui/ProductSearch';
import api from '../../lib/api';

function formatCnpj(v) {
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return v;
}

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcAdHocUnitPrice(item) {
  const cm = item.calculationMode || 'dimensions_density_factor';
  const parseNum = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    // Aceita vírgula como separador decimal (formato brasileiro)
    return Number(String(v).replace(',', '.')) || 0;
  };

  const w = parseNum(item.width);
  const l = parseNum(item.length);
  const t = parseNum(item.thickness);
  const density = parseNum(item.density);
  const factorKg = parseNum(item.factorKg);
  const basePrice = parseNum(item.basePrice);
  const unitPriceManual = parseNum(item.unitPrice);
  const boxPrice = parseNum(item.boxPrice);
  const unitsPerBox = parseNum(item.unitsPerBox);

  if (cm === 'dimensions_density_factor') {
    if ((item.saleMode || 'thousand') === 'thousand' && w && l && t && density && factorKg) {
      return w * l * t * density * factorKg;
    }
    if ((item.saleMode || 'thousand') === 'kg' && factorKg) return factorKg;
  }
  if (cm === 'weight_times_price_per_kg') return basePrice;
  if (cm === 'quantity_times_unit_price') return unitPriceManual;
  if (cm === 'boxes_times_box_price') return boxPrice;
  if (cm === 'boxes_times_units_per_box_times_unit_price') return unitsPerBox * unitPriceManual;
  if (cm === 'manual_price') return unitPriceManual || basePrice;
  if (cm === 'pallet') {
    const palletQty = parseNum(item.palletQuantity);
    const palletWeight = parseNum(item.palletWeight);
    if (palletQty && palletWeight && basePrice) return palletQty * palletWeight * basePrice;
    return 0;
  }
  return unitPriceManual;
}

// ─── Componente de seleção de cliente (existente ou novo) ────────────────────

function ClientSelector({ clients, selectedClient, adHocClient, onSelectExisting, onSetAdHoc }) {
  const [mode, setMode] = useState(selectedClient ? 'existing' : 'new'); // 'existing' | 'new'
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

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('existing'); onSetAdHoc(null); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${mode === 'existing' ? 'bg-[#58706d] text-white border-[#58706d]' : 'bg-white text-[#4b5757] border-[#e3e3d1] hover:border-[#58706d]'}`}
        >
          Cliente cadastrado
        </button>
        <button
          type="button"
          onClick={() => { setMode('new'); onSelectExisting(''); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${mode === 'new' ? 'bg-[#58706d] text-white border-[#58706d]' : 'bg-white text-[#4b5757] border-[#e3e3d1] hover:border-[#58706d]'}`}
        >
          Digitar novo
        </button>
      </div>

      {/* Modo: cliente existente */}
      {mode === 'existing' && (
        <>
          {selected ? (
            <div className="flex items-center gap-2 p-3 bg-[#f5f5ee] rounded-lg border border-[#e3e3d1]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#4b5757] truncate">{selected.tradeName || selected.name}</p>
                <p className="text-xs text-gray-400">{formatCnpj(selected.cnpj)} {selected.city ? `· ${selected.city}/${selected.state}` : ''}</p>
              </div>
              <button type="button" onClick={() => onSelectExisting('')} className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white"><X size={16} /></button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                  onFocus={() => setOpen(true)}
                  placeholder="Digite o nome do cliente..."
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
                        <button key={c._id} type="button" onClick={() => { onSelectExisting(c._id); setQuery(''); setOpen(false); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#f5f5ee] transition-colors border-b border-[#e3e3d1] last:border-b-0">
                          <p className="text-sm font-medium text-[#4b5757]">{c.tradeName || c.name}</p>
                          <p className="text-xs text-gray-400">{formatCnpj(c.cnpj)} {c.city ? `· ${c.city}/${c.state}` : ''}</p>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Modo: cliente novo (ad-hoc) */}
      {mode === 'new' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#f5f5ee] rounded-lg">
          <Input label="Nome do Cliente *" value={adHocClient?.name || ''} onChange={(e) => onSetAdHoc({ ...adHocClient, name: e.target.value })} required />
          <Input label="Cidade" value={adHocClient?.city || ''} onChange={(e) => onSetAdHoc({ ...adHocClient, city: e.target.value })} />
        </div>
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function NewQuotationPage() {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [adHocClient, setAdHocClient] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [supplierIpi, setSupplierIpi] = useState(0);
  const [items, setItems] = useState([]);
  const [attn, setAttn] = useState('');
  const [observations, setObservations] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/clients', { params: { active: 'true', limit: 500 } }),
      api.get('/suppliers', { params: { active: 'true', limit: 200 } }),
      api.get('/settings'),
    ]).then(([cRes, sRes, settingsRes]) => {
      setClients(cRes.data.clients || []);
      setSuppliers(sRes.data.suppliers || []);
      // Preenche observações com o texto padrão das configurações
      if (settingsRes.data?.defaultObservations) {
        setObservations(settingsRes.data.defaultObservations);
      }
    }).catch(() => {});
  }, []);

  // Carrega produtos quando cliente existente é selecionado
  useEffect(() => {
    if (!selectedClient) { setProducts([]); setSupplierIpi(0); return; }
    setLoadingProducts(true);
    api.get('/quotations/client-products', { params: { clientId: selectedClient } })
      .then(({ data }) => {
        setProducts(data || []);
        // Busca IPI do fornecedor a partir do primeiro produto
        if (data && data.length > 0) {
          const supId = typeof data[0].supplierId === 'object' ? data[0].supplierId._id : data[0].supplierId;
          if (supId) api.get(`/suppliers/${supId}`).then(({ data: s }) => setSupplierIpi(s.ipi ?? 0)).catch(() => {});
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedClient]);

  const addItem = () => setItems((prev) => [...prev, { productId: '', quantity: '', hasIpi: true }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems((prev) => prev.map((item, idx) => {
    if (idx !== i) return item;
    const updated = { ...item, [field]: value };

    // Auto-gera nome (igual ao cadastro de produto)
    const calcMode = updated.calculationMode || 'dimensions_density_factor';
    if (['width', 'length', 'thickness', 'gusset', 'material', 'calculationMode', 'productType'].includes(field)) {
      // Fitas: "Fitas Adesivas LARGURAxCOMPRIMENTO"
      if (updated.productType === 'tape') {
        if (updated.width && updated.length) {
          const fmt = (v) => String(v).replace('.', ',');
          updated.name = `Fitas Adesivas ${fmt(updated.width)}x${fmt(updated.length)}`;
        }
      } else if (calcMode === 'dimensions_density_factor') {
        const fmt = (v) => String(v).replace('.', ',');
        const parts = [];
        if (updated.width && updated.length && updated.thickness) {
          parts.push(`${fmt(updated.width)}x${fmt(updated.length)}x${fmt(updated.thickness)}`);
        }
        if (updated.gusset) {
          parts.push(`SF ${fmt(updated.gusset)}`);
        } else if (updated.width && updated.length && updated.thickness) {
          parts.push('S/SF');
        }
        if (updated.material) {
          parts.push(String(updated.material).toUpperCase());
        }
        if (parts.length > 0) {
          updated.name = parts.join(' ');
        }
      }
    }

    // Auto-preenche densidade quando material é selecionado (da tabela do fornecedor)
    if (field === 'material' && value && supplierId) {
      const sup = suppliers.find((s) => s._id === supplierId);
      if (sup?.priceTable?.length) {
        const match = sup.priceTable.find((p) => p.material.toLowerCase() === value.toLowerCase());
        if (match?.density && !updated.density) {
          updated.density = match.density;
        }
      }
    }

    return updated;
  }));

  // Obtém dicas do fornecedor selecionado (fator kg, densidade)
  const getSupplierHint = (material) => {
    if (!supplierId || !material) return {};
    const sup = suppliers.find((s) => s._id === supplierId);
    if (!sup?.priceTable?.length) return {};
    const match = sup.priceTable.find((p) => p.material.toLowerCase() === material.toLowerCase());
    if (!match) return {};
    return { density: match.density, factorKg: match.factorKg, limitFactorKg: match.limitFactorKg };
  };

  const selectedSupplierObj = suppliers.find((s) => s._id === supplierId);

  // Atualiza IPI quando fornecedor ad-hoc muda
  useEffect(() => {
    if (!supplierId) { if (!selectedClient) setSupplierIpi(0); return; }
    // Busca direto da API para garantir que pega o IPI correto
    api.get(`/suppliers/${supplierId}`).then(({ data }) => setSupplierIpi(data.ipi ?? 0)).catch(() => setSupplierIpi(0));
  }, [supplierId, selectedClient]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedClient && (!adHocClient || !adHocClient.name?.trim())) {
      return setError('Selecione um cliente ou preencha o nome do novo cliente.');
    }
    if (items.length === 0) return setError('Adicione pelo menos um item.');

    if (selectedClient) {
      const invalid = items.some((i) => !i.productId || !i.quantity || Number(i.quantity) <= 0);
      if (invalid) return setError('Preencha produto e quantidade em todos os itens.');
    } else {
      const invalid = items.some((i) => !i.name?.trim() || !i.quantity || Number(i.quantity) <= 0 || calcAdHocUnitPrice(i) <= 0);
      if (invalid) return setError('Preencha nome, quantidade e dados de cálculo em todos os itens.');
    }

    setLoading(true);
    try {
      const payload = {
        save: true,
        attn: attn || undefined,
        observations: observations || undefined,
        deliveryDate: deliveryDate || undefined,
        paymentTerm: paymentTerm || undefined,
      };

      if (selectedClient) {
        payload.clientId = selectedClient;
        payload.items = items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), hasIpi: i.hasIpi !== false }));
      } else {
        payload.adHocClient = adHocClient;
        if (!supplierId) { setError('Selecione o fornecedor.'); setLoading(false); return; }
        payload.items = items.map((i) => ({
          adHocProduct: {
            name: i.name,
            description: i.description || undefined,
            saleMode: i.saleMode || 'thousand',
            unitLabel: i.unitLabel || i.saleMode || 'ML',
            supplierCode: i.supplierCode || undefined,
            calculationMode: i.calculationMode || 'dimensions_density_factor',
            material: i.material || undefined,
            technicalData: {
              measurements: {
                width: Number(i.width) || undefined,
                length: Number(i.length) || undefined,
                thickness: Number(i.thickness) || undefined,
                gusset: Number(i.gusset) || undefined,
              },
            },
            commercialData: {
              density: Number(i.density) || undefined,
              factorKg: Number(i.factorKg) || undefined,
              basePrice: Number(i.basePrice) || undefined,
              unitPrice: Number(i.unitPrice) || undefined,
              boxPrice: Number(i.boxPrice) || undefined,
              palletQuantity: Number(i.palletQuantity) || undefined,
              palletWeight: Number(i.palletWeight) || undefined,
            },
          },
          supplierId,
          unitPrice: calcAdHocUnitPrice(i),
          quantity: Number(i.quantity),
          hasIpi: i.hasIpi !== false,
        }));
      }

      const { data } = await api.post('/quotations', payload);
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
          <p className="text-sm text-[#7c8a6e]">Selecione ou digite o cliente e os produtos</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Cliente</h2></CardHeader>
          <CardBody>
            <ClientSelector
              clients={clients}
              selectedClient={selectedClient}
              adHocClient={adHocClient}
              onSelectExisting={setSelectedClient}
              onSetAdHoc={setAdHocClient}
            />
          </CardBody>
        </Card>

        {/* Dados adicionais */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Informações do Orçamento</h2></CardHeader>
          <CardBody>
            <Input
              label="Aos cuidados de (A/C)"
              placeholder="Ex: João da Silva"
              value={attn}
              onChange={(e) => setAttn(e.target.value)}
            />
          </CardBody>
        </Card>

        {/* Fornecedor (obrigatório para itens ad-hoc — antes dos itens para ter IPI) */}
        {!selectedClient && adHocClient?.name && (
          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Fornecedor</h2></CardHeader>
            <CardBody>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]">
                <option value="">Selecione o fornecedor...</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.tradeName || s.name} (IPI {s.ipi}%)</option>)}
              </select>
            </CardBody>
          </Card>
        )}

        {/* Itens */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Itens</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem} disabled={!selectedClient && !adHocClient?.name}>
              <Plus size={14} /> Adicionar
            </Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {selectedClient && loadingProducts && <p className="text-sm text-gray-400 text-center py-4">Carregando produtos...</p>}
            {selectedClient && !loadingProducts && products.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum produto disponível para este cliente.</p>}
            {!selectedClient && !adHocClient?.name && <p className="text-sm text-gray-400 text-center py-4">Selecione ou digite um cliente primeiro.</p>}

            {/* Itens com produto cadastrado (cliente existente) */}
            {selectedClient && items.map((item, i) => {
              const product = products.find((p) => p._id === item.productId);
              let unitPrice = 0;
              let subtotal = 0;
              if (product && item.quantity) {
                unitPrice = calcAdHocUnitPrice({
                  calculationMode: product.calculationMode,
                  saleMode: product.saleMode,
                  width: product.technicalData?.measurements?.width,
                  length: product.technicalData?.measurements?.length,
                  thickness: product.technicalData?.measurements?.thickness,
                  density: product.commercialData?.density,
                  factorKg: product.commercialData?.factorKg,
                  basePrice: product.commercialData?.basePrice,
                  unitPrice: product.commercialData?.unitPrice,
                  boxPrice: product.commercialData?.boxPrice,
                  unitsPerBox: product.technicalData?.unitsPerBox,
                });
                subtotal = unitPrice * Number(item.quantity);
              }

              return (
                <div key={i} className="flex flex-col sm:flex-row gap-3 p-3 bg-[#f5f5ee] rounded-lg">
                  <div className="flex-1">
                    <ProductSearch
                      products={products}
                      selectedProductId={item.productId}
                      onSelect={(id) => updateItem(i, 'productId', id)}
                    />
                    {product && unitPrice > 0 && (
                      <p className="text-xs text-gray-400 mt-1">Preço un.: {formatCurrency(unitPrice)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" step="any" placeholder="Qtd" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="w-24 rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]" />
                    <label className="flex items-center gap-1 text-xs text-[#4b5757] cursor-pointer" title="Incide IPI?">
                      <input type="checkbox" checked={item.hasIpi !== false} onChange={(e) => updateItem(i, 'hasIpi', e.target.checked)} className="rounded border-[#b0b087] text-[#58706d] focus:ring-[#58706d]" />
                      IPI
                    </label>
                    {subtotal > 0 && <span className="text-sm font-medium text-[#4b5757] min-w-[80px] text-right">{formatCurrency(subtotal)}</span>}
                    <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}

            {/* Itens manuais (cliente ad-hoc) */}
            {!selectedClient && adHocClient?.name && items.map((item, i) => {
              // Calcula preço unitário em tempo real
              const calcUnitPrice = calcAdHocUnitPrice(item);
              const qty = Number(String(item.quantity || '').replace(',', '.')) || 0;
              const subtotal = calcUnitPrice * qty;

              return (
                <div key={i} className="p-3 bg-[#f5f5ee] rounded-lg space-y-3 border border-[#e3e3d1]">
                  {/* Linha 1: Nome e descrição */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input label="Nome do Produto *" value={item.name || ''} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                    <Input label="Descrição" value={item.description || ''} onChange={(e) => updateItem(i, 'description', e.target.value)} />
                    <div>
                      <label className="text-sm font-medium text-[#4b5757] mb-1 block">Tipo</label>
                      <select value={item.productType || 'plastic_bag'} onChange={(e) => updateItem(i, 'productType', e.target.value)} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]">
                        <option value="plastic_bag">Saco Plástico</option>
                        <option value="tape">Fita</option>
                        <option value="stretch">Stretch</option>
                        <option value="shrink">Shrink</option>
                        <option value="bobbin">Bobina</option>
                        <option value="custom">Personalizado</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#4b5757] mb-1 block">Modo de Venda</label>
                      <select value={item.saleMode || 'thousand'} onChange={(e) => updateItem(i, 'saleMode', e.target.value)} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]">
                        <option value="kg">Kg</option>
                        <option value="thousand">Milheiro</option>
                        <option value="unit">Unidade</option>
                        <option value="box">Caixa</option>
                        <option value="linear_meter">Metro Linear</option>
                      </select>
                    </div>
                  </div>

                  {/* Linha 2: Modo de cálculo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-sm font-medium text-[#4b5757] mb-1 block">Modo de Cálculo</label>
                      <select value={item.calculationMode || 'dimensions_density_factor'} onChange={(e) => updateItem(i, 'calculationMode', e.target.value)} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]">
                        <option value="dimensions_density_factor">Dimensões × Densidade × Fator</option>
                        <option value="weight_times_price_per_kg">Peso × Preço/Kg</option>
                        <option value="quantity_times_unit_price">Qtd × Preço Unitário</option>
                        <option value="boxes_times_box_price">Caixas × Preço/Caixa</option>
                        <option value="boxes_times_units_per_box_times_unit_price">Caixas × Un/Cx × Preço Un.</option>
                        <option value="pallet">Palete (Qtd × Peso × Preço/kg)</option>
                        <option value="manual_price">Preço Manual</option>
                      </select>
                    </div>
                    <Input label="Quantidade *" type="number" min="1" step="any" value={item.quantity || ''} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                    <Input label="Cód. Fornecedor" value={item.supplierCode || ''} onChange={(e) => updateItem(i, 'supplierCode', e.target.value)} />
                  </div>

                  {/* Linha 3: Campos de cálculo (condicionais) */}
                  {/* Fita: sempre mostra largura e comprimento */}
                  {item.productType === 'tape' && (item.calculationMode || 'dimensions_density_factor') !== 'dimensions_density_factor' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Largura" type="number" step="any" value={item.width || ''} onChange={(e) => updateItem(i, 'width', e.target.value)} />
                      <Input label="Comprimento" type="number" step="any" value={item.length || ''} onChange={(e) => updateItem(i, 'length', e.target.value)} />
                    </div>
                  )}
                  {(item.calculationMode || 'dimensions_density_factor') === 'dimensions_density_factor' && (() => {
                    const hint = getSupplierHint(item.material);
                    const isTape = item.productType === 'tape';
                    return (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <Input label="Largura" type="number" step="any" value={item.width || ''} onChange={(e) => updateItem(i, 'width', e.target.value)} />
                      <Input label="Comprimento" type="number" step="any" value={item.length || ''} onChange={(e) => updateItem(i, 'length', e.target.value)} />
                      {!isTape && <Input label="Espessura" type="number" step="any" value={item.thickness || ''} onChange={(e) => updateItem(i, 'thickness', e.target.value)} />}
                      {!isTape && <Input label="Sanfona" type="number" step="any" value={item.gusset || ''} onChange={(e) => updateItem(i, 'gusset', e.target.value)} />}
                      {selectedSupplierObj?.priceTable?.length > 0 ? (
                        <div>
                          <label className="text-sm font-medium text-[#4b5757] mb-1 block">Material</label>
                          <select value={item.material || ''} onChange={(e) => updateItem(i, 'material', e.target.value)} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]">
                            <option value="">Selecione...</option>
                            {selectedSupplierObj.priceTable.map((p, pi) => (
                              <option key={pi} value={p.material}>{p.material}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <Input label="Material" value={item.material || ''} onChange={(e) => updateItem(i, 'material', e.target.value)} placeholder="Ex: PEAD" />
                      )}
                      <Input label="Densidade" type="number" step="any" value={item.density || ''} onChange={(e) => updateItem(i, 'density', e.target.value)} placeholder={hint.density ? `${Number(hint.density).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}` : ''} />
                      <Input label="Fator Kg (R$)" type="number" step="any" value={item.factorKg || ''} onChange={(e) => updateItem(i, 'factorKg', e.target.value)} placeholder={hint.factorKg ? `Dica: R$ ${Number(hint.factorKg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''} />
                      {hint.limitFactorKg && item.factorKg && Number(item.factorKg) < Number(hint.limitFactorKg) && (
                        <div className="col-span-2 sm:col-span-5 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                          <p className="text-xs text-amber-700">Fator abaixo do limite (R$ {Number(hint.limitFactorKg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Comissão será de apenas 3%.</p>
                        </div>
                      )}
                      {(() => {
                        const w = Number(item.width) || 0;
                        const l = Number(item.length) || 0;
                        const t = Number(item.thickness) || 0;
                        const d = Number(item.density) || 0;
                        const kgMil = w * l * t * d;
                        if (kgMil > 0) {
                          return (
                            <div className="col-span-2 sm:col-span-5 px-3 py-2 bg-[#e3e3d1]/30 rounded-lg">
                              <p className="text-xs text-[#7c8a6e]">Kg/Mil: <span className="font-semibold text-[#4b5757]">{kgMil.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span></p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    );
                  })()}

                  {(item.calculationMode === 'weight_times_price_per_kg') && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Preço Base (R$/kg)" type="number" step="any" value={item.basePrice || ''} onChange={(e) => updateItem(i, 'basePrice', e.target.value)} />
                    </div>
                  )}

                  {(item.calculationMode === 'quantity_times_unit_price' || item.calculationMode === 'manual_price') && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Preço Unitário (R$)" type="number" step="any" value={item.unitPrice || ''} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} />
                    </div>
                  )}

                  {item.calculationMode === 'boxes_times_box_price' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Preço por Caixa (R$)" type="number" step="any" value={item.boxPrice || ''} onChange={(e) => updateItem(i, 'boxPrice', e.target.value)} />
                    </div>
                  )}

                  {item.calculationMode === 'boxes_times_units_per_box_times_unit_price' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Un/Caixa" type="number" step="1" value={item.unitsPerBox || ''} onChange={(e) => updateItem(i, 'unitsPerBox', e.target.value)} />
                      <Input label="Preço Unitário (R$)" type="number" step="any" value={item.unitPrice || ''} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} />
                    </div>
                  )}

                  {item.calculationMode === 'pallet' && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input label="Qtd por Palete" type="number" step="1" value={item.palletQuantity || ''} onChange={(e) => updateItem(i, 'palletQuantity', e.target.value)} />
                      <Input label="Peso (kg)" type="number" step="any" value={item.palletWeight || ''} onChange={(e) => updateItem(i, 'palletWeight', e.target.value)} />
                      <Input label="Preço/kg (R$)" type="number" step="any" value={item.basePrice || ''} onChange={(e) => updateItem(i, 'basePrice', e.target.value)} />
                    </div>
                  )}

                  {/* Resultado do cálculo */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#e3e3d1]">
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-400">
                        {calcUnitPrice > 0 ? `Preço unitário: ${formatCurrency(calcUnitPrice)}` : 'Preencha os campos para calcular'}
                      </div>
                      <label className="flex items-center gap-1 text-xs text-[#4b5757] cursor-pointer" title="Incide IPI?">
                        <input type="checkbox" checked={item.hasIpi !== false} onChange={(e) => updateItem(i, 'hasIpi', e.target.checked)} className="rounded border-[#b0b087] text-[#58706d] focus:ring-[#58706d]" />
                        IPI
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      {subtotal > 0 && <span className="text-sm font-semibold text-[#4b5757]">{formatCurrency(subtotal)}</span>}
                      <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Subtotal estimado dentro do card */}
            {items.length > 0 && (() => {
              let totalEstimado = 0;
              let subtotalComIpi = 0;
              if (selectedClient) {
                totalEstimado = items.reduce((sum, item) => {
                  const product = products.find((p) => p._id === item.productId);
                  if (!product || !item.quantity) return sum;
                  const up = calcAdHocUnitPrice({
                    calculationMode: product.calculationMode, saleMode: product.saleMode,
                    width: product.technicalData?.measurements?.width, length: product.technicalData?.measurements?.length,
                    thickness: product.technicalData?.measurements?.thickness, density: product.commercialData?.density,
                    factorKg: product.commercialData?.factorKg, basePrice: product.commercialData?.basePrice,
                    unitPrice: product.commercialData?.unitPrice, boxPrice: product.commercialData?.boxPrice,
                    unitsPerBox: product.technicalData?.unitsPerBox,
                  });
                  const sub = up * (Number(String(item.quantity).replace(',', '.')) || 0);
                  if (item.hasIpi !== false) subtotalComIpi += sub;
                  return sum + sub;
                }, 0);
              } else {
                totalEstimado = items.reduce((sum, item) => {
                  const sub = calcAdHocUnitPrice(item) * (Number(String(item.quantity || '').replace(',', '.')) || 0);
                  if (item.hasIpi !== false) subtotalComIpi += sub;
                  return sum + sub;
                }, 0);
              }
              const ipiVal = subtotalComIpi * (supplierIpi / 100);
              return items.length > 0 ? (
                <div className="flex justify-end pt-2 border-t border-[#e3e3d1]">
                  <div className="text-right space-y-1">
                    <div>
                      <p className="text-xs text-gray-400">Subtotal (s/ IPI)</p>
                      <p className="text-base font-semibold text-[#4b5757]">{formatCurrency(totalEstimado)}</p>
                    </div>
                    {supplierIpi > 0 && (
                      <>
                        <div>
                          <p className="text-xs text-gray-400">IPI ({supplierIpi}%)</p>
                          <p className="text-sm text-[#4b5757]">{formatCurrency(ipiVal)}</p>
                        </div>
                        <div className="pt-1 border-t border-[#e3e3d1]">
                          <p className="text-xs text-gray-400">Total estimado</p>
                          <p className="text-lg font-bold text-[#4b5757]">{formatCurrency(totalEstimado + ipiVal)}</p>
                        </div>
                      </>
                    )}
                    {supplierIpi === 0 && (
                      <div>
                        <p className="text-xs text-gray-400">Total estimado</p>
                        <p className="text-lg font-bold text-[#4b5757]">{formatCurrency(totalEstimado)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}
          </CardBody>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              placeholder="Observações do orçamento (opcional)"
              className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] resize-none"
            />
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
