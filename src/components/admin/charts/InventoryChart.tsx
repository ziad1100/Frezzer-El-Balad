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

interface InventoryData {
  available: number;
  lowStock: number;
  outOfStock: number;
}

interface InventoryChartProps {
  data: InventoryData;
  lang: string;
}

function CustomTooltip({ active, payload, lang }: any) {
  if (!active || !payload?.length) return null;
  const labels: Record<string, string> = {
    available: lang === 'ar' ? 'متوفر' : 'Available',
    lowStock: lang === 'ar' ? 'مخزون منخفض' : 'Low Stock',
    outOfStock: lang === 'ar' ? 'نفد المخزون' : 'Out of Stock',
  };
  return (
    <div className="rounded-lg border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-[var(--tw-text)]">
        {labels[payload[0]?.dataKey] ?? payload[0]?.dataKey}
      </p>
      <p className="mt-1 text-sm font-bold" style={{ color: payload[0]?.fill }}>
        {payload[0]?.value}
      </p>
    </div>
  );
}

export function InventoryChart({ data, lang }: InventoryChartProps) {
  const chartData = [
    {
      key: 'available',
      label: lang === 'ar' ? 'متوفر' : 'Available',
      value: data.available,
      color: '#22C55E',
    },
    {
      key: 'lowStock',
      label: lang === 'ar' ? 'مخزون منخفض' : 'Low Stock',
      value: data.lowStock,
      color: '#F59E0B',
    },
    {
      key: 'outOfStock',
      label: lang === 'ar' ? 'نفد المخزون' : 'Out of Stock',
      value: data.outOfStock,
      color: '#EF4444',
    },
  ];

  const hasData = chartData.some((d) => d.value > 0);
  if (!hasData) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
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
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip lang={lang} />} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
