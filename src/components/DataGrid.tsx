import { useMemo, useState } from "react";
import type { Row } from "../core/model";
export function DataGrid({
  data,
  selected,
  onColumn,
}: {
  data: Row[];
  selected?: string;
  onColumn?: (c: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; desc: boolean }>();
  const [page, setPage] = useState(0);
  const columns = Object.keys(data[0] ?? {});
  const filtered = useMemo(() => {
    const result = data.filter((r) =>
      Object.values(r).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    );
    if (sort)
      result.sort((a, b) => {
        const x = a[sort.key],
          y = b[sort.key];
        return (
          (typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x ?? "").localeCompare(String(y ?? ""), undefined, {
                numeric: true,
              })) * (sort.desc ? -1 : 1)
        );
      });
    return result;
  }, [data, search, sort]);
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 50) - 1),
  );
  return (
    <div className="data-grid">
      <div className="grid-toolbar">
        <input
          aria-label="Search rows"
          placeholder="Search this table…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <span>
          {filtered.length.toLocaleString()} rows · {columns.length} columns
        </span>
      </div>
      <div className="data-scroll">
        <table>
          <thead>
            <tr>
              <th className="row-number">#</th>
              {columns.map((c) => (
                <th key={c} className={selected === c ? "selected-column" : ""}>
                  <button
                    onClick={() => {
                      onColumn?.(c);
                      setSort({
                        key: c,
                        desc: sort?.key === c ? !sort.desc : false,
                      });
                    }}
                  >
                    <span className="type-icon">
                      {typeof data[0]?.[c] === "number" ? "123" : "ABC"}
                    </span>
                    {c}
                    {sort?.key === c ? (sort.desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(current * 50, current * 50 + 50).map((row, i) => (
              <tr key={i}>
                <td className="row-number">{current * 50 + i + 1}</td>
                {columns.map((c) => (
                  <td
                    key={c}
                    className={selected === c ? "selected-column" : ""}
                  >
                    {row[c] === null ? <em>null</em> : String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="empty-message">No rows match this selection.</p>
        )}
      </div>
      <div className="pagination">
        <button disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous
        </button>
        <span>
          Page {current + 1} of {Math.max(1, Math.ceil(filtered.length / 50))}
        </span>
        <button
          disabled={(current + 1) * 50 >= filtered.length}
          onClick={() => setPage(current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
