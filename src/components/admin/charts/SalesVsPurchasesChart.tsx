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

interface ComparisonDataPoint {
  date: string;
  sales: number;
  purchases: number;
}

interface SalesVsPurchasesChartProps {
  data: ComparisonDataPoint[];
  lang: string;
}

/* ── Compact tooltip ──────────────────────────────────────────────── */
function CompareTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface-elevated)] px-4 py-3 shadow-lg shadow-black/10">
      <p className="mb-2 text-xs font-semibold text-[var(--tw-text-muted)]">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => (
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

export function SalesVsPurchasesChart({ data, lang }: SalesVsPurchasesChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={3}>
        <defs>
          <linearGradient id="gradSalesBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id="gradPurchasesBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#22C55E" stopOpacity={0.55} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="none" stroke="var(--tw-border)" strokeOpacity={0.5} vertical={false} />

        <XAxis
          dataKey="date"
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

        <Tooltip content={<CompareTooltip lang={lang} />} cursor={{ fill: 'var(--tw-surface-alt)', radius: 4 }} />

        <Bar
          dataKey="sales"
          name={lang === 'ar' ? 'المبيعات' : 'Sales'}
          fill="url(#gradSalesBar)"
          radius={[5, 5, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="purchases"
          name={lang === 'ar' ? 'المشتريات' : 'Purchases'}
          fill="url(#gradPurchasesBar)"
          radius={[5, 5, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
