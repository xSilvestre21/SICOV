import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, FileText, Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function QuotationsListPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [quotations, setQuotations] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get('page') || 1);
  const search = searchParams.get('search') || '';

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;

      const { data } = await api.get('/quotations', { params });
      setQuotations(data.quotations || []);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

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
          <h1 className="text-2xl font-bold text-[#4b5757]">Orçamentos</h1>
          <p className="text-sm text-[#7c8a6e]">{total} orçamento{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/quotations/new">
          <Button size="md"><Plus size={16} /> Novo Orçamento</Button>
        </Link>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="search"
              defaultValue={search}
              placeholder="Buscar por cliente, fornecedor..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
            />
          </div>
          <Button type="submit" variant="secondary" size="md"><Search size={14} /></Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : quotations.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum orçamento encontrado.</div>
        ) : (
          <div className="divide-y divide-[#e3e3d1]">
            {quotations.map((q) => (
              <Link
                key={q._id}
                to={`/quotations/${q._id}`}
                className="flex items-center justify-between px-4 md:px-6 py-4 hover:bg-[#f5f5ee] transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#e3e3d1] flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-[#7c8a6e]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#4b5757] truncate">
                      {q.clientSnapshot?.tradeName || q.clientSnapshot?.name || 'Orçamento'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {formatDate(q.createdAt)}
                      {q.supplierSnapshot?.name && ` · ${q.supplierSnapshot.tradeName || q.supplierSnapshot.name}`}
                      {isAdmin && q.representativeId?.name && ` · ${q.representativeId.name}`}
                      {q.items?.length > 0 && ` · ${q.items.length} ite${q.items.length > 1 ? 'ns' : 'm'}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-[#4b5757] shrink-0">
                  {formatCurrency(q.total)}
                </span>
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
