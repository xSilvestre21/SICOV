import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { formatSaleMode } from '../../utils/formatSaleMode';

export function ProductSearch({ products, selectedProductId, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = products.find((p) => p._id === selectedProductId);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 30);
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.supplierCode || '').toLowerCase().includes(q) ||
        (p.clientCode || '').toLowerCase().includes(q),
    ).slice(0, 30);
  }, [products, query]);

  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-[#e3e3d1]">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#4b5757] truncate">
            {selected.name} {selected.description ? `— ${selected.description}` : ''} ({formatSaleMode(selected.unitLabel || selected.saleMode)})
          </p>
          <p className="text-xs text-gray-400">
            {selected.supplierId?.tradeName || selected.supplierId?.name || ''}
            {selected.supplierCode ? ` · Cód: ${selected.supplierCode}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { onSelect(''); setQuery(''); }}
          className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar produto por nome, descrição, código..."
          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
        />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#e3e3d1] rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">Nenhum produto encontrado.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => { onSelect(p._id); setQuery(''); setOpen(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#f5f5ee] transition-colors border-b border-[#e3e3d1] last:border-b-0"
                >
                  <p className="text-sm font-medium text-[#4b5757]">
                    {p.name} {p.description ? `— ${p.description}` : ''} ({formatSaleMode(p.unitLabel || p.saleMode)})
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.supplierId?.tradeName || p.supplierId?.name || ''}
                    {p.supplierCode ? ` · Cód: ${p.supplierCode}` : ''}
                    {p.clientCode ? ` · Cli: ${p.clientCode}` : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
