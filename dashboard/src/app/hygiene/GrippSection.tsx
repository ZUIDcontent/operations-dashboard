"use client";

import { useEffect, useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

interface GrippRow {
  id: string;
  name: string;
  pm: string;
  grippNr: string;
  grippId: string;
  listArchived: boolean;
  grippOpen: boolean | null;
}

interface GrippStatusResponse {
  ok: boolean;
  grippConfigured: boolean;
  message?: string;
  projectsWithGrippId: number;
  grippOrdersCount?: number;
  grippError?: string;
  archivedInCuOpenInGripp: GrippRow[];
  openInCuArchivedInGripp: GrippRow[];
}

export default function GrippSection() {
  const [data, setData] = useState<GrippStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gripp-status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Gripp-koppeling</h2>
          <InfoTooltip text="Match lijsten in ClickUp met orders in Gripp via Gripp ID/nummer (op overview-taak)." />
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Gripp-status laden…
        </div>
      </section>
    );
  }

  if (!data?.ok) {
    return (
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Gripp-koppeling</h2>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Kon Gripp-status niet ophalen. Controleer of de cache bestaat (draai <code className="bg-red-100 px-1 rounded">node sync.mjs</code>).
        </div>
      </section>
    );
  }

  const hasGripp = data.grippConfigured;
  const a = data.archivedInCuOpenInGripp ?? [];
  const b = data.openInCuArchivedInGripp ?? [];

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold text-gray-900">Gripp-koppeling</h2>
        <InfoTooltip text="Match lijsten in ClickUp met orders in Gripp via Gripp ID/nummer. Sync moet draaien zodat ClickUp weet welke lijsten gearchiveerd zijn." />
      </div>

      {!hasGripp && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-4">
          <p className="font-medium">Gripp API nog niet geconfigureerd</p>
          <p className="mt-1 text-amber-700">
            Er zijn <strong>{data.projectsWithGrippId}</strong> projecten met een Gripp-nummer of -ID in ClickUp.
            Zet <code className="bg-amber-100 px-1 rounded">gripp_base_url</code> en{" "}
            <code className="bg-amber-100 px-1 rounded">gripp_api_token</code> in{" "}
            <code className="bg-amber-100 px-1 rounded">dashboard/.env.local</code> (dus in de map waar <code>package.json</code> staat). Dan
            kunnen we vergelijken welke opdrachten gearchiveerd zijn in ClickUp maar nog open in Gripp (en omgekeerd).
          </p>
        </div>
      )}

      {data.grippError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 mb-4">
          <p className="font-medium">Gripp API-fout</p>
          <p className="mt-1 text-red-700">{data.grippError}</p>
          <p className="mt-1 text-red-600 text-xs">
            Controleer gripp_base_url (bijv. https://zuidagencygroup.gripp.com) en of gripp_api_token geldig is.
            Gripp gebruikt vaak <code>?action=opdrachten</code> of een ander endpoint; zie Gripp-documentatie.
          </p>
        </div>
      )}

      {hasGripp && !data.grippError && (
        <p className="text-sm text-gray-500 mb-3">
          {data.projectsWithGrippId} projecten met Gripp-koppeling · {data.grippOrdersCount ?? 0} opdrachten uit Gripp geladen.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
            <h3 className="font-semibold text-amber-900">
              Gearchiveerd in ClickUp, nog open in Gripp
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">
              Lijst staat dicht in CU; opdracht staat nog open in Gripp — overweeg archiveren in Gripp.
            </p>
          </div>
          <div className="overflow-x-auto">
            {a.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">
                Geen — alles in lijn.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Project</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">PM</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Gripp nr.</th>
                  </tr>
                </thead>
                <tbody>
                  {a.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-2 text-gray-600">{r.pm || "—"}</td>
                      <td className="px-4 py-2 text-gray-600">{r.grippNr || r.grippId || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-violet-50 px-4 py-2 border-b border-violet-200">
            <h3 className="font-semibold text-violet-900">
              Open in ClickUp, gearchiveerd in Gripp
            </h3>
            <p className="text-xs text-violet-700 mt-0.5">
              Lijst staat nog open in CU; opdracht is in Gripp afgesloten — overweeg archiveren in ClickUp.
            </p>
          </div>
          <div className="overflow-x-auto">
            {b.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">
                Geen — alles in lijn.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Project</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">PM</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Gripp nr.</th>
                  </tr>
                </thead>
                <tbody>
                  {b.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-2 text-gray-600">{r.pm || "—"}</td>
                      <td className="px-4 py-2 text-gray-600">{r.grippNr || r.grippId || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
