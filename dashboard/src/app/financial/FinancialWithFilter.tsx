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

interface Approvals {
  pm_ohw_exceed: Record<string, { at: string; by?: string }>;
  pm_expected_exceed: Record<string, { at: string; by?: string; approvedExpected: number; threshold: number }>;
}

export default function FinancialWithFilter({ projects }: { projects: OverviewItem[] }) {
  const [statusSelected, setStatusSelected] = useState<string[]>([]);
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

  const filtered = useMemo(() => {
    if (statusSelected.length === 0) return projects;
    return projects.filter((p) => {
      const s = (p.status ?? "").trim() || "(leeg)";
      return statusSelected.includes(s);
    });
  }, [projects, statusSelected]);

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
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pm_expected_exceed", projectId, threshold, approvedExpected }),
      });
      loadApprovals();
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

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opdrachten</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} projecten · {active.length} met taken · OHW max. total task budget
          </p>
        </div>
        <StatusFilter
          statuses={statuses}
          selected={statusSelected}
          onChange={setStatusSelected}
          label="Filter op status (project)"
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total task budget" value={eur(totalBudget)} sub="Na inkoop/marge/risico" />
        <MetricCard label="Gepland" value={eur(totalPlanned)} />
        <MetricCard label="Werkelijk" value={eur(totalSpent)} />
        <MetricCard label="OHW" value={eur(totalOhw)} sub="Max. total task budget" />
      </div>

      <FinancialTables
        burnRows={burnRows}
        expectedRows={expectedRows}
        missingRows={missingRows}
        approvals={approvals}
        onPmAllow={handlePmAllow}
        onPmExpectedApprove={handlePmExpectedApprove}
        onPmExpectedRevoke={handlePmExpectedRevoke}
      />
    </div>
  );
}
