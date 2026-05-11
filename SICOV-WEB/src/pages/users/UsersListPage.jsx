import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Power, Edit, Trash2, Users } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import api from '../../lib/api';

export function UsersListPage() {
  const [representatives, setRepresentatives] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReps = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/representatives');
      setRepresentatives(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchReps(); }, []);

  const handleToggle = async (id) => {
    try {
      await api.patch(`/users/representatives/${id}/toggle-active`);
      fetchReps();
    } catch (err) { alert(err.response?.data?.message || 'Erro.'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Excluir o representante "${name}"?`)) return;
    try {
      await api.delete(`/users/representatives/${id}`);
      fetchReps();
    } catch (err) { alert(err.response?.data?.message || 'Erro.'); }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Representantes</h1>
          <p className="text-sm text-[#7c8a6e]">{representatives.length} representante{representatives.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/users/new"><Button size="md"><Plus size={16} /> Novo Representante</Button></Link>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-gray-400">Carregando...</div> : representatives.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">Nenhum representante cadastrado.</div> : (
          <div className="divide-y divide-[#e3e3d1]">
            {representatives.map((rep) => (
              <div key={rep._id} className="flex items-center justify-between px-4 md:px-6 py-4 hover:bg-[#f5f5ee] transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#7c8a6e] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{rep.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#4b5757] truncate">{rep.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{rep.email}</span>
                      {rep.defaultCommissionPercentage > 0 && (
                        <span className="text-xs text-[#7c8a6e]">· {rep.defaultCommissionPercentage}% comissão</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge variant={rep.active ? 'active' : 'inactive'}>{rep.active ? 'Ativo' : 'Inativo'}</Badge>
                  <Link to={`/users/${rep._id}/edit`}>
                    <button className="p-1.5 text-gray-400 hover:text-[#58706d] rounded-lg hover:bg-[#e3e3d1] transition-colors"><Edit size={14} /></button>
                  </Link>
                  <button onClick={() => handleToggle(rep._id)} className="p-1.5 text-gray-400 hover:text-[#58706d] rounded-lg hover:bg-[#e3e3d1] transition-colors"><Power size={14} /></button>
                  <button onClick={() => handleDelete(rep._id, rep.name)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
