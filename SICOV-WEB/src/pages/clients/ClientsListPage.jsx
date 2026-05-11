import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, Phone, Mail } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

function formatCnpj(v) {
  if (!v) return '—';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return v;
}

function formatPhone(v) {
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return v;
}

export function ClientsListPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get('page') || 1);
  const search = searchParams.get('search') || '';
  const active = searchParams.get('active') || '';

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (active) params.active = active;

      const { data } = await api.get('/clients', { params });
      setClients(data.clients);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [page, search, active]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

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

  const handleActiveFilter = (v) => {
    const params = new URLSearchParams(searchParams);
    if (v) params.set('active', v);
    else params.delete('active');
    params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Clientes</h1>
          <p className="text-sm text-[#7c8a6e]">{total} cliente{total !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <Link to="/clients/new">
            <Button size="md">
              <Plus size={16} />
              Novo Cliente
            </Button>
          </Link>
        )}
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="search"
                defaultValue={search}
                placeholder="Buscar por nome, CNPJ, cidade..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] outline-none"
              />
            </div>
            <Button type="submit" variant="secondary" size="md">
              <Search size={14} />
            </Button>
          </form>

          <div className="flex gap-2">
            {['', 'true', 'false'].map((v) => (
              <button
                key={v}
                onClick={() => handleActiveFilter(v)}
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
        </div>
      </Card>

      {/* Lista */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum cliente encontrado.</div>
        ) : (
          <div className="divide-y divide-[#e3e3d1]">
            {clients.map((client) => (
              <Link
                key={client._id}
                to={`/clients/${client._id}`}
                className="flex items-center justify-between px-4 md:px-6 py-4 hover:bg-[#f5f5ee] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#e3e3d1] flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#4b5757]">
                      {client.name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#4b5757] truncate">
                      {client.tradeName || client.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">{formatCnpj(client.cnpj)}</span>
                      {client.city && (
                        <span className="text-xs text-gray-400">
                          {client.city}{client.state ? `/${client.state}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-2">
                  {client.phone && (
                    <span className="hidden lg:flex items-center gap-1 text-xs text-gray-400">
                      <Phone size={12} />
                      {formatPhone(client.phone)}
                    </span>
                  )}
                  <Badge variant={client.active ? 'active' : 'inactive'}>
                    {client.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Paginação */}
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
