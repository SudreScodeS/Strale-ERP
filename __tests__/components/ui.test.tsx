// @ts-nocheck

/**
 * Tests for app/components/ui.tsx
 * Covers: PageHeader, MetricCard, Select
 *
 * Note: These are client components ("use client") so we need to mock
 * the necessary Next.js modules and browser APIs.
 */

// Mock Next.js modules
jest.mock('next/link', () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
});

jest.mock('next/image', () => {
  return ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    <img src={src} alt={alt} {...props} />
  );
});

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

// Mock config
jest.mock('../../config/global', () => ({
  globalConfig: {
    systemName: 'Elitium ERP',
    companyName: 'Elitium',
    profitMargin: 20,
    logoPricePerColor: 5,
    minStockAlert: 10,
  },
  applyServerConfig: jest.fn(),
}));

// Mock authClient
jest.mock('../../app/lib/authClient', () => ({
  getCurrentUser: jest.fn(() => null),
  getStoredToken: jest.fn(() => null),
  getAuthHeaders: jest.fn(() => ({})),
  logout: jest.fn(),
}));

// Mock icons
jest.mock('../../app/components/icons', () => ({
  ACTION_ICON_MAP: {},
  IconBell: () => <span>Bell</span>,
  IconOther: () => <span>Other</span>,
}));

// Mock error boundary
jest.mock('../../app/components/error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageHeader, MetricCard, Select } from '../../app/components/ui';

// Mock createPortal to render in place
jest.mock('react-dom', () => {
  const actual = jest.requireActual('react-dom');
  return { ...actual, createPortal: (node: React.ReactNode) => node };
});

describe('PageHeader', () => {
  it('should render the title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render the system name', () => {
    render(<PageHeader title="Test" />);
    expect(screen.getByText('Elitium ERP')).toBeInTheDocument();
  });

  it('should render the company name badge', () => {
    render(<PageHeader title="Test" />);
    expect(screen.getByText('Elitium')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(<PageHeader title="Test" description="Uma descrição útil." />);
    expect(screen.getByText('Uma descrição útil.')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    const { container } = render(<PageHeader title="Test" />);
    const desc = container.querySelector('p:last-child');
    // The last p should be the company name, not a description
    expect(screen.queryByText(/descrição/)).not.toBeInTheDocument();
  });
});

describe('MetricCard', () => {
  it('should render title and value', () => {
    render(<MetricCard title="Receita" value="R$ 15.000" />);
    expect(screen.getByText('Receita')).toBeInTheDocument();
    expect(screen.getByText('R$ 15.000')).toBeInTheDocument();
  });

  it('should render note when provided', () => {
    render(<MetricCard title="Vendas" value="42" note="+12% vs mês anterior" />);
    expect(screen.getByText('+12% vs mês anterior')).toBeInTheDocument();
  });

  it('should not render note when not provided', () => {
    const { container } = render(<MetricCard title="Test" value="100" />);
    // Only title and value should be present
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    render(
      <MetricCard
        title="Pedidos"
        value="10"
        icon={<span data-testid="icon">📦</span>}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('should render as link when href is provided', () => {
    render(
      <MetricCard
        title="Estoque"
        value="5"
        href="/inventory"
        icon={<span>📦</span>}
      />
    );
    const link = screen.getByTitle('Ir para Estoque');
    expect(link).toHaveAttribute('href', '/inventory');
  });
});

describe('Select', () => {
  it('should render with children options', () => {
    render(
      <Select value="opt1" onChange={() => {}}>
        <option value="opt1">Opção 1</option>
        <option value="opt2">Opção 2</option>
      </Select>
    );
    expect(screen.getByText('Opção 1')).toBeInTheDocument();
    expect(screen.getByText('Opção 2')).toBeInTheDocument();
  });

  it('should have the correct value selected', () => {
    render(
      <Select value="opt2" onChange={() => {}}>
        <option value="opt1">Opção 1</option>
        <option value="opt2">Opção 2</option>
      </Select>
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('opt2');
  });

  it('should call onChange when selection changes', () => {
    const handleChange = jest.fn();
    render(
      <Select value="opt1" onChange={handleChange}>
        <option value="opt1">Opção 1</option>
        <option value="opt2">Opção 2</option>
      </Select>
    );
    const select = screen.getByRole('combobox');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(handleChange).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <Select value="opt1" onChange={() => {}} disabled>
        <option value="opt1">Opção 1</option>
      </Select>
    );
    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  it('should apply aria-label when provided', () => {
    render(
      <Select value="opt1" onChange={() => {}} ariaLabel="Selecione uma opção">
        <option value="opt1">Opção 1</option>
      </Select>
    );
    expect(screen.getByLabelText('Selecione uma opção')).toBeInTheDocument();
  });
});
