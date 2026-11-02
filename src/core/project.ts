import Papa from "papaparse";
import type { Project, Row, Table } from "./model";
import { uid, rows, validateRelationship } from "./model";
export function csvTable(text: string, name: string): Table {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  if (!parsed.meta.fields?.length || !parsed.data.length)
    throw new Error("The CSV must contain headers and at least one data row.");
  if (
    Object.keys(parsed.meta.renamedHeaders ?? {}).length > 0 ||
    parsed.meta.fields.some((h) => !h.trim()) ||
    new Set(parsed.meta.fields).size !== parsed.meta.fields.length
  )
    throw new Error("Column names must be nonempty and unique.");
  const data: Row[] = parsed.data.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value === ""
          ? null
          : /^-?\d+(\.\d+)?$/.test(value) && !/^0\d/.test(value)
            ? Number(value)
            : value,
      ]),
    ),
  );
  return { id: uid(), name, source: data, steps: [] };
}
export async function importFile(file: File): Promise<Table[]> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a file smaller than 10 MB.");
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[^\w ]/g, "_");
  if (/\.csv$/i.test(file.name)) return [csvTable(await file.text(), name)];
  if (!/\.xlsx$/i.test(file.name))
    throw new Error("Supported data files: CSV and XLSX.");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const tables: Table[] = [];
  workbook.eachSheet((sheet) => {
    const headers = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((v) => String(v ?? "").trim());
    if (!headers.length) return;
    if (headers.some((h) => !h) || new Set(headers).size !== headers.length)
      throw new Error(
        `Sheet ${sheet.name} needs unique, nonempty column names in row 1.`,
      );
    const source: Row[] = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      source.push(
        Object.fromEntries(
          headers.map((h, i) => {
            const c = row.getCell(i + 1);
            const v = c.result ?? c.value;
            return [
              h,
              v instanceof Date
                ? v.toISOString().slice(0, 10)
                : typeof v === "object" && v !== null
                  ? c.text
                  : (v ?? null),
            ];
          }),
        ) as Row,
      );
    });
    if (source.length)
      tables.push({ id: uid(), name: sheet.name, source, steps: [] });
  });
  if (!tables.length) throw new Error("No populated worksheets were found.");
  return tables;
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const exportCsv = (t: Table) =>
  download(`${t.name}.csv`, Papa.unparse(rows(t)), "text/csv;charset=utf-8");
export function readProject(text: string): Project {
  const p = JSON.parse(text);
  const fail = () => {
    throw new Error(
      "Invalid or unsupported BI Practice project. Your current project was kept.",
    );
  };
  const str = (v: unknown) => typeof v === "string";
  const array = (v: unknown) => Array.isArray(v);
  const record = (v: unknown) =>
    v !== null && typeof v === "object" && !array(v);
  const cell = (v: unknown) =>
    v === null ||
    str(v) ||
    typeof v === "boolean" ||
    (typeof v === "number" && Number.isFinite(v));
  const table = (t: any) =>
    record(t) &&
    str(t.id) &&
    str(t.name) &&
    array(t.source) &&
    t.source.length > 0 &&
    t.source.every((r: any) => record(r) && Object.values(r).every(cell)) &&
    array(t.steps) &&
    t.steps.every(
      (s: any) =>
        record(s) &&
        str(s.id) &&
        [
          "trim",
          "uppercase",
          "filter",
          "number",
          "rename",
          "remove",
          "deduplicate",
        ].includes(s.kind) &&
        str(s.column) &&
        (s.value === undefined || str(s.value)),
    );
  const visual = (v: any) =>
    record(v) &&
    str(v.id) &&
    [
      "column",
      "bar",
      "line",
      "area",
      "donut",
      "table",
      "card",
      "slicer",
    ].includes(v.type) &&
    ["SUM", "AVERAGE", "COUNT", "MIN", "MAX"].includes(v.aggregation) &&
    ["title", "table", "category", "value", "color"].every((k) => str(v[k])) &&
    /^#[0-9a-f]{6}$/i.test(v.color) &&
    typeof v.wide === "boolean";
  const page = (v: any) =>
    record(v) &&
    str(v.id) &&
    str(v.name) &&
    array(v.visuals) &&
    v.visuals.every(visual);
  const measure = (v: any) =>
    record(v) && str(v.id) && str(v.name) && str(v.expression);
  const rel = (v: any) =>
    record(v) &&
    ["id", "from", "fromColumn", "to", "toColumn"].every((k) => str(v[k]));
  if (
    !record(p) ||
    p.version !== 1 ||
    !str(p.name) ||
    !array(p.tables) ||
    !p.tables.every(table) ||
    !array(p.relationships) ||
    !p.relationships.every(rel) ||
    !array(p.measures) ||
    !p.measures.every(measure) ||
    !array(p.pages) ||
    !p.pages.length ||
    !p.pages.every(page) ||
    !p.pages.some((v: any) => v.id === p.activePage) ||
    !array(p.filters) ||
    !p.filters.every(
      (v: any) => record(v) && str(v.table) && str(v.column) && cell(v.value),
    ) ||
    !array(p.completed) ||
    !p.completed.every(str) ||
    !array(p.publications)
  )
    fail();
  if (
    new Set(p.tables.map((t: any) => t.name)).size !== p.tables.length ||
    new Set(p.measures.map((m: any) => m.name)).size !== p.measures.length
  )
    fail();
  if (
    !p.publications.every(
      (v: any) =>
        record(v) &&
        str(v.id) &&
        str(v.name) &&
        str(v.date) &&
        array(v.pages) &&
        v.pages.every(page) &&
        array(v.tables) &&
        v.tables.every(table) &&
        array(v.measures) &&
        v.measures.every(measure) &&
        array(v.relationships) &&
        v.relationships.every(rel),
    )
  )
    fail();
  for (const t of p.tables) rows(t);
  const checked = { ...p, relationships: [] };
  for (const r of p.relationships) {
    validateRelationship(checked, r);
    checked.relationships.push(r);
  }
  return p as Project;
}
