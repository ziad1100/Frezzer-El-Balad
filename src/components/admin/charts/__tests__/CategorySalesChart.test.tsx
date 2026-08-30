import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategorySalesChart } from '../CategorySalesChart';

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

describe('CategorySalesChart', () => {
  const sampleData = [
    { name: 'لحوم', nameEn: 'Meat', units: 50, revenue: 25000 },
    { name: 'فراخ', nameEn: 'Chicken', units: 30, revenue: 15000 },
    { name: 'مصنعات', nameEn: 'Processed', units: 20, revenue: 10000 },
  ];

  it('renders null when data is empty array', () => {
    const { container } = render(<CategorySalesChart data={[]} lang="ar" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null when all revenue is zero', () => {
    const zeroData = [
      { name: 'لحوم', nameEn: 'Meat', units: 50, revenue: 0 },
      { name: 'فراخ', nameEn: 'Chicken', units: 30, revenue: 0 },
    ];
    const { container } = render(<CategorySalesChart data={zeroData} lang="ar" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders chart container when valid data is provided', () => {
    render(<CategorySalesChart data={sampleData} lang="ar" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders recharts-wrapper when data is valid', () => {
    const { container } = render(<CategorySalesChart data={sampleData} lang="ar" />);
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });

  it('displays total sales label in Arabic', () => {
    render(<CategorySalesChart data={sampleData} lang="ar" />);
    expect(screen.getByText('إجمالي')).toBeInTheDocument();
  });

  it('displays total sales label in English', () => {
    render(<CategorySalesChart data={sampleData} lang="en" />);
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('displays category names in Arabic from name field', () => {
    render(<CategorySalesChart data={sampleData} lang="ar" />);
    expect(screen.getByText('لحوم')).toBeInTheDocument();
    expect(screen.getByText('فراخ')).toBeInTheDocument();
    expect(screen.getByText('مصنعات')).toBeInTheDocument();
  });

  it('displays category names in English from nameEn field', () => {
    render(<CategorySalesChart data={sampleData} lang="en" />);
    expect(screen.getByText('Meat')).toBeInTheDocument();
    expect(screen.getByText('Chicken')).toBeInTheDocument();
    expect(screen.getByText('Processed')).toBeInTheDocument();
  });

  it('displays percentage for each category in legend', () => {
    render(<CategorySalesChart data={sampleData} lang="ar" />);
    // 25000/50000 = 50%, 15000/50000 = 30%, 10000/50000 = 20%
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('filters out categories with zero revenue from chart and legend', () => {
    const mixedData = [
      { name: 'لحوم', nameEn: 'Meat', units: 50, revenue: 25000 },
      { name: 'فراخ', nameEn: 'Chicken', units: 0, revenue: 0 },
    ];
    render(<CategorySalesChart data={mixedData} lang="ar" />);
    expect(screen.getByText('لحوم')).toBeInTheDocument();
    expect(screen.queryByText('فراخ')).not.toBeInTheDocument();
  });

  it('falls back to Arabic name when nameEn is empty and lang is en', () => {
    const dataWithoutEn = [
      { name: 'لحوم', nameEn: '', units: 50, revenue: 25000 },
    ];
    render(<CategorySalesChart data={dataWithoutEn} lang="en" />);
    expect(screen.getByText('لحوم')).toBeInTheDocument();
  });

  it('shows 100% for single category', () => {
    const singleData = [
      { name: 'لحوم', nameEn: 'Meat', units: 50, revenue: 25000 },
    ];
    render(<CategorySalesChart data={singleData} lang="ar" />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('handles many categories (8)', () => {
    const manyCategories = Array.from({ length: 8 }, (_, i) => ({
      name: `فئة ${i + 1}`,
      nameEn: `Category ${i + 1}`,
      units: (i + 1) * 10,
      revenue: (i + 1) * 1000,
    }));
    render(<CategorySalesChart data={manyCategories} lang="en" />);
    for (let i = 1; i <= 8; i++) {
      expect(screen.getByText(`Category ${i}`)).toBeInTheDocument();
    }
  });

  it('handles data with only one non-zero category among zeros', () => {
    const data = [
      { name: 'لحوم', nameEn: 'Meat', units: 50, revenue: 25000 },
      { name: 'فراخ', nameEn: 'Chicken', units: 0, revenue: 0 },
      { name: 'مصنعات', nameEn: 'Processed', units: 0, revenue: 0 },
    ];
    render(<CategorySalesChart data={data} lang="ar" />);
    // Only Meat should show in legend
    expect(screen.getByText('لحوم')).toBeInTheDocument();
    expect(screen.queryByText('فراخ')).not.toBeInTheDocument();
    expect(screen.queryByText('مصنعات')).not.toBeInTheDocument();
    // 100% since it's the only non-zero category
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
