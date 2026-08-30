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

interface TopProduct {
  name: string;
  count: number;
  revenue: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
  lang: string;
}

const BAR_COLORS = ['#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE', '#E0E7FF', '#EEF2FF', '#F5F7FF', '#FAFAFE'];

function CustomTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3 shadow-xl">
      <p className="text-sm font-bold text-[var(--tw-text)]">{d.name}</p>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'الكمية المباعة' : 'Qty Sold'}
          </span>
          <span className="text-sm font-bold text-brand-500">{d.count}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'الإيراد' : 'Revenue'}
          </span>
          <span className="text-sm font-bold text-fresh-400">{formatPrice(d.revenue, lang)}</span>
        </div>
      </div>
    </div>
  );
}

export function TopProductsChart({ data, lang }: TopProductsChartProps) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 8).map((p) => ({
    ...p,
    shortName: p.name.length > 22 ? p.name.slice(0, 20) + '…' : p.name,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 44 + 20)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-border)" strokeOpacity={0.4} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip content={<CustomTooltip lang={lang} />} cursor={{ fill: 'var(--tw-hover)', radius: 4 }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
