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

interface PurchaseDataPoint {
  date: string;
  cost: number;
  quantity: number;
}

interface PurchasesChartProps {
  data: PurchaseDataPoint[];
  lang: string;
  height?: number;
  comparisonData?: PurchaseDataPoint[];
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
          return (
            <div key={i} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="text-sm font-bold" style={{ color: entry.color }}>
                {formatPrice(entry.value, lang)}
              </span>
            </div>
          );
        })}
        {payload.length >= 2 && payload[0]?.value != null && payload[1]?.value != null && (
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

export function PurchasesChart({ data, lang, height = 280, comparisonData, comparisonLabel }: PurchasesChartProps) {
  if (data.length === 0) return null;

  const hasComparison = comparisonData && comparisonData.length > 0;

  const chartData = hasComparison
    ? data.map((d) => {
        const prev = comparisonData.find((p) => p.date === d.date);
        return { ...d, prevCost: prev?.cost ?? null };
      })
    : data;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="colorPrevPurchases" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.25} />
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
        {hasComparison && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-[var(--tw-text-muted)]">
                {value === 'cost'
                  ? (lang === 'ar' ? 'الفترة الحالية' : 'Current Period')
                  : (comparisonLabel || (lang === 'ar' ? 'الفترة السابقة' : 'Previous Period'))}
              </span>
            )}
          />
        )}
        {hasComparison && (
          <Bar
            dataKey="prevCost"
            name={comparisonLabel || (lang === 'ar' ? 'الفترة السابقة' : 'Previous Period')}
            fill="url(#colorPrevPurchases)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
        )}
        <Bar
          dataKey="cost"
          name={lang === 'ar' ? 'التكلفة' : 'Cost'}
          fill="url(#colorPurchases)"
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
