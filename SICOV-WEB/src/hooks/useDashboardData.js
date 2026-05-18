import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

/**
 * Hook para buscar dados do Dashboard com gerenciamento de loading, error e retry.
 * Configura timeout de 5 segundos e re-fetch automático quando params mudam.
 *
 * @param {string} endpoint - Caminho do endpoint (ex: '/dashboard/clients-revenue')
 * @param {object} params - Query params enviados na requisição (filtros globais)
 * @returns {{ data: any, loading: boolean, error: string|null, retry: () => void }}
 */
export function useDashboardData(endpoint, params) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const paramsRef = useRef(params);

  // Serializa params para usar como dependência estável no useCallback/useEffect
  const paramsKey = JSON.stringify(params);

  // Mantém referência atualizada dos params
  useEffect(() => {
    paramsRef.current = params;
  }, [paramsKey]);

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await api.get(endpoint, {
        params: paramsRef.current,
        timeout: 5000,
      });
      setState({ data: res.data, loading: false, error: null });
    } catch (err) {
      const message =
        err.code === 'ECONNABORTED'
          ? 'Tempo limite excedido. Tente novamente.'
          : 'Falha ao carregar dados. Tente novamente.';
      setState({ data: null, loading: false, error: message });
    }
  }, [endpoint, paramsKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, retry: fetchData };
}

export default useDashboardData;
