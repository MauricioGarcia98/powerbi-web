import { columns, filteredRows, rows, tableByName } from "./model";
import type { Cell, Filter, Project, Row } from "./model";
type Node =
  | { kind: "literal"; value: Cell }
  | { kind: "ref"; table?: string; column: string }
  | { kind: "table"; name: string }
  | { kind: "call"; name: string; args: Node[] }
  | { kind: "binary"; op: string; left: Node; right: Node }
  | { kind: "unary"; op: string; child: Node };
type Token = { kind: string; value: string };
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let s = source;
  while (s.length) {
    const m =
      /^(\s+|\d+(?:\.\d+)?|"(?:[^"]|"")*"|'(?:[^']|'')*'|\[[^\]]+\]|[A-Za-z_][\w]*|>=|<=|<>|&&|\|\||[+*/(),=<>-])/.exec(
        s,
      );
    if (!m) throw new Error(`Unsupported syntax near: ${s.slice(0, 24)}`);
    const v = m[0];
    s = s.slice(v.length);
    if (!v.trim()) continue;
    tokens.push({
      kind: /^\d/.test(v)
        ? "number"
        : v[0] === '"'
          ? "string"
          : v[0] === "'"
            ? "quoted"
            : v[0] === "["
              ? "column"
              : /^[A-Za-z_]/.test(v)
                ? "identifier"
                : "symbol",
      value: v,
    });
  }
  return tokens;
}
export function parseDax(source: string): Node {
  const ts = tokenize(source);
  let i = 0;
  const peek = () => ts[i]?.value;
  const take = (v: string) => {
    if (peek() !== v)
      throw new Error(`Expected '${v}', got '${peek() ?? "end of formula"}'.`);
    i++;
  };
  const primary = (): Node => {
    const t = ts[i++];
    if (!t) throw new Error("Incomplete formula.");
    if (t.value === "-" || t.value === "+")
      return { kind: "unary", op: t.value, child: primary() };
    if (t.value === "(") {
      const n = expr(0);
      take(")");
      return n;
    }
    if (t.kind === "number") return { kind: "literal", value: Number(t.value) };
    if (t.kind === "string")
      return {
        kind: "literal",
        value: t.value.slice(1, -1).replaceAll('""', '"'),
      };
    if (t.kind === "column")
      return { kind: "ref", column: t.value.slice(1, -1) };
    if (t.kind === "identifier" || t.kind === "quoted") {
      const name =
        t.kind === "quoted"
          ? t.value.slice(1, -1).replaceAll("''", "'")
          : t.value;
      if (ts[i]?.kind === "column")
        return { kind: "ref", table: name, column: ts[i++].value.slice(1, -1) };
      if (peek() === "(") {
        i++;
        const args: Node[] = [];
        if (peek() !== ")") {
          do {
            args.push(expr(0));
            if (peek() !== ",") break;
            i++;
          } while (true);
        }
        take(")");
        return { kind: "call", name: name.toUpperCase(), args };
      }
      return { kind: "table", name };
    }
    throw new Error(`Unexpected '${t.value}'.`);
  };
  const precedence: Record<string, number> = {
    "||": 1,
    "&&": 2,
    "=": 3,
    "<>": 3,
    ">": 3,
    "<": 3,
    ">=": 3,
    "<=": 3,
    "+": 4,
    "-": 4,
    "*": 5,
    "/": 5,
  };
  const expr = (min: number): Node => {
    let left = primary();
    while (peek() in precedence && precedence[peek()] >= min) {
      const op = ts[i++].value;
      left = { kind: "binary", op, left, right: expr(precedence[op] + 1) };
    }
    return left;
  };
  const result = expr(0);
  if (i !== ts.length) throw new Error(`Unexpected '${peek()}'.`);
  return result;
}
type Context = {
  project: Project;
  filters: Filter[];
  row?: Row;
  rowTable?: string;
  stack: string[];
};
type Value = Cell | Row[];
function scalar(v: Value): Cell {
  if (Array.isArray(v)) throw new Error("A scalar value was expected.");
  return v;
}
function number(v: Value): number {
  const s = scalar(v);
  if (s === null) return 0;
  if (typeof s !== "number")
    throw new Error("This expression requires numeric values.");
  return s;
}
function evaluate(node: Node, ctx: Context): Value {
  const ev = (n: Node) => evaluate(n, ctx),
    args = node.kind === "call" ? node.args : [];
  if (node.kind === "literal") return node.value;
  if (node.kind === "table")
    return filteredRows(ctx.project, node.name, ctx.filters);
  if (node.kind === "ref") {
    if (node.table) {
      if (!columns(tableByName(ctx.project, node.table)).includes(node.column))
        throw new Error(
          `Column '${node.column}' was not found in '${node.table}'.`,
        );
      if (ctx.row && ctx.rowTable === node.table)
        return ctx.row[node.column] ?? null;
      throw new Error(
        `A single value for ${node.table}[${node.column}] cannot be determined. Use an aggregation.`,
      );
    }
    const m = ctx.project.measures.find((m) => m.name === node.column);
    if (!m) throw new Error(`Measure [${node.column}] was not found.`);
    if (ctx.stack.includes(m.name))
      throw new Error("Circular measure reference.");
    const filters =
      ctx.row && ctx.rowTable
        ? [
            ...ctx.filters,
            ...Object.entries(ctx.row).map(([column, value]) => ({
              table: ctx.rowTable!,
              column,
              value,
            })),
          ]
        : ctx.filters;
    return evaluate(parseDax(m.expression), {
      ...ctx,
      filters,
      stack: [...ctx.stack, m.name],
    });
  }
  if (node.kind === "unary")
    return (node.op === "-" ? -1 : 1) * number(ev(node.child));
  if (node.kind === "binary") {
    const a = scalar(ev(node.left)),
      b = scalar(ev(node.right));
    if (["+", "-", "*", "/"].includes(node.op)) {
      const x = number(a),
        y = number(b);
      if (node.op === "+") return x + y;
      if (node.op === "-") return x - y;
      if (node.op === "*") return x * y;
      if (y === 0)
        throw new Error("Division by zero. Use DIVIDE for a blank result.");
      return x / y;
    }
    switch (node.op) {
      case "=":
        return a === b;
      case "<>":
        return a !== b;
      case ">":
        return a !== null && b !== null && a > b;
      case "<":
        return a !== null && b !== null && a < b;
      case ">=":
        return a !== null && b !== null && a >= b;
      case "<=":
        return a !== null && b !== null && a <= b;
      case "&&":
        return Boolean(a && b);
      case "||":
        return Boolean(a || b);
    }
  }
  if (node.kind !== "call") throw new Error("Invalid expression.");
  const arity = (min: number, max = min) => {
    if (args.length < min || args.length > max)
      throw new Error(
        `${node.name} expects ${min === max ? min : `${min}–${max}`} arguments.`,
      );
  };
  if (
    ["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "DISTINCTCOUNT"].includes(
      node.name,
    )
  ) {
    arity(1);
    const ref = args[0];
    if (ref.kind !== "ref" || !ref.table)
      throw new Error(`${node.name} requires a table column reference.`);
    if (!columns(tableByName(ctx.project, ref.table)).includes(ref.column))
      throw new Error(`Column '${ref.column}' was not found.`);
    const values = filteredRows(ctx.project, ref.table, ctx.filters).map(
      (r) => r[ref.column],
    );
    const nonblank = values.filter((v) => v !== null && v !== undefined);
    if (node.name === "DISTINCTCOUNT")
      return values.length ? new Set(values).size : null;
    if (node.name === "COUNT") return nonblank.length || null;
    if (!nonblank.length) return null;
    const ns = nonblank.map(number);
    if (node.name === "SUM") return ns.reduce((a, b) => a + b, 0);
    if (node.name === "AVERAGE")
      return ns.reduce((a, b) => a + b, 0) / ns.length;
    if (node.name === "MIN") return Math.min(...ns);
    return Math.max(...ns);
  }
  switch (node.name) {
    case "COUNTROWS": {
      arity(1);
      const rs = ev(args[0]);
      if (!Array.isArray(rs)) throw new Error("COUNTROWS requires a table.");
      return rs.length || null;
    }
    case "DIVIDE": {
      arity(2, 3);
      const denominator = number(ev(args[1]));
      return denominator === 0
        ? args[2]
          ? ev(args[2])
          : null
        : number(ev(args[0])) / denominator;
    }
    case "IF":
      arity(2, 3);
      return ev(args[0]) ? ev(args[1]) : args[2] ? ev(args[2]) : null;
    case "ROUND":
      arity(2);
      return (
        Math.round(number(ev(args[0])) * 10 ** number(ev(args[1]))) /
        10 ** number(ev(args[1]))
      );
    case "ABS":
      arity(1);
      return Math.abs(number(ev(args[0])));
    case "BLANK":
      arity(0);
      return null;
    case "TRUE":
      arity(0);
      return true;
    case "FALSE":
      arity(0);
      return false;
    case "ISBLANK":
      arity(1);
      return ev(args[0]) === null;
    case "COALESCE": {
      arity(1, 20);
      for (const a of args) {
        const v = ev(a);
        if (v !== null) return v;
      }
      return null;
    }
    case "RELATED": {
      arity(1);
      const ref = args[0];
      if (!ctx.row || ref.kind !== "ref" || !ref.table)
        throw new Error("RELATED needs a column and a row context.");
      const rel = ctx.project.relationships.find(
        (r) => r.from === ref.table && r.to === ctx.rowTable,
      );
      if (!rel) throw new Error("No relationship is available for RELATED.");
      return (
        rows(tableByName(ctx.project, ref.table)).find(
          (r) => r[rel.fromColumn] === ctx.row![rel.toColumn],
        )?.[ref.column] ?? null
      );
    }
    case "SUMX":
    case "AVERAGEX":
    case "FILTER": {
      arity(2);
      const rs = ev(args[0]);
      if (!Array.isArray(rs)) throw new Error(`${node.name} requires a table.`);
      const root = args[0];
      const table =
        root.kind === "table"
          ? root.name
          : root.kind === "call" && root.args[0]?.kind === "table"
            ? root.args[0].name
            : undefined;
      if (!table)
        throw new Error(
          "This iterator requires a named table or FILTER(named table, expression).",
        );
      const values = rs.map((row) =>
        evaluate(args[1], { ...ctx, row, rowTable: table }),
      );
      if (node.name === "FILTER")
        return rs.filter((_, i) => Boolean(values[i]));
      const ns = values.filter((v) => v !== null).map(number);
      return ns.length
        ? ns.reduce((a, b) => a + b, 0) /
            (node.name === "AVERAGEX" ? ns.length : 1)
        : null;
    }
    case "CALCULATE": {
      arity(1, 20);
      let filters = [...ctx.filters];
      if (ctx.row && ctx.rowTable)
        filters.push(
          ...Object.entries(ctx.row).map(([column, value]) => ({
            table: ctx.rowTable!,
            column,
            value,
          })),
        );
      for (const arg of args.slice(1)) {
        if (
          arg.kind === "call" &&
          (arg.name === "ALL" || arg.name === "REMOVEFILTERS") &&
          arg.args.length === 1
        ) {
          const target = arg.args[0];
          if (target.kind === "table") {
            tableByName(ctx.project, target.name);
            filters = filters.filter((f) => f.table !== target.name);
          } else if (target.kind === "ref" && target.table)
            filters = filters.filter(
              (f) => !(f.table === target.table && f.column === target.column),
            );
          else throw new Error("Use a table or column in REMOVEFILTERS.");
        } else if (
          arg.kind === "binary" &&
          arg.op === "=" &&
          arg.left.kind === "ref" &&
          arg.left.table
        ) {
          const ref = arg.left;
          if (
            !columns(tableByName(ctx.project, ref.table!)).includes(ref.column)
          )
            throw new Error(`Column '${ref.column}' was not found.`);
          const value = scalar(ev(arg.right));
          filters = filters.filter(
            (f) => !(f.table === ref.table && f.column === ref.column),
          );
          filters.push({ table: ref.table!, column: ref.column, value });
        } else
          throw new Error(
            "Supported CALCULATE filters: Table[Column] = value, ALL(Table), REMOVEFILTERS(Table[Column]).",
          );
      }
      return evaluate(args[0], {
        ...ctx,
        filters,
        row: undefined,
        rowTable: undefined,
      });
    }
    default:
      throw new Error(
        `Function ${node.name} is not implemented in this practice engine.`,
      );
  }
}
export function dax(
  expression: string,
  project: Project,
  filters = project.filters,
): Cell {
  return scalar(
    evaluate(parseDax(expression), { project, filters, stack: [] }),
  );
}
export const supportedFunctions = [
  "SUM",
  "AVERAGE",
  "MIN",
  "MAX",
  "COUNT",
  "DISTINCTCOUNT",
  "COUNTROWS",
  "SUMX",
  "AVERAGEX",
  "DIVIDE",
  "IF",
  "ROUND",
  "ABS",
  "BLANK",
  "ISBLANK",
  "TRUE",
  "FALSE",
  "COALESCE",
  "RELATED",
  "FILTER",
  "CALCULATE",
];
