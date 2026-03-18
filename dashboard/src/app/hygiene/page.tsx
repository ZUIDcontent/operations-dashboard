import { loadCache } from "@/lib/data";
import MetricCard from "@/components/MetricCard";
import HygieneProjectList from "./HygieneProjectList";
import GrippSection from "./GrippSection";

export const dynamic = "force-dynamic";

export default function HygienePage() {
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

  const projects = cache.projects.filter((p) => p.taskCount > 0);
  const nonContainerTasks = projects.flatMap((p) => p.tasks.filter((t) => !t.isContainer));
  const noAssignee = nonContainerTasks.filter((t) => t.issues.includes("no_assignee"));
  const noEstimate = nonContainerTasks.filter((t) => t.issues.includes("no_estimate"));
  const missingDates = nonContainerTasks.filter(
    (t) => t.issues.includes("no_start_date") || t.issues.includes("no_due_date")
  );
  const containerHours = projects.flatMap((p) =>
    p.tasks.filter((t) => t.hoursOnContainer > 0).map((t) => ({ ...t, projectName: p.name, pm: p.pm }))
  );
  const totalContainerHours = containerHours.reduce((s, t) => s + t.hoursOnContainer, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Hygiëne Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Alleen taken met task type &quot;Task&quot; (geen containers). Per project uit te klappen naar individuele taken.
      </p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Zonder assignee" value={noAssignee.length} />
        <MetricCard label="Zonder uren-schatting" value={noEstimate.length} />
        <MetricCard label="Zonder start/due date" value={missingDates.length} />
        <MetricCard label="Uren op containers" value={containerHours.length} sub={`${totalContainerHours.toFixed(1)} u totaal`} />
      </div>

      <GrippSection />

      <HygieneProjectList projects={projects} />
    </div>
  );
}
