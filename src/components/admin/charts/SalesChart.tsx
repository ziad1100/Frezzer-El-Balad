import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatPrice } from '@/lib/utils';

interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface SalesChartProps {
  data: SalesDataPoint[];
  lang: string;
}

function CustomTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-[var(--tw-text)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-brand-500">
        {formatPrice(payload[0].value, lang)}
      </p>
      {payload[1] && (
        <p className="text-xs text-[var(--tw-text-muted)]">
          {payload[1].value} {lang === 'ar' ? 'طلب' : 'orders'}
        </p>
      )}
    </div>
  );
}

export function SalesChart({ data, lang }: SalesChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      label: d.date.length > 5 ? d.date.slice(5) : d.date,
    }));
  }, [data]);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-border)" strokeOpacity={0.5} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
        />
        <Tooltip content={<CustomTooltip lang={lang} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#6366F1"
          strokeWidth={2}
          fill="url(#colorRevenue)"
          dot={false}
          activeDot={{ r: 5, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
