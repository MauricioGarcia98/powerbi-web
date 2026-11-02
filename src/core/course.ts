import type { Project } from "./model";
import { dax } from "./dax";
export type Lesson = {
  id: string;
  title: string;
  section: string;
  minutes: number;
  description: string;
  steps: string[];
  check: (p: Project) => boolean;
  hint: string;
  url: string;
};
const base = "https://learn.microsoft.com/en-us/power-bi/";
export const lessons: Lesson[] = [
  {
    id: "import",
    title: "Meet your data",
    section: "01 · CONNECT",
    minutes: 5,
    description:
      "Every report starts with a question. Explore sales at Northstar, a fictional retailer, and load its three tables.",
    steps: [
      "Open Home → Get data.",
      "Select Northstar sample data.",
      "Open Data view and inspect Sales, Products and Customers.",
    ],
    check: (p) =>
      ["Sales", "Products", "Customers"].every((n) =>
        p.tables.some((t) => t.name === n),
      ),
    hint: "Use the sample dataset for this course. It includes 240 sales across 12 months.",
    url: base + "connect-data/desktop-quickstart-connect-to-data",
  },
  {
    id: "transform",
    title: "Clean with Power Query",
    section: "02 · PREPARE",
    minutes: 8,
    description:
      "Product names contain leading and trailing spaces. Clean them before using them in your report.",
    steps: [
      "Open Transform data and select Products.",
      "Select the Product column.",
      "Apply Trim, then Close & Apply.",
    ],
    check: (p) =>
      p.tables.some(
        (t) =>
          t.name === "Products" &&
          t.steps.some((s) => s.kind === "trim" && s.column === "Product"),
      ),
    hint: "Applied Steps preserves the original data. Remove a step to undo a transformation.",
    url: base + "transform-model/desktop-query-overview",
  },
  {
    id: "model",
    title: "Build a star schema",
    section: "03 · MODEL",
    minutes: 10,
    description:
      "Dimension tables describe the products and customers in the Sales fact table. Relationships let their filters reach Sales.",
    steps: [
      "Open Model view → New relationship.",
      "Connect Products[ProductID] (one) to Sales[ProductID] (many).",
      "Connect Customers[CustomerID] (one) to Sales[CustomerID] (many).",
    ],
    check: (p) =>
      ["Products", "Customers"].every((n) =>
        p.relationships.some(
          (r) =>
            r.from === n &&
            r.to === "Sales" &&
            r.fromColumn === `${n === "Products" ? "Product" : "Customer"}ID` &&
            r.toColumn === r.fromColumn,
        ),
      ),
    hint: "The one-side key must be unique. Filters travel from the dimension to the fact table.",
    url: base + "transform-model/desktop-relationships-understand",
  },
  {
    id: "measure",
    title: "Your first DAX measure",
    section: "04 · CALCULATE",
    minutes: 10,
    description:
      "Measures calculate results in the current filter context. Create a reusable total for your sales.",
    steps: [
      "Choose Modeling → New measure.",
      "Name it Total Sales.",
      "Enter SUM(Sales[SalesAmount]) and save.",
    ],
    check: (p) => {
      try {
        return p.measures.some(
          (m) =>
            m.name === "Total Sales" &&
            Number(dax(m.expression, p, [])) ===
              p.tables
                .find((t) => t.name === "Sales")
                ?.source.reduce((a, r) => a + Number(r.SalesAmount), 0),
        );
      } catch {
        return false;
      }
    },
    hint: "The name and expression have separate fields. Enter only SUM(Sales[SalesAmount]) in the expression field.",
    url: base + "transform-model/desktop-quickstart-learn-dax-basics",
  },
  {
    id: "visual",
    title: "Tell the story visually",
    section: "05 · VISUALIZE",
    minutes: 8,
    description:
      "Compare monthly sales in a column chart. The field wells connect the data model to the visual.",
    steps: [
      "In Report view, add a Column chart.",
      "In Build visual, select Sales and Month for the X-axis.",
      "Select [Total Sales] for Values.",
    ],
    check: (p) =>
      p.pages.some((pg) =>
        pg.visuals.some(
          (v) =>
            v.type === "column" &&
            v.table === "Sales" &&
            v.category === "Month" &&
            v.value === "@Total Sales",
        ),
      ),
    hint: "Select your chart to edit its field wells in the Visualizations pane.",
    url: base + "visuals/power-bi-visualization-types-for-reports-and-q-and-a",
  },
  {
    id: "filter",
    title: "Explore filter context",
    section: "06 · INTERACT",
    minutes: 8,
    description:
      "A filter changes the rows available to your measure. Filter the report to a single customer region.",
    steps: [
      "Open the Filters pane beside the canvas.",
      "Select Customers, Region and North.",
      "Apply the filter and observe your chart.",
    ],
    check: (p) =>
      p.filters.some(
        (f) =>
          f.table === "Customers" &&
          f.column === "Region" &&
          f.value === "North",
      ),
    hint: "The Customers → Sales relationship must exist for the regional filter to affect sales.",
    url: base + "create-reports/power-bi-report-add-filter",
  },
  {
    id: "format",
    title: "Make the report readable",
    section: "07 · DESIGN",
    minutes: 5,
    description:
      "Descriptive titles and consistent colors help readers understand a report without extra explanation.",
    steps: [
      "Select your chart, then open the Format tab.",
      "Set its title to Monthly sales.",
      "Choose a color and enable Wide visual.",
    ],
    check: (p) =>
      p.pages.some((pg) =>
        pg.visuals.some((v) => v.title === "Monthly sales" && v.wide),
      ),
    hint: "Formatting changes presentation; the measure remains the same.",
    url:
      base +
      "visuals/power-bi-visualization-customize-title-background-and-legend",
  },
  {
    id: "pages",
    title: "Organize your report",
    section: "08 · REPORT",
    minutes: 5,
    description:
      "Use report pages to separate an overview from detailed analysis.",
    steps: [
      "Use the + button in the bottom page bar.",
      "Rename the new page to Details.",
      "Add a Table visual to Details.",
    ],
    check: (p) =>
      p.pages.some(
        (pg) =>
          pg.name === "Details" && pg.visuals.some((v) => v.type === "table"),
      ),
    hint: "Double-click a page tab to rename it. Each page has its own visuals.",
    url: base + "create-reports/power-bi-reports",
  },
  {
    id: "publish",
    title: "From Desktop to Service",
    section: "09 · SERVICE",
    minutes: 8,
    description:
      "Practice the publishing workflow with a local workspace snapshot. Real Power BI Service adds accounts, permissions and cloud infrastructure.",
    steps: [
      "Click Publish in the ribbon.",
      "Choose Publish to practice workspace.",
      "Open Service view and inspect your report snapshot.",
    ],
    check: (p) => p.publications.length > 0,
    hint: "Practice publishing is local to this browser. It does not upload data or create a real Power BI workspace.",
    url: base + "create-reports/desktop-upload-desktop-files",
  },
];
export const quiz = [
  {
    question: "What does a measure respond to when a slicer selection changes?",
    options: [
      "The file name",
      "The current filter context",
      "Only the original row order",
    ],
    correct: 1,
    explanation:
      "Measures are evaluated in the current filter context, including slicers and related dimension filters.",
  },
  {
    question:
      "Which table normally belongs on the one side of a ProductID relationship?",
    options: [
      "Products, with unique ProductID values",
      "Sales, with repeated ProductID values",
      "Both tables must contain duplicates",
    ],
    correct: 0,
    explanation:
      "The dimension key on the one side must be unique. The fact table can repeat that key.",
  },
  {
    question: "When should you use Power Query?",
    options: [
      "To share workspace permissions",
      "To arrange a chart legend",
      "To import and transform data before modeling",
    ],
    correct: 2,
    explanation:
      "Power Query prepares the data before it is loaded into the model.",
  },
  {
    question: "Which expression avoids a division-by-zero error?",
    options: [
      "SUM(Sales[SalesAmount]) / 0",
      "DIVIDE([Profit], [Total Sales])",
      "COUNTROWS(0)",
    ],
    correct: 1,
    explanation:
      "DIVIDE returns BLANK, or its optional alternate result, when the denominator is zero.",
  },
  {
    question: "What is needed to publish to the real Power BI Service?",
    options: [
      "Only a local JSON export",
      "A browser bookmark",
      "A Power BI account and the appropriate workspace permissions and license",
    ],
    correct: 2,
    explanation:
      "The real service requires authentication, permissions and a suitable license. The local practice workspace simulates only the workflow.",
  },
];
