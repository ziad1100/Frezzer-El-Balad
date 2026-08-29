import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

function CustomTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-[var(--tw-text)]">
        {lang === 'ar' ? `admin.status.${d.name}` : d.name}
      </p>
      <p className="mt-1 text-sm font-bold" style={{ color: d.payload.fill }}>
        {d.value}
      </p>
    </div>
  );
}

export function OrdersDonutChart({ data, lang }: OrdersDonutChartProps) {
  if (data.length === 0) return null;

  const chartData = data.filter((d) => d.count > 0);

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="count"
          nameKey="status"
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.status}
              fill={STATUS_COLORS[entry.status] ?? '#64748B'}
              stroke="none"
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip lang={lang} />} />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs text-[var(--tw-text-muted)]">
              {lang === 'ar' ? `admin.status.${value}` : value}
            </span>
          )}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
