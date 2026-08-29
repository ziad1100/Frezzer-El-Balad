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
}

function CustomTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-[var(--tw-text)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-fresh-500">
        {formatPrice(payload[0].value, lang)}
      </p>
      {payload[1] && (
        <p className="text-xs text-[var(--tw-text-muted)]">
          {payload[1].value} {lang === 'ar' ? 'وحدة' : 'units'}
        </p>
      )}
    </div>
  );
}

export function PurchasesChart({ data, lang }: PurchasesChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-border)" strokeOpacity={0.5} />
        <XAxis
          dataKey="date"
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
        <Bar
          dataKey="cost"
          fill="#22C55E"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
