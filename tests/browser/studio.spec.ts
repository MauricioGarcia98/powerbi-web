import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
test("guided workflow: import, transform, model, measure, visualize, publish and persist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Every great report starts with data."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Get data", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /Northstar sample data/ }).click();
  await page.getByRole("button", { name: "View lesson" }).click();
  await page.getByRole("button", { name: "Check my work" }).click();
  await expect(
    page.getByText("Lesson complete. Your project meets the objectives."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Transform data", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Products", exact: true }).click();
  await dialog.getByLabel("Transform column").selectOption("Product");
  await dialog.getByRole("button", { name: "Apply step" }).click();
  await expect(dialog.getByText("1. trim · Product")).toBeVisible();
  await dialog.getByRole("button", { name: "Close & Apply" }).click();
  await page.getByRole("button", { name: "Model view", exact: true }).click();
  await page
    .getByRole("button", { name: "New relationship", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create relationship", exact: true })
    .click();
  await expect(page.getByLabel("Delete Products relationship")).toBeVisible();
  await page
    .getByRole("button", { name: "New relationship", exact: true })
    .click();
  await page.getByLabel("From table (one)").selectOption("Customers");
  await page
    .getByRole("combobox", { name: "To column", exact: true })
    .selectOption("CustomerID");
  await page
    .getByRole("button", { name: "Create relationship", exact: true })
    .click();
  await page.getByRole("button", { name: "New measure", exact: true }).click();
  await page.getByRole("button", { name: "Save measure" }).click();
  await page.getByRole("button", { name: "Report view", exact: true }).click();
  await page.getByRole("button", { name: "Create your first visual" }).click();
  await expect(
    page.getByRole("combobox", { name: "Values", exact: true }),
  ).toHaveValue("@Total Sales");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Table", exact: true })
    .selectOption("Customers");
  await page
    .getByRole("combobox", { name: "Field", exact: true })
    .selectOption("Region");
  await page
    .getByRole("combobox", { name: "Value", exact: true })
    .selectOption({ label: "North" });
  await page.getByRole("button", { name: "Apply filter", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Customers[Region] = North" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close filters" }).click();
  await page.getByRole("button", { name: "Format", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Monthly sales");
  await page.getByLabel("Wide visual").check();
  await page.getByRole("button", { name: "Add page" }).click();
  await page.getByRole("button", { name: "Page settings" }).click();
  await page.getByLabel("Page name").fill("Details");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Build visual", exact: true }).click();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish to practice workspace", exact: true })
    .click();
  await expect(page.getByText("Snapshot", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /My first report Report/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Monthly sales");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Service practice" }).click();
  await expect(page.getByText("Snapshot", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("XLSX import, numeric visual, export and rejected invalid project", async ({
  page,
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Revenue").addRows([
    ["Region", "Amount"],
    ["North", 100],
    ["South", 200],
  ]);
  const content = await workbook.xlsx.writeBuffer();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Get data", exact: true })
    .first()
    .click();
  await page
    .locator('input[type=file][accept=".csv,.xlsx"]')
    .setInputFiles({
      name: "revenue.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(content),
    });
  await page.getByRole("button", { name: "Create your first visual" }).click();
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(2);
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await expect(page.locator(".kpi>span").first()).toHaveText("300");
  await page.getByRole("button", { name: "File", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project (.json)" }).click();
  const file = await downloaded;
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported.tables[0].source).toEqual([
    { Region: "North", Amount: 100 },
    { Region: "South", Amount: 200 },
  ]);
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1}'),
    });
  await expect(page.getByRole("alert")).toContainText("Invalid or unsupported");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".kpi>span").first()).toHaveText("300");
});
test("CSV import, invalid DAX, quiz scoring and small viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Get data", exact: true })
    .first()
    .click();
  await page.locator('input[type=file][accept=".csv,.xlsx"]').setInputFiles({
    name: "Example.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Region,Amount\nNorth,100\nSouth,200\n"),
  });
  await page.getByRole("button", { name: "Data view", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "North", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New measure", exact: true }).click();
  await page.getByLabel("DAX expression").fill("UNKNOWN(1)");
  await page.getByRole("button", { name: "Save measure" }).click();
  await expect(page.getByRole("alert")).toContainText("not implemented");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: /Knowledge check/ }).click();
  for (let i = 0; i < 5; i++)
    await page
      .locator(`input[name="question-${i}"]`)
      .nth([1, 0, 2, 1, 2][i])
      .check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Score: 5/5",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle learning pane" }).click();
  await page.getByRole("button", { name: "Report view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create your first visual" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
