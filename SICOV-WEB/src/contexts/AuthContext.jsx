import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT = 4 * 60 * 60 * 1000; // 4 horas em ms

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('sicov_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const inactivityTimer = useRef(null);

  const logout = useCallback(() => {
    sessionStorage.removeItem('sicov_token');
    sessionStorage.removeItem('sicov_refreshToken');
    sessionStorage.removeItem('sicov_user');
    setUser(null);
  }, []);

  // Reseta o timer de inatividade
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);
  }, [logout]);

  // Monitora atividade do usuário
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    sessionStorage.setItem('sicov_token', data.token);
    sessionStorage.setItem('sicov_refreshToken', data.refreshToken);
    sessionStorage.setItem('sicov_user', JSON.stringify(data.user));
    // Sincroniza preferência de tema do servidor (tema fica no localStorage para persistir)
    if (data.user.themePreference) {
      localStorage.setItem('sicov_theme', data.user.themePreference);
    }
    setUser(data.user);
    return data.user;
  }, []);

  const isAdmin = user?.profile === 'admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
