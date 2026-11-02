export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
export type Step = {
  id: string;
  kind:
    | "trim"
    | "uppercase"
    | "filter"
    | "number"
    | "rename"
    | "remove"
    | "deduplicate";
  column: string;
  value?: string;
};
export type Table = { id: string; name: string; source: Row[]; steps: Step[] };
export type Relationship = {
  id: string;
  from: string;
  fromColumn: string;
  to: string;
  toColumn: string;
};
export type Measure = { id: string; name: string; expression: string };
export type VisualType =
  "column" | "bar" | "line" | "area" | "donut" | "table" | "card" | "slicer";
export type Visual = {
  id: string;
  type: VisualType;
  title: string;
  table: string;
  category: string;
  value: string;
  aggregation: "SUM" | "AVERAGE" | "COUNT" | "MIN" | "MAX";
  color: string;
  wide: boolean;
};
export type Page = { id: string; name: string; visuals: Visual[] };
export type Filter = { table: string; column: string; value: Cell };
export type Publication = {
  id: string;
  name: string;
  date: string;
  pages: Page[];
  tables: Table[];
  measures: Measure[];
  relationships: Relationship[];
};
export type Project = {
  version: 1;
  name: string;
  tables: Table[];
  relationships: Relationship[];
  measures: Measure[];
  pages: Page[];
  activePage: string;
  filters: Filter[];
  completed: string[];
  publications: Publication[];
};
export const uid = () => crypto.randomUUID();
export const blankProject = (): Project => ({
  version: 1,
  name: "My first report",
  tables: [],
  relationships: [],
  measures: [],
  pages: [{ id: "page-1", name: "Page 1", visuals: [] }],
  activePage: "page-1",
  filters: [],
  completed: [],
  publications: [],
});
export function rows(table: Table): Row[] {
  let data = table.source.map((r) => ({ ...r }));
  for (const step of table.steps) {
    const c = step.column;
    if (step.kind === "filter")
      data = data.filter((r) => String(r[c] ?? "") === step.value);
    else if (step.kind === "deduplicate") {
      const seen = new Set<string>();
      data = data.filter((r) => {
        const key = c ? JSON.stringify(r[c]) : JSON.stringify(r);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else
      data = data.map((row) => {
        const r = { ...row };
        if (step.kind === "trim" && typeof r[c] === "string")
          r[c] = (r[c] as string).trim();
        if (step.kind === "uppercase" && typeof r[c] === "string")
          r[c] = (r[c] as string).toUpperCase();
        if (step.kind === "number") {
          const v = r[c];
          if (v === null || String(v).trim() === "") r[c] = null;
          else {
            const n = Number(v);
            if (!Number.isFinite(n))
              throw new Error(`Cannot convert "${v}" in ${c} to a number.`);
            r[c] = n;
          }
        }
        if (step.kind === "rename") {
          if (!step.value?.trim()) throw new Error("Enter a new column name.");
          if (step.value !== c && step.value in r)
            throw new Error("Column already exists.");
          r[step.value] = r[c];
          if (step.value !== c) delete r[c];
        }
        if (step.kind === "remove") delete r[c];
        return r;
      });
  }
  return data;
}
export const columns = (t: Table) => {
  let result = Object.keys(t.source[0] ?? {});
  for (const step of t.steps) {
    if (step.kind === "remove")
      result = result.filter((c) => c !== step.column);
    if (step.kind === "rename" && step.value)
      result = result.map((c) => (c === step.column ? step.value! : c));
  }
  return result;
};
export function tableByName(project: Project, name: string) {
  const t = project.tables.find((t) => t.name === name);
  if (!t) throw new Error(`Table '${name}' was not found.`);
  return t;
}
export function filteredRows(
  project: Project,
  name: string,
  filters = project.filters,
  path = new Set<string>(),
): Row[] {
  if (path.has(name))
    throw new Error("Circular relationships are not supported.");
  const next = new Set(path).add(name);
  let data = rows(tableByName(project, name));
  for (const f of filters.filter((f) => f.table === name))
    data = data.filter((r) => r[f.column] === f.value);
  for (const rel of project.relationships.filter((r) => r.to === name)) {
    // Only propagate a constrained dimension; unconstrained relationships preserve orphan fact rows.
    const affected = (n: string, visited = new Set<string>()): boolean => {
      if (visited.has(n)) return false;
      visited.add(n);
      return (
        filters.some((f) => f.table === n) ||
        project.relationships
          .filter((r) => r.to === n)
          .some((r) => affected(r.from, visited))
      );
    };
    if (affected(rel.from)) {
      const keys = new Set(
        filteredRows(project, rel.from, filters, next).map(
          (r) => r[rel.fromColumn],
        ),
      );
      data = data.filter((r) => keys.has(r[rel.toColumn]));
    }
  }
  return data;
}
export function validateRelationship(project: Project, rel: Relationship) {
  if (rel.from === rel.to) throw new Error("Choose two different tables.");
  const from = tableByName(project, rel.from),
    to = tableByName(project, rel.to);
  if (
    !columns(from).includes(rel.fromColumn) ||
    !columns(to).includes(rel.toColumn)
  )
    throw new Error("Choose existing columns.");
  const keys = rows(from).map((r) => r[rel.fromColumn]);
  if (keys.some((k) => k === null) || new Set(keys).size !== keys.length)
    throw new Error(
      "The one-side column must contain unique, nonblank values.",
    );
  if (project.relationships.some((r) => r.to === rel.to && r.from === rel.from))
    throw new Error("A relationship between these tables already exists.");
  const a = keys.find((k) => k !== null),
    b = rows(to)
      .map((r) => r[rel.toColumn])
      .find((k) => k !== null);
  if (a !== undefined && b !== undefined && typeof a !== typeof b)
    throw new Error("Relationship columns must have matching data types.");
  const canReach = (n: string, visited = new Set<string>()): boolean => {
    if (n === rel.from) return true;
    if (visited.has(n)) return false;
    visited.add(n);
    return project.relationships
      .filter((r) => r.from === n)
      .some((r) => canReach(r.to, visited));
  };
  if (canReach(rel.to))
    throw new Error("This relationship would create a cycle.");
}
export function sampleTables(): Table[] {
  const products = [
    {
      ProductID: 1,
      Product: " Laptop ",
      Category: "Technology",
      UnitPrice: 1200,
    },
    {
      ProductID: 2,
      Product: " Monitor ",
      Category: "Technology",
      UnitPrice: 350,
    },
    { ProductID: 3, Product: " Desk ", Category: "Furniture", UnitPrice: 480 },
    { ProductID: 4, Product: " Chair ", Category: "Furniture", UnitPrice: 220 },
    {
      ProductID: 5,
      Product: " Notebook ",
      Category: "Office supplies",
      UnitPrice: 18,
    },
    {
      ProductID: 6,
      Product: " Pen set ",
      Category: "Office supplies",
      UnitPrice: 12,
    },
  ];
  const customers = Array.from({ length: 12 }, (_, i) => ({
    CustomerID: i + 1,
    Customer: `Customer ${String(i + 1).padStart(2, "0")}`,
    Region: ["North", "South", "East", "West"][i % 4],
    Segment: i % 2 ? "Consumer" : "Corporate",
  }));
  const sales = Array.from({ length: 240 }, (_, i) => {
    const p = products[(i * 7 + Math.floor(i / 12)) % 6],
      qty = 1 + ((i * 3) % 7);
    return {
      OrderID: 1001 + i,
      Date: `2025-${String(1 + Math.floor(i / 20)).padStart(2, "0")}-${String(1 + (i % 20)).padStart(2, "0")}`,
      Month: `2025-${String(1 + Math.floor(i / 20)).padStart(2, "0")}`,
      ProductID: p.ProductID,
      CustomerID: 1 + ((i * 5) % 12),
      Quantity: qty,
      SalesAmount: p.UnitPrice * qty,
      Cost: p.UnitPrice * qty * 0.62,
    };
  });
  return [
    { id: uid(), name: "Sales", source: sales, steps: [] },
    { id: uid(), name: "Products", source: products, steps: [] },
    { id: uid(), name: "Customers", source: customers, steps: [] },
  ];
}
