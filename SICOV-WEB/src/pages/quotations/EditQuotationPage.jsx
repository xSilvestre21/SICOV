import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Search, X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProductSearch } from '../../components/ui/ProductSearch';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCnpj(v) {
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return v;
}

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  return Number(String(v).replace(',', '.')) || 0;
}

function calcAdHocUnitPrice(item) {
  const cm = item.calculationMode || 'dimensions_density_factor';
  const w = parseNum(item.width); const l = parseNum(item.length);
  const t = parseNum(item.thickness); const density = parseNum(item.density);
  const factorKg = parseNum(item.factorKg); const basePrice = parseNum(item.basePrice);
  const unitPriceManual = parseNum(item.unitPrice); const boxPrice = parseNum(item.boxPrice);
  const unitsPerBox = parseNum(item.unitsPerBox);

  if (cm === 'dimensions_density_factor') {
    if ((item.saleMode || 'thousand') === 'thousand' && w && l && t && density && factorKg) return w * l * t * density * factorKg;
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

export function EditQuotationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quotation, setQuotation] = useState(null);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [adHocClient, setAdHocClient] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [items, setItems] = useState([]);
  const [attn, setAttn] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState('');

  // Carrega dados iniciais
  useEffect(() => {
    Promise.all([
      api.get(`/quotations/${id}`),
      api.get('/clients', { params: { active: 'true', limit: 500 } }),
      api.get('/suppliers', { params: { active: 'true', limit: 200 } }),
    ]).then(([qRes, cRes, sRes]) => {
      const q = qRes.data;
      setQuotation(q);
      setClients(cRes.data.clients || []);
      setSuppliers(sRes.data.suppliers || []);
      setAttn(q.attn || '');
      setObservations(q.observations || '');
      setSupplierId(q.supplierId || '');

      if (q.clientId) {
        setMode('existing');
        setSelectedClient(q.clientId);
      } else {
        setMode('new');
        setAdHocClient({ name: q.clientSnapshot?.tradeName || q.clientSnapshot?.name || '', city: q.clientSnapshot?.city || '' });
        // Itens ad-hoc com dados do snapshot
        setItems(q.items.map((i) => {
          const p = i.productSnapshot || {};
          const m = p.technicalData?.measurements || {};
          const cd = p.commercialData || {};
          return {
            name: p.name || '', description: p.description || '',
            saleMode: p.saleMode || 'thousand',
            calculationMode: p.calculationMode || 'dimensions_density_factor',
            material: p.material || '',
            quantity: String(i.quantity || ''),
            unitPrice: String(i.unitPrice || ''),
            width: m.width != null ? String(m.width) : '',
            length: m.length != null ? String(m.length) : '',
            thickness: m.thickness != null ? String(m.thickness) : '',
            gusset: m.gusset != null ? String(m.gusset) : '',
            density: cd.density != null ? String(cd.density) : '',
            factorKg: cd.factorKg != null ? String(cd.factorKg) : '',
            basePrice: cd.basePrice != null ? String(cd.basePrice) : '',
            boxPrice: cd.boxPrice != null ? String(cd.boxPrice) : '',
            palletQuantity: cd.palletQuantity != null ? String(cd.palletQuantity) : '',
            palletWeight: cd.palletWeight != null ? String(cd.palletWeight) : '',
            unitsPerBox: p.technicalData?.unitsPerBox != null ? String(p.technicalData.unitsPerBox) : '',
            supplierCode: p.supplierCode || '',
          };
        }));
      }
    }).catch(() => navigate('/quotations'))
      .finally(() => setLoadingData(false));
  }, [id, navigate]);

  // Carrega produtos quando cliente existente muda
  useEffect(() => {
    if (mode !== 'existing' || !selectedClient) return;
    setLoadingProducts(true);
    api.get('/quotations/client-products', { params: { clientId: selectedClient } })
      .then(({ data }) => {
        setProducts(data || []);
        // Se é a carga inicial e já temos itens do orçamento, mantém
        if (quotation && quotation.clientId === selectedClient && items.length === 0) {
          setItems(quotation.items.map((i) => ({ productId: i.productId, quantity: String(i.quantity) })));
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedClient, mode]);

  // Preenche itens na primeira carga para cliente existente
  useEffect(() => {
    if (quotation && mode === 'existing' && products.length > 0 && items.length === 0) {
      setItems(quotation.items.map((i) => ({ productId: i.productId, quantity: String(i.quantity) })));
    }
  }, [products, quotation, mode]);

  const addItem = () => {
    if (mode === 'new') {
      setItems((prev) => [...prev, { name: '', description: '', saleMode: 'thousand', calculationMode: 'dimensions_density_factor', quantity: '', width: '', length: '', thickness: '', density: '', factorKg: '', unitPrice: '', basePrice: '', boxPrice: '', unitsPerBox: '', supplierCode: '' }]);
    } else {
      setItems((prev) => [...prev, { productId: '', quantity: '' }]);
    }
  };
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems((prev) => prev.map((item, idx) => {
    if (idx !== i) return item;
    const updated = { ...item, [field]: value };

    // Auto-gera nome para modo dimensions_density_factor
    const calcMode = updated.calculationMode || 'dimensions_density_factor';
    if (calcMode === 'dimensions_density_factor' && ['width', 'length', 'thickness', 'gusset', 'material', 'calculationMode'].includes(field)) {
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
    return updated;
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) return setError('Adicione pelo menos um item.');

    setLoading(true);
    try {
      const payload = { attn: attn || undefined, observations: observations || undefined };

      if (mode === 'new') {
        if (!adHocClient?.name?.trim()) { setError('Nome do cliente é obrigatório.'); setLoading(false); return; }
        if (!supplierId) { setError('Selecione o fornecedor.'); setLoading(false); return; }
        payload.adHocClient = adHocClient;
        payload.items = items.map((i) => ({
          adHocProduct: { name: i.name, description: i.description || undefined, saleMode: i.saleMode || 'thousand', unitLabel: i.saleMode || 'ML', supplierCode: i.supplierCode || undefined },
          supplierId,
          unitPrice: calcAdHocUnitPrice(i) || parseNum(i.unitPrice),
          quantity: parseNum(i.quantity),
        }));
      } else {
        if (selectedClient) payload.clientId = selectedClient;
        payload.items = items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }));
      }

      await api.put(`/quotations/${id}`, payload);
      navigate(`/quotations/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao atualizar orçamento.');
    } finally { setLoading(false); }
  };

  if (loadingData) return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  if (!quotation) return null;

  // Cálculo do subtotal
  const totalEstimado = (() => {
    if (mode === 'existing') {
      return items.reduce((sum, item) => {
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
        return sum + up * parseNum(item.quantity);
      }, 0);
    }
    return items.reduce((sum, item) => sum + (calcAdHocUnitPrice(item) || parseNum(item.unitPrice)) * parseNum(item.quantity), 0);
  })();

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#58706d] hover:text-[#4b5757]"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Editar Orçamento</h1>
          <p className="text-sm text-[#7c8a6e]">Altere os dados do orçamento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Cliente</h2></CardHeader>
          <CardBody className="space-y-3">
            {mode === 'new' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nome do Cliente *" value={adHocClient?.name || ''} onChange={(e) => setAdHocClient({ ...adHocClient, name: e.target.value })} required />
                <Input label="Cidade" value={adHocClient?.city || ''} onChange={(e) => setAdHocClient({ ...adHocClient, city: e.target.value })} />
              </div>
            )}
            {mode === 'existing' && (
              <div className="p-3 bg-[#f5f5ee] rounded-lg border border-[#e3e3d1]">
                <p className="text-sm font-medium text-[#4b5757]">{quotation.clientSnapshot?.tradeName || quotation.clientSnapshot?.name}</p>
                <p className="text-xs text-gray-400">{formatCnpj(quotation.clientSnapshot?.cnpj)}</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* A/C */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Informações</h2></CardHeader>
          <CardBody>
            <Input label="Aos cuidados de (A/C)" value={attn} onChange={(e) => setAttn(e.target.value)} />
          </CardBody>
        </Card>

        {/* Itens */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Itens</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}><Plus size={14} /> Adicionar</Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {mode === 'existing' && loadingProducts && <p className="text-sm text-gray-400 text-center py-4">Carregando produtos...</p>}

            {/* Itens com produto cadastrado */}
            {mode === 'existing' && items.map((item, i) => {
              const product = products.find((p) => p._id === item.productId);
              let unitPrice = 0;
              if (product) {
                unitPrice = calcAdHocUnitPrice({
                  calculationMode: product.calculationMode, saleMode: product.saleMode,
                  width: product.technicalData?.measurements?.width, length: product.technicalData?.measurements?.length,
                  thickness: product.technicalData?.measurements?.thickness, density: product.commercialData?.density,
                  factorKg: product.commercialData?.factorKg, basePrice: product.commercialData?.basePrice,
                  unitPrice: product.commercialData?.unitPrice, boxPrice: product.commercialData?.boxPrice,
                  unitsPerBox: product.technicalData?.unitsPerBox,
                });
              }
              const subtotal = unitPrice * parseNum(item.quantity);
              return (
                <div key={i} className="flex flex-col sm:flex-row gap-3 p-3 bg-[#f5f5ee] rounded-lg">
                  <div className="flex-1">
                    <ProductSearch
                      products={products}
                      selectedProductId={item.productId}
                      onSelect={(id) => updateItem(i, 'productId', id)}
                    />
                    {product && unitPrice > 0 && <p className="text-xs text-gray-400 mt-1">Preço un.: {formatCurrency(unitPrice)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" step="any" placeholder="Qtd" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="w-24 rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]" />
                    {subtotal > 0 && <span className="text-sm font-medium text-[#4b5757] min-w-[80px] text-right">{formatCurrency(subtotal)}</span>}
                    <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}

            {/* Itens ad-hoc com cálculo completo */}
            {mode === 'new' && items.map((item, i) => {
              const up = calcAdHocUnitPrice(item) || parseNum(item.unitPrice);
              const qty = parseNum(item.quantity);
              const subtotal = up * qty;
              return (
                <div key={i} className="p-3 bg-[#f5f5ee] rounded-lg space-y-3 border border-[#e3e3d1]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input label="Nome do Produto *" value={item.name || ''} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                    <Input label="Descrição" value={item.description || ''} onChange={(e) => updateItem(i, 'description', e.target.value)} />
                    <div>
                      <label className="text-sm font-medium text-[#4b5757] mb-1 block">Modo de Venda</label>
                      <select value={item.saleMode || 'thousand'} onChange={(e) => updateItem(i, 'saleMode', e.target.value)} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d]">
                        <option value="kg">Kg</option><option value="thousand">Milheiro</option><option value="unit">Unidade</option><option value="box">Caixa</option><option value="linear_meter">Metro Linear</option>
                      </select>
                    </div>
                  </div>
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

                  {(item.calculationMode || 'dimensions_density_factor') === 'dimensions_density_factor' && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <Input label="Largura" type="number" step="any" value={item.width || ''} onChange={(e) => updateItem(i, 'width', e.target.value)} />
                      <Input label="Comprimento" type="number" step="any" value={item.length || ''} onChange={(e) => updateItem(i, 'length', e.target.value)} />
                      <Input label="Espessura" type="number" step="any" value={item.thickness || ''} onChange={(e) => updateItem(i, 'thickness', e.target.value)} />
                      <Input label="Sanfona" type="number" step="any" value={item.gusset || ''} onChange={(e) => updateItem(i, 'gusset', e.target.value)} />
                      <Input label="Material" value={item.material || ''} onChange={(e) => updateItem(i, 'material', e.target.value)} placeholder="Ex: PEAD" />
                      <Input label="Densidade" type="number" step="any" value={item.density || ''} onChange={(e) => updateItem(i, 'density', e.target.value)} />
                      <Input label="Fator Kg (R$)" type="number" step="any" value={item.factorKg || ''} onChange={(e) => updateItem(i, 'factorKg', e.target.value)} />
                    </div>
                  )}
                  {item.calculationMode === 'weight_times_price_per_kg' && <Input label="Preço Base (R$/kg)" type="number" step="any" value={item.basePrice || ''} onChange={(e) => updateItem(i, 'basePrice', e.target.value)} />}
                  {(item.calculationMode === 'quantity_times_unit_price' || item.calculationMode === 'manual_price') && <Input label="Preço Unitário (R$)" type="number" step="any" value={item.unitPrice || ''} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} />}
                  {item.calculationMode === 'boxes_times_box_price' && <Input label="Preço por Caixa (R$)" type="number" step="any" value={item.boxPrice || ''} onChange={(e) => updateItem(i, 'boxPrice', e.target.value)} />}
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

                  <div className="flex items-center justify-between pt-2 border-t border-[#e3e3d1]">
                    <div className="text-xs text-gray-400">{up > 0 ? `Preço unitário: ${formatCurrency(up)}` : 'Preencha os campos para calcular'}</div>
                    <div className="flex items-center gap-3">
                      {subtotal > 0 && <span className="text-sm font-semibold text-[#4b5757]">{formatCurrency(subtotal)}</span>}
                      <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Subtotal */}
            {items.length > 0 && totalEstimado > 0 && (
              <div className="flex justify-end pt-2 border-t border-[#e3e3d1]">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Subtotal estimado (s/ IPI)</p>
                  <p className="text-lg font-bold text-[#4b5757]">{formatCurrency(totalEstimado)}</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Fornecedor para ad-hoc */}
        {mode === 'new' && items.length > 0 && (
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

        {/* Observações */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody>
            <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={5} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] resize-none" />
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
