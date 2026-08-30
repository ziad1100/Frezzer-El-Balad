import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
  comparisonData?: SalesDataPoint[];
  comparisonLabel?: string;
}

function CustomTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-[var(--tw-text-muted)]">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry: any, i: number) => {
          if (entry.value === undefined || entry.value === null) return null;
          const isComparison = entry.dataKey === 'prevRevenue';
          return (
            <div key={i} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color, opacity: isComparison ? 0.5 : 1 }}
                />
                {entry.name}
              </span>
              <span className="text-sm font-bold" style={{ color: entry.color }}>
                {formatPrice(entry.value, lang)}
              </span>
            </div>
          );
        })}
        {payload.length >= 2 && payload[0]?.value && payload[1]?.value && (
          <div className="flex items-center justify-between gap-6 border-t border-[var(--tw-border)] pt-1.5">
            <span className="text-xs text-[var(--tw-text-muted)]">
              {lang === 'ar' ? 'الفرق' : 'Difference'}
            </span>
            <span className={`text-xs font-bold ${payload[0].value >= payload[1].value ? 'text-fresh-400' : 'text-red-400'}`}>
              {payload[0].value >= payload[1].value ? '+' : ''}
              {formatPrice(payload[0].value - payload[1].value, lang)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SalesChart({ data, lang, height = 320, comparisonData, comparisonLabel }: SalesChartProps) {
  const chartData = useMemo(() => {
    if (!comparisonData || comparisonData.length === 0) {
      return data.map((d) => ({
        ...d,
        label: d.date.length > 5 ? d.date.slice(5) : d.date,
      }));
    }

    // Build a map of previous period data
    const prevMap = new Map(comparisonData.map((d) => [d.date, d.revenue]));

    // Use current period dates as the base
    return data.map((d) => ({
      ...d,
      label: d.date.length > 5 ? d.date.slice(5) : d.date,
      prevRevenue: prevMap.get(d.date) ?? null,
    }));
  }, [data, comparisonData]);

  if (data.length === 0) return null;

  const hasComparison = comparisonData && comparisonData.length > 0;

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
          <linearGradient id="colorPrevRevenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
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
        <Tooltip
          content={<CustomTooltip lang={lang} />}
          cursor={{ stroke: 'var(--tw-border-strong)', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        {hasComparison && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-[var(--tw-text-muted)]">
                {value === 'revenue'
                  ? (lang === 'ar' ? 'الفترة الحالية' : 'Current Period')
                  : (comparisonLabel || (lang === 'ar' ? 'الفترة السابقة' : 'Previous Period'))}
              </span>
            )}
          />
        )}
        {/* Previous period (background, dashed) */}
        {hasComparison && (
          <Area
            type="monotone"
            dataKey="prevRevenue"
            stroke="#F59E0B"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            fill="url(#colorPrevRevenueGradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: '#F59E0B',
              stroke: '#fff',
              strokeWidth: 2,
            }}
            connectNulls={false}
          />
        )}
        {/* Current period (foreground, solid) */}
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
