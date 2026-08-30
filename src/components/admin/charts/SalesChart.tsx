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
  height?: number;
}

function CustomTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;
  const revenue = payload[0]?.value ?? 0;
  const orders = payload[1]?.value ?? 0;
  const avg = orders > 0 ? revenue / orders : 0;

  return (
    <div className="rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-[var(--tw-text-muted)]">{label}</p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            {lang === 'ar' ? 'المبيعات' : 'Sales'}
          </span>
          <span className="text-sm font-bold text-brand-500">{formatPrice(revenue, lang)}</span>
        </div>
        {orders > 0 && (
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
              <span className="h-2 w-2 rounded-full bg-brand-300" />
              {lang === 'ar' ? 'العمليات' : 'Orders'}
            </span>
            <span className="text-sm font-bold text-[var(--tw-text)]">{orders}</span>
          </div>
        )}
        {avg > 0 && (
          <div className="flex items-center justify-between gap-6 border-t border-[var(--tw-border)] pt-1.5">
            <span className="text-xs text-[var(--tw-text-muted)]">
              {lang === 'ar' ? 'متوسط العملية' : 'Avg Order'}
            </span>
            <span className="text-xs font-bold text-[var(--tw-text-muted)]">{formatPrice(avg, lang)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SalesChart({ data, lang, height = 320 }: SalesChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      label: d.date.length > 5 ? d.date.slice(5) : d.date,
    }));
  }, [data]);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.25} />
            <stop offset="50%" stopColor="#6366F1" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorRevenueStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--tw-border)"
          strokeOpacity={0.4}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
          dy={8}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          dx={-4}
        />
        <Tooltip content={<CustomTooltip lang={lang} />} cursor={{ stroke: 'var(--tw-border-strong)', strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="url(#colorRevenueStroke)"
          strokeWidth={2.5}
          fill="url(#colorRevenueGradient)"
          dot={false}
          activeDot={{
            r: 6,
            fill: '#6366F1',
            stroke: '#fff',
            strokeWidth: 3,
            className: 'drop-shadow-md',
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
