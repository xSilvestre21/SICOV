import { createContext, useContext, useState, useCallback } from 'react';

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

const DashboardFilterContext = createContext(null);

export function DashboardFilterProvider({ children }) {
  const [granularity, setGranularityState] = useState('monthly');
  const [month, setMonthState] = useState(currentMonth);
  const [year, setYearState] = useState(currentYear);

  // Permite selecionar até 3 meses à frente (pedidos com datas de entrega futuras)
  const MONTHS_AHEAD = 3;

  const isBeyondAllowedDate = useCallback((m, y) => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;

    // Calcula o limite máximo: mês atual + 3 meses
    const maxTotalMonths = todayYear * 12 + todayMonth + MONTHS_AHEAD;
    const selectedTotalMonths = y * 12 + m;

    return selectedTotalMonths > maxTotalMonths;
  }, []);

  const setGranularity = useCallback((value) => {
    if (value !== 'monthly' && value !== 'annual') return;
    setGranularityState(value);
  }, []);

  const setMonth = useCallback((value) => {
    const m = Number(value);
    if (!Number.isInteger(m) || m < 1 || m > 12) return;
    if (isBeyondAllowedDate(m, year)) return;
    setMonthState(m);
  }, [year, isBeyondAllowedDate]);

  const setYear = useCallback((value) => {
    const y = Number(value);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) return;

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;

    // Calcula o limite máximo permitido
    const maxTotalMonths = todayYear * 12 + todayMonth + MONTHS_AHEAD;
    const maxAllowedYear = Math.floor((maxTotalMonths - 1) / 12);

    if (y > maxAllowedYear) return;

    // Se o ano selecionado com o mês atual ultrapassa o limite, ajusta o mês
    if (isBeyondAllowedDate(month, y)) {
      const maxMonthForYear = maxTotalMonths - y * 12;
      setMonthState(Math.min(12, Math.max(1, maxMonthForYear)));
    }

    setYearState(y);
  }, [month, isBeyondAllowedDate]);

  return (
    <DashboardFilterContext.Provider
      value={{
        granularity,
        month,
        year,
        setGranularity,
        setMonth,
        setYear,
      }}
    >
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFilterContext);
  if (!ctx) {
    throw new Error('useDashboardFilters must be used within DashboardFilterProvider');
  }
  return ctx;
}
