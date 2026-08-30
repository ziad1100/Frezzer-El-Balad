import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface StatusCount {
  status: string;
  count: number;
}

interface OrdersDonutChartProps {
  data: StatusCount[];
  lang: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  preparing: '#0EA5E9',
  ready_for_delivery: '#14B8A6',
  on_delivery: '#8B5CF6',
  completed: '#22C55E',
  cancelled: '#EF4444',
  delivery_failed: '#F97316',
  refunded: '#94A3B8',
  complimentary: '#F59E0B',
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: 'قيد الانتظار', en: 'Pending' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  preparing: { ar: 'قيد التحضير', en: 'Preparing' },
  ready_for_delivery: { ar: 'جاهز للتوصيل', en: 'Ready' },
  on_delivery: { ar: 'في الطريق', en: 'On Delivery' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  delivery_failed: { ar: 'فشل التوصيل', en: 'Failed' },
  refunded: { ar: 'مسترد', en: 'Refunded' },
  complimentary: { ar: 'هدية', en: 'Complimentary' },
};

function CustomTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const label = STATUS_LABELS[d.name]?.[lang === 'ar' ? 'ar' : 'en'] ?? d.name;
  return (
    <div className="rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3 shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.payload.fill }} />
        <span className="text-sm font-bold text-[var(--tw-text)]">{label}</span>
      </div>
      <p className="mt-1 text-lg font-extrabold" style={{ color: d.payload.fill }}>
        {d.value}
      </p>
    </div>
  );
}

export function OrdersDonutChart({ data, lang }: OrdersDonutChartProps) {
  if (data.length === 0) return null;

  const chartData = data.filter((d) => d.count > 0);
  if (chartData.length === 0) return null;

  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="count"
            nameKey="status"
            stroke="none"
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.status}
                fill={STATUS_COLORS[entry.status] ?? '#64748B'}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip lang={lang} />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="relative -mt-32 mb-6 text-center">
        <p className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)]">{total}</p>
        <p className="text-xs text-[var(--tw-text-muted)]">
          {lang === 'ar' ? 'إجمالي الطلبات' : 'Total Orders'}
        </p>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3">
        {chartData.map((d) => {
          const label = STATUS_LABELS[d.status]?.[lang === 'ar' ? 'ar' : 'en'] ?? d.status;
          return (
            <div key={d.status} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] ?? '#64748B' }} />
              <span className="text-xs text-[var(--tw-text-muted)]">{label}</span>
              <span className="text-xs font-bold text-[var(--tw-text)]">{d.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
