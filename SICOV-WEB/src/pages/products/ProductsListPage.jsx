import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

const typeLabels = {
  plastic_bag: 'Saco Plástico',
  tape: 'Fita',
  stretch: 'Stretch',
  shrink: 'Shrink',
  bobbin: 'Bobina',
  custom: 'Personalizado',
};

export function ProductsListPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get('page') || 1);
  const search = searchParams.get('search') || '';
  const active = searchParams.get('active') || '';
  const clientId = searchParams.get('clientId') || '';

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (active) params.active = active;
      if (clientId) params.clientId = clientId;

      const { data } = await api.get('/products', { params });
      setProducts(data.products || []);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [page, search, active, clientId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const setPage = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', p);
    setSearchParams(params);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const params = new URLSearchParams(searchParams);
    params.set('search', formData.get('search'));
    params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Produtos</h1>
          <p className="text-sm text-[#7c8a6e]">{total} produto{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/products/new">
          <Button size="md"><Plus size={16} /> Novo Produto</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="search"
                defaultValue={search}
                placeholder="Buscar por nome, material, código..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
              />
            </div>
            <Button type="submit" variant="secondary" size="md"><Search size={14} /></Button>
          </form>
          {isAdmin && (
            <div className="flex gap-2">
              {['', 'true', 'false'].map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    if (v) params.set('active', v); else params.delete('active');
                    params.set('page', '1');
                    setSearchParams(params);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    active === v
                      ? 'bg-[#58706d] text-white border-[#58706d]'
                      : 'bg-white text-[#4b5757] border-[#e3e3d1] hover:border-[#58706d]'
                  }`}
                >
                  {v === '' ? 'Todos' : v === 'true' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum produto encontrado.</div>
        ) : (
          <div className="divide-y divide-[#e3e3d1]">
            {products.map((product) => (
              <Link
                key={product._id}
                to={`/products/${product._id}`}
                className="flex items-center justify-between px-4 md:px-6 py-4 hover:bg-[#f5f5ee] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#e3e3d1] flex items-center justify-center shrink-0">
                    <Package size={18} className="text-[#7c8a6e]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#4b5757] truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {typeLabels[product.productType] || product.productType}
                      </span>
                      {product.material && (
                        <span className="text-xs text-gray-400">· {product.material}</span>
                      )}
                      {product.clientId?.name && (
                        <span className="text-xs text-[#7c8a6e]">· {product.clientId.tradeName || product.clientId.name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {product.supplierCode && (
                    <span className="hidden sm:block text-xs text-gray-400">{product.supplierCode}</span>
                  )}
                  <Badge variant={product.active ? 'active' : 'inactive'}>
                    {product.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-[#4b5757]">Página {page} de {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
