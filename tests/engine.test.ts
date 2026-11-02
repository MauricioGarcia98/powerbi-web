import { describe, expect, it } from "vitest";
import {
  blankProject,
  filteredRows,
  rows,
  sampleTables,
  validateRelationship,
} from "../src/core/model";
import type { Project, Relationship } from "../src/core/model";
import { dax } from "../src/core/dax";
import { csvTable, readProject } from "../src/core/project";
import { lessons } from "../src/core/course";
import { visualData } from "../src/components/Visual";
function fixture(): Project {
  return {
    ...blankProject(),
    tables: [
      {
        id: "s",
        name: "Sales",
        source: [
          { ProductID: 1, Amount: 100, Quantity: 2 },
          { ProductID: 2, Amount: 60, Quantity: 3 },
          { ProductID: 1, Amount: 40, Quantity: 1 },
        ],
        steps: [],
      },
      {
        id: "p",
        name: "Products",
        source: [
          { ProductID: 1, Category: "A", Price: 50 },
          { ProductID: 2, Category: "B", Price: 20 },
        ],
        steps: [],
      },
    ],
    relationships: [
      {
        id: "r",
        from: "Products",
        fromColumn: "ProductID",
        to: "Sales",
        toColumn: "ProductID",
      },
    ],
    measures: [
      { id: "m", name: "Total Sales", expression: "SUM(Sales[Amount])" },
    ],
  };
}
describe("DAX calculations", () => {
  it("builds raw-column chart aggregates and reports invalid filter columns", () => {
    const p = fixture();
    const result = visualData(p, {
      id: "v",
      type: "column",
      title: "Sales",
      table: "Sales",
      category: "ProductID",
      value: "Amount",
      aggregation: "SUM",
      color: "#487d86",
      wide: false,
    });
    expect(result.map((d) => d.value)).toEqual([140, 60]);
    expect(() =>
      dax('CALCULATE([Total Sales], Products[Missing] = "A")', p),
    ).toThrow(/not found/);
  });
  it("aggregates with filter context propagated through relationships", () => {
    const p = fixture();
    expect(dax("[Total Sales]", p)).toBe(200);
    p.filters = [{ table: "Products", column: "Category", value: "A" }];
    expect(dax("[Total Sales]", p)).toBe(140);
    expect(dax("COUNTROWS(Sales)", p)).toBe(2);
    expect(dax("AVERAGE(Sales[Amount])", p)).toBe(70);
  });
  it("evaluates arithmetic, nested functions, and safe division", () => {
    const p = fixture();
    expect(dax("ROUND(DIVIDE([Total Sales], 3), 2)", p)).toBe(66.67);
    expect(dax("DIVIDE(10, 0)", p)).toBeNull();
    expect(dax("DIVIDE(10, 0, 7)", p)).toBe(7);
    expect(dax("IF([Total Sales] > 150, 1, 0)", p)).toBe(1);
    expect(dax("2 + 3 * 4", p)).toBe(14);
  });
  it("supports quoted table names, escaped strings and row iterators", () => {
    const p = fixture();
    expect(dax("SUM('Sales'[Amount])", p)).toBe(200);
    expect(
      dax("SUMX(Sales, Sales[Quantity] * RELATED(Products[Price]))", p),
    ).toBe(210);
    expect(dax("COUNTROWS(FILTER(Sales, Sales[Amount] > 50))", p)).toBe(2);
    expect(
      dax("SUMX(FILTER(Sales, Sales[Amount] > 50), Sales[Amount])", p),
    ).toBe(160);
  });
  it("CALCULATE replaces a column filter and removes explicitly selected filters", () => {
    const p = fixture();
    p.filters = [{ table: "Products", column: "Category", value: "A" }];
    expect(dax('CALCULATE([Total Sales], Products[Category] = "B")', p)).toBe(
      60,
    );
    expect(dax("CALCULATE([Total Sales], ALL(Products))", p)).toBe(200);
    expect(
      dax("CALCULATE([Total Sales], REMOVEFILTERS(Products[Category]))", p),
    ).toBe(200);
  });
  it("transitions iterator row context for measures", () => {
    expect(dax("SUMX(Products, [Total Sales])", fixture())).toBe(200);
  });
  it("returns BLANK for empty sums and rejects unsupported syntax", () => {
    const p = fixture();
    p.filters = [{ table: "Products", column: "Category", value: "missing" }];
    expect(dax("[Total Sales]", p)).toBeNull();
    expect(() => dax("EVALUATE Sales", p)).toThrow();
    expect(() => dax("TOTALYTD([Total Sales], Sales[Date])", p)).toThrow(
      /not implemented/,
    );
    expect(() => dax("SUM(Sales[Missing])", p)).toThrow(/not found/);
    expect(() => dax("Sales[Amount]", p)).toThrow(/single value/);
    expect(() => dax("1 / 0", p)).toThrow(/Division by zero/);
  });
  it("detects cycles and does not execute code", () => {
    const p = fixture();
    p.measures.push({ id: "cycle", name: "Cycle", expression: "[Cycle]" });
    expect(() => dax("[Cycle]", p)).toThrow(/Circular/);
    expect(() => dax('globalThis.alert("oops")', p)).toThrow();
  });
  it("validates arity and scalar/table distinctions", () => {
    expect(() => dax("SUM()", fixture())).toThrow(/arguments/);
    expect(() => dax("COUNTROWS(1)", fixture())).toThrow(/table/);
    expect(() => dax("Sales", fixture())).toThrow(/scalar/);
  });
});
describe("query and model", () => {
  it("keeps source rows intact and runs transformations in order", () => {
    const t = {
      id: "x",
      name: "Data",
      source: [
        { Name: " a ", Value: "12" },
        { Name: "a", Value: "12" },
        { Name: " b ", Value: "8" },
      ],
      steps: [
        { id: "1", kind: "trim" as const, column: "Name" },
        { id: "2", kind: "number" as const, column: "Value" },
        { id: "3", kind: "deduplicate" as const, column: "Name" },
      ],
    };
    expect(rows(t)).toEqual([
      { Name: "a", Value: 12 },
      { Name: "b", Value: 8 },
    ]);
    expect(t.source[0].Name).toBe(" a ");
  });
  it("reports invalid conversions and duplicate renames", () => {
    const t = {
      id: "x",
      name: "Data",
      source: [{ A: "abc", B: 1 }],
      steps: [{ id: "1", kind: "number" as const, column: "A" }],
    };
    expect(() => rows(t)).toThrow(/Cannot convert/);
    expect(() =>
      rows({
        ...t,
        steps: [{ id: "1", kind: "rename", column: "A", value: "B" }],
      }),
    ).toThrow(/already exists/);
  });
  it("enforces uniqueness, type compatibility, and acyclic direction", () => {
    const p = fixture();
    const r: Relationship = {
      id: "x",
      from: "Sales",
      fromColumn: "ProductID",
      to: "Products",
      toColumn: "ProductID",
    };
    expect(() => validateRelationship(p, r)).toThrow(/unique/);
    expect(() =>
      validateRelationship(
        { ...p, relationships: [] },
        { ...r, from: "Products", to: "Sales" },
      ),
    ).not.toThrow();
    expect(() =>
      validateRelationship(p, { ...r, from: "Products", to: "Sales" }),
    ).toThrow(/already exists/);
  });
  it("does not remove orphan facts when an unrelated dimension is unfiltered", () => {
    const p = fixture();
    p.tables[0].source.push({ ProductID: 9, Amount: 10, Quantity: 1 });
    expect(filteredRows(p, "Sales")).toHaveLength(4);
    p.filters = [{ table: "Products", column: "Category", value: "A" }];
    expect(filteredRows(p, "Sales")).toHaveLength(2);
  });
  it("handles quoted CSV, numbers, leading-zero identifiers and blank cells", () => {
    const t = csvTable(
      'ID,Name,Value\n001,"Doe, Jane",10\n002,Sam,\n',
      "People",
    );
    expect(t.source).toEqual([
      { ID: "001", Name: "Doe, Jane", Value: 10 },
      { ID: "002", Name: "Sam", Value: null },
    ]);
    expect(() => csvTable("A,B\n1,2,3", "bad")).toThrow();
  });
  it("round-trips a project and rejects malformed imports", () => {
    expect(readProject(JSON.stringify(fixture()))).toEqual(fixture());
    for (const p of [
      null,
      {},
      { ...fixture(), version: 2 },
      { ...fixture(), tables: [null] },
      { ...fixture(), publications: [{}] },
      { ...fixture(), pages: [] },
    ])
      expect(() => readProject(JSON.stringify(p))).toThrow();
  });
  it("course assessments reject missing work", () => {
    const empty = blankProject();
    expect(lessons.every((l) => !l.check(empty))).toBe(true);
    const loaded = { ...empty, tables: sampleTables() };
    expect(lessons[0].check(loaded)).toBe(true);
    expect(lessons[1].check(loaded)).toBe(false);
  });
});
