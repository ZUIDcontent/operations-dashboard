"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import DataTable, { Column } from "@/components/DataTable";
import InfoTooltip from "@/components/InfoTooltip";
import StatusFilter from "@/components/StatusFilter";
import type { OverviewItem } from "@/lib/types";

type Row = OverviewItem & { type: "project" | "estimate" };

const columns: Column<Row>[] = [
  {
    key: "type",
    label: "Type",
    width: "90px",
    render: (r) => (
      <span
        className={clsx(
          "inline-flex px-2 py-0.5 rounded text-xs font-medium",
          r.type === "project" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"
        )}
      >
        {r.type === "project" ? "Project" : "Estimate"}
      </span>
    ),
  },
  { key: "name", label: "Overview-taak", width: "28%" },
  { key: "client", label: "Klant" },
  { key: "grippNr", label: "Gripp Nr." },
  {
    key: "hasList",
    label: "Status",
    width: "120px",
    sortValue: (r) => (r.hasList ? 1 : 0),
    render: (r) =>
      r.hasList ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Gekoppeld
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Geen lijst
        </span>
      ),
  },
  {
    key: "listUrl",
    label: "Lijst in Delivery",
    width: "140px",
    sortable: false,
    render: (r) => {
      const url = r.listUrl as string | null | undefined;
      if (!url) return <span className="text-gray-400">—</span>;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-500 hover:underline text-sm"
        >
          Open lijst →
        </a>
      );
    },
  },
  { key: "taskCount", label: "Taken", align: "right", width: "70px" },
  {
    key: "url",
    label: "Overview",
    width: "90px",
    sortable: false,
    render: (r) => (
      <a
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-orange-500 hover:underline text-sm"
      >
        Open taak →
      </a>
    ),
  },
];

const FILTERS = [
  { id: "all", label: "Alle" },
  { id: "project", label: "Projecten" },
  { id: "estimate", label: "Estimates" },
] as const;

export default function ControlTable({ items }: { items: Row[] }) {
  const [filter, setFilter] = useState<"all" | "project" | "estimate">("all");
  const [statusSelected, setStatusSelected] = useState<string[]>([]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add((i.status ?? "").trim() || "(leeg)"));
    return Array.from(set).sort();
  }, [items]);

  const byType =
    filter === "all"
      ? items
      : filter === "project"
        ? items.filter((i) => i.type === "project")
        : items.filter((i) => i.type === "estimate");

  const filtered = useMemo(() => {
    if (statusSelected.length === 0) return byType;
    return byType.filter((i) => {
      const s = (i.status ?? "").trim() || "(leeg)";
      return statusSelected.includes(s);
    });
  }, [byType, statusSelected]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Match-overzicht</h2>
        <InfoTooltip text="Elke taak in Overview/Projects en Overview/Estimates heeft een custom field 'List' met een URL naar de bijbehorende lijst in de Delivery space (per klant). ✅ Gekoppeld = URL aanwezig en lijst succesvol geladen tijdens sync. ⚠ Geen lijst = veld leeg of link ongeldig (404/geen rechten)." />
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                filter === f.id
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {f.label}
              {f.id === "all" && ` (${items.length})`}
              {f.id === "project" && ` (${items.filter((i) => i.type === "project").length})`}
              {f.id === "estimate" && ` (${items.filter((i) => i.type === "estimate").length})`}
            </button>
          ))}
        </div>
        <StatusFilter
          statuses={statuses}
          selected={statusSelected}
          onChange={setStatusSelected}
          label="Filter op status"
        />
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        searchKeys={["name", "client", "grippNr"]}
        defaultSort={{ key: "hasList", dir: "asc" }}
        emptyMessage="Geen items met dit filter."
      />
    </div>
  );
}
