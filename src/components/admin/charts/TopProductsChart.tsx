import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

function CustomTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-[var(--tw-text)]">{d.name}</p>
      <p className="mt-1 text-xs text-[var(--tw-text-muted)]">
        {d.count} {lang === 'ar' ? 'مباع' : 'sold'}
      </p>
      <p className="text-xs font-bold text-brand-500">
        {formatPrice(d.revenue, lang)}
      </p>
    </div>
  );
}

export function TopProductsChart({ data, lang }: TopProductsChartProps) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 8).map((p) => ({
    ...p,
    shortName: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40 + 20)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-border)" strokeOpacity={0.5} horizontal={false} />
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
          width={100}
        />
        <Tooltip content={<CustomTooltip lang={lang} />} />
        <Bar
          dataKey="count"
          fill="#6366F1"
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
