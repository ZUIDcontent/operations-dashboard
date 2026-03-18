"use client";

import { useState } from "react";
import clsx from "clsx";
import DataTable, { Column } from "@/components/DataTable";

export interface DeadlineTask {
  id: string;
  name: string;
  projectId: string;
  project: string;
  pm?: string;
  client: string;
  status: string;
  assignees: string;
  dueDate: string;
  daysLate: number;
  category: "critical" | "overdue" | "recent" | "upcoming";
  categoryLabel: string;
  url: string;
  [key: string]: unknown;
}

const categoryStyles = {
  critical: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  overdue: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
  recent: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  upcoming: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
};

const columns: Column<DeadlineTask>[] = [
  {
    key: "category",
    label: "",
    width: "120px",
    sortValue: (r) => r.daysLate,
    render: (r) => {
      const s = categoryStyles[r.category];
      return (
        <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", s.bg, s.text)}>
          <span className={clsx("w-1.5 h-1.5 rounded-full", s.dot)} />
          {r.category === "critical" ? "Kritiek" : r.category === "overdue" ? "Te laat" : r.category === "recent" ? "Recent" : "Binnenkort"}
        </span>
      );
    },
  },
  { key: "name", label: "Taak", width: "25%" },
  { key: "project", label: "Project" },
  { key: "assignees", label: "Assignee" },
  { key: "status", label: "Status" },
  { key: "dueDate", label: "Due date", sortValue: (r) => r.daysLate },
  {
    key: "categoryLabel",
    label: "Urgentie",
    sortValue: (r) => r.daysLate,
    render: (r) => (
      <span className={r.daysLate > 0 ? "text-red-600 font-medium" : "text-blue-600"}>
        {r.categoryLabel}
      </span>
    ),
  },
  {
    key: "url",
    label: "",
    sortable: false,
    render: (r) => (
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline text-xs">
        Open →
      </a>
    ),
  },
];

const FILTER_OPTIONS = [
  { id: "all", label: "Alle" },
  { id: "critical", label: "Kritiek" },
  { id: "overdue", label: "Te laat" },
  { id: "recent", label: "Recent" },
  { id: "upcoming", label: "Binnenkort" },
] as const;

export default function PMBoardTable({ tasks }: { tasks: DeadlineTask[] }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.category === filter);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt.id === "all" ? tasks.length : tasks.filter((t) => t.category === opt.id).length;
          return (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                filter === opt.id
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        searchKeys={["name", "project", "assignees", "client"]}
        defaultSort={{ key: "daysLate", dir: "desc" }}
        emptyMessage="Geen taken met deadline-issues gevonden."
      />
    </div>
  );
}
