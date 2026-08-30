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

/* ── Gradient bar colors from brand-500 down ─────────────────────── */
const BAR_FILLS = ['#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE', '#DDD6FE'];

/* ── Compact tooltip ──────────────────────────────────────────────── */
function BarTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="min-w-[140px] rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface-elevated)] px-4 py-3 shadow-lg shadow-black/10">
      <p className="mb-1.5 text-xs font-bold text-[var(--tw-text)]">{d.name}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'الكمية' : 'Qty'}
          </span>
          <span className="text-xs font-bold text-brand-500">{d.count}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'الإيراد' : 'Revenue'}
          </span>
          <span className="text-xs font-bold text-fresh-400">{formatPrice(d.revenue, lang)}</span>
        </div>
      </div>
    </div>
  );
}

export function TopProductsChart({ data, lang }: TopProductsChartProps) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40 + 16)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="none" stroke="var(--tw-border)" strokeOpacity={0.5} horizontal={false} />

        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'var(--tw-text-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--tw-text)' }}
          tickLine={false}
          axisLine={false}
          width={120}
        />

        <Tooltip content={<BarTooltip lang={lang} />} cursor={{ fill: 'var(--tw-surface-alt)', radius: 4 }} />

        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={26} barSize={20}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={BAR_FILLS[i % BAR_FILLS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
