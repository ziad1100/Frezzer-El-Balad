import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatPrice } from '@/lib/utils';

interface CategoryValue {
  categoryName: string;
  categoryNameEn: string;
  totalStock: number;
  totalValue: number;
  productCount: number;
}

interface InventoryValueChartProps {
  data: CategoryValue[];
  lang: string;
  height?: number;
}

const COLORS = [
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4',
];

function ChartTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as CategoryValue;
  if (!d) return null;
  return (
    <div className="min-w-[180px] rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface-elevated)] px-4 py-3 shadow-lg shadow-black/10">
      <p className="mb-2 text-xs font-semibold text-[var(--tw-text)]">
        {lang === 'ar' ? d.categoryName : (d.categoryNameEn || d.categoryName)}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'القيمة' : 'Value'}
          </span>
          <span className="text-xs font-bold tabular-nums text-[var(--tw-text)]">
            {formatPrice(d.totalValue, lang)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'المخزون' : 'Stock'}
          </span>
          <span className="text-xs font-bold tabular-nums text-[var(--tw-text)]">
            {d.totalStock}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'المنتجات' : 'Products'}
          </span>
          <span className="text-xs font-bold tabular-nums text-[var(--tw-text)]">
            {d.productCount}
          </span>
        </div>
      </div>
    </div>
  );
}

export function InventoryValueChart({ data, lang, height = 300 }: InventoryValueChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: lang === 'ar' ? d.categoryName : (d.categoryNameEn || d.categoryName),
      })),
    [data, lang],
  );

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="none" stroke="var(--tw-border)" strokeOpacity={0.5} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          content={<ChartTooltip lang={lang} />}
          cursor={{ fill: 'var(--tw-hover)', fillOpacity: 0.5 }}
        />
        <Bar dataKey="totalValue" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
