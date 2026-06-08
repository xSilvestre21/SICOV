import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useTheme } from '../../contexts/ThemeContext';
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
  { value: 'pallet', label: 'Palete (Qtd × Peso × Preço/kg)' },
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

function SearchableSelect({ label, items, value, onChange, displayKey, fallbackKey, placeholder }) {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedItem = items.find((item) => item._id === value);
  const displayValue = selectedItem ? (selectedItem[displayKey] || selectedItem[fallbackKey]) : '';

  const filtered = query.length > 0
    ? items.filter((item) => {
        const name = (item[displayKey] || item[fallbackKey] || '').toLowerCase();
        return name.includes(query.toLowerCase());
      })
    : items;

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(item) {
    onChange(item._id);
    setQuery('');
    setOpen(false);
  }

  function handleClear() {
    onChange('');
    setQuery('');
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className={`text-sm font-medium mb-1 block ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>{label}</label>
      {value && !open ? (
        <div
          onClick={() => setOpen(true)}
          className={`w-full rounded-lg border px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
            isDark
              ? 'bg-[#1e2322] border-[#3d4543] text-[#d4e4d1]'
              : 'bg-white border-[#b0b087] text-[#4b5757]'
          }`}
        >
          <span>{displayValue}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'text-[#9cb3a0] hover:text-[#d4e4d1]' : 'text-[#7c8a6e] hover:text-[#4b5757]'}`}
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#6b8a6e]' : 'text-[#7c8a6e]'}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg border outline-none transition-colors focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] ${
              isDark
                ? 'bg-[#1e2322] border-[#3d4543] text-[#d4e4d1] placeholder:text-[#6b8a6e]'
                : 'bg-white border-[#b0b087] text-[#4b5757] placeholder:text-gray-400'
            }`}
          />
        </div>
      )}

      {open && (
        <div className={`absolute z-50 mt-1 w-full rounded-lg shadow-lg max-h-48 overflow-y-auto border ${
          isDark ? 'bg-[#2a2f2e] border-[#3d4543]' : 'bg-white border-[#e3e3d1]'
        }`}>
          {filtered.length === 0 ? (
            <p className={`px-3 py-2 text-sm ${isDark ? 'text-[#6b8a6e]' : 'text-[#7c8a6e]'}`}>Nenhum resultado</p>
          ) : (
            filtered.slice(0, 30).map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => handleSelect(item)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  isDark
                    ? 'text-[#d4e4d1] hover:bg-[#3d4543]'
                    : 'text-[#4b5757] hover:bg-[#f5f5ee]'
                } ${item._id === value ? (isDark ? 'bg-[#58706d]/20' : 'bg-[#e3e3d1]/50') : ''}`}
              >
                {item[displayKey] || item[fallbackKey]}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
    palletQuantity: '', palletWeight: '',
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
          palletQuantity: cd.palletQuantity ?? '', palletWeight: cd.palletWeight ?? '',
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
    const matches = selectedSupplier.priceTable.filter(
      (item) => item.material && item.material.toLowerCase() === form.material.toLowerCase()
    );
    if (matches.length === 0) return {};
    const match = matches[0];
    return {
      density: match.density,
      factorKg: match.factorKg,
      limitFactorKg: match.limitFactorKg,
      hasWeightRanges: matches.some((m) => m.weightFrom != null || m.weightTo != null),
      ranges: matches,
    };
  })();

  // Alerta quando o fator kg está abaixo do limite do fornecedor
  const factorBelowLimit = (() => {
    if (!supplierHint.limitFactorKg || !form.factorKg) return false;
    return Number(form.factorKg) < Number(supplierHint.limitFactorKg);
  })();

  // Gera o nome do produto automaticamente
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    // Não sobrescreve o nome ao carregar dados na edição
    if (isEdit && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }

    // Fitas: "Fitas Adesivas LARGURAxCOMPRIMENTO"
    if (form.productType === 'tape') {
      if (form.width && form.length) {
        const fmt = (v) => String(v).replace('.', ',');
        setForm((f) => ({ ...f, name: `Fitas Adesivas ${fmt(f.width)}x${fmt(f.length)}` }));
      }
      return;
    }

    // Outros: LARGURAxCOMPRIMENTOxESPESSURA SF/S/SF MATERIAL
    if (form.calculationMode !== 'dimensions_density_factor' && form.productType !== 'plastic_bag') return;
    const fmt = (v) => String(v).replace('.', ',');
    const parts = [];
    if (form.width && form.length && form.thickness) {
      parts.push(`${fmt(form.width)}x${fmt(form.length)}x${fmt(form.thickness)}`);
    }
    if (form.gusset) {
      parts.push(`SF ${fmt(form.gusset)}`);
    } else if (form.width && form.length && form.thickness) {
      parts.push('S/SF');
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
          ...(form.palletQuantity !== '' && { palletQuantity: form.palletQuantity }),
          ...(form.palletWeight !== '' && { palletWeight: form.palletWeight }),
        },
        selectedExtras: form.selectedExtras.filter((ex) => ex.name && ex.value),
      };

      if (isEdit) {
        await api.put(`/products/${id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      navigate(-1);
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
            <SearchableSelect
              label="Cliente *"
              items={clients}
              value={form.clientId}
              onChange={(id) => setForm((f) => ({ ...f, clientId: id }))}
              displayKey="tradeName"
              fallbackKey="name"
              placeholder="Buscar cliente..."
            />
            <SearchableSelect
              label="Fornecedor *"
              items={suppliers}
              value={form.supplierId}
              onChange={(id) => setForm((f) => ({ ...f, supplierId: id }))}
              displayKey="tradeName"
              fallbackKey="name"
              placeholder="Buscar fornecedor..."
            />
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
              {!showTape && <Input label="Espessura" type="number" step="any" value={form.thickness} onChange={set('thickness')} />}
              {!showTape && <Input label="Sanfona" type="number" step="any" value={form.gusset} onChange={set('gusset')} />}
              {showTape && <Input label="Un/Caixa" type="number" step="1" value={form.unitsPerBox} onChange={set('unitsPerBox')} />}
            </CardBody>
          </Card>
        )}

        {/* Dados comerciais */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-[#4b5757]">Dados Comerciais</h2></CardHeader>
          <CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {form.calculationMode === 'weight_times_price_per_kg' && (
              <Input label="Preço Base (R$/kg)" type="number" step="any" value={form.basePrice} onChange={set('basePrice')} placeholder={supplierHint.factorKg ? `Dica: R$ ${Number(supplierHint.factorKg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''} />
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
                <Input label="Densidade" type="number" step="any" value={form.density} onChange={set('density')} placeholder={supplierHint.density ? `Dica: ${Number(supplierHint.density).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}` : ''} />
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
                }} placeholder={supplierHint.factorKg ? `Dica: R$ ${Number(supplierHint.factorKg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''} />
                {factorBelowLimit && (
                  <div className="col-span-2 sm:col-span-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    <p className="text-xs text-amber-700">
                      Fator abaixo do limite (R$ {Number(supplierHint.limitFactorKg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Comissão será de apenas 3%.
                    </p>
                  </div>
                )}
                {(() => {
                  const w = Number(form.width) || 0;
                  const l = Number(form.length) || 0;
                  const t = Number(form.thickness) || 0;
                  const d = Number(form.density) || 0;
                  const kgMil = w * l * t * d;
                  if (kgMil > 0) {
                    return (
                      <div className="col-span-2 sm:col-span-3 px-3 py-2 bg-[#e3e3d1]/30 rounded-lg">
                        <p className="text-xs text-[#7c8a6e]">Kg/Mil: <span className="font-semibold text-[#4b5757]">{kgMil.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span></p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}
            {form.calculationMode === 'manual_price' && (
              <Input label="Preço Manual" type="number" step="any" value={form.unitPrice} onChange={set('unitPrice')} />
            )}
            {form.calculationMode === 'pallet' && (
              <>
                <Input label="Qtd por Palete" type="number" step="1" value={form.palletQuantity} onChange={set('palletQuantity')} />
                <Input label="Peso (kg)" type="number" step="any" value={form.palletWeight} onChange={set('palletWeight')} />
                <Input label="Preço/kg (R$)" type="number" step="any" value={form.basePrice} onChange={set('basePrice')} />
              </>
            )}
          </CardBody>
        </Card>

        {/* Extras */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#4b5757]">Extras</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addExtra}><Plus size={14} /> Manual</Button>
          </CardHeader>
          <CardBody className="space-y-4">
            {/* Extras do fornecedor (cards clicáveis) */}
            {selectedSupplier?.extras?.length > 0 && (
              <div>
                <p className="text-xs text-[#7c8a6e] mb-2">Extras do fornecedor (clique para selecionar):</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedSupplier.extras.map((extra, i) => {
                    const isSelected = form.selectedExtras.some(
                      (se) => se.source === 'supplier' && se.name === extra.name && se.chargeType === extra.chargeType
                    );
                    const chargeLabel = { per_kg: '/kg', per_thousand: '/mil', per_unit: '/un', per_box: '/cx', per_linear_meter: '/m', fixed: ' fixo' }[extra.chargeType] || '';
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setForm((f) => ({
                              ...f,
                              selectedExtras: f.selectedExtras.filter(
                                (se) => !(se.source === 'supplier' && se.name === extra.name && se.chargeType === extra.chargeType)
                              ),
                            }));
                          } else {
                            setForm((f) => ({
                              ...f,
                              selectedExtras: [...f.selectedExtras, { name: extra.name, chargeType: extra.chargeType, value: extra.value, source: 'supplier' }],
                            }));
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-[#58706d] bg-[#58706d]/10'
                            : 'border-[#e3e3d1] bg-white hover:border-[#b0b087]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#58706d] bg-[#58706d]' : 'border-[#b0b087]'
                        }`}>
                          {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#4b5757] truncate">{extra.name}</p>
                          <p className="text-xs text-[#7c8a6e]">R$ {Number(extra.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{chargeLabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Extras manuais */}
            {form.selectedExtras.filter((e) => e.source !== 'supplier').length > 0 && (
              <div>
                <p className="text-xs text-[#7c8a6e] mb-2">Extras manuais:</p>
                {form.selectedExtras.map((extra, i) => {
                  if (extra.source === 'supplier') return null;
                  return (
                    <div key={i} className="flex flex-col sm:flex-row gap-2 p-3 bg-[#f5f5ee] rounded-lg mb-2">
                      <input value={extra.name} onChange={(e) => updateExtra(i, 'name', e.target.value)} placeholder="Nome" className="flex-1 rounded-lg border border-[#b0b087] px-3 py-1.5 text-sm outline-none focus:border-[#58706d]" />
                      <select value={extra.chargeType} onChange={(e) => updateExtra(i, 'chargeType', e.target.value)} className="rounded-lg border border-[#b0b087] px-2 py-1.5 text-sm outline-none focus:border-[#58706d]">
                        {chargeTypes.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                      </select>
                      <input type="number" step="any" value={extra.value} onChange={(e) => updateExtra(i, 'value', e.target.value)} placeholder="Valor" className="w-24 rounded-lg border border-[#b0b087] px-3 py-1.5 text-sm outline-none focus:border-[#58706d]" />
                      <button type="button" onClick={() => removeExtra(i)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  );
                })}
              </div>
            )}

            {form.selectedExtras.length === 0 && !selectedSupplier?.extras?.length && (
              <p className="text-sm text-gray-400 text-center py-2">Nenhum extra disponível. Adicione manualmente ou cadastre extras no fornecedor.</p>
            )}
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
