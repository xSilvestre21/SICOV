import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

const ThemeContext = createContext(null);

/**
 * Determina se é "noite" (entre 18h e 6h) para o modo automático.
 */
function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

/**
 * Resolve o tema efetivo baseado na preferência.
 * 'auto' → usa horário do dia (noite = dark, dia = light)
 */
function resolveTheme(preference) {
  if (preference === 'auto') return isNightTime() ? 'dark' : 'light';
  return preference;
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => {
    try {
      return localStorage.getItem('sicov_theme') || 'light';
    } catch {
      return 'light';
    }
  });

  const [effectiveTheme, setEffectiveTheme] = useState(() => resolveTheme(preference));

  // Aplica a classe 'dark' no <html> quando o tema efetivo muda
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  // Atualiza o tema efetivo quando a preferência muda
  useEffect(() => {
    setEffectiveTheme(resolveTheme(preference));
  }, [preference]);

  // Para modo 'auto': verifica a cada minuto se o horário mudou
  useEffect(() => {
    if (preference !== 'auto') return;

    const interval = setInterval(() => {
      setEffectiveTheme(resolveTheme('auto'));
    }, 60000); // verifica a cada 1 minuto

    return () => clearInterval(interval);
  }, [preference]);

  const setTheme = useCallback((value) => {
    if (!['light', 'dark', 'auto'].includes(value)) return;
    setPreferenceState(value);
    localStorage.setItem('sicov_theme', value);

    // Salva no backend (fire-and-forget)
    api.patch('/settings/theme', { themePreference: value }).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    // Cicla: light → dark → auto → light
    const next = preference === 'light' ? 'dark' : preference === 'dark' ? 'auto' : 'light';
    setTheme(next);
  }, [preference, setTheme]);

  const isDark = effectiveTheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme: preference, effectiveTheme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
