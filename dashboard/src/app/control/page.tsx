import { loadCache } from "@/lib/data";
import MetricCard from "@/components/MetricCard";
import ControlTable from "./ControlTable";

export const dynamic = "force-dynamic";

export default function ControlPage() {
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

  const projects = cache.projects;
  const estimates = cache.estimates;

  const projectsLinked = projects.filter((p) => p.hasList).length;
  const projectsUnlinked = projects.filter((p) => !p.hasList).length;
  const estimatesLinked = estimates.filter((e) => e.hasList).length;
  const estimatesUnlinked = estimates.filter((e) => !e.hasList).length;

  const allItems = [
    ...projects.map((p) => ({ ...p, type: "project" as const })),
    ...estimates.map((e) => ({ ...e, type: "estimate" as const })),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Controle — Match Overview ↔ Lijsten</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Overzicht van de koppeling tussen Overview-taken (Projects en Estimates) en de bijbehorende lijsten in Delivery.
        Elke Overview-taak heeft een veld &quot;List&quot; met een URL naar de werk-lijst; hier zie je of die match klopt.
      </p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Projecten gekoppeld"
          value={projectsLinked}
          sub={`van ${projects.length}`}
        />
        <MetricCard
          label="Projecten zonder lijst"
          value={projectsUnlinked}
          sub={projectsUnlinked > 0 ? "Geen List URL of ongeldige link" : ""}
        />
        <MetricCard
          label="Estimates gekoppeld"
          value={estimatesLinked}
          sub={`van ${estimates.length}`}
        />
        <MetricCard
          label="Estimates zonder lijst"
          value={estimatesUnlinked}
          sub={estimatesUnlinked > 0 ? "Geen List URL of ongeldige link" : ""}
        />
      </div>

      <ControlTable items={allItems} />
    </div>
  );
}
