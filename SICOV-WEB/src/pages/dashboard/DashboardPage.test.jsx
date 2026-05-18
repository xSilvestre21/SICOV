import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock all chart components to simple stubs
vi.mock('./charts/ClientsRevenueChart', () => ({
  ClientsRevenueChart: () => <div data-testid="clients-revenue-chart">ClientsRevenueChart</div>,
}));
vi.mock('./charts/CommissionsOverviewChart', () => ({
  CommissionsOverviewChart: () => <div data-testid="commissions-overview-chart">CommissionsOverviewChart</div>,
}));
vi.mock('./charts/CommissionsVariationChart', () => ({
  CommissionsVariationChart: () => <div data-testid="commissions-variation-chart">CommissionsVariationChart</div>,
}));
vi.mock('./charts/RepresentativesPerformanceChart', () => ({
  RepresentativesPerformanceChart: () => <div data-testid="representatives-performance-chart">RepresentativesPerformanceChart</div>,
}));
vi.mock('./charts/TopClientsChart', () => ({
  TopClientsChart: () => <div data-testid="top-clients-chart">TopClientsChart</div>,
}));
vi.mock('./charts/CancelledOrdersChart', () => ({
  CancelledOrdersChart: () => <div data-testid="cancelled-orders-chart">CancelledOrdersChart</div>,
}));
vi.mock('./charts/ClientIndividualView', () => ({
  ClientIndividualView: () => <div data-testid="client-individual-view">ClientIndividualView</div>,
}));

// Mock GlobalFilters
vi.mock('../../components/dashboard/GlobalFilters', () => ({
  GlobalFilters: () => <div data-testid="global-filters">GlobalFilters</div>,
}));

// Mock DashboardFilterContext
vi.mock('../../contexts/DashboardFilterContext', () => ({
  DashboardFilterProvider: ({ children }) => <div>{children}</div>,
}));

// Mock api
vi.mock('../../lib/api', () => ({
  default: { get: vi.fn() },
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';
import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('renders all chart sections when user is admin', () => {
    useAuth.mockReturnValue({ isAdmin: true, user: { profile: 'admin' } });

    render(<DashboardPage />);

    expect(screen.getByTestId('clients-revenue-chart')).toBeInTheDocument();
    expect(screen.getByTestId('commissions-overview-chart')).toBeInTheDocument();
    expect(screen.getByTestId('commissions-variation-chart')).toBeInTheDocument();
    expect(screen.getByTestId('representatives-performance-chart')).toBeInTheDocument();
    expect(screen.getByTestId('top-clients-chart')).toBeInTheDocument();
    expect(screen.getByTestId('cancelled-orders-chart')).toBeInTheDocument();
  });

  it('hides RepresentativesPerformanceChart and CommissionsVariationChart for representative', () => {
    useAuth.mockReturnValue({ isAdmin: false, user: { profile: 'representative' } });

    render(<DashboardPage />);

    // These should be visible for all users
    expect(screen.getByTestId('clients-revenue-chart')).toBeInTheDocument();
    expect(screen.getByTestId('commissions-overview-chart')).toBeInTheDocument();
    expect(screen.getByTestId('top-clients-chart')).toBeInTheDocument();
    expect(screen.getByTestId('cancelled-orders-chart')).toBeInTheDocument();

    // These should be hidden for representatives
    expect(screen.queryByTestId('commissions-variation-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('representatives-performance-chart')).not.toBeInTheDocument();
  });

  it('renders global filters section', () => {
    useAuth.mockReturnValue({ isAdmin: true, user: { profile: 'admin' } });

    render(<DashboardPage />);

    expect(screen.getByTestId('global-filters')).toBeInTheDocument();
  });
});
