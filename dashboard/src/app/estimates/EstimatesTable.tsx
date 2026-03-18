"use client";

import DataTable, { Column } from "@/components/DataTable";
import InfoTooltip from "@/components/InfoTooltip";

import type { OverviewItem } from "@/lib/types";

type Estimate = OverviewItem;

function eur(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const columns: Column<Estimate>[] = [
  { key: "name", label: "Estimate", width: "25%" },
  { key: "client", label: "Klant" },
  { key: "status", label: "Status", render: (r) => <span className="capitalize">{r.status}</span> },
  { key: "grippNr", label: "Gripp Nr." },
  { key: "signedOfferValue", label: "Offertewaarde", align: "right", render: (r) => eur(r.signedOfferValue) },
  { key: "vendorCosts", label: "Vendor", align: "right", render: (r) => eur(r.vendorCosts) },
  { key: "totalTaskBudget", label: "Budget", align: "right", render: (r) => eur(r.totalTaskBudget) },
  { key: "plannedBudget", label: "Ingepland", align: "right", render: (r) => eur(r.plannedBudget) },
  { key: "taskCount", label: "Taken", align: "right" },
  {
    key: "url", label: "", sortable: false,
    render: (r) => (
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline text-xs">
        Open →
      </a>
    ),
  },
];

export default function EstimatesTable({ estimates }: { estimates: Estimate[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Alle estimates</h2>
        <InfoTooltip text="Estimates uit Overview/Estimates. Offertewaarde = Signed offer value. Budget = Total task budget (na aftrek vendor/risk). Ingepland = Σ(Rate × Geschatte uren) in gekoppelde lijst." />
      </div>
      <DataTable
        data={estimates}
        columns={columns}
        searchKeys={["name", "client", "grippNr"]}
        defaultSort={{ key: "signedOfferValue", dir: "desc" }}
      />
    </div>
  );
}
