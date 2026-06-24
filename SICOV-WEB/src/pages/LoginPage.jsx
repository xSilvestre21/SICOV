import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

/** Retorna a chave do localStorage para tentativas de um email */
function attemptsKey(email) {
  return `sicov_attempts_${email.toLowerCase().trim()}`;
}

/** Retorna a chave do localStorage para bloqueio de um email */
function blockKey(email) {
  return `sicov_blocked_${email.toLowerCase().trim()}`;
}

/** Retorna dados de tentativas do localStorage */
function getAttempts(email) {
  try {
    const raw = localStorage.getItem(attemptsKey(email));
    if (!raw) return 0;
    return Number(raw);
  } catch { return 0; }
}

/** Retorna timestamp de bloqueio (ou null se não bloqueado) */
function getBlockedUntil(email) {
  try {
    const raw = localStorage.getItem(blockKey(email));
    if (!raw) return null;
    const until = Number(raw);
    if (Date.now() >= until) {
      // Expirou — limpa
      localStorage.removeItem(blockKey(email));
      localStorage.removeItem(attemptsKey(email));
      return null;
    }
    return until;
  } catch { return null; }
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const timerRef = useRef(null);

  // Verifica bloqueio ao digitar email
  const checkBlock = useCallback((email) => {
    if (!email) { setBlocked(false); setCountdown(0); setError(''); return; }
    const until = getBlockedUntil(email);
    if (until) {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      setBlocked(true);
      setCountdown(remaining);
      setError('Conta bloqueada temporariamente neste dispositivo.');
    } else {
      setBlocked(false);
      setCountdown(0);
    }
  }, []);

  // Ao montar ou trocar email, verifica bloqueio
  useEffect(() => {
    checkBlock(form.email);
  }, [form.email, checkBlock]);

  // Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!blocked || countdown <= 0) return;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setBlocked(false);
          setError('');
          if (form.email) {
            localStorage.removeItem(blockKey(form.email));
            localStorage.removeItem(attemptsKey(form.email));
          }
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [blocked, form.email]);

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

    const email = form.email.toLowerCase().trim();

    try {
      await login(email, form.password);
      // Login OK — limpa tentativas
      localStorage.removeItem(attemptsKey(email));
      localStorage.removeItem(blockKey(email));
      navigate('/');
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Erro ao fazer login.';

      if (status === 401 || status === 429) {
        // Incrementa tentativas no localStorage
        const attempts = getAttempts(email) + 1;
        localStorage.setItem(attemptsKey(email), String(attempts));

        if (attempts >= MAX_ATTEMPTS) {
          // Bloqueia
          const until = Date.now() + BLOCK_DURATION_MS;
          localStorage.setItem(blockKey(email), String(until));
          setBlocked(true);
          setCountdown(Math.ceil(BLOCK_DURATION_MS / 1000));
          setError('Conta bloqueada temporariamente neste dispositivo.');
        } else {
          const remaining = MAX_ATTEMPTS - attempts;
          if (remaining <= 3) {
            setError(`Credenciais inválidas. ${remaining} tentativa${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''} antes do bloqueio.`);
          } else {
            setError('Credenciais inválidas.');
          }
        }
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
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              autoFocus
              disabled={blocked}
            />
            <div className="relative">
              <Input
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                disabled={blocked}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[34px] text-[#7c8a6e] hover:text-[#4b5757] transition-colors"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

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
