import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import api from '../lib/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      return setError('A senha deve ter pelo menos 8 caracteres.');
    }
    if (password !== confirmPassword) {
      return setError('As senhas não coincidem.');
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5ee] p-4">
        <div className="text-center">
          <p className="text-sm text-red-500">Link inválido. Solicite um novo link de redefinição.</p>
          <Link to="/forgot-password" className="text-sm text-[#58706d] hover:underline mt-2 inline-block">
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5ee] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#58706d] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Nova senha</h1>
          <p className="text-sm text-[#7c8a6e] mt-1">Defina sua nova senha</p>
        </div>

        {success ? (
          <div className="bg-white rounded-xl border border-[#e3e3d1] p-6 text-center">
            <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-[#4b5757] font-medium">Senha redefinida com sucesso!</p>
            <Link to="/login" className="inline-block mt-4 bg-[#58706d] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#4b5757]">
              Fazer login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e3e3d1] p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-[#4b5757] mb-1 block">Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#4b5757] mb-1 block">Confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                required
                className="w-full rounded-lg border border-[#b0b087] px-3 py-2 text-sm outline-none focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#58706d] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#4b5757] transition-colors disabled:opacity-50"
            >
              {loading ? 'Redefinindo...' : 'Redefinir senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
