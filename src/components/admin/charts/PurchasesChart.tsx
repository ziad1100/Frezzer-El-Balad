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

interface PurchaseDataPoint {
  date: string;
  cost: number;
  quantity: number;
}

interface PurchasesChartProps {
  data: PurchaseDataPoint[];
  lang: string;
  height?: number;
}

function CustomTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;
  const cost = payload[0]?.value ?? 0;
  const qty = payload[1]?.value ?? 0;
  return (
    <div className="rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-[var(--tw-text-muted)]">{label}</p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            {lang === 'ar' ? 'التكلفة' : 'Cost'}
          </span>
          <span className="text-sm font-bold text-violet-400">{formatPrice(cost, lang)}</span>
        </div>
        {qty > 0 && (
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
              <span className="h-2 w-2 rounded-full bg-violet-300" />
              {lang === 'ar' ? 'الكمية' : 'Qty'}
            </span>
            <span className="text-sm font-bold text-[var(--tw-text)]">{qty}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PurchasesChart({ data, lang, height = 280 }: PurchasesChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-border)" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
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
        <Bar
          dataKey="cost"
          fill="url(#colorPurchases)"
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
