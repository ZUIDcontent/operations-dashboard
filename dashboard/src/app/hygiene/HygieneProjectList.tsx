"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";
import InfoTooltip from "@/components/InfoTooltip";
import type { OverviewItem } from "@/lib/types";
import type { DeliveryTask } from "@/lib/types";

function issueLabels(issues: string[]) {
  const out: string[] = [];
  if (issues.includes("no_assignee")) out.push("Geen assignee");
  if (issues.includes("no_estimate")) out.push("Geen schatting");
  if (issues.includes("no_start_date")) out.push("Geen start");
  if (issues.includes("no_due_date")) out.push("Geen due");
  return out;
}

export default function HygieneProjectList({ projects }: { projects: OverviewItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = projects.map((p) => {
    const tasks = (p.tasks || []).filter((t) => !t.isContainer);
    const noAssignee = tasks.filter((t) => t.issues.includes("no_assignee"));
    const noEstimate = tasks.filter((t) => t.issues.includes("no_estimate"));
    const noDates = tasks.filter(
      (t) => t.issues.includes("no_start_date") || t.issues.includes("no_due_date")
    );
    const containerHours = (p.tasks || []).filter((t) => t.hoursOnContainer > 0);
    const totalContainerH = containerHours.reduce((s, t) => s + t.hoursOnContainer, 0);
    const hasIssues = noAssignee.length > 0 || noEstimate.length > 0 || noDates.length > 0 || containerHours.length > 0;

    return {
      ...p,
      noAssignee: noAssignee.length,
      noEstimate: noEstimate.length,
      noDates: noDates.length,
      containerHours: containerHours.length,
      totalContainerH,
      tasksWithIssues: tasks.filter(
        (t) =>
          t.issues.includes("no_assignee") ||
          t.issues.includes("no_estimate") ||
          t.issues.includes("no_start_date") ||
          t.issues.includes("no_due_date")
      ),
      containerTasks: containerHours,
      hasIssues,
    };
  });

  const withIssues = rows.filter((r) => r.hasIssues);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Per project</h2>
        <InfoTooltip text="Alleen task type 'Task' (geen containers). Klik op een rij om individuele taken met ontbrekende assignee, schatting of datums te zien. Uren op containers = uren geschreven op container-taken." />
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-8 px-3 py-2" />
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Project</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">PM</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Klant</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Geen assignee</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Geen schatting</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Geen datums</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Uren op containers</th>
            </tr>
          </thead>
          <tbody>
            {withIssues.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Geen projecten met hygiëne-issues.
                </td>
              </tr>
            ) : (
              withIssues.map((r) => (
                <>
                  <tr
                    key={r.id}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className={clsx(
                      "border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer transition-colors",
                      expandedId === r.id && "bg-orange-50/50"
                    )}
                  >
                    <td className="px-3 py-2">
                      {expandedId === r.id ? (
                        <ChevronDown size={16} className="text-gray-500" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.pm || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.client || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {r.noAssignee > 0 ? <span className="text-red-600 font-medium">{r.noAssignee}</span> : "0"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.noEstimate > 0 ? <span className="text-amber-600 font-medium">{r.noEstimate}</span> : "0"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.noDates > 0 ? <span className="text-amber-600 font-medium">{r.noDates}</span> : "0"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.containerHours > 0 ? (
                        <span className="text-violet-600 font-medium" title={`${r.containerHours} ta(a)k(en)`}>
                          {r.totalContainerH.toFixed(1)} u
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr key={`${r.id}-exp`} className="bg-gray-50/80">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="pl-6 space-y-2">
                          {r.tasksWithIssues.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Taken met ontbrekende gegevens</p>
                              <ul className="space-y-1">
                                {r.tasksWithIssues.map((t: DeliveryTask) => (
                                  <li key={t.id} className="flex items-center gap-3 text-sm">
                                    <a
                                      href={t.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-orange-600 hover:underline truncate max-w-md"
                                    >
                                      {t.name}
                                    </a>
                                    <span className="text-gray-500 text-xs">
                                      {issueLabels(t.issues).join(", ")}
                                    </span>
                                    <span className="text-gray-400">· {t.assignees || "—"}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {r.containerTasks.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Uren op container-taken</p>
                              <ul className="space-y-1">
                                {r.containerTasks.map((t: DeliveryTask) => (
                                  <li key={t.id} className="flex items-center gap-3 text-sm">
                                    <a
                                      href={t.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-orange-600 hover:underline truncate max-w-md"
                                    >
                                      {t.name}
                                    </a>
                                    <span className="text-violet-600 font-medium">{t.hoursOnContainer} u</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
