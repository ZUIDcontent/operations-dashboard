"use client";

import { useMemo, useState } from "react";
import MetricCard from "@/components/MetricCard";
import StatusFilter from "@/components/StatusFilter";
import EstimatesTable from "./EstimatesTable";
import type { OverviewItem } from "@/lib/data";

function eur(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function EstimatesWithFilter({ estimates }: { estimates: OverviewItem[] }) {
  const [statusSelected, setStatusSelected] = useState<string[]>([]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    estimates.forEach((e) => set.add((e.status ?? "").trim() || "(leeg)"));
    return Array.from(set).sort();
  }, [estimates]);

  const filtered = useMemo(() => {
    if (statusSelected.length === 0) return estimates;
    return estimates.filter((e) => {
      const s = (e.status ?? "").trim() || "(leeg)";
      return statusSelected.includes(s);
    });
  }, [estimates, statusSelected]);

  const withValue = useMemo(() => filtered.filter((e) => e.signedOfferValue > 0), [filtered]);
  const totalValue = withValue.reduce((s, e) => s + e.signedOfferValue, 0);
  const totalBudget = withValue.reduce((s, e) => s + e.totalTaskBudget, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} estimates uit Overview/Estimates</p>
        </div>
        <StatusFilter
          statuses={statuses}
          selected={statusSelected}
          onChange={setStatusSelected}
          label="Filter op status (estimate)"
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Totaal estimates" value={filtered.length} />
        <MetricCard label="Met waarde" value={withValue.length} />
        <MetricCard label="Totale offertewaarde" value={eur(totalValue)} />
        <MetricCard label="Totaal budget" value={eur(totalBudget)} />
      </div>

      <EstimatesTable estimates={filtered} />
    </div>
  );
}
