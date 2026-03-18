"use client";

import { Fragment, useState, useCallback } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Check, Loader2 } from "lucide-react";
import type { OverviewItem } from "@/lib/types";
import InfoTooltip from "@/components/InfoTooltip";

function eur(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface FieldDraft {
  signedOfferValue: string;
  vendorCosts: string;
  vendorMargin: string;
  riskBuffer: string;
}

function calcTotalTaskBudget(
  signedOffer: number,
  vendorCosts: number,
  vendorMarginPct: number,
  riskBufferPct: number
) {
  const riskAmount = signedOffer * (riskBufferPct / 100);
  const marginAmount = vendorCosts * (vendorMarginPct / 100);
  return signedOffer - riskAmount - marginAmount - vendorCosts;
}

export default function ProjectEditPanel({ projects }: { projects: OverviewItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, FieldDraft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [successMsg, setSuccessMsg] = useState<Record<string, string>>({});

  const filtered = search.trim()
    ? projects.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.client ?? "").toLowerCase().includes(q) ||
          (p.pm ?? "").toLowerCase().includes(q) ||
          (p.grippNr ?? "").includes(q)
        );
      })
    : projects;

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const getDraft = useCallback(
    (p: OverviewItem): FieldDraft => {
      if (drafts[p.id]) return drafts[p.id];
      return {
        signedOfferValue: p.signedOfferValue ? String(p.signedOfferValue) : "",
        vendorCosts: p.vendorCosts ? String(p.vendorCosts) : "",
        vendorMargin: p.vendorMargin ? String(p.vendorMargin) : "",
        riskBuffer: p.riskBuffer ? String(p.riskBuffer) : "",
      };
    },
    [drafts]
  );

  const updateDraft = (id: string, key: keyof FieldDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...getDraft(projects.find((p) => p.id === id)!), [key]: value },
    }));
  };

  const handleSave = async (p: OverviewItem) => {
    setSaving(p.id);
    try {
      const draft = getDraft(p);
      const fields: Record<string, number> = {};
      const sv = parseFloat(draft.signedOfferValue);
      const vc = parseFloat(draft.vendorCosts);
      const vm = parseFloat(draft.vendorMargin);
      const rb = parseFloat(draft.riskBuffer);

      if (!isNaN(sv) && sv !== p.signedOfferValue) fields.signedOfferValue = sv;
      if (!isNaN(vc) && vc !== p.vendorCosts) fields.vendorCosts = vc;
      if (!isNaN(vm) && vm !== p.vendorMargin) fields.vendorMargin = vm;
      if (!isNaN(rb) && rb !== p.riskBuffer) fields.riskBuffer = rb;

      if (Object.keys(fields).length === 0) {
        setSaving(null);
        return;
      }

      const res = await fetch("/api/clickup-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: p.id, fields }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg((prev) => ({ ...prev, [p.id]: "Opgeslagen in ClickUp" }));
        setTimeout(() => setSuccessMsg((prev) => { const n = { ...prev }; delete n[p.id]; return n; }), 3000);
      } else {
        setSuccessMsg((prev) => ({ ...prev, [p.id]: `Fout: ${data.error}` }));
      }
    } catch (e) {
      setSuccessMsg((prev) => ({
        ...prev,
        [p.id]: `Fout: ${e instanceof Error ? e.message : "onbekend"}`,
      }));
    }
    setSaving(null);
  };

  const handleComplete = async (p: OverviewItem) => {
    setCompleting(p.id);
    try {
      const res = await fetch("/api/clickup-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: p.id, action: "complete" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg((prev) => ({ ...prev, [p.id]: "Status → complete" }));
        setTimeout(() => setSuccessMsg((prev) => { const n = { ...prev }; delete n[p.id]; return n; }), 3000);
      } else {
        setSuccessMsg((prev) => ({ ...prev, [p.id]: `Fout: ${data.error}` }));
      }
    } catch (e) {
      setSuccessMsg((prev) => ({
        ...prev,
        [p.id]: `Fout: ${e instanceof Error ? e.message : "onbekend"}`,
      }));
    }
    setCompleting(null);
  };

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold text-gray-900">Opdracht-gegevens invullen</h2>
        <InfoTooltip text="Vul ontbrekende financiële gegevens in voor een opdracht. Wijzigingen worden direct in ClickUp opgeslagen. Velden die al ingevuld zijn kun je niet wijzigen. Total task budget wordt automatisch berekend: Signed offer − Risk buffer − Vendor margin − Vendor costs." />
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Klik op een project om velden in te vullen. Alleen lege velden zijn bewerkbaar.
      </p>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Zoek project, klant of PM..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-8 px-3 py-2" />
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Project</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">PM</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Signed offer</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Vendor costs</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Vendor margin</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Risk buffer</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total task budget</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Geen projecten gevonden.
                </td>
              </tr>
            ) : (
              sorted.map((p) => {
                const isExpanded = expandedId === p.id;
                const draft = getDraft(p);
                const hasEmpty =
                  !p.signedOfferValue || !p.vendorCosts || !p.vendorMargin || !p.riskBuffer;
                const isComplete = (p.status ?? "").toLowerCase() === "complete";

                const previewBudget = calcTotalTaskBudget(
                  parseFloat(draft.signedOfferValue) || 0,
                  parseFloat(draft.vendorCosts) || 0,
                  parseFloat(draft.vendorMargin) || 0,
                  parseFloat(draft.riskBuffer) || 10
                );

                return (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
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
                      <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-xs">
                        {p.name}
                        {hasEmpty && (
                          <span className="ml-2 text-xs text-amber-600 font-normal">ontbreekt</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.pm || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            isComplete
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {p.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{eur(p.signedOfferValue)}</td>
                      <td className="px-4 py-3 text-right">{eur(p.vendorCosts)}</td>
                      <td className="px-4 py-3 text-right">
                        {p.vendorMargin ? `${p.vendorMargin}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.riskBuffer ? `${p.riskBuffer}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{eur(p.totalTaskBudget)}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50/80">
                        <td colSpan={9} className="px-6 py-5">
                          <div className="max-w-2xl space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <FieldInput
                                label="Signed offer value (€)"
                                value={draft.signedOfferValue}
                                locked={!!p.signedOfferValue}
                                onChange={(v) => updateDraft(p.id, "signedOfferValue", v)}
                                placeholder="bijv. 25000"
                              />
                              <FieldInput
                                label="Vendor costs (€)"
                                value={draft.vendorCosts}
                                locked={!!p.vendorCosts}
                                onChange={(v) => updateDraft(p.id, "vendorCosts", v)}
                                placeholder="bijv. 5000"
                              />
                              <FieldInput
                                label="Vendor margin (%)"
                                value={draft.vendorMargin}
                                locked={!!p.vendorMargin}
                                onChange={(v) => updateDraft(p.id, "vendorMargin", v)}
                                placeholder="bijv. 15"
                              />
                              <FieldInput
                                label="Risk buffer (%, default 10)"
                                value={draft.riskBuffer || "10"}
                                locked={!!p.riskBuffer}
                                onChange={(v) => updateDraft(p.id, "riskBuffer", v)}
                                placeholder="10"
                              />
                            </div>

                            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm">
                              <span className="text-gray-500">Berekend total task budget: </span>
                              <span className="font-semibold text-gray-900">{eur(previewBudget)}</span>
                              <span className="text-gray-400 ml-2 text-xs">
                                = signed offer − {draft.riskBuffer || "10"}% risk − {draft.vendorMargin || "0"}% vendor margin − €{draft.vendorCosts || "0"} vendor
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {hasEmpty && (
                                <button
                                  type="button"
                                  onClick={() => handleSave(p)}
                                  disabled={saving === p.id}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                                >
                                  {saving === p.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                  Opslaan in ClickUp
                                </button>
                              )}

                              {!isComplete && (
                                <button
                                  type="button"
                                  onClick={() => handleComplete(p)}
                                  disabled={completing === p.id}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
                                >
                                  {completing === p.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                  Zet op complete
                                </button>
                              )}

                              {successMsg[p.id] && (
                                <span
                                  className={clsx(
                                    "text-sm font-medium",
                                    successMsg[p.id].startsWith("Fout")
                                      ? "text-red-600"
                                      : "text-emerald-600"
                                  )}
                                >
                                  {successMsg[p.id]}
                                </span>
                              )}
                            </div>
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
    </section>
  );
}

function FieldInput({
  label,
  value,
  locked,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  locked: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {locked && (
          <span className="ml-1 text-gray-400 font-normal">(ingevuld)</span>
        )}
      </label>
      {locked ? (
        <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">
          {value}
        </div>
      ) : (
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
