import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalFilters } from './GlobalFilters';

// Mock the DashboardFilterContext
vi.mock('../../contexts/DashboardFilterContext', () => ({
  useDashboardFilters: vi.fn(),
}));

import { useDashboardFilters } from '../../contexts/DashboardFilterContext';

function renderGlobalFilters(overrides = {}) {
  useDashboardFilters.mockReturnValue({
    granularity: 'monthly',
    month: 6,
    year: 2025,
    setGranularity: vi.fn(),
    setMonth: vi.fn(),
    setYear: vi.fn(),
    ...overrides,
  });
  return render(<GlobalFilters />);
}

describe('GlobalFilters', () => {
  it('shows month selector when granularity is "monthly"', () => {
    renderGlobalFilters({ granularity: 'monthly' });

    // Month selector should be present (select with month options)
    const selects = screen.getAllByRole('combobox');
    // Should have 2 selects: month + year
    expect(selects).toHaveLength(2);

    // Verify month options are present
    expect(screen.getByText('Janeiro')).toBeInTheDocument();
    expect(screen.getByText('Dezembro')).toBeInTheDocument();
  });

  it('hides month selector when granularity is "annual"', () => {
    renderGlobalFilters({ granularity: 'annual' });

    // Only year selector should be present
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(1);

    // Month options should NOT be present
    expect(screen.queryByText('Janeiro')).not.toBeInTheDocument();
    expect(screen.queryByText('Dezembro')).not.toBeInTheDocument();
  });

  it('always shows year selector regardless of granularity', () => {
    // Test with monthly
    const { unmount } = renderGlobalFilters({ granularity: 'monthly' });
    expect(screen.getByDisplayValue('2025')).toBeInTheDocument();
    unmount();

    // Test with annual
    renderGlobalFilters({ granularity: 'annual' });
    expect(screen.getByDisplayValue('2025')).toBeInTheDocument();
  });
});
