import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardData } from './useDashboardData';

// Mock the api module
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../lib/api';

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state on initial render', () => {
    // Make the API call hang (never resolve)
    api.get.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() =>
      useDashboardData('/dashboard/clients-revenue', { month: 6, year: 2025 }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets data and clears loading on successful fetch', async () => {
    const mockData = { data: [{ clientId: '1', tradeName: 'Test', totalRevenue: 1000 }] };
    api.get.mockResolvedValue({ data: mockData });

    const { result } = renderHook(() =>
      useDashboardData('/dashboard/clients-revenue', { month: 6, year: 2025 }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('sets error state when API call fails', async () => {
    api.get.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() =>
      useDashboardData('/dashboard/clients-revenue', { month: 6, year: 2025 }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Falha ao carregar dados. Tente novamente.');
    expect(result.current.data).toBeNull();
  });

  it('sets timeout error message when request times out', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.code = 'ECONNABORTED';
    api.get.mockRejectedValue(timeoutError);

    const { result } = renderHook(() =>
      useDashboardData('/dashboard/clients-revenue', { month: 6, year: 2025 }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Tempo limite excedido. Tente novamente.');
  });

  it('retry re-executes the fetch', async () => {
    // First call fails
    api.get.mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() =>
      useDashboardData('/dashboard/clients-revenue', { month: 6, year: 2025 }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Falha ao carregar dados. Tente novamente.');

    // Set up success for retry
    const mockData = { data: [{ clientId: '1', tradeName: 'Test', totalRevenue: 500 }] };
    api.get.mockResolvedValueOnce({ data: mockData });

    // Call retry
    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    // API was called twice total (initial + retry)
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
