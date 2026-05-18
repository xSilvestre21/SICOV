import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../lib/api';

const productTypes = [
  { value: 'plastic_bag', label: 'Saco Plástico' },
  { value: 'tape', label: 'Fita' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'shrink', label: 'Shrink' },
  { value: 'bobbin', label: 'Bobina' },
  { value: 'custom', label: 'Personalizado' },
];

const saleModes = [
  { value: 'kg', label: 'Kg' },
  { value: 'thousand', label: 'Milheiro' },
  { value: 'unit', label: 'Unidade' },
  { value: 'box', label: 'Caixa' },
  { value: 'linear_meter', label: 'Metro Linear' },
  { value: 'manual', label: 'Manual' },
];

const calculationModes = [
  { value: 'weight_times_price_per_kg', label: 'Peso × Preço/Kg' },
  { value: 'quantity_times_unit_price', label: 'Quantidade × Preço Unitário' },
  { value: 'boxes_times_box_price', label: 'Caixas × Preço/Caixa' },
  { value: 'boxes_times_units_per_box_times_unit_price', label: 'Caixas × Un/Caixa × Preço Unitário' },
  { value: 'dimensions_density_factor', label: 'Dimensões × Densidade × Fator' },
  { value: 'manual_price', label: 'Preço Manual' },
];

const chargeTypes = [
  { value: 'per_kg', label: 'Por Kg' },
  { value: 'per_thousand', label: 'Por Milheiro' },
  { value: 'per_unit', label: 'Por Unidade' },
  { value: 'per_box', label: 'Por Caixa' },
  { value: 'per_linear_meter', label: 'Por Metro Linear' },
  { value: 'fixed', label: 'Fixo' },
];

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    clientId: '', supplierId: '', supplierCode: '', clientCode: '',
    name: '', description: '', productType: 'custom', material: '',
    saleMode: 'kg', calculationMode: 'weight_times_price_per_kg', unitLabel: '', notes: '',
    width: '', length: '', thickness: '', gusset: '', height: '', diameter: '', weight: '',
    unitsPerBox: '', basePrice: '', density: '', factorKg: '', unitPrice: '', boxPrice: '',
    selectedExtras: [],
  });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/clients', { params: { active: 'true', limit: 200 } }),
      api.get('/suppliers', { params: { active: 'true', limit: 200 } }),
    ]).then(([cRes, sRes]) => {
      setClients(cRes.data.clients || []);
      setSuppliers(sRes.data.suppliers || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/products/${id}`)
      .then(({ data: p }) => {
        const m = p.technicalData?.measurements || {};
        const cd = p.commercialData || {};
        setForm({
          clientId: p.clientId?._id || p.clientId || '',
          supplierId: p.supplierId?._id || p.supplierId || '',
          supplierCode: p.supplierCode || '', clientCode: p.clientCode || '',
          name: p.name || '', description: p.description || '',
          productType: p.productType || 'custom', material: p.material || '',
          saleMode: p.saleMode || 'kg', calculationMode: p.calculationMode || 'weight_times_price_per_kg',
          unitLabel: p.unitLabel || '', notes: p.notes || '',
          width: m.width ?? '', length: m.length ?? '', thickness: m.thickness ?? '',
          gusset: m.gusset ?? '', height: m.height ?? '', diameter: m.diameter ?? '', weight: m.weight ?? '',
          unitsPerBox: p.technicalData?.unitsPerBox ?? '',
          basePrice: cd.basePrice ?? '', density: cd.density ?? '',
          factorKg: cd.factorKg ?? '', unitPrice: cd.unitPrice ?? '', boxPrice: cd.boxPrice ?? '',
          selectedExtras: p.selectedExtras || [],
        });
      })
      .catch(() => navigate('/products'))
      .finally(() => setLoadingData(false));
  }, [id, isEdit, navigate]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const selectedSupplier = suppliers.find((s) => s._id === form.supplierId);

  const setMaterial = (e) => {
    const material = e.target.value;
    setForm((f) => {
      const updated = { ...f, material };
      // Preenche densidade automaticamente a partir da tabela do fornecedor
      if (selectedSupplier?.priceTable?.length && material) {
        const match = selectedSupplier.priceTable.find(
          (item) => item.material.toLowerCase() === material.toLowerCase()
        );
        if (match?.density && !f.density) {
          updated.density = match.density;
        }
      }
      return updated;
    });
  };

  // Obtém dicas de fator kg da tabela de preços do fornecedor selecionado
  const supplierHint = (() => {
    if (!selectedSupplier?.priceTable?.length || !form.material) return {};
    const match = selectedSupplier.priceTable.find(
      (item) => item.material.toLowerCase() === form.material.toLowerCase()
    );
    if (!match) return {};
    return {
      density: match.density,
      factorKg: match.factorKg,
    };
  })();

  // Gera o nome do produto automaticamente: LARGURAxCOMPRIMENTOxESPESSURA SF SANFONA MATERIAL
  useEffect(() => {
    if (form.calculationMode !== 'dimensions_density_factor' && form.productType !== 'plastic_bag') return;
    const fmt = (v) => String(v).replace('.', ',');
    const parts = [];
    if (form.width && form.length && form.thickness) {
      parts.push(`${fmt(form.width)}x${fmt(form.length)}x${fmt(form.thickness)}`);
    }
    if (form.gusset) {
      parts.push(`SF ${fmt(form.gusset)}`);
    }
    if (form.material) {
      parts.push(form.material.toUpperCase());
    }
    if (parts.length > 0) {
      setForm((f) => ({ ...f, name: parts.join(' ') }));
    }
  }, [form.width, form.length, form.thickness, form.gusset, form.material, form.calculationMode, form.productType]);

  const addExtra = () => setForm((f) => ({ ...f, selectedExtras: [...f.selectedExtras, { name: '', chargeType: 'per_kg', value: '', source: 'manual', notes: '' }] }));
  const removeExtra = (i) => setForm((f) => ({ ...f, selectedExtras: f.selectedExtras.filter((_, idx) => idx !== i) }));
  const updateExtra = (i, field, value) => setForm((f) => ({ ...f, selectedExtras: f.selectedExtras.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.clientId || !form.supplierId || !form.name) return setError('Cliente, fornecedor e nome são obrigatórios.');

    setLoading(true);
    try {
      const payload = {
        clientId: form.clientId, supplierId: form.supplierId,
        supplierCode: form.supplierCode || undefined, clientCode: form.clientCode || undefined,
        name: form.name, description: form.description || undefined,
        productType: form.productType, material: form.material || undefined,
        saleMode: form.saleMode, calculationMode: form.calculationMode,
        unitLabel: form.unitLabel || undefined, notes: form.notes || undefined,
        technicalData: {
          measurements: {
            ...(form.width !== '' && { width: form.width }),
            ...(form.length !== '' && { length: form.length }),
            ...(form.thickness !== '' && { thickness: form.thickness }),
            ...(form.gusset !== '' && { gusset: form.gusset }),
            ...(form.height !== '' && { height: form.height }),
            ...(form.diameter !== '' && { diameter: form.diameter }),
            ...(form.weight !== '' && { weight: form.weight }),
          },
          ...(form.unitsPerBox !== '' && { unitsPerBox: form.unitsPerBox }),
        },
        commercialData: {
          ...(form.basePrice !== '' && { basePrice: form.basePrice }),
          ...(form.density !== '' && { density: form.density }),
          ...(form.factorKg !== '' && { factorKg: form.factorKg }),
          ...(form.unitPrice !== '' && { unitPrice: form.unitPrice }),
          ...(form.boxPrice !== '' && { boxPrice: form.boxPrice }),
        },
        selectedExtras: form.selectedExtras.filter((ex) => ex.name && ex.value),
      };

      if (isEdit) {
        await api.put(`/products/${id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar produto.');
    } finally { setLoading(false); }
  };

  if (loadingData) return <div className="text-center py-12 text-gray-400">Carregando...</div>;

  const showPlasticBag = form.productType === 'plastic_bag';
  const showTape = form.productType === 'tape';

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#58706d] hover:text-[#4b5757]"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold text-[#4b5757]">{isEdit ? 'Editar Produto' : 'Novo Produto'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Vínculos */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Vínculos</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#4b5757] mb-1 block">Cliente *</label>
              <select value={form.clientId} onChange={set('clientId')} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]">
                <option value="">Selecione...</option>
                {clients.map((c) => <option key={c._id} value={c._id}>{c.tradeName || c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#4b5757] mb-1 block">Fornecedor *</label>
              <select value={form.supplierId} onChange={set('supplierId')} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]">
                <option value="">Selecione...</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.tradeName || s.name}</option>)}
              </select>
            </div>
          </CardBody>
        </Card>

        {/* Dados básicos */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados do Produto</h2></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome *" value={form.name} onChange={set('name')} required />
            <Input label="Descrição" value={form.description} onChange={set('description')} />
            <div>
              <label className="text-sm font-medium text-[#4b5757] mb-1 block">Tipo</label>
              <select value={form.productType} onChange={set('productType')} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]">
                {productTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#4b5757] mb-1 block">Modo de Venda</label>
              <select value={form.saleMode} onChange={set('saleMode')} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]">
                {saleModes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#4b5757] mb-1 block">Modo de Cálculo</label>
              <select value={form.calculationMode} onChange={set('calculationMode')} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]">
                {calculationModes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {(showPlasticBag || form.calculationMode === 'dimensions_density_factor') && (
              selectedSupplier?.priceTable?.length > 0 ? (
                <div>
                  <label className="text-sm font-medium text-[#4b5757] mb-1 block">Material *</label>
                  <select value={form.material} onChange={setMaterial} className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]">
                    <option value="">Selecione o material...</option>
                    {selectedSupplier.priceTable.map((item, idx) => (
                      <option key={idx} value={item.material}>{item.material}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <Input label="Material *" value={form.material} onChange={setMaterial} placeholder="Ex: PEAD, PEBD" />
              )
            )}
            <Input label="Unidade (label)" value={form.unitLabel} onChange={set('unitLabel')} placeholder="Ex: KG, UN, CX" />
            <Input label="Cód. Fornecedor" value={form.supplierCode} onChange={set('supplierCode')} />
            <Input label="Cód. Cliente" value={form.clientCode} onChange={set('clientCode')} />
          </CardBody>
        </Card>

        {/* Medidas */}
        {(showPlasticBag || showTape || form.productType === 'bobbin' || form.calculationMode === 'dimensions_density_factor') && (
          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Medidas</h2></CardHeader>
            <CardBody className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Largura" type="number" step="any" value={form.width} onChange={set('width')} />
              <Input label="Comprimento" type="number" step="any" value={form.length} onChange={set('length')} />
              <Input label="Espessura" type="number" step="any" value={form.thickness} onChange={set('thickness')} />
              <Input label="Sanfona" type="number" step="any" value={form.gusset} onChange={set('gusset')} />
              {showTape && <Input label="Un/Caixa" type="number" step="1" value={form.unitsPerBox} onChange={set('unitsPerBox')} />}
            </CardBody>
          </Card>
        )}

        {/* Dados comerciais */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados Comerciais</h2></CardHeader>
          <CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {form.calculationMode === 'weight_times_price_per_kg' && (
              <Input label="Preço Base (R$/kg)" type="number" step="any" value={form.basePrice} onChange={set('basePrice')} />
            )}
            {form.calculationMode === 'quantity_times_unit_price' && (
              <Input label="Preço Unitário" type="number" step="any" value={form.unitPrice} onChange={set('unitPrice')} />
            )}
            {form.calculationMode === 'boxes_times_box_price' && (
              <>
                <Input label="Preço Caixa" type="number" step="any" value={form.boxPrice} onChange={set('boxPrice')} />
                <Input label="Un/Caixa" type="number" step="1" value={form.unitsPerBox} onChange={set('unitsPerBox')} />
              </>
            )}
            {form.calculationMode === 'boxes_times_units_per_box_times_unit_price' && (
              <>
                <Input label="Preço Unitário" type="number" step="any" value={form.unitPrice} onChange={set('unitPrice')} />
                <Input label="Un/Caixa" type="number" step="1" value={form.unitsPerBox} onChange={set('unitsPerBox')} />
              </>
            )}
            {form.calculationMode === 'dimensions_density_factor' && (
              <>
                <div>
                  <label className="text-sm font-medium text-[#4b5757] mb-1 block">Preço Base (R$/kg)</label>
                  <input
                    type="text"
                    value={form._basePriceFocused
                      ? (form._basePriceRaw ?? '')
                      : (form.basePrice !== '' ? Number(form.basePrice).toLocaleString('pt-BR') : '')
                    }
                    onFocus={() => setForm((f) => ({ ...f, _basePriceFocused: true, _basePriceRaw: f.basePrice !== '' ? Number(f.basePrice).toLocaleString('pt-BR') : '' }))}
                    onBlur={() => setForm((f) => {
                      const raw = (f._basePriceRaw || '');
                      const cleaned = raw.replace(/\./g, '').replace(',', '.');
                      const num = parseFloat(cleaned);
                      return { ...f, _basePriceFocused: false, _basePriceRaw: undefined, basePrice: isNaN(num) ? '' : num };
                    })}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const cleaned = raw.replace(/\./g, '').replace(',', '.');
                      const num = parseFloat(cleaned);
                      const basePrice = isNaN(num) ? '' : num;
                      setForm((f) => {
                        const updated = { ...f, _basePriceRaw: raw, basePrice };
                        const w = Number(f.width) || 0;
                        const l = Number(f.length) || 0;
                        const t = Number(f.thickness) || 0;
                        const d = Number(f.density) || 0;
                        const bp = Number(basePrice) || 0;
                        if (w && l && t && d && bp) {
                          updated.factorKg = parseFloat((bp / (w * l * t * d)).toFixed(6));
                        }
                        return updated;
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
                    placeholder="0"
                  />
                </div>
                <Input label="Densidade" type="number" step="any" value={form.density} onChange={set('density')} placeholder={supplierHint.density ? `Fornecedor: ${Number(supplierHint.density).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}` : ''} />
                <Input label="Fator Kg" type="number" step="any" value={form.factorKg} onChange={(e) => {
                  const factorKg = e.target.value;
                  setForm((f) => {
                    const updated = { ...f, factorKg };
                    const w = Number(f.width) || 0;
                    const l = Number(f.length) || 0;
                    const t = Number(f.thickness) || 0;
                    const d = Number(f.density) || 0;
                    const fk = Number(factorKg) || 0;
                    if (w && l && t && d && fk) {
                      updated.basePrice = parseFloat((w * l * t * d * fk).toFixed(4));
                    }
                    return updated;
                  });
                }} placeholder={supplierHint.factorKg ? `Fornecedor: ${supplierHint.factorKg}` : ''} />
              </>
            )}
            {form.calculationMode === 'manual_price' && (
              <Input label="Preço Manual" type="number" step="any" value={form.unitPrice} onChange={set('unitPrice')} />
            )}
          </CardBody>
        </Card>

        {/* Extras */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Extras</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addExtra}><Plus size={14} /> Adicionar</Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {form.selectedExtras.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Nenhum extra adicionado.</p>}
            {form.selectedExtras.map((extra, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2 p-3 bg-[#f5f5ee] rounded-lg">
                <input value={extra.name} onChange={(e) => updateExtra(i, 'name', e.target.value)} placeholder="Nome" className="flex-1 rounded-lg border border-[#b0b087] px-3 py-1.5 text-sm outline-none focus:border-[#58706d]" />
                <select value={extra.chargeType} onChange={(e) => updateExtra(i, 'chargeType', e.target.value)} className="rounded-lg border border-[#b0b087] px-2 py-1.5 text-sm outline-none focus:border-[#58706d]">
                  {chargeTypes.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                </select>
                <input type="number" step="any" value={extra.value} onChange={(e) => updateExtra(i, 'value', e.target.value)} placeholder="Valor" className="w-24 rounded-lg border border-[#b0b087] px-3 py-1.5 text-sm outline-none focus:border-[#58706d]" />
                <button type="button" onClick={() => removeExtra(i)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Observações</h2></CardHeader>
          <CardBody>
            <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Observações (opcional)" className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] resize-none" />
          </CardBody>
        </Card>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={loading}><Save size={16} /> {isEdit ? 'Salvar' : 'Criar Produto'}</Button>
        </div>
      </form>
    </div>
  );
}
