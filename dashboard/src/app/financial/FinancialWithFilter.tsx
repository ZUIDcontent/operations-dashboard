"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import MetricCard from "@/components/MetricCard";
import StatusFilter from "@/components/StatusFilter";
import FinancialTables from "./FinancialTables";
import type { OverviewItem } from "@/lib/types";
import { getStatusColor, getStatusLabel } from "@/lib/status";

function eur(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function csvCell(value: unknown) {
  const str = String(value ?? "");
  const escaped = str.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function toIsoDate(dateValue: unknown): string {
  if (!dateValue) return "";
  const d = new Date(String(dateValue));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dateDoneToIsoDate(dateDoneValue: unknown): string {
  const raw = Number(dateDoneValue);
  if (!Number.isFinite(raw) || raw <= 1) return "";
  const ms = raw > 1_000_000_000_000 ? raw : raw * 1000;
  return toIsoDate(ms);
}

function projectDateForExport(p: OverviewItem): string {
  const created = toIsoDate((p as { dateCreated?: unknown }).dateCreated);
  if (created) return created;

  const candidateDates: string[] = [];
  for (const t of p.tasks || []) {
    if (t.isContainer) continue;
    const start = toIsoDate(t.startDate);
    if (start) candidateDates.push(start);
    const due = toIsoDate(t.dueDate);
    if (due) candidateDates.push(due);
    const done = dateDoneToIsoDate(t.dateDone);
    if (done) candidateDates.push(done);
  }

  if (candidateDates.length === 0) return "";
  candidateDates.sort();
  return candidateDates[0];
}

interface Approvals {
  pm_ohw_exceed: Record<string, { at: string; by?: string }>;
  pm_expected_exceed: Record<string, { at: string; by?: string; approvedExpected: number; threshold: number }>;
}

interface ExpectedBulkApprovalItem {
  projectId: string;
  approvedExpected: number;
}

export default function FinancialWithFilter({ projects }: { projects: OverviewItem[] }) {
  const [statusSelected, setStatusSelected] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [approvals, setApprovals] = useState<Approvals>({ pm_ohw_exceed: {}, pm_expected_exceed: {} });

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals");
      if (res.ok) setApprovals(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => set.add((p.status ?? "").trim() || "(leeg)"));
    return Array.from(set).sort();
  }, [projects]);

  const projectDateById = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of projects) {
      out.set(p.id, projectDateForExport(p));
    }
    return out;
  }, [projects]);

  const availableDateRange = useMemo(() => {
    const dates = Array.from(projectDateById.values()).filter(Boolean).sort();
    return {
      min: dates[0] ?? "",
      max: dates[dates.length - 1] ?? "",
    };
  }, [projectDateById]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const s = (p.status ?? "").trim() || "(leeg)";
      const statusMatch = statusSelected.length === 0 || statusSelected.includes(s);
      const projectDate = projectDateById.get(p.id) || "";
      const fromMatch = !dateFrom || (projectDate !== "" && projectDate >= dateFrom);
      const toMatch = !dateTo || (projectDate !== "" && projectDate <= dateTo);
      return statusMatch && fromMatch && toMatch;
    });
  }, [projects, statusSelected, dateFrom, dateTo, projectDateById]);

  // Geplande waarde moet uit echte taken komen (rate * estimate), niet uit overview rollups.
  const enriched = useMemo(() => {
    return filtered.map((p) => {
      const plannedFromTasks = (p.tasks || [])
        .filter((t) => !t.isContainer)
        .reduce((s, t) => s + (t.rate || 0) * (t.timeEstimate || 0), 0);
      return {
        ...p,
        plannedBudget: plannedFromTasks,
      } as OverviewItem;
    });
  }, [filtered]);

  const withBudget = useMemo(() => enriched.filter((p) => p.totalTaskBudget > 0), [enriched]);
  const active = useMemo(() => enriched.filter((p) => p.taskCount > 0), [enriched]);
  const noListRows = useMemo(() => enriched.filter((p) => !p.hasList), [enriched]);

  // Projects with missing totalTaskBudget — shown inline in each table for quick editing
  const missingRows = useMemo(
    () => enriched.filter((p) => !p.totalTaskBudget),
    [enriched]
  );

  // 1. OHW vs total task budget — rood/oranje/groen op 85%; OHW is al gecapped op opdrachtwaarde in sync
  const burnRows = useMemo(() => {
    return active.map((p) => {
      const totalBudget = (p.totalTaskBudget as number) || 0;
      const ohw = (p.ohw as number) || 0;
      const ohwPct = totalBudget > 0 ? (ohw / totalBudget) * 100 : 0;
      const statusColor = getStatusColor(ohwPct);
      const statusLabel = getStatusLabel(ohwPct);
      return {
        ...p,
        ohwPct: Math.round(ohwPct * 10) / 10,
        statusColor,
        statusLabel,
      };
    });
  }, [active]);

  // 3. Expected task budget — IF(dateDone > 1, spent, IF(spent > budget, spent, budget))
  //    = voor afgeronde taken: werkelijk; voor lopende: max(spent, budget)
  //    Toont projecten waar expected > totalTaskBudget (dreigt uit de bocht te vliegen)
  const expectedRows = useMemo(() => {
    return active
      .map((p) => {
        const totalBudget = (p.totalTaskBudget as number) || 0;
        const expectedBudget = (p.tasks || [])
          .filter((t) => !t.isContainer)
          .reduce((sum, t) => {
            const done = (t.dateDone ?? 0) > 1 || t.status.toLowerCase().includes("complete");
            const expected = done ? t.spentBudget : Math.max(t.spentBudget, t.budget);
            return sum + expected;
          }, 0);
        const overshoot = expectedBudget - totalBudget;
        const overshootPct = totalBudget > 0 ? (overshoot / totalBudget) * 100 : 0;
        return {
          ...p,
          expectedBudget: Math.round(expectedBudget * 100) / 100,
          overshoot: Math.round(overshoot * 100) / 100,
          overshootPct: Math.round(overshootPct * 10) / 10,
        };
      })
      .filter((p) => p.overshoot > 0)
      .sort((a, b) => b.overshootPct - a.overshootPct);
  }, [active]);

  const totalBudget = withBudget.reduce((s, p) => s + p.totalTaskBudget, 0);
  const totalPlanned = active.reduce((s, p) => s + p.plannedBudget, 0);
  const totalSpent = active.reduce((s, p) => s + p.spentBudget, 0);
  const totalOhw = active.reduce((s, p) => s + p.ohw, 0);

  const handlePmAllow = useCallback(
    async (projectId: string) => {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pm_ohw_exceed", projectId }),
      });
      loadApprovals();
    },
    [loadApprovals]
  );

  const handlePmExpectedApprove = useCallback(
    async (projectId: string, threshold: number, approvedExpected: number) => {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pm_expected_exceed", projectId, threshold, approvedExpected }),
      });
      if (!res.ok) {
        throw new Error("Kon PM-akkoord niet opslaan");
      }
      loadApprovals();
    },
    [loadApprovals]
  );

  const handlePmExpectedApproveBulk = useCallback(
    async (items: ExpectedBulkApprovalItem[]) => {
      const results = await Promise.allSettled(
        items.map(({ projectId, approvedExpected }) =>
          fetch("/api/approvals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "pm_expected_exceed",
              projectId,
              threshold: 0,
              approvedExpected,
            }),
          }).then((res) => {
            if (!res.ok) {
              throw new Error(`Kon PM-akkoord niet opslaan voor ${projectId}`);
            }
          })
        )
      );

      await loadApprovals();

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        throw new Error(`${failed} van ${items.length} projecten niet geaccordeerd`);
      }
    },
    [loadApprovals]
  );

  const handlePmExpectedRevoke = useCallback(
    async (projectId: string) => {
      await fetch(`/api/approvals?type=pm_expected_exceed&projectId=${projectId}`, {
        method: "DELETE",
      });
      loadApprovals();
    },
    [loadApprovals]
  );

  const handleExportCsv = useCallback(() => {
    const headers = [
      "Project",
      "Klant",
      "PM",
      "Status",
      "Aanmaakdatum",
      "Gekoppelde lijst",
      "Gripp Nr",
      "Task budget",
      "Gepland",
      "Werkelijk",
      "OHW",
      "Aantal taken",
      "URL",
    ];

    const lines = filtered.map((p) => {
      const createdDate = projectDateById.get(p.id) || "";
      return [
        p.name,
        p.client,
        p.pm,
        p.status,
        createdDate,
        p.hasList ? "Ja" : "Nee",
        p.grippNr,
        p.totalTaskBudget,
        p.plannedBudget,
        p.spentBudget,
        p.ohw,
        p.taskCount,
        p.url,
      ]
        .map(csvCell)
        .join(",");
    });

    const csv = [headers.map(csvCell).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `opdrachten-export-${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [filtered, projectDateById]);

  const applyYtdRange = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    setDateFrom(`${now.getFullYear()}-01-01`);
    setDateTo(today);
  }, []);

  const applyLast12MonthsRange = useCallback(() => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const fromDate = new Date(now);
    fromDate.setFullYear(fromDate.getFullYear() - 1);
    const from = fromDate.toISOString().slice(0, 10);
    setDateFrom(from);
    setDateTo(to);
  }, []);

  const clearDateRange = useCallback(() => {
    setDateFrom("");
    setDateTo("");
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opdrachten</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} projecten · {active.length} met taken · OHW max. total task budget
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-[42px] self-end inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Exporteer CSV
          </button>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 min-w-[320px]">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Filter op aanmaakdatum</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 rounded-md border border-gray-200 px-2 text-sm"
                max={dateTo || undefined}
              />
              <span className="text-xs text-gray-400">t/m</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 rounded-md border border-gray-200 px-2 text-sm"
                min={dateFrom || undefined}
              />
              <button
                type="button"
                onClick={applyYtdRange}
                className="h-8 rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                YTD
              </button>
              <button
                type="button"
                onClick={applyLast12MonthsRange}
                className="h-8 rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Laatste 12m
              </button>
              <button
                type="button"
                onClick={clearDateRange}
                className="h-8 rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
            {availableDateRange.min && availableDateRange.max && (
              <p className="mt-1 text-[11px] text-gray-400">
                Beschikbaar: {availableDateRange.min} t/m {availableDateRange.max}
              </p>
            )}
          </div>
          <StatusFilter
            statuses={statuses}
            selected={statusSelected}
            onChange={setStatusSelected}
            label="Filter op status (project)"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total task budget" value={eur(totalBudget)} sub="Na inkoop/marge/risico" />
        <MetricCard label="Gepland" value={eur(totalPlanned)} />
        <MetricCard label="Werkelijk" value={eur(totalSpent)} />
        <MetricCard label="OHW" value={eur(totalOhw)} sub="Max. total task budget" />
      </div>

      {noListRows.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            {noListRows.length} overview-opdracht(en) zonder gekoppelde delivery-lijst
          </p>
          <p className="mt-1 text-sm text-amber-800">
            {noListRows
              .slice(0, 8)
              .map((p) => p.name)
              .join(" • ")}
            {noListRows.length > 8 ? ` • +${noListRows.length - 8} meer` : ""}
          </p>
        </div>
      )}

      <FinancialTables
        burnRows={burnRows}
        expectedRows={expectedRows}
        missingRows={missingRows}
        approvals={approvals}
        onPmAllow={handlePmAllow}
        onPmExpectedApprove={handlePmExpectedApprove}
        onPmExpectedApproveBulk={handlePmExpectedApproveBulk}
        onPmExpectedRevoke={handlePmExpectedRevoke}
      />
    </div>
  );
}
