"use client";

import { useState, useMemo, Fragment } from "react";
import { Search, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import clsx from "clsx";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => number | string;
  align?: "left" | "right" | "center";
  width?: string;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: string[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  emptyMessage?: string;
  pageSize?: number;
  /** Return non-null content to make the row expandable. */
  expandRow?: (row: T) => React.ReactNode;
  /** Only rows where this returns true are expandable. Defaults to true for all rows when expandRow is set. */
  isExpandable?: (row: T) => boolean;
  /** Controlled expanded row id */
  expandedId?: string | null;
  onExpandChange?: (id: string | null) => void;
  /** Extra CSS classes per row */
  rowClassName?: (row: T) => string;
}

export default function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchKeys = [],
  defaultSort,
  emptyMessage = "Geen data",
  pageSize = 50,
  expandRow,
  isExpandable,
  expandedId,
  onExpandChange,
  rowClassName,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const getValue = col.sortValue ?? ((row: T) => row[sort.key] as number | string);
    return [...filtered].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sort.dir === "asc" ? va - vb : vb - va;
      }
      return sort.dir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(key: string) {
    if (sort?.key === key) {
      setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      setSort({ key, dir: "desc" });
    }
    setPage(0);
  }

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sort?.key !== colKey) return <ArrowUpDown size={12} className="text-gray-300" />;
    return sort.dir === "asc" ? (
      <ChevronUp size={12} className="text-orange-500" />
    ) : (
      <ChevronDown size={12} className="text-orange-500" />
    );
  };

  function canExpand(row: T) {
    if (!expandRow) return false;
    if (isExpandable) return isExpandable(row);
    return true;
  }

  return (
    <div>
      {searchKeys.length > 0 && (
        <div className="relative mb-3 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Zoeken..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    "px-4 py-3 font-semibold text-gray-600 whitespace-nowrap",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    col.sortable !== false && "cursor-pointer select-none hover:text-gray-900"
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && <SortIcon colKey={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => {
                const rowId = String(row.id ?? i);
                const expandable = canExpand(row);
                const isExpanded = expandable && expandedId === rowId;
                const expandContent = expandable && isExpanded ? expandRow!(row) : null;

                return (
                  <Fragment key={rowId}>
                    <tr
                      onClick={() => {
                        if (!expandable) return;
                        onExpandChange?.(isExpanded ? null : rowId);
                      }}
                      className={clsx(
                        "border-b border-gray-100 transition-colors",
                        expandable ? "cursor-pointer hover:bg-amber-50/60" : "hover:bg-gray-50/50",
                        isExpanded && "bg-amber-50/40",
                        rowClassName?.(row)
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={clsx(
                            "px-4 py-3",
                            col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                          )}
                        >
                          {col.render ? col.render(row) : String(row[col.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                    {expandContent && (
                      <tr className="border-b border-amber-100">
                        <td colSpan={columns.length} className="px-4 py-4 bg-amber-50/30">
                          {expandContent}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>
            {sorted.length} resultaten · pagina {page + 1}/{totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
            >
              Vorige
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
            >
              Volgende
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
