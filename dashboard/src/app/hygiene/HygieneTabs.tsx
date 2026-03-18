"use client";

import { useState } from "react";
import clsx from "clsx";
import DataTable, { Column } from "@/components/DataTable";
import InfoTooltip from "@/components/InfoTooltip";
import type { DeliveryTask, ArchivedIssue, OverviewItem } from "@/lib/types";

type TaskRow = DeliveryTask & { project: string; client: string; [key: string]: unknown };
type ArchivedRow = ArchivedIssue & { [key: string]: unknown };
type ProjectRow = OverviewItem & { [key: string]: unknown };

const taskCols: Column<TaskRow>[] = [
  { key: "name", label: "Taak", width: "28%" },
  { key: "project", label: "Project" },
  { key: "client", label: "Klant" },
  { key: "status", label: "Status", render: (r) => <span className="capitalize">{r.status}</span> },
  {
    key: "url", label: "", sortable: false,
    render: (r) => <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline text-xs">Open →</a>,
  },
];

const dateCols: Column<TaskRow>[] = [
  { key: "name", label: "Taak", width: "25%" },
  { key: "project", label: "Project" },
  { key: "client", label: "Klant" },
  {
    key: "issues", label: "Ontbreekt",
    render: (r) => {
      const parts = [];
      if (r.issues.includes("no_start_date")) parts.push("Start date");
      if (r.issues.includes("no_due_date")) parts.push("Due date");
      return parts.join(", ");
    },
  },
  { key: "status", label: "Status", render: (r) => <span className="capitalize">{r.status}</span> },
  {
    key: "url", label: "", sortable: false,
    render: (r) => <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline text-xs">Open →</a>,
  },
];

const archivedCols: Column<ArchivedRow>[] = [
  { key: "taskName", label: "Taak", width: "28%" },
  { key: "project", label: "Project" },
  { key: "list", label: "Lijst" },
  { key: "hours", label: "Uren", align: "right" },
  {
    key: "url", label: "", sortable: false,
    render: (r) => <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline text-xs">Open →</a>,
  },
];

const projectCols: Column<ProjectRow>[] = [
  { key: "name", label: "Project", width: "30%" },
  { key: "client", label: "Klant" },
  { key: "grippNr", label: "Gripp Nr." },
  { key: "status", label: "Status", render: (r) => <span className="capitalize">{r.status as string}</span> },
];

interface TabDef { id: string; label: string; count: number; tooltip: string }

export default function HygieneTabs({
  noAssignee, noEstimate, missingDates, archivedIssues, noListProjects,
}: {
  noAssignee: TaskRow[];
  noEstimate: TaskRow[];
  missingDates: TaskRow[];
  archivedIssues: ArchivedRow[];
  noListProjects: ProjectRow[];
}) {
  const tabs: TabDef[] = [
    { id: "assignee", label: "Geen Assignee", count: noAssignee.length, tooltip: "Taken zonder toegewezen persoon. Container-taken zijn uitgefilterd." },
    { id: "estimate", label: "Geen Schatting", count: noEstimate.length, tooltip: "Taken zonder time estimate. Zonder schatting kan het budget niet berekend worden (Rate × Geschatte uren)." },
    { id: "dates", label: "Geen Datums", count: missingDates.length, tooltip: "Taken zonder start date en/of due date." },
    { id: "archived", label: "Gearchiveerd", count: archivedIssues.length, tooltip: "Taken in gearchiveerde lijsten waar nog uren op staan. Deze uren tellen mee in het project maar de lijst is al gearchiveerd." },
    { id: "nolist", label: "Geen Lijst", count: noListProjects.length, tooltip: "Actieve projecten in Overview zonder gekoppelde lijst in Delivery (List URL ontbreekt)." },
  ];

  const [active, setActive] = useState("assignee");

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1",
              active === tab.id
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {tab.label}
            <span className={clsx(
              "text-xs font-bold px-2 py-0.5 rounded-full",
              tab.count > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400",
            )}>
              {tab.count}
            </span>
            <InfoTooltip text={tab.tooltip} />
          </button>
        ))}
      </div>

      {active === "assignee" && <DataTable data={noAssignee} columns={taskCols} searchKeys={["name", "project", "client"]} />}
      {active === "estimate" && <DataTable data={noEstimate} columns={taskCols} searchKeys={["name", "project", "client"]} />}
      {active === "dates" && <DataTable data={missingDates} columns={dateCols} searchKeys={["name", "project", "client"]} />}
      {active === "archived" && <DataTable data={archivedIssues} columns={archivedCols} searchKeys={["taskName", "project"]} defaultSort={{ key: "hours", dir: "desc" }} />}
      {active === "nolist" && <DataTable data={noListProjects} columns={projectCols} searchKeys={["name", "client"]} />}
    </div>
  );
}
