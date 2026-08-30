import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatPrice } from '@/lib/utils';

interface CategoryData {
  name: string;
  nameEn: string;
  units: number;
  revenue: number;
}

interface CategorySalesChartProps {
  data: CategoryData[];
  lang: string;
}

/* ── Professional color palette — restrained and clean ─────────────── */
const PALETTE = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#EC4899', '#0EA5E9'];

/* ── Compact tooltip ──────────────────────────────────────────────── */
function DonutTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="min-w-[140px] rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface-elevated)] px-4 py-3 shadow-lg shadow-black/10">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: d.payload.fill }}
        />
        <span className="text-xs font-bold text-[var(--tw-text)]">{d.name}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'الإيراد' : 'Revenue'}
          </span>
          <span className="text-xs font-bold text-fresh-400">{formatPrice(d.payload.revenue, lang)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'النسبة' : 'Share'}
          </span>
          <span className="text-xs font-bold text-[var(--tw-text)]">
            {d.payload.percentage.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function CategorySalesChart({ data, lang }: CategorySalesChartProps) {
  if (data.length === 0) return null;

  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  if (totalRevenue === 0) return null;

  const chartData = data
    .filter((d) => d.revenue > 0)
    .map((d) => ({
      name: lang === 'ar' ? d.name : d.nameEn || d.name,
      revenue: d.revenue,
      units: d.units,
      percentage: ((d.revenue / totalRevenue) * 100),
    }));

  if (chartData.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Donut chart */}
      <div className="relative shrink-0">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="revenue"
              nameKey="name"
              stroke="none"
            >
              {chartData.map((entry, i) => (
                <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip lang={lang} />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-base font-extrabold tabular-nums text-[var(--tw-text)]">
            {formatPrice(totalRevenue, lang)}
          </p>
          <p className="text-[10px] text-[var(--tw-text-muted)]">
            {lang === 'ar' ? 'إجمالي' : 'Total'}
          </p>
        </div>
      </div>

      {/* Custom legend */}
      <div className="flex flex-1 flex-col gap-1.5">
        {chartData.map((d, i) => (
          <div
            key={d.name}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--tw-surface-alt)]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate text-xs text-[var(--tw-text)]">{d.name}</span>
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--tw-text-muted)]">
              {d.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
