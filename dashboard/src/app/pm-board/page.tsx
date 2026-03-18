import { loadCache } from "@/lib/data";
import MetricCard from "@/components/MetricCard";
import PMBoardByProject from "./PMBoardByProject";
import type { DeadlineTask } from "./PMBoardTable";

export const dynamic = "force-dynamic";

const COMPLETE = new Set(["complete", "completed", "done", "closed", "afgesloten", "klaar", "opgeleverd"]);

export default function PMBoardPage() {
  const cache = loadCache();
  if (!cache) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">Geen data beschikbaar</p>
          <p className="text-sm text-gray-500 mt-1">
            Draai <code className="bg-gray-200 px-1.5 py-0.5 rounded">node sync.mjs</code>
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const flagged: DeadlineTask[] = [];

  for (const project of cache.projects) {
    for (const task of project.tasks) {
      if (!task.dueDate || task.isContainer) continue;
      if (COMPLETE.has(task.status.toLowerCase())) continue;

      const due = new Date(task.dueDate);
      const daysLate = Math.floor((now.getTime() - due.getTime()) / 86_400_000);

      let category: DeadlineTask["category"] | null = null;
      let categoryLabel = "";

      if (daysLate > 14) {
        category = "critical";
        categoryLabel = `${daysLate}d te laat`;
      } else if (daysLate > 7) {
        category = "overdue";
        categoryLabel = `${daysLate}d te laat`;
      } else if (daysLate > 0) {
        category = "recent";
        categoryLabel = `${daysLate}d te laat`;
      } else if (daysLate >= -7) {
        category = "upcoming";
        categoryLabel = daysLate === 0 ? "Vandaag" : `Over ${Math.abs(daysLate)}d`;
      }

      if (!category) continue;

      flagged.push({
        id: task.id,
        name: task.name,
        projectId: project.id,
        project: project.name,
        pm: project.pm,
        client: project.client,
        status: task.status,
        assignees: task.assignees || "Niet toegewezen",
        dueDate: due.toLocaleDateString("nl-NL"),
        daysLate,
        category,
        categoryLabel,
        url: task.url,
      });
    }
  }

  flagged.sort((a, b) => b.daysLate - a.daysLate);

  const critical = flagged.filter((t) => t.category === "critical").length;
  const overdue = flagged.filter((t) => t.category === "overdue").length;
  const recent = flagged.filter((t) => t.category === "recent").length;
  const upcoming = flagged.filter((t) => t.category === "upcoming").length;

  // Group by project for PMBoardByProject
  const byProject = new Map<string, { projectId: string; name: string; pm: string; client: string; tasks: DeadlineTask[] }>();
  for (const t of flagged) {
    const key = t.projectId;
    if (!byProject.has(key)) {
      byProject.set(key, {
        projectId: key,
        name: t.project,
        pm: t.pm ?? "",
        client: t.client ?? "",
        tasks: [],
      });
    }
    byProject.get(key)!.tasks.push(t);
  }
  const projectsWithTasks = Array.from(byProject.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">PM Board — Deadline Monitor</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        {flagged.length} taken met verlopen of naderende deadlines (excl. containers en afgeronde taken)
      </p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Kritiek (>14d)" value={critical} sub="Direct actie" />
        <MetricCard label="Te laat (7-14d)" value={overdue} sub="Aandacht nodig" />
        <MetricCard label="Recent (<7d)" value={recent} sub="Pas verlopen" />
        <MetricCard label="Binnenkort" value={upcoming} sub="Komende 7 dagen" />
      </div>

      <PMBoardByProject projects={projectsWithTasks} />
    </div>
  );
}
