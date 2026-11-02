import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  BarChartHorizontal,
  LineChart,
  AreaChart,
  Donut,
  Table2,
  Hash,
  Filter as FilterIcon,
  Database,
  Network,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  Plus,
  X,
  Upload,
  Download,
  Save,
  Undo2,
  Redo2,
  Settings2,
  Paintbrush,
  Play,
  ArrowRight,
  ArrowUpRight,
  GraduationCap,
  Cloud,
  FileSpreadsheet,
  FolderOpen,
  Trash2,
  Copy,
  Grip,
  Search,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Monitor,
  FileJson,
  ExternalLink,
} from "lucide-react";
import type {
  Cell,
  Filter,
  Project,
  Step,
  Table,
  Visual,
  VisualType,
} from "./core/model";
import {
  blankProject,
  columns,
  rows,
  sampleTables,
  uid,
  validateRelationship,
} from "./core/model";
import { dax, supportedFunctions } from "./core/dax";
import { download, exportCsv, importFile, readProject } from "./core/project";
import { lessons, quiz } from "./core/course";
import { ReportVisual, formatNumber } from "./components/Visual";
import { DataGrid } from "./components/DataGrid";

const storageKey = "bi-practice-project-v1";
const visualTypes: {
  type: VisualType;
  label: string;
  icon: typeof BarChart3;
}[] = [
  { type: "column", label: "Column chart", icon: BarChart3 },
  { type: "bar", label: "Bar chart", icon: BarChartHorizontal },
  { type: "line", label: "Line chart", icon: LineChart },
  { type: "area", label: "Area chart", icon: AreaChart },
  { type: "donut", label: "Donut chart", icon: Donut },
  { type: "table", label: "Table", icon: Table2 },
  { type: "card", label: "Card", icon: Hash },
  { type: "slicer", label: "Slicer", icon: FilterIcon },
];
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const focusable = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function QueryEditor({
  project,
  onApply,
  onClose,
}: {
  project: Project;
  onApply: (tables: Table[]) => void;
  onClose: () => void;
}) {
  const [tables, setTables] = useState(() => structuredClone(project.tables));
  const [name, setName] = useState(tables[0]?.name ?? "");
  const [column, setColumn] = useState("");
  const [kind, setKind] = useState<Step["kind"]>("trim");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const table = tables.find((t) => t.name === name);
  const data = table ? rows(table) : [];
  const apply = () => {
    if (!table || !column) {
      setError("Select a column first.");
      return;
    }
    try {
      const updated = {
        ...table,
        steps: [...table.steps, { id: uid(), kind, column, value }],
      };
      rows(updated);
      setTables(tables.map((t) => (t.id === table.id ? updated : t)));
      setError("");
      if (kind === "rename") setColumn(value);
      if (kind === "remove") setColumn("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = () => {
    try {
      const candidate = { ...project, tables };
      for (const r of project.relationships)
        validateRelationship(
          {
            ...candidate,
            relationships: project.relationships.filter((x) => x.id !== r.id),
          },
          r,
        );
      onApply(tables);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal title="Power Query Editor · practice" wide onClose={onClose}>
      <div className="query-ribbon">
        <label>
          Transform
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Step["kind"])}
          >
            <option value="trim">Format → Trim</option>
            <option value="uppercase">Format → UPPERCASE</option>
            <option value="number">Data type → Decimal number</option>
            <option value="filter">Keep matching rows</option>
            <option value="deduplicate">Remove duplicates</option>
            <option value="rename">Rename column</option>
            <option value="remove">Remove column</option>
          </select>
        </label>
        <label>
          Column
          <select
            aria-label="Transform column"
            value={column}
            onChange={(e) => setColumn(e.target.value)}
          >
            <option value="">Select column</option>
            {table && columns(table).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {["filter", "rename"].includes(kind) && (
          <label>
            {kind === "rename" ? "New name" : "Exact value"}
            <input value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        )}
        <button className="secondary" onClick={apply}>
          Apply step
        </button>
        <button className="primary" onClick={save}>
          <Check size={16} />
          Close & Apply
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="query-layout">
        <aside>
          <h4>Queries [{tables.length}]</h4>
          {tables.map((t) => (
            <button
              className={t.name === name ? "active" : ""}
              key={t.id}
              onClick={() => {
                setName(t.name);
                setColumn("");
              }}
            >
              <Table2 size={15} />
              {t.name}
            </button>
          ))}
        </aside>
        <DataGrid data={data} selected={column} onColumn={setColumn} />
        <aside className="applied-steps">
          <h4>Query settings</h4>
          <small>NAME</small>
          <strong>{name}</strong>
          <small>APPLIED STEPS</small>
          <div className="query-step">
            <Database size={14} />
            Source
          </div>
          {table?.steps.map((s, i) => (
            <div className="query-step" key={s.id}>
              <span>
                {i + 1}. {s.kind} · {s.column}
              </span>
              <button
                aria-label={`Remove ${s.kind} step`}
                onClick={() => {
                  try {
                    const updated = {
                      ...table,
                      steps: table.steps.filter((x) => x.id !== s.id),
                    };
                    rows(updated);
                    setTables(
                      tables.map((t) => (t.id === table.id ? updated : t)),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <p>Steps run in order. Source rows stay intact.</p>
        </aside>
      </div>
      <div className="modal-foot">
        This editor implements the listed transformations. Editing Power Query M
        is not supported.
      </div>
    </Modal>
  );
}

export default function App() {
  const [loadWarning] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v) readProject(v);
      return "";
    } catch {
      return "Saved project could not be loaded. Import a backup JSON file to recover it; the original browser entry has been preserved.";
    }
  });
  const [project, setProject] = useState<Project>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? readProject(saved) : blankProject();
    } catch {
      return blankProject();
    }
  });
  const [persistAllowed, setPersistAllowed] = useState(!loadWarning);
  const [saveError, setSaveError] = useState("");
  const [view, setView] = useState<"report" | "data" | "model" | "service">(
    "report",
  );
  const [ribbon, setRibbon] = useState("Home");
  const [courseOpen, setCourseOpen] = useState(true);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [lessonFeedback, setLessonFeedback] = useState("");
  const [selected, setSelected] = useState("");
  const [pane, setPane] = useState<"build" | "format">("build");
  const [tableName, setTableName] = useState("Sales");
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [measureName, setMeasureName] = useState("Total Sales");
  const [expression, setExpression] = useState("SUM(Sales[SalesAmount])");
  const [editingMeasure, setEditingMeasure] = useState("");
  const [relFrom, setRelFrom] = useState("Products");
  const [relFromColumn, setRelFromColumn] = useState("ProductID");
  const [relTo, setRelTo] = useState("Sales");
  const [relToColumn, setRelToColumn] = useState("ProductID");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [publication, setPublication] = useState("");
  const undoStack = useRef<Project[]>([]);
  const redoStack = useRef<Project[]>([]);
  const dataInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const page =
    project.pages.find((p) => p.id === project.activePage) ?? project.pages[0];
  const visual = page.visuals.find((v) => v.id === selected);
  const lesson = lessons[lessonIndex];
  const table =
    project.tables.find((t) => t.name === tableName) ?? project.tables[0];
  const update = (next: Project) => {
    undoStack.current = [...undoStack.current.slice(-19), project];
    redoStack.current = [];
    setProject(next);
  };
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    if (!persistAllowed) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(project));
      setSaveError("");
    } catch {
      setSaveError(
        "Browser storage is full. Export your project to keep your work.",
      );
    }
  }, [project, persistAllowed]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  const open = (name: string) => {
    setError("");
    setModal(name);
  };
  const undo = () => {
    const previous = undoStack.current.pop();
    if (previous) {
      redoStack.current.push(project);
      setProject(previous);
      setSelected("");
    }
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (next) {
      undoStack.current.push(project);
      setProject(next);
      setSelected("");
    }
  };
  const updateVisual = (patch: Partial<Visual>) =>
    update({
      ...project,
      pages: project.pages.map((p) =>
        p.id === page.id
          ? {
              ...p,
              visuals: p.visuals.map((v) =>
                v.id === selected ? { ...v, ...patch } : v,
              ),
            }
          : p,
      ),
    });
  const addVisual = (type: VisualType) => {
    if (!project.tables.length) {
      open("data");
      return;
    }
    const t =
      project.tables.find((t) => t.name === "Sales") ?? project.tables[0];
    const cs = columns(t);
    const id = uid();
    const v: Visual = {
      id,
      type,
      title: visualTypes.find((v) => v.type === type)!.label,
      table: t.name,
      category: cs.find((c) => c === "Month") ?? cs[0],
      value: project.measures[0]
        ? `@${project.measures[0].name}`
        : (cs.find((c) => typeof rows(t)[0]?.[c] === "number") ?? cs[0]),
      aggregation: "SUM",
      color: "#487d86",
      wide: false,
    };
    update({
      ...project,
      pages: project.pages.map((p) =>
        p.id === page.id ? { ...p, visuals: [...p.visuals, v] } : p,
      ),
    });
    setSelected(id);
    setView("report");
  };
  const toggleFilter = (f: Filter) => {
    const exists = project.filters.some(
      (x) =>
        x.table === f.table && x.column === f.column && x.value === f.value,
    );
    update({
      ...project,
      filters: [
        ...project.filters.filter(
          (x) => !(x.table === f.table && x.column === f.column),
        ),
        ...(exists ? [] : [f]),
      ],
    });
  };
  const importTables = (tables: Table[]) => {
    const existing = new Set(project.tables.map((t) => t.name));
    const normalized = tables.map((t) => {
      let name = t.name;
      let i = 2;
      while (existing.has(name)) name = `${t.name} ${i++}`;
      existing.add(name);
      return { ...t, name };
    });
    update({ ...project, tables: [...project.tables, ...normalized] });
    setTableName(normalized[0].name);
    setModal("");
    notify(`Loaded ${tables.length} table${tables.length === 1 ? "" : "s"}.`);
  };
  const progress = project.completed.length;
  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      importTables(await importFile(file));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const addPage = () => {
    const id = uid();
    update({
      ...project,
      pages: [
        ...project.pages,
        { id, name: `Page ${project.pages.length + 1}`, visuals: [] },
      ],
      activePage: id,
    });
    setSelected("");
  };
  const selectedTable = project.tables.find((t) => t.name === visual?.table);
  const filterT = project.tables.find((t) => t.name === filterTable);
  const filterChoices =
    filterT && filterColumn
      ? [...new Set(rows(filterT).map((r) => r[filterColumn]))]
      : [];
  const saveMeasure = () => {
    try {
      const name = measureName.trim();
      if (!name || /[\[\]]/.test(name))
        throw new Error("Enter a measure name without brackets.");
      if (
        editingMeasure &&
        project.measures.find((m) => m.id === editingMeasure)?.name !== name
      )
        throw new Error(
          "Keep the existing measure name when editing its expression. Create a new measure to use a different name.",
        );
      if (
        project.measures.some((m) => m.name === name && m.id !== editingMeasure)
      )
        throw new Error("A measure with this name already exists.");
      const measures = [
        ...project.measures.filter((m) => m.id !== editingMeasure),
        { id: editingMeasure || uid(), name, expression },
      ];
      dax(`[${name}]`, { ...project, measures });
      update({ ...project, measures });
      setModal("");
      notify(`Measure [${name}] saved.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const checkLesson = () => {
    if (lesson.check(project)) {
      if (!project.completed.includes(lesson.id))
        update({ ...project, completed: [...project.completed, lesson.id] });
      setLessonFeedback("passed");
    } else setLessonFeedback("Try again: " + lesson.hint);
  };
  const activePublication = project.publications.find(
    (p) => p.id === publication,
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <span />
            <span />
            <span />
          </div>
          <strong>
            BI <span>Practice Studio</span>
          </strong>
          <span className="beta-badge">LEARN BY DOING</span>
        </div>
        <div className="report-name">
          <span>{project.name}</span>
          <ChevronDown size={13} />
        </div>
        <div className="header-actions">
          <span className="save-state">
            <span
              className={
                saveError || !persistAllowed
                  ? "status-dot warning"
                  : "status-dot"
              }
            />
            {saveError || !persistAllowed
              ? "Not saved"
              : "Saved on this device"}
          </span>
          <button
            aria-label="Help and supported features"
            className="icon-button"
            onClick={() => open("help")}
          >
            <HelpCircle size={18} />
          </button>
          <div className="avatar">You</div>
        </div>
      </header>
      <nav className="top-tabs" aria-label="Ribbon">
        <button className="file-tab" onClick={() => open("file")}>
          File
        </button>
        {["Home", "Insert", "Modeling", "View"].map((t) => (
          <button
            className={ribbon === t ? "active" : ""}
            key={t}
            onClick={() => setRibbon(t)}
          >
            {t}
          </button>
        ))}
        <button
          className="learning-tab"
          onClick={() => setCourseOpen(!courseOpen)}
        >
          <GraduationCap size={16} />
          Learning path<span>{progress}/10</span>
        </button>
      </nav>
      <div className="ribbon">
        {ribbon === "Home" && (
          <>
            <div className="ribbon-group">
              <button className="ribbon-button" onClick={() => open("data")}>
                <Database />
                <span>
                  Get data
                  <ChevronDown size={10} />
                </span>
              </button>
              <button className="ribbon-button" onClick={() => open("data")}>
                <FileSpreadsheet className="green" />
                <span>Excel / CSV</span>
              </button>
              <small>Data</small>
            </div>
            <div className="ribbon-group">
              <button
                className="ribbon-button"
                disabled={!project.tables.length}
                onClick={() => open("query")}
              >
                <Settings2 />
                <span>Transform data</span>
              </button>
              <button
                className="ribbon-button"
                disabled={!project.tables.length}
                onClick={() =>
                  notify(
                    "Recalculated from the imported source snapshot. To refresh an external file, import its updated version.",
                  )
                }
              >
                <RefreshCw />
                <span>Refresh</span>
              </button>
              <small>Queries</small>
            </div>
            <div className="ribbon-group">
              <button
                className="ribbon-button"
                onClick={() => addVisual("column")}
              >
                <BarChart3 />
                <span>New visual</span>
              </button>
              <button
                className="ribbon-button"
                onClick={() => {
                  setEditingMeasure("");
                  open("measure");
                }}
                disabled={!project.tables.length}
              >
                <Hash />
                <span>New measure</span>
              </button>
              <small>Build</small>
            </div>
            <div className="ribbon-group">
              <button
                className="ribbon-button"
                onClick={() => open("publish")}
                disabled={!project.tables.length}
              >
                <Upload className="amber" />
                <span>Publish</span>
              </button>
              <small>Share</small>
            </div>
          </>
        )}
        {ribbon === "Insert" && (
          <div className="ribbon-group">
            {visualTypes.map((v) => (
              <button
                key={v.type}
                className="ribbon-button"
                onClick={() => addVisual(v.type)}
              >
                <v.icon />
                <span>{v.label}</span>
              </button>
            ))}
            <small>Visuals</small>
          </div>
        )}
        {ribbon === "Modeling" && (
          <>
            <div className="ribbon-group">
              <button
                className="ribbon-button"
                disabled={!project.tables.length}
                onClick={() => {
                  setEditingMeasure("");
                  open("measure");
                }}
              >
                <Hash />
                <span>New measure</span>
              </button>
              <button
                className="ribbon-button"
                disabled={project.tables.length < 2}
                onClick={() => open("relationship")}
              >
                <Network />
                <span>New relationship</span>
              </button>
              <small>Calculations and relationships</small>
            </div>
            <button className="ribbon-button" onClick={() => setView("model")}>
              <Database />
              <span>Model view</span>
            </button>
          </>
        )}
        {ribbon === "View" && (
          <>
            <button
              className="ribbon-button"
              onClick={() => setCourseOpen(!courseOpen)}
            >
              <BookOpen />
              <span>Learning pane</span>
            </button>
            <button
              className="ribbon-button"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <FilterIcon />
              <span>Filters pane</span>
            </button>
            <button className="ribbon-button" onClick={() => window.print()}>
              <Download />
              <span>Print / PDF</span>
            </button>
            <button className="ribbon-button" onClick={() => open("help")}>
              <HelpCircle />
              <span>Feature guide</span>
            </button>
          </>
        )}
        <div className="ribbon-end">
          <button
            aria-label="Undo"
            className="icon-button"
            disabled={!undoStack.current.length}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            aria-label="Redo"
            className="icon-button"
            disabled={!redoStack.current.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <span className="desktop-pill">
            <Monitor size={13} />
            Desktop practice
          </span>
        </div>
      </div>
      {((loadWarning && !persistAllowed) || saveError) && (
        <div className="storage-warning">
          {saveError || loadWarning}
          <button
            onClick={() => {
              download(
                "recovery-project.json",
                JSON.stringify(project, null, 2),
              );
            }}
          >
            Export current project
          </button>
          {!persistAllowed && (
            <button onClick={() => setPersistAllowed(true)}>
              Allow saving this project
            </button>
          )}
        </div>
      )}
      <div className="workspace">
        <nav className="view-rail" aria-label="Workspace views">
          {[
            { key: "report", label: "Report view", icon: BarChart3 },
            { key: "data", label: "Data view", icon: Table2 },
            { key: "model", label: "Model view", icon: Network },
          ].map((v) => (
            <button
              key={v.key}
              title={v.label}
              aria-label={v.label}
              className={view === v.key ? "active" : ""}
              onClick={() => setView(v.key as typeof view)}
            >
              <v.icon size={21} />
            </button>
          ))}
          <div className="rail-divider" />
          <button
            className={view === "service" ? "active" : ""}
            title="Service practice"
            aria-label="Service practice"
            onClick={() => setView("service")}
          >
            <Cloud size={21} />
          </button>
          <button
            className="rail-bottom"
            title="Toggle learning pane"
            aria-label="Toggle learning pane"
            onClick={() => setCourseOpen(!courseOpen)}
          >
            {courseOpen ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeftOpen size={20} />
            )}
          </button>
        </nav>
        {courseOpen && (
          <aside className="learning-pane">
            <div className="learning-heading">
              <span className="eyebrow">YOUR LEARNING PATH</span>
              <h2>From data to insight.</h2>
              <p>Build real skills, one step at a time.</p>
              <div className="progress-label">
                <span>Power BI foundations</span>
                <strong>{Math.round((progress / 10) * 100)}%</strong>
              </div>
              <div className="progress-track">
                <div style={{ width: `${progress * 10}%` }} />
              </div>
            </div>
            <div className="lesson-list">
              {lessons.map((l, i) => (
                <button
                  key={l.id}
                  className={`lesson-item ${lessonIndex === i ? "current" : ""} ${project.completed.includes(l.id) ? "complete" : ""}`}
                  onClick={() => {
                    setLessonIndex(i);
                    setLessonFeedback("");
                  }}
                >
                  <span className="lesson-number">
                    {project.completed.includes(l.id) ? (
                      <Check size={13} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <span>
                    <strong>{l.title}</strong>
                    <small>
                      {l.minutes} min · {i < 8 ? "Desktop" : "Service"}
                    </small>
                  </span>
                  {lessonIndex === i && <ChevronRight size={15} />}
                </button>
              ))}
              <button
                className={`lesson-item ${project.completed.includes("assessment") ? "complete" : ""}`}
                onClick={() => open("quiz")}
              >
                <span className="lesson-number">
                  <GraduationCap size={15} />
                </span>
                <span>
                  <strong>Knowledge check</strong>
                  <small>5 questions · Final assessment</small>
                </span>
              </button>
            </div>
            <div className="learning-footer">
              <BookOpen size={17} />
              <p>
                Practice here. Apply it in Power BI.
                <span>Independent learning environment</span>
              </p>
            </div>
          </aside>
        )}
        <main className="main-workspace">
          <div className="workspace-heading">
            <div className="breadcrumbs">
              Workspace
              <ChevronRight size={12} />
              <span>
                {view === "report"
                  ? "Report editor"
                  : view === "data"
                    ? "Data explorer"
                    : view === "model"
                      ? "Semantic model"
                      : "Practice service"}
              </span>
            </div>
            <button className="text-button" onClick={() => open("help")}>
              Quick guide
              <ArrowUpRight size={13} />
            </button>
          </div>
          {view === "report" && (
            <>
              <section className="lesson-banner">
                <div className="lesson-banner-icon">
                  <BookOpen size={20} />
                </div>
                <div>
                  <span className="eyebrow">
                    LESSON {String(lessonIndex + 1).padStart(2, "0")} / 09
                  </span>
                  <h1>{lesson.title}</h1>
                  <p>{lesson.description}</p>
                </div>
                <button className="secondary" onClick={() => open("lesson")}>
                  View lesson
                  <ArrowRight size={15} />
                </button>
              </section>
              <div className="canvas-toolbar">
                <div>
                  <span className="report-dot" />
                  <strong>{page.name}</strong>
                  <span className="subtle">
                    {page.visuals.length} visual
                    {page.visuals.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div>
                  <button
                    className={`text-button ${filtersOpen ? "selected-text" : ""}`}
                    onClick={() => setFiltersOpen(!filtersOpen)}
                  >
                    <FilterIcon size={14} />
                    Filters
                    {project.filters.length
                      ? ` (${project.filters.length})`
                      : ""}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Export project"
                    onClick={() =>
                      download(
                        "my-report.bipractice.json",
                        JSON.stringify(project, null, 2),
                      )
                    }
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
              {project.filters.length > 0 && (
                <div className="filter-chips">
                  {project.filters.map((f, i) => (
                    <button key={i} onClick={() => toggleFilter(f)}>
                      {f.table}[{f.column}] = {String(f.value)}
                      <X size={12} />
                    </button>
                  ))}
                  <button onClick={() => update({ ...project, filters: [] })}>
                    Clear all
                  </button>
                </div>
              )}
              <div className="canvas-scroll">
                <div
                  className={`report-canvas ${!page.visuals.length ? "empty-canvas" : ""}`}
                >
                  {!page.visuals.length ? (
                    <div className="canvas-welcome">
                      <div className="welcome-illustration">
                        <div className="mini-window">
                          <div className="mini-dots">
                            <i />
                            <i />
                            <i />
                          </div>
                          <div className="mini-chart">
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                          </div>
                          <div className="mini-line" />
                        </div>
                        <div className="floating-data">
                          <Database size={24} />
                        </div>
                        <div className="floating-check">
                          <Check size={15} />
                        </div>
                      </div>
                      <span className="eyebrow">
                        A BLANK CANVAS. ENDLESS POSSIBILITIES.
                      </span>
                      <h2>
                        {project.tables.length
                          ? "Your data is ready. Tell its story."
                          : "Every great report starts with data."}
                      </h2>
                      <p>
                        {project.tables.length
                          ? "Choose a visual, assign your fields, and turn rows into insights."
                          : "Connect a dataset to start exploring. We have a sample ready for your first lesson."}
                      </p>
                      <button
                        className="primary"
                        onClick={() =>
                          project.tables.length
                            ? addVisual("column")
                            : open("data")
                        }
                      >
                        {project.tables.length ? (
                          <BarChart3 size={17} />
                        ) : (
                          <Database size={17} />
                        )}{" "}
                        {project.tables.length
                          ? "Create your first visual"
                          : "Get data"}
                        <ArrowRight size={16} />
                      </button>
                      <div className="welcome-steps">
                        <span>
                          <span>1</span>Connect
                        </span>
                        <i />
                        <span>
                          <span>2</span>Transform
                        </span>
                        <i />
                        <span>
                          <span>3</span>Visualize
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="visual-grid">
                      {page.visuals.map((v, i) => (
                        <section
                          tabIndex={0}
                          aria-label={`${v.title} visual`}
                          className={`visual-card ${v.wide ? "wide" : ""} ${selected === v.id ? "selected" : ""}`}
                          key={v.id}
                          onClick={() => setSelected(v.id)}
                          onFocus={() => setSelected(v.id)}
                        >
                          <div className="visual-title">
                            <h3>{v.title}</h3>
                            <div className="visual-actions">
                              <button
                                title="Move earlier"
                                aria-label={`Move ${v.title} earlier`}
                                disabled={i === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const visuals = [...page.visuals];
                                  [visuals[i - 1], visuals[i]] = [
                                    visuals[i],
                                    visuals[i - 1],
                                  ];
                                  update({
                                    ...project,
                                    pages: project.pages.map((p) =>
                                      p.id === page.id ? { ...p, visuals } : p,
                                    ),
                                  });
                                }}
                              >
                                <Grip size={13} />
                              </button>
                              <button
                                aria-label={`Duplicate ${v.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  update({
                                    ...project,
                                    pages: project.pages.map((p) =>
                                      p.id === page.id
                                        ? {
                                            ...p,
                                            visuals: [
                                              ...p.visuals,
                                              {
                                                ...v,
                                                id: uid(),
                                                title: v.title + " copy",
                                              },
                                            ],
                                          }
                                        : p,
                                    ),
                                  });
                                }}
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                aria-label={`Delete ${v.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  update({
                                    ...project,
                                    pages: project.pages.map((p) =>
                                      p.id === page.id
                                        ? {
                                            ...p,
                                            visuals: p.visuals.filter(
                                              (x) => x.id !== v.id,
                                            ),
                                          }
                                        : p,
                                    ),
                                  });
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                          <ReportVisual
                            project={project}
                            visual={v}
                            onFilter={toggleFilter}
                          />
                        </section>
                      ))}
                    </div>
                  )}
                </div>
                <div className="canvas-note">
                  <span>
                    <span className="status-dot" />
                    All data stays in your browser
                  </span>
                  <span>Report canvas · Responsive layout</span>
                </div>
              </div>
              <div className="page-bar">
                {project.pages.map((p) => (
                  <button
                    key={p.id}
                    className={p.id === page.id ? "active" : ""}
                    onClick={() => {
                      update({ ...project, activePage: p.id });
                      setSelected("");
                    }}
                    onDoubleClick={() => open("rename-page")}
                  >
                    {p.name}
                  </button>
                ))}
                <button aria-label="Add page" onClick={addPage}>
                  <Plus size={17} />
                </button>
                <button
                  className="page-settings"
                  aria-label="Page settings"
                  onClick={() => open("rename-page")}
                >
                  <Settings2 size={15} />
                </button>
              </div>
            </>
          )}
          {view === "data" && (
            <div className="full-view">
              <div className="section-title">
                <div>
                  <span className="eyebrow">EXPLORE YOUR DATA</span>
                  <h1>Data view</h1>
                </div>
                <button
                  className="secondary"
                  onClick={() => table && exportCsv(table)}
                  disabled={!table}
                >
                  <Download size={15} />
                  Export CSV
                </button>
              </div>
              <div className="table-tabs">
                {project.tables.map((t) => (
                  <button
                    className={table?.id === t.id ? "active" : ""}
                    key={t.id}
                    onClick={() => setTableName(t.name)}
                  >
                    <Table2 size={14} />
                    {t.name}
                  </button>
                ))}
              </div>
              {table ? (
                <DataGrid key={table.id} data={rows(table)} />
              ) : (
                <div className="empty-message">
                  Load a dataset to explore its rows.
                  <button className="primary" onClick={() => open("data")}>
                    Get data
                  </button>
                </div>
              )}
            </div>
          )}
          {view === "model" && (
            <div className="full-view model-view">
              <div className="section-title">
                <div>
                  <span className="eyebrow">CONNECT THE DOTS</span>
                  <h1>Model view</h1>
                  <p>One-to-many relationships · Single filter direction</p>
                </div>
                <button
                  className="primary"
                  disabled={project.tables.length < 2}
                  onClick={() => open("relationship")}
                >
                  <Plus size={16} />
                  New relationship
                </button>
              </div>
              <div className="model-tables">
                {project.tables.map((t) => (
                  <div className="model-table" key={t.id}>
                    <h3>
                      <Table2 size={17} />
                      {t.name}
                      <small>{rows(t).length} rows</small>
                    </h3>
                    {columns(t).map((c) => (
                      <div key={c}>
                        <span>
                          {typeof rows(t)[0]?.[c] === "number" ? "∑" : "▤"}
                        </span>
                        {c}
                        {project.relationships.some(
                          (r) => r.from === t.name && r.fromColumn === c,
                        ) && <b className="key-tag">1</b>}
                        {project.relationships.some(
                          (r) => r.to === t.name && r.toColumn === c,
                        ) && <b className="key-tag">*</b>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <h3 className="relationships-title">
                Relationships <span>{project.relationships.length}</span>
              </h3>
              {!project.relationships.length && (
                <p className="empty-message">
                  Connect a dimension table to Sales to propagate filters.
                </p>
              )}
              {project.relationships.map((r) => (
                <div className="relationship-row" key={r.id}>
                  <span>
                    {r.from}
                    <strong>[{r.fromColumn}]</strong>
                  </span>
                  <b>1</b>
                  <div className="relationship-line">
                    <ArrowRight size={17} />
                  </div>
                  <b>*</b>
                  <span>
                    {r.to}
                    <strong>[{r.toColumn}]</strong>
                  </span>
                  <button
                    aria-label={`Delete ${r.from} relationship`}
                    className="icon-button"
                    onClick={() =>
                      update({
                        ...project,
                        relationships: project.relationships.filter(
                          (x) => x.id !== r.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {view === "service" && (
            <div className="full-view service-view">
              <span className="eyebrow">
                POWER BI SERVICE · LOCAL SIMULATION
              </span>
              <div className="section-title">
                <div>
                  <h1>My practice workspace</h1>
                  <p>
                    Publish a snapshot of your report, then explore it as a
                    reader.
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={!project.tables.length}
                  onClick={() => open("publish")}
                >
                  <Upload size={16} />
                  Publish report
                </button>
              </div>
              <div className="service-notice">
                <Cloud size={20} />
                <span>
                  This workspace is stored on your device. Accounts, sharing
                  permissions, gateways and scheduled refresh require the real
                  Power BI Service.
                </span>
              </div>
              {project.publications.length ? (
                <div className="publication-list">
                  {project.publications.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPublication(p.id);
                        open("published");
                      }}
                    >
                      <span className="report-file">
                        <BarChart3 size={23} />
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          Report · {p.pages.length} pages ·{" "}
                          {new Date(p.date).toLocaleDateString("en-US")}
                        </small>
                      </span>
                      <span className="snapshot-badge">Snapshot</span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="service-empty">
                  <Cloud size={50} />
                  <h2>Your next stop: the cloud.</h2>
                  <p>
                    Build your first report in Desktop practice, then publish it
                    here.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setView("report")}
                  >
                    Back to report
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
        {view === "report" && (
          <aside className="right-pane">
            {filtersOpen ? (
              <>
                <div className="pane-heading">
                  <h3>Filters</h3>
                  <button
                    className="icon-button"
                    aria-label="Close filters"
                    onClick={() => setFiltersOpen(false)}
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="pane-body">
                  <p className="pane-description">
                    Filters apply across all report pages in this practice app.
                  </p>
                  <label>
                    Table
                    <select
                      value={filterTable}
                      onChange={(e) => {
                        setFilterTable(e.target.value);
                        setFilterColumn("");
                        setFilterValue("");
                      }}
                    >
                      <option value="">Select table</option>
                      {project.tables.map((t) => (
                        <option key={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Field
                    <select
                      value={filterColumn}
                      onChange={(e) => {
                        setFilterColumn(e.target.value);
                        setFilterValue("");
                      }}
                    >
                      <option value="">Select field</option>
                      {filterT &&
                        columns(filterT).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Value
                    <select
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                    >
                      <option value="">Select value</option>
                      {filterChoices.map((v, i) => (
                        <option key={i} value={i}>
                          {String(v ?? "(Blank)")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary full"
                    disabled={filterValue === ""}
                    onClick={() =>
                      toggleFilter({
                        table: filterTable,
                        column: filterColumn,
                        value: filterChoices[Number(filterValue)],
                      })
                    }
                  >
                    Apply filter
                  </button>
                  <button
                    className="secondary full"
                    onClick={() => update({ ...project, filters: [] })}
                  >
                    Clear filters
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="pane-heading">
                  <h3>Visualizations</h3>
                  <Settings2 size={15} />
                </div>
                <div className="pane-tabs">
                  <button
                    className={pane === "build" ? "active" : ""}
                    onClick={() => setPane("build")}
                  >
                    <BarChart3 size={15} />
                    Build visual
                  </button>
                  <button
                    className={pane === "format" ? "active" : ""}
                    onClick={() => setPane("format")}
                  >
                    <Paintbrush size={15} />
                    Format
                  </button>
                </div>
                <div className="pane-body">
                  {pane === "build" ? (
                    <>
                      <div className="visual-picker">
                        {visualTypes.map((v) => (
                          <button
                            title={v.label}
                            aria-label={v.label}
                            className={visual?.type === v.type ? "active" : ""}
                            key={v.type}
                            onClick={() =>
                              visual
                                ? updateVisual({ type: v.type })
                                : addVisual(v.type)
                            }
                          >
                            <v.icon size={23} />
                          </button>
                        ))}
                      </div>
                      {visual ? (
                        <>
                          <label>
                            Table
                            <select
                              value={visual.table}
                              onChange={(e) => {
                                const t = project.tables.find(
                                  (t) => t.name === e.target.value,
                                )!;
                                updateVisual({
                                  table: t.name,
                                  category: columns(t)[0],
                                  value: project.measures[0]
                                    ? `@${project.measures[0].name}`
                                    : (columns(t).find(
                                        (c) =>
                                          typeof rows(t)[0]?.[c] === "number",
                                      ) ?? ""),
                                });
                              }}
                            >
                              {project.tables.map((t) => (
                                <option key={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </label>
                          {!["card", "table"].includes(visual.type) && (
                            <label>
                              {visual.type === "slicer"
                                ? "Field"
                                : "X-axis / Category"}
                              <select
                                value={visual.category}
                                onChange={(e) =>
                                  updateVisual({ category: e.target.value })
                                }
                              >
                                {selectedTable &&
                                  columns(selectedTable).map((c) => (
                                    <option key={c}>{c}</option>
                                  ))}
                              </select>
                            </label>
                          )}
                          {!["table", "slicer"].includes(visual.type) && (
                            <>
                              <label>
                                Values
                                <select
                                  value={visual.value}
                                  onChange={(e) =>
                                    updateVisual({ value: e.target.value })
                                  }
                                >
                                  <option value="">Select field</option>
                                  <optgroup label="Measures">
                                    {project.measures.map((m) => (
                                      <option key={m.id} value={`@${m.name}`}>
                                        [{m.name}]
                                      </option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Columns">
                                    {selectedTable &&
                                      columns(selectedTable).map((c) => (
                                        <option key={c}>{c}</option>
                                      ))}
                                  </optgroup>
                                </select>
                              </label>
                              {!visual.value.startsWith("@") && (
                                <label>
                                  Summarization
                                  <select
                                    value={visual.aggregation}
                                    onChange={(e) =>
                                      updateVisual({
                                        aggregation: e.target
                                          .value as Visual["aggregation"],
                                      })
                                    }
                                  >
                                    {[
                                      "SUM",
                                      "AVERAGE",
                                      "COUNT",
                                      "MIN",
                                      "MAX",
                                    ].map((a) => (
                                      <option key={a}>{a}</option>
                                    ))}
                                  </select>
                                </label>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <div className="field-well-empty">
                          <Plus size={18} />
                          <p>Select a visual above to start building.</p>
                        </div>
                      )}
                    </>
                  ) : visual ? (
                    <>
                      <label>
                        Title
                        <input
                          value={visual.title}
                          onChange={(e) =>
                            updateVisual({ title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Data color
                        <div className="color-field">
                          <input
                            aria-label="Data color"
                            type="color"
                            value={visual.color}
                            onChange={(e) =>
                              updateVisual({ color: e.target.value })
                            }
                          />
                          <span>{visual.color.toUpperCase()}</span>
                        </div>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={visual.wide}
                          onChange={(e) =>
                            updateVisual({ wide: e.target.checked })
                          }
                        />
                        Wide visual
                      </label>
                    </>
                  ) : (
                    <p className="pane-description">
                      Select a visual to format its title, color and size.
                    </p>
                  )}
                </div>
                <div className="pane-heading data-heading">
                  <h3>Data</h3>
                  <Database size={15} />
                </div>
                <div className="field-search">
                  <Search size={14} />
                  <input
                    placeholder="Search fields"
                    aria-label="Search fields"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                  />
                </div>
                <div className="fields-list">
                  {project.tables.map((t) => (
                    <details key={t.id} open>
                      <summary>
                        <Table2 size={14} />
                        {t.name}
                        <span>{rows(t).length}</span>
                      </summary>
                      {columns(t)
                        .filter((c) =>
                          `${t.name} ${c}`
                            .toLowerCase()
                            .includes(fieldSearch.toLowerCase()),
                        )
                        .map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              if (visual)
                                updateVisual(
                                  typeof rows(t)[0]?.[c] === "number"
                                    ? { table: t.name, value: c }
                                    : { table: t.name, category: c },
                                );
                              else {
                                setTableName(t.name);
                                setView("data");
                              }
                            }}
                          >
                            <span className="field-type">
                              {typeof rows(t)[0]?.[c] === "number" ? "∑" : "▤"}
                            </span>
                            {c}
                          </button>
                        ))}
                    </details>
                  ))}
                  {project.measures.length > 0 && (
                    <details open>
                      <summary>
                        <Hash size={14} />
                        Measures
                      </summary>
                      {project.measures.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (visual) updateVisual({ value: `@${m.name}` });
                            else {
                              setEditingMeasure(m.id);
                              setMeasureName(m.name);
                              setExpression(m.expression);
                              open("measure");
                            }
                          }}
                        >
                          <Hash size={12} />
                          {m.name}
                        </button>
                      ))}
                    </details>
                  )}
                  {!project.tables.length && (
                    <div className="empty-data">
                      <Database size={27} />
                      <p>Your tables will appear here.</p>
                      <button
                        className="text-button"
                        onClick={() => open("data")}
                      >
                        Connect data
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        )}
      </div>
      <footer className="app-footer">
        <span>
          <span className="status-dot" />
          Ready
        </span>
        <span>
          {project.tables.length} tables · {project.measures.length} measures ·{" "}
          {project.relationships.length} relationships
        </span>
        <span>Independent Power BI practice · v0.1</span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <input
        type="file"
        hidden
        ref={dataInput}
        accept=".csv,.xlsx"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        hidden
        ref={projectInput}
        accept=".json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const loaded = readProject(await file.text());
            update(loaded);
            setPersistAllowed(true);
            setModal("");
            notify("Project imported.");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      {modal === "data" && (
        <Modal title="Get data" onClose={() => setModal("")}>
          <div className="modal-content">
            <p>
              Choose where your data comes from. Files are processed on your
              device.
            </p>
            <button
              className="data-source featured"
              onClick={() => {
                if (
                  project.tables.some((t) =>
                    ["Sales", "Products", "Customers"].includes(t.name),
                  )
                ) {
                  setError(
                    "Sample tables already exist. Use File → New project to restart the course, or import a different file.",
                  );
                  return;
                }
                importTables(sampleTables());
              }}
            >
              <div className="source-icon">
                <Database size={25} />
              </div>
              <div>
                <span className="eyebrow">RECOMMENDED FOR THE COURSE</span>
                <h3>Northstar sample data</h3>
                <p>240 orders · 3 tables · A year of retail sales</p>
              </div>
              <ArrowRight size={19} />
            </button>
            <button
              className="data-source"
              onClick={() => dataInput.current?.click()}
            >
              <div className="source-icon green">
                <FileSpreadsheet size={25} />
              </div>
              <div>
                <h3>Excel workbook or Text / CSV</h3>
                <p>Import .xlsx or .csv · Up to 10 MB</p>
              </div>
              <Upload size={18} />
            </button>
            <div className="callout">
              The first row must contain unique column names. Excel imports
              populated worksheets; formulas use their saved values.
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {modal === "query" && (
        <QueryEditor
          project={project}
          onApply={(tables) => {
            update({ ...project, tables });
            setModal("");
            notify("Transformations applied.");
          }}
          onClose={() => setModal("")}
        />
      )}
      {modal === "measure" && (
        <Modal title="New / edit measure" onClose={() => setModal("")}>
          <div className="modal-content">
            <label>
              Measure name
              <input
                value={measureName}
                onChange={(e) => setMeasureName(e.target.value)}
              />
            </label>
            <label>
              DAX expression
              <textarea
                className="code-editor"
                rows={5}
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                spellCheck={false}
              />
            </label>
            <div className="formula-examples">
              <small>TRY AN EXPRESSION</small>
              {[
                "SUM(Sales[SalesAmount])",
                "DIVIDE(SUM(Sales[SalesAmount]) - SUM(Sales[Cost]), SUM(Sales[SalesAmount]))",
                'CALCULATE(SUM(Sales[SalesAmount]), Customers[Region] = "North")',
              ].map((s) => (
                <button key={s} onClick={() => setExpression(s)}>
                  <code>{s}</code>
                </button>
              ))}
            </div>
            <details className="function-support">
              <summary>Supported DAX subset</summary>
              <p>
                {supportedFunctions.join(", ")}. ALL and REMOVEFILTERS are
                supported inside CALCULATE. Unsupported syntax returns an error.
              </p>
            </details>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" onClick={saveMeasure}>
              <Check size={16} />
              Save measure
            </button>
          </div>
        </Modal>
      )}
      {modal === "relationship" && (
        <Modal title="Create relationship" onClose={() => setModal("")}>
          <div className="modal-content">
            <p>
              Filters flow from the one-side dimension to the many-side fact
              table.
            </p>
            <div className="form-columns">
              <div>
                <label>
                  From table (one)
                  <select
                    value={relFrom}
                    onChange={(e) => {
                      setRelFrom(e.target.value);
                      setRelFromColumn(
                        columns(
                          project.tables.find(
                            (t) => t.name === e.target.value,
                          )!,
                        )[0],
                      );
                    }}
                  >
                    {project.tables.map((t) => (
                      <option key={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  From column
                  <select
                    value={relFromColumn}
                    onChange={(e) => setRelFromColumn(e.target.value)}
                  >
                    {project.tables.find((t) => t.name === relFrom) &&
                      columns(
                        project.tables.find((t) => t.name === relFrom)!,
                      ).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <ArrowRight size={20} />
              <div>
                <label>
                  To table (many)
                  <select
                    value={relTo}
                    onChange={(e) => {
                      setRelTo(e.target.value);
                      setRelToColumn(
                        columns(
                          project.tables.find(
                            (t) => t.name === e.target.value,
                          )!,
                        )[0],
                      );
                    }}
                  >
                    {project.tables.map((t) => (
                      <option key={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  To column
                  <select
                    value={relToColumn}
                    onChange={(e) => setRelToColumn(e.target.value)}
                  >
                    {project.tables.find((t) => t.name === relTo) &&
                      columns(
                        project.tables.find((t) => t.name === relTo)!,
                      ).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="callout">
              Cardinality: One to many (1:*) · Cross-filter direction: Single
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary"
              onClick={() => {
                try {
                  const rel = {
                    id: uid(),
                    from: relFrom,
                    fromColumn: relFromColumn,
                    to: relTo,
                    toColumn: relToColumn,
                  };
                  validateRelationship(project, rel);
                  update({
                    ...project,
                    relationships: [...project.relationships, rel],
                  });
                  setModal("");
                  notify("Relationship created.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Create relationship
            </button>
          </div>
        </Modal>
      )}
      {modal === "lesson" && (
        <Modal
          title={`Lesson ${lessonIndex + 1} · ${lesson.title}`}
          onClose={() => setModal("")}
        >
          <div className="modal-content lesson-detail">
            <span className="eyebrow">
              {lesson.section} · {lesson.minutes} MINUTES
            </span>
            <p>{lesson.description}</p>
            <ol>
              {lesson.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="callout">
              <BookOpen size={18} />
              {lesson.hint}
            </div>
            {lessonFeedback && (
              <div
                role="status"
                className={lessonFeedback === "passed" ? "success" : "error"}
              >
                {lessonFeedback === "passed" ? (
                  <>
                    <CheckCircle2 size={18} />
                    Lesson complete. Your project meets the objectives.
                  </>
                ) : (
                  lessonFeedback
                )}
              </div>
            )}
            <div className="lesson-actions">
              <button className="primary" onClick={checkLesson}>
                <Check size={16} />
                Check my work
              </button>
              {project.completed.includes(lesson.id) && (
                <button
                  className="secondary"
                  onClick={() => {
                    if (lessonIndex < lessons.length - 1) {
                      setLessonIndex(lessonIndex + 1);
                      setLessonFeedback("");
                    } else open("quiz");
                  }}
                >
                  Next lesson
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
            <a
              className="documentation-link"
              href={lesson.url}
              target="_blank"
              rel="noreferrer"
            >
              Read on Microsoft Learn
              <ExternalLink size={13} />
            </a>
          </div>
        </Modal>
      )}
      {modal === "quiz" && (
        <Modal title="Knowledge check" wide onClose={() => setModal("")}>
          <div className="modal-content quiz-content">
            <p>
              Put your understanding to the test. Score at least 80% to pass.
            </p>
            {quiz.map((q, i) => (
              <fieldset key={q.question}>
                <legend>
                  {i + 1}. {q.question}
                </legend>
                {q.options.map((o, j) => (
                  <label className="quiz-option" key={o}>
                    <input
                      type="radio"
                      name={`question-${i}`}
                      checked={quizAnswers[i] === j}
                      onChange={() => {
                        setQuizAnswers({ ...quizAnswers, [i]: j });
                        setQuizSubmitted(false);
                      }}
                    />
                    {o}
                  </label>
                ))}
                {quizSubmitted && (
                  <p
                    className={
                      quizAnswers[i] === q.correct
                        ? "quiz-correct"
                        : "quiz-wrong"
                    }
                  >
                    {quizAnswers[i] === q.correct ? "Correct. " : "Review. "}
                    {q.explanation}
                  </p>
                )}
              </fieldset>
            ))}
            {quizSubmitted && (
              <div
                className={
                  quiz.filter((q, i) => quizAnswers[i] === q.correct).length >=
                  4
                    ? "success"
                    : "error"
                }
                role="status"
              >
                Score:{" "}
                {quiz.filter((q, i) => quizAnswers[i] === q.correct).length}/5.{" "}
                {quiz.filter((q, i) => quizAnswers[i] === q.correct).length >= 4
                  ? "Assessment passed."
                  : "Review the explanations and try again."}
              </div>
            )}
            <button
              className="primary"
              disabled={Object.keys(quizAnswers).length < 5}
              onClick={() => {
                setQuizSubmitted(true);
                if (
                  quiz.filter((q, i) => quizAnswers[i] === q.correct).length >=
                    4 &&
                  !project.completed.includes("assessment")
                )
                  update({
                    ...project,
                    completed: [...project.completed, "assessment"],
                  });
              }}
            >
              Submit answers
            </button>
          </div>
        </Modal>
      )}
      {modal === "publish" && (
        <Modal
          title="Publish to practice workspace"
          onClose={() => setModal("")}
        >
          <div className="modal-content">
            <div className="publish-graphic">
              <Cloud size={42} />
            </div>
            <h3>Ready to share your story?</h3>
            <p>
              Save a read-only snapshot to{" "}
              <strong>My practice workspace</strong>. Future edits to your
              report will not change this snapshot.
            </p>
            <div className="callout">
              Local simulation: this does not publish to Microsoft or share data
              with other people.
            </div>
            <button
              className="primary"
              onClick={() => {
                const snapshot = structuredClone({
                  id: uid(),
                  name: project.name,
                  date: new Date().toISOString(),
                  pages: project.pages,
                  tables: project.tables,
                  measures: project.measures,
                  relationships: project.relationships,
                });
                update({
                  ...project,
                  publications: [snapshot, ...project.publications],
                });
                setModal("");
                setView("service");
                notify("Published to your local practice workspace.");
              }}
            >
              <Upload size={16} />
              Publish to practice workspace
            </button>
          </div>
        </Modal>
      )}
      {modal === "published" && activePublication && (
        <Modal
          title={`${activePublication.name} · Published snapshot`}
          wide
          onClose={() => setModal("")}
        >
          <div className="modal-content published-content">
            {activePublication.pages.map((p) => (
              <section key={p.id}>
                <h3>{p.name}</h3>
                <div className="visual-grid">
                  {p.visuals.map((v) => (
                    <div
                      className={`visual-card ${v.wide ? "wide" : ""}`}
                      key={v.id}
                    >
                      <h3>{v.title}</h3>
                      <ReportVisual
                        project={{
                          ...project,
                          ...activePublication,
                          filters: [],
                        }}
                        visual={v}
                        onFilter={() =>
                          notify(
                            "This snapshot is read-only. Explore filters in Report view.",
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                {!p.visuals.length && <p>No visuals on this page.</p>}
              </section>
            ))}
          </div>
        </Modal>
      )}
      {modal === "rename-page" && (
        <Modal title="Page settings" onClose={() => setModal("")}>
          <div className="modal-content">
            <label>
              Page name
              <input
                value={page.name}
                onChange={(e) =>
                  update({
                    ...project,
                    pages: project.pages.map((p) =>
                      p.id === page.id ? { ...p, name: e.target.value } : p,
                    ),
                  })
                }
              />
            </label>
            <button
              className="secondary danger"
              disabled={project.pages.length < 2}
              onClick={() => {
                update({
                  ...project,
                  pages: project.pages.filter((p) => p.id !== page.id),
                  activePage: project.pages.find((p) => p.id !== page.id)!.id,
                });
                setModal("");
              }}
            >
              Delete this page
            </button>
            <button className="primary" onClick={() => setModal("")}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {modal === "file" && (
        <Modal title="Your project" onClose={() => setModal("")}>
          <div className="modal-content">
            <label>
              Report name
              <input
                value={project.name}
                onChange={(e) => update({ ...project, name: e.target.value })}
              />
            </label>
            <div className="file-actions">
              <button
                className="secondary"
                onClick={() =>
                  download(
                    `${project.name}.bipractice.json`,
                    JSON.stringify(project, null, 2),
                  )
                }
              >
                <Save size={18} />
                Export project (.json)
              </button>
              <button
                className="secondary"
                onClick={() => projectInput.current?.click()}
              >
                <FolderOpen size={18} />
                Open project (.json)
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setModal("");
                  setTimeout(() => window.print(), 50);
                }}
              >
                <Download size={18} />
                Print report / Save as PDF
              </button>
              <button className="secondary" onClick={() => open("reset")}>
                <Plus size={18} />
                New project
              </button>
            </div>
            <p className="subtle">
              JSON exports preserve tables, steps, relationships, measures,
              pages and course progress. They are not .pbix files. Opening a
              project replaces the current one; Undo restores it.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="Start a new project?" onClose={() => setModal("")}>
          <div className="modal-content">
            <p>
              Your current project will be replaced. Export a backup to keep it;
              Undo is also available in this session.
            </p>
            <div className="file-actions">
              <button
                className="secondary"
                onClick={() =>
                  download(
                    `${project.name}.bipractice.json`,
                    JSON.stringify(project, null, 2),
                  )
                }
              >
                <Download size={16} />
                Export backup
              </button>
              <button
                className="primary"
                onClick={() => {
                  update(blankProject());
                  setPersistAllowed(true);
                  setSelected("");
                  setLessonIndex(0);
                  setView("report");
                  setModal("");
                }}
              >
                Create blank project
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Welcome to BI Practice Studio"
          wide
          onClose={() => setModal("")}
        >
          <div className="modal-content help-content">
            <p>
              A hands-on, independent learning environment for Power BI
              concepts. Follow the nine lessons, check your work, and complete
              the final assessment.
            </p>
            <div className="help-grid">
              <div>
                <h3>Practice here</h3>
                <ul>
                  <li>Import CSV and Excel workbooks</li>
                  <li>Clean data with seven query transformations</li>
                  <li>Build single-direction, one-to-many relationships</li>
                  <li>Write measures using the supported DAX subset</li>
                  <li>Build eight visual types, use filters and slicers</li>
                  <li>Create pages, format visuals and export projects</li>
                  <li>Publish snapshots to a local practice workspace</li>
                </ul>
              </div>
              <div>
                <h3>Continue in real Power BI</h3>
                <ul>
                  <li>Full DAX, M and VertiPaq behavior</li>
                  <li>DirectQuery, databases and live connectors</li>
                  <li>Calculated tables / columns and time intelligence</li>
                  <li>Bidirectional and many-to-many relationships</li>
                  <li>PBIX / PBIT import and export</li>
                  <li>RLS, cloud sharing, gateways and scheduled refresh</li>
                  <li>Custom visuals, bookmarks and drill-through</li>
                </ul>
              </div>
            </div>
            <div className="callout">
              The interface uses familiar English terminology, but this is not a
              Microsoft product or a complete Power BI replica. Features outside
              the supported subset are not silently simulated.
            </div>
            <h3>Official reference</h3>
            <p>
              Each lesson links to Microsoft Learn. Power BI Desktop is
              available for Windows; the real Service runs in a browser.
            </p>
            <a
              className="documentation-link"
              href="https://learn.microsoft.com/en-us/power-bi/"
              target="_blank"
              rel="noreferrer"
            >
              Power BI documentation
              <ExternalLink size={14} />
            </a>
            <button
              className="primary"
              onClick={() => {
                setModal("lesson");
                setLessonFeedback("");
              }}
            >
              <Play size={16} />
              Start learning
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
