import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  // Ao montar, verifica se há bloqueio salvo no localStorage
  useEffect(() => {
    const blockedUntil = localStorage.getItem('sicov_blocked_until');
    if (blockedUntil) {
      const remaining = Math.floor((Number(blockedUntil) - Date.now()) / 1000);
      if (remaining > 0) {
        setBlocked(true);
        setCountdown(remaining);
        setError('Conta bloqueada temporariamente.');
      } else {
        localStorage.removeItem('sicov_blocked_until');
      }
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setBlocked(false);
      localStorage.removeItem('sicov_blocked_until');
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setBlocked(false);
          setError('');
          localStorage.removeItem('sicov_blocked_until');
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [blocked]);

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (blocked) return;
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Erro ao fazer login.';

      if (status === 429) {
        // Bloqueado pelo rate limiter — salva no localStorage para persistir entre reloads
        const blockedUntil = Date.now() + 15 * 60 * 1000;
        localStorage.setItem('sicov_blocked_until', String(blockedUntil));
        setBlocked(true);
        setCountdown(15 * 60); // 15 minutos
        setError('Conta bloqueada temporariamente.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5ee] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#58706d] flex items-center justify-center mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-2xl font-bold text-[#4b5757]">SICOV</h1>
          <p className="text-sm text-[#7c8a6e] mt-1">Gerenciador de Vendas</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#e3e3d1] shadow-sm p-8">
          <h2 className="text-lg font-semibold text-[#4b5757] mb-6">Entrar na conta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              autoFocus
              disabled={blocked}
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              disabled={blocked}
            />

            {error && (
              <div className={`rounded-lg px-3 py-2 ${blocked ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm ${blocked ? 'text-amber-700' : 'text-red-600'}`}>{error}</p>
                {blocked && countdown > 0 && (
                  <p className="text-lg font-bold text-amber-800 mt-1 text-center">
                    {formatTime(countdown)}
                  </p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full mt-2" loading={loading} disabled={blocked}>
              {blocked ? 'Aguarde...' : 'Entrar'}
            </Button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-xs text-[#7c8a6e] hover:text-[#58706d] hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-[#7c8a6e] mt-6">
          © {new Date().getFullYear()} SICOV · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
