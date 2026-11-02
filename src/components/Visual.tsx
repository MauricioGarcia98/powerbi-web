import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell as ChartCell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Filter, Project, Visual as VisualModel } from "../core/model";
import { filteredRows, rows, tableByName } from "../core/model";
import { dax } from "../core/dax";
export const formatNumber = (n: unknown) =>
  n === null
    ? "(Blank)"
    : typeof n === "number"
      ? new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 2,
          notation: Math.abs(n) >= 100000 ? "compact" : "standard",
        }).format(n)
      : String(n ?? "");
export function visualData(project: Project, visual: VisualModel) {
  const data = filteredRows(project, visual.table);
  const expression = visual.value.startsWith("@")
    ? `[${visual.value.slice(1)}]`
    : `${visual.aggregation}('${visual.table.replaceAll("'", "''")}'[${visual.value}])`;
  if (visual.type === "card")
    return [{ name: visual.title, value: dax(expression, project) }];
  const categories = [...new Set(data.map((r) => r[visual.category]))].sort(
    (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }),
  );
  return categories.map((category) => ({
    name: String(category ?? "(Blank)"),
    raw: category,
    value: dax(expression, project, [
      ...project.filters.filter(
        (f) => !(f.table === visual.table && f.column === visual.category),
      ),
      { table: visual.table, column: visual.category, value: category },
    ]),
  }));
}
export function ReportVisual({
  project,
  visual,
  onFilter,
}: {
  project: Project;
  visual: VisualModel;
  onFilter: (f: Filter) => void;
}) {
  try {
    if (!visual.table)
      return (
        <div className="visual-empty">
          Choose a table and fields in Build visual.
        </div>
      );
    if (visual.type === "table") {
      const data = filteredRows(project, visual.table);
      const keys = Object.keys(data[0] ?? {});
      return (
        <div className="visual-table">
          <table>
            <thead>
              <tr>
                {keys.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  {keys.map((k) => (
                    <td key={k}>{formatNumber(r[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <small>
            {data.length > 100 ? "First 100 of " : ""}
            {data.length} rows
          </small>
        </div>
      );
    }
    if (visual.type === "slicer")
      return (
        <div className="slicer-options">
          {[
            ...new Set(
              rows(tableByName(project, visual.table)).map(
                (r) => r[visual.category],
              ),
            ),
          ].map((v, i) => (
            <button
              key={i}
              className={
                project.filters.some(
                  (f) =>
                    f.table === visual.table &&
                    f.column === visual.category &&
                    f.value === v,
                )
                  ? "chosen"
                  : ""
              }
              onClick={() =>
                onFilter({
                  table: visual.table,
                  column: visual.category,
                  value: v,
                })
              }
            >
              {String(v ?? "(Blank)")}
            </button>
          ))}
        </div>
      );
    if (!visual.value || (!visual.category && visual.type !== "card"))
      return (
        <div className="visual-empty">Add fields to build this visual.</div>
      );
    const data = visualData(project, visual);
    if (visual.type === "card")
      return (
        <div className="kpi">
          <span>{formatNumber(data[0].value)}</span>
          <small>{visual.value.replace("@", "")}</small>
          <span className="kpi-note">Current filter context</span>
        </div>
      );
    const click = (entry: any) => {
      const payload = entry?.payload ?? entry;
      if (payload && "raw" in payload)
        onFilter({
          table: visual.table,
          column: visual.category,
          value: payload.raw,
        });
    };
    const shared = {
      data,
      margin: { top: 12, right: 18, bottom: 14, left: 4 },
    };
    const axes = (
      <>
        <CartesianGrid vertical={false} stroke="#eceef1" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "#727781" }}
          tickLine={false}
          axisLine={false}
          minTickGap={12}
        />
        <YAxis
          tickFormatter={formatNumber}
          tick={{ fontSize: 10, fill: "#727781" }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip formatter={formatNumber} />
      </>
    );
    return (
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {visual.type === "donut" ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="50%"
                outerRadius="80%"
                paddingAngle={2}
                onClick={click}
              >
                {data.map((_, i) => (
                  <ChartCell
                    key={i}
                    fill={
                      [
                        visual.color,
                        "#edc44a",
                        "#7bb6ae",
                        "#d88d74",
                        "#aaa0ca",
                        "#c4ccd5",
                      ][i % 6]
                    }
                  />
                ))}
              </Pie>
              <Tooltip formatter={formatNumber} />
            </PieChart>
          ) : visual.type === "line" ? (
            <LineChart {...shared}>
              {axes}
              <Line
                type="monotone"
                dataKey="value"
                stroke={visual.color}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ onClick: (_e: any, p: any) => click(p) }}
              />
            </LineChart>
          ) : visual.type === "area" ? (
            <AreaChart {...shared}>
              {axes}
              <Area
                type="monotone"
                dataKey="value"
                fill={visual.color}
                fillOpacity={0.12}
                stroke={visual.color}
                strokeWidth={2}
              />
            </AreaChart>
          ) : visual.type === "bar" ? (
            <BarChart {...shared} layout="vertical">
              <CartesianGrid horizontal={false} stroke="#eceef1" />
              <XAxis
                type="number"
                tickFormatter={formatNumber}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={85}
                tick={{ fontSize: 10 }}
              />
              <Tooltip formatter={formatNumber} />
              <Bar
                dataKey="value"
                fill={visual.color}
                radius={[0, 3, 3, 0]}
                onClick={click}
              />
            </BarChart>
          ) : (
            <BarChart {...shared}>
              {axes}
              <Bar
                dataKey="value"
                fill={visual.color}
                radius={[3, 3, 0, 0]}
                onClick={click}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  } catch (e) {
    return (
      <div className="visual-error" role="alert">
        {(e as Error).message}
      </div>
    );
  }
}
