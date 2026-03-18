"use client";

import { Fragment, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DeadlineTask } from "./PMBoardTable";

const categoryStyles = {
  critical: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  overdue: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
  recent: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  upcoming: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
};

interface ProjectRow {
  projectId: string;
  name: string;
  pm: string;
  client: string;
  tasks: DeadlineTask[];
}

function countByCategory(tasks: DeadlineTask[]) {
  const critical = tasks.filter((t) => t.category === "critical").length;
  const overdue = tasks.filter((t) => t.category === "overdue").length;
  const recent = tasks.filter((t) => t.category === "recent").length;
  const upcoming = tasks.filter((t) => t.category === "upcoming").length;
  return { critical, overdue, recent, upcoming };
}

export default function PMBoardByProject({ projects }: { projects: ProjectRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="w-8 px-3 py-2" />
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Project</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">PM</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Klant</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Kritiek</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Te laat</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Recent</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Binnenkort</th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                Geen projecten met deadline-issues.
              </td>
            </tr>
          ) : (
            projects.map((row) => {
              const counts = countByCategory(row.tasks);
              const isExpanded = expandedId === row.projectId;
              const byAssignees = new Map<string, DeadlineTask[]>();
              for (const t of row.tasks) {
                const key = t.assignees || "Niet toegewezen";
                if (!byAssignees.has(key)) byAssignees.set(key, []);
                byAssignees.get(key)!.push(t);
              }
              const assigneeGroups = Array.from(byAssignees.entries()).sort((a, b) =>
                a[0].localeCompare(b[0])
              );

              return (
                <Fragment key={row.projectId}>
                  <tr
                    key={row.projectId}
                    onClick={() => setExpandedId(isExpanded ? null : row.projectId)}
                    className={clsx(
                      "border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer transition-colors",
                      isExpanded && "bg-orange-50/50"
                    )}
                  >
                    <td className="px-3 py-2">
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-gray-500" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.pm || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.client || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {counts.critical > 0 ? (
                        <span className="text-red-600 font-medium">{counts.critical}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {counts.overdue > 0 ? (
                        <span className="text-amber-600 font-medium">{counts.overdue}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {counts.recent > 0 ? (
                        <span className="text-yellow-600 font-medium">{counts.recent}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {counts.upcoming > 0 ? (
                        <span className="text-blue-600 font-medium">{counts.upcoming}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${row.projectId}-exp`} className="bg-gray-50/80">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="pl-6 space-y-4">
                          {assigneeGroups.map(([assignee, tasks]) => {
                            const sorted = [...tasks].sort((a, b) => b.daysLate - a.daysLate);
                            return (
                              <div key={assignee}>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                  {assignee} ({tasks.length} taak/taken)
                                </p>
                                <ul className="space-y-1.5">
                                  {sorted.map((t) => {
                                    const s = categoryStyles[t.category];
                                    return (
                                      <li
                                        key={t.id}
                                        className="flex items-center gap-3 text-sm flex-wrap"
                                      >
                                        <span
                                          className={clsx(
                                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                                            s.bg,
                                            s.text
                                          )}
                                        >
                                          <span className={clsx("w-1.5 h-1.5 rounded-full", s.dot)} />
                                          {t.categoryLabel}
                                        </span>
                                        <span className="text-gray-700">{t.dueDate}</span>
                                        <a
                                          href={t.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-orange-600 hover:underline truncate max-w-md"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {t.name}
                                        </a>
                                        <span className="text-gray-400 text-xs">{t.status}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
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
  );
}
