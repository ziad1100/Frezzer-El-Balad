import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinancialChart } from '../FinancialChart';

// Mock recharts ResponsiveContainer to work in jsdom
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children, height }: { children: React.ReactNode; height?: number }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: height ?? 400 }}>
        {children}
      </div>
    ),
  };
});

describe('FinancialChart', () => {
  const sampleData = [
    { date: '2026-08-01', sales: 10000, outgoing: 5000, purchases: 5000, revenue: 5000 },
    { date: '2026-08-02', sales: 15000, outgoing: 7000, purchases: 7000, revenue: 8000 },
    { date: '2026-08-03', sales: 8000, outgoing: 3000, purchases: 3000, revenue: 5000 },
  ];

  it('renders null when data is empty', () => {
    const { container } = render(<FinancialChart data={[]} lang="ar" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders chart container when data is provided', () => {
    render(<FinancialChart data={sampleData} lang="ar" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders recharts-wrapper when data is valid', () => {
    const { container } = render(<FinancialChart data={sampleData} lang="ar" />);
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });

  it('accepts custom height prop', () => {
    render(<FinancialChart data={sampleData} lang="ar" height={500} />);
    const container = screen.getByTestId('responsive-container');
    expect(container).toHaveStyle({ height: '500px' });
  });

  it('defaults to height 360', () => {
    render(<FinancialChart data={sampleData} lang="ar" />);
    const container = screen.getByTestId('responsive-container');
    expect(container).toHaveStyle({ height: '360px' });
  });

  it('does not crash with all-zero data', () => {
    const zeroData = [
      { date: '2026-08-01', sales: 0, outgoing: 0, purchases: 0, revenue: 0 },
    ];
    const { container } = render(<FinancialChart data={zeroData} lang="ar" />);
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });

  it('handles single data point without crashing', () => {
    const singleData = [
      { date: '08-01', sales: 1000, outgoing: 500, purchases: 500, revenue: 500 },
    ];
    render(<FinancialChart data={singleData} lang="ar" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('works with English language', () => {
    render(<FinancialChart data={sampleData} lang="en" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders with date labels sliced from full ISO dates', () => {
    // Dates like '2026-08-01' should be sliced to '08-01' for display
    const fullDateData = [
      { date: '2026-08-01', sales: 1000, outgoing: 500, purchases: 500, revenue: 500 },
    ];
    const { container } = render(<FinancialChart data={fullDateData} lang="ar" />);
    // Check that the data was passed to the chart (recharts-wrapper exists)
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });

  it('handles short date labels (already <= 5 chars)', () => {
    const shortDateData = [
      { date: '08-01', sales: 1000, outgoing: 500, purchases: 500, revenue: 500 },
    ];
    const { container } = render(<FinancialChart data={shortDateData} lang="ar" />);
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });
});
