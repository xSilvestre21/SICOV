import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { DashboardFilterProvider } from '../../contexts/DashboardFilterContext';
import { GlobalFilters } from '../../components/dashboard/GlobalFilters';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ClientsRevenueChart } from './charts/ClientsRevenueChart';
import { CommissionsOverviewChart } from './charts/CommissionsOverviewChart';
import { CommissionsVariationChart } from './charts/CommissionsVariationChart';
import { RepresentativesPerformanceChart } from './charts/RepresentativesPerformanceChart';
import { TopClientsChart } from './charts/TopClientsChart';
import { CancelledOrdersChart } from './charts/CancelledOrdersChart';
import { SuppliersComparisonChart } from './charts/SuppliersComparisonChart';
import { ClientIndividualView } from './charts/ClientIndividualView';
import api from '../../lib/api';

function ClientSelector({ onSelect, selectedClientId, onClear }) {
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    if (query.length < 2) {
      setClients([]);
      setOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/clients', {
          params: { active: 'true', limit: 20, search: query },
        });
        setClients(data.clients || []);
        setOpen(true);
      } catch {
        setClients([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  function handleSelect(client) {
    onSelect(client);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {selectedClientId ? (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-[#58706d] text-white rounded-lg hover:bg-[#4b5757] transition-colors"
          >
            <X size={14} />
            Limpar seleção
          </button>
        ) : null}
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c8a6e]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente para visão individual..."
            className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none transition-colors focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] ${
              isDark
                ? 'bg-[#1e2322] border-[#3d4543] text-[#d4e4d1] placeholder:text-[#6b8a6e]'
                : 'bg-white border-[#b0b087] text-[#4b5757] placeholder:text-gray-400'
            }`}
          />
        </div>
      </div>

      {open && clients.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-w-xs bg-white border border-[#e3e3d1] rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {clients.map((client) => (
            <button
              key={client._id}
              onClick={() => handleSelect(client)}
              className="w-full text-left px-4 py-2 text-sm text-[#4b5757] hover:bg-[#f5f5ee] transition-colors"
            >
              {client.tradeName || client.name}
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && clients.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full max-w-xs bg-white border border-[#e3e3d1] rounded-lg shadow-lg px-4 py-3">
          <p className="text-sm text-[#7c8a6e]">Nenhum cliente encontrado</p>
        </div>
      )}
    </div>
  );
}

function DashboardContent() {
  const { isAdmin } = useAuth();
  const { isDark } = useTheme();
  const [selectedClient, setSelectedClient] = useState(null);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className={`text-2xl font-bold ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>Dashboard</h1>
        <p className={`text-sm mt-1 ${isDark ? 'text-[#9cb3a0]' : 'text-[#7c8a6e]'}`}>
          Visualizações e indicadores do sistema
        </p>
      </div>

      {/* Global filters */}
      <GlobalFilters />

      {/* Client selector */}
      <ClientSelector
        selectedClientId={selectedClient?._id}
        onSelect={(client) => setSelectedClient(client)}
        onClear={() => setSelectedClient(null)}
      />

      {/* Client individual view (when a client is selected) */}
      {selectedClient && (
        <ClientIndividualView clientId={selectedClient._id} />
      )}

      {/* Charts grid: 2 columns on md+, 1 column on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ClientsRevenueChart />
        <CommissionsOverviewChart />

        {/* CommissionsVariationChart: hidden for representatives (shows admin commission data) */}
        {isAdmin && <CommissionsVariationChart />}

        {/* RepresentativesPerformanceChart: hidden for representatives */}
        {isAdmin && <RepresentativesPerformanceChart />}

        <TopClientsChart />
        {isAdmin && <CancelledOrdersChart />}
        {isAdmin && <SuppliersComparisonChart />}
      </div>
    </div>
  );
}

export function DashboardPage() {
  return (
    <DashboardFilterProvider>
      <DashboardContent />
    </DashboardFilterProvider>
  );
}

export default DashboardPage;
