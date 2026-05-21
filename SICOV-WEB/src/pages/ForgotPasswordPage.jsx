import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import api from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5ee] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#58706d] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h1 className="text-2xl font-bold text-[#4b5757]">Esqueci minha senha</h1>
          <p className="text-sm text-[#7c8a6e] mt-1">Informe seu email para receber o link de redefinição</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-xl border border-[#e3e3d1] p-6 text-center">
            <Mail size={40} className="text-[#58706d] mx-auto mb-3" />
            <p className="text-sm text-[#4b5757] font-medium">Email enviado!</p>
            <p className="text-xs text-[#7c8a6e] mt-2">Verifique sua caixa de entrada (e spam) para o link de redefinição.</p>
            <button
              onClick={() => { setSent(false); setError(''); }}
              className="mt-4 text-sm text-[#58706d] hover:underline"
            >
              Não recebeu? Enviar novamente
            </button>
            <div className="mt-2">
              <Link to="/login" className="text-xs text-[#7c8a6e] hover:text-[#4b5757]">
                Voltar para o login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e3e3d1] p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-[#4b5757] mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
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
              {loading ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>

            <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-[#7c8a6e] hover:text-[#4b5757]">
              <ArrowLeft size={14} /> Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
