"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ChartSpec, TableColumn } from "@/types/analytics-viz";

const COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

interface DynamicChartProps {
  spec: ChartSpec;
  className?: string;
}

export function DynamicChart({ spec, className = "" }: DynamicChartProps) {
  const { type, title, description, data, config } = spec;

  return (
    <div className={`bg-white rounded-xl border border-foreground/10 p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-foreground/60 mt-1">{description}</p>
        )}
      </div>

      <div className="min-h-[300px]">
        {type === "bar" && <BarChartRenderer data={data} config={config} />}
        {type === "line" && <LineChartRenderer data={data} config={config} />}
        {type === "area" && <AreaChartRenderer data={data} config={config} />}
        {type === "pie" && <PieChartRenderer data={data} config={config} />}
        {type === "table" && <TableRenderer data={data} config={config} />}
        {type === "metric" && <MetricRenderer data={data} config={config} />}
      </div>
    </div>
  );
}

function BarChartRenderer({
  data,
  config,
}: {
  data: Record<string, unknown>[];
  config: ChartSpec["config"];
}) {
  const { xAxis, yAxis, colors = COLORS } = config;
  const yAxes = Array.isArray(yAxis) ? yAxis : yAxis ? [yAxis] : [];

  if (!xAxis || yAxes.length === 0) {
    return <EmptyState message="Invalid chart configuration" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xAxis}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        {yAxes.length > 1 && <Legend />}
        {yAxes.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartRenderer({
  data,
  config,
}: {
  data: Record<string, unknown>[];
  config: ChartSpec["config"];
}) {
  const { xAxis, yAxis, colors = COLORS } = config;
  const yAxes = Array.isArray(yAxis) ? yAxis : yAxis ? [yAxis] : [];

  if (!xAxis || yAxes.length === 0) {
    return <EmptyState message="Invalid chart configuration" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xAxis}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        {yAxes.length > 1 && <Legend />}
        {yAxes.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={{ fill: colors[index % colors.length], strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaChartRenderer({
  data,
  config,
}: {
  data: Record<string, unknown>[];
  config: ChartSpec["config"];
}) {
  const { xAxis, yAxis, colors = COLORS } = config;
  const yAxes = Array.isArray(yAxis) ? yAxis : yAxis ? [yAxis] : [];

  if (!xAxis || yAxes.length === 0) {
    return <EmptyState message="Invalid chart configuration" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xAxis}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        {yAxes.length > 1 && <Legend />}
        {yAxes.map((key, index) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[index % colors.length]}
            fill={colors[index % colors.length]}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PieChartRenderer({
  data,
  config,
}: {
  data: Record<string, unknown>[];
  config: ChartSpec["config"];
}) {
  const { nameKey, valueKey, colors = COLORS } = config;

  if (!nameKey || !valueKey) {
    return <EmptyState message="Invalid chart configuration" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, percent }) =>
            `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TableRenderer({
  data,
  config,
}: {
  data: Record<string, unknown>[];
  config: ChartSpec["config"];
}) {
  const { columns } = config;

  // Auto-detect columns if not provided
  const tableColumns: TableColumn[] =
    columns && columns.length > 0
      ? columns
      : data.length > 0
        ? Object.keys(data[0]).map((key) => ({ key, label: formatLabel(key) }))
        : [];

  if (tableColumns.length === 0) {
    return <EmptyState message="No data to display" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-foreground/60 border-b border-foreground/10">
            {tableColumns.map((col) => (
              <th key={col.key} className="pb-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-foreground/5 last:border-0"
            >
              {tableColumns.map((col) => (
                <td key={col.key} className="py-3 text-sm">
                  {formatCellValue(row[col.key], col.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricRenderer({
  data,
  config
}: {
  data: Record<string, unknown>[];
  config: ChartSpec["config"];
}) {
  const { value: configValue, previousValue, unit, trend } = config;

  // Extract value from data array if not directly in config
  let value: number | string | undefined;

  // If configValue is a string, it might be a field reference
  if (typeof configValue === 'string' && data.length > 0) {
    const firstRow = data[0];
    // Check if it's a field name in the data
    if (configValue in firstRow && typeof firstRow[configValue] === 'number') {
      value = firstRow[configValue] as number;
    } else {
      // Otherwise, try to find any numeric value
      const numericKeys = Object.keys(firstRow).filter(key =>
        typeof firstRow[key] === 'number'
      );
      if (numericKeys.length > 0) {
        value = firstRow[numericKeys[0]] as number;
      }
    }
  } else if (typeof configValue === 'number') {
    // It's already a number, use it directly
    value = configValue;
  } else if (configValue === undefined && data.length > 0) {
    // No config value, try to find a numeric value in data
    const firstRow = data[0];
    const numericKeys = Object.keys(firstRow).filter(key =>
      typeof firstRow[key] === 'number'
    );
    if (numericKeys.length > 0) {
      value = firstRow[numericKeys[0]] as number;
    }
  }

  if (value === undefined) {
    return <EmptyState message="No metric value" />;
  }

  const percentChange =
    previousValue && typeof value === "number"
      ? (((value - previousValue) / previousValue) * 100).toFixed(1)
      : null;

  const trendColor =
    trend === "up"
      ? "text-green-600"
      : trend === "down"
        ? "text-red-600"
        : "text-foreground/60";

  return (
    <div className="flex flex-col items-center justify-center h-[200px]">
      <div className="text-5xl font-bold text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && <span className="text-2xl font-normal ml-1">{unit}</span>}
      </div>
      {percentChange && (
        <div className={`mt-2 text-sm ${trendColor}`}>
          {trend === "up" ? "+" : trend === "down" ? "" : ""}
          {percentChange}% from previous period
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-foreground/50 text-sm">
      {message}
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatCellValue(
  value: unknown,
  format?: TableColumn["format"]
): string {
  if (value === null || value === undefined) {
    return "-";
  }

  switch (format) {
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "percent":
      return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : String(value);
    case "date":
      return value instanceof Date
        ? value.toLocaleDateString()
        : String(value);
    case "duration":
      return typeof value === "number" ? `${value}ms` : String(value);
    default:
      return String(value);
  }
}
