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
  return (
    <div className="rounded-lg border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-[var(--tw-text)]">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="mt-1 text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{formatPrice(entry.value, lang)}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenuesChart({ data, lang }: RevenuesChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }} barGap={4}>
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
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => <span className="text-[var(--tw-text-muted)]">{value}</span>}
        />
        <Bar
          dataKey="revenue"
          name={lang === 'ar' ? 'الإيرادات' : 'Revenue'}
          fill="#6366F1"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="cost"
          name={lang === 'ar' ? 'التكلفة' : 'Cost'}
          fill="#F97316"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
