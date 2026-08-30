import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatPrice } from '@/lib/utils';

interface RevenueDataPoint {
  label: string;
  revenue: number;
  cost: number;
}

interface RevenuesChartProps {
  data: RevenueDataPoint[];
  lang: string;
}

function CustomTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p: any) => p.dataKey === 'revenue')?.value ?? 0;
  const cost = payload.find((p: any) => p.dataKey === 'cost')?.value ?? 0;
  const profit = revenue - cost;
  return (
    <div className="rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-[var(--tw-text-muted)]">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="text-sm font-bold" style={{ color: entry.color }}>
              {formatPrice(entry.value, lang)}
            </span>
          </div>
        ))}
        {profit !== 0 && (
          <div className="flex items-center justify-between gap-6 border-t border-[var(--tw-border)] pt-1.5">
            <span className="text-xs text-[var(--tw-text-muted)]">
              {lang === 'ar' ? 'صافي الربح' : 'Net Profit'}
            </span>
            <span className={`text-sm font-bold ${profit >= 0 ? 'text-fresh-400' : 'text-red-400'}`}>
              {formatPrice(profit, lang)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RevenuesChart({ data, lang }: RevenuesChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={4}>
        <defs>
          <linearGradient id="colorRevenueBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="colorCostBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#F97316" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-border)" strokeOpacity={0.4} vertical={false} />
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
        <Tooltip content={<CustomTooltip lang={lang} />} cursor={{ fill: 'var(--tw-hover)', radius: 4 }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span className="text-[var(--tw-text-muted)]">{value}</span>}
        />
        <Bar
          dataKey="revenue"
          name={lang === 'ar' ? 'الإيرادات' : 'Revenue'}
          fill="url(#colorRevenueBar)"
          radius={[6, 6, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="cost"
          name={lang === 'ar' ? 'التكلفة' : 'Cost'}
          fill="url(#colorCostBar)"
          radius={[6, 6, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
