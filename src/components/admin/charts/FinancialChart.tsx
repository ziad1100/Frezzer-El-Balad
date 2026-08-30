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

interface FinancialDataPoint {
  date: string;
  sales: number;
  outgoing: number;
  purchases: number;
  revenue: number;
}

interface FinancialChartProps {
  data: FinancialDataPoint[];
  lang: string;
  height?: number;
}

/* ── Compact tooltip ──────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[160px] rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface-elevated)] px-4 py-3 shadow-lg shadow-black/10">
      <p className="mb-2 text-xs font-semibold text-[var(--tw-text-muted)]">{label}</p>
      <div className="space-y-1.5">
        {payload
          .filter((e: any) => e.value != null)
          .map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: entry.color }}>
                {formatPrice(entry.value, lang)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── Main chart ───────────────────────────────────────────────────── */
export function FinancialChart({ data, lang, height = 360 }: FinancialChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: d.date.length > 5 ? d.date.slice(5) : d.date,
      })),
    [data],
  );

  if (data.length === 0) return null;

  const hasData = (key: keyof FinancialDataPoint) => data.some((d) => (d[key] as number) > 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradOutgoing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity={0.10} />
            <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPurchases" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.10} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Horizontal grid only — subtle */}
        <CartesianGrid strokeDasharray="none" stroke="var(--tw-border)" strokeOpacity={0.5} vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          dx={-2}
          width={44}
        />

        <Tooltip
          content={<ChartTooltip lang={lang} />}
          cursor={{ stroke: 'var(--tw-border-strong)', strokeWidth: 1, strokeDasharray: '4 4' }}
        />

        {hasData('sales') && (
          <Area
            type="monotone"
            dataKey="sales"
            name={lang === 'ar' ? 'المبيعات' : 'Sales'}
            stroke="#6366F1"
            strokeWidth={2}
            fill="url(#gradSales)"
            dot={false}
            activeDot={{ r: 4, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
          />
        )}
        {hasData('outgoing') && (
          <Area
            type="monotone"
            dataKey="outgoing"
            name={lang === 'ar' ? 'المنصرف' : 'Outgoing'}
            stroke="#EF4444"
            strokeWidth={1.5}
            fill="url(#gradOutgoing)"
            dot={false}
            activeDot={{ r: 4, fill: '#EF4444', stroke: '#fff', strokeWidth: 2 }}
          />
        )}
        {hasData('purchases') && (
          <Area
            type="monotone"
            dataKey="purchases"
            name={lang === 'ar' ? 'المشتريات' : 'Purchases'}
            stroke="#8B5CF6"
            strokeWidth={1.5}
            fill="url(#gradPurchases)"
            dot={false}
            activeDot={{ r: 4, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
          />
        )}
        {hasData('revenue') && (
          <Area
            type="monotone"
            dataKey="revenue"
            name={lang === 'ar' ? 'الإيرادات' : 'Revenue'}
            stroke="#22C55E"
            strokeWidth={2}
            fill="url(#gradRevenue)"
            dot={false}
            activeDot={{ r: 4, fill: '#22C55E', stroke: '#fff', strokeWidth: 2 }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
