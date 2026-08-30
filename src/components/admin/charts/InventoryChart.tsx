import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface InventoryData {
  available: number;
  lowStock: number;
  outOfStock: number;
}

interface InventoryChartProps {
  data: InventoryData;
  lang: string;
}

const COLORS = ['#22C55E', '#F59E0B', '#EF4444'];

function CustomTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const labels: Record<string, string> = {
    available: lang === 'ar' ? 'متوفر' : 'Available',
    lowStock: lang === 'ar' ? 'مخزون منخفض' : 'Low Stock',
    outOfStock: lang === 'ar' ? 'نفد المخزون' : 'Out of Stock',
  };
  return (
    <div className="rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-[var(--tw-text-muted)]">
        {labels[payload[0]?.name] ?? payload[0]?.name}
      </p>
      <p className="mt-1 text-lg font-extrabold" style={{ color: payload[0]?.fill }}>
        {payload[0]?.value}
      </p>
    </div>
  );
}

export function InventoryChart({ data, lang }: InventoryChartProps) {
  const total = data.available + data.lowStock + data.outOfStock;
  if (total === 0) return null;

  const chartData = [
    { name: 'available', label: lang === 'ar' ? 'متوفر' : 'Available', value: data.available, color: COLORS[0] },
    { name: 'lowStock', label: lang === 'ar' ? 'مخزون منخفض' : 'Low Stock', value: data.lowStock, color: COLORS[1] },
    { name: 'outOfStock', label: lang === 'ar' ? 'نفد المخزون' : 'Out of Stock', value: data.outOfStock, color: COLORS[2] },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={4}
            dataKey="value"
            nameKey="name"
            stroke="none"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip lang={lang} />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="relative -mt-28 mb-8 text-center">
        <p className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)]">{total}</p>
        <p className="text-xs text-[var(--tw-text-muted)]">
          {lang === 'ar' ? 'إجمالي' : 'Total'}
        </p>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-[var(--tw-text-muted)]">{d.label}</span>
            <span className="text-xs font-bold text-[var(--tw-text)]">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
