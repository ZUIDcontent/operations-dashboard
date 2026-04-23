"use client";

import { useState, useCallback } from "react";
import { Loader2, Check, Pencil, RotateCcw } from "lucide-react";
import DataTable, { Column } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import InfoTooltip from "@/components/InfoTooltip";
import type { OverviewItem, StatusColor } from "@/lib/types";

// ─── types ────────────────────────────────────────────────

interface Approvals {
  pm_ohw_exceed: Record<string, { at: string; by?: string }>;
  pm_expected_exceed: Record<string, { at: string; by?: string; approvedExpected: number; threshold: number }>;
}

interface BurnRow {
  id: string; name: string; client: string; pm: string;
  signedOfferValue: number; totalTaskBudget: number;
  plannedBudget: number; spentBudget: number;
  ohw: number; ohwPct: number;
  statusColor: StatusColor; statusLabel: string;
  plannedHours: number; actualHours: number;
  _missing?: boolean;
  [key: string]: unknown;
}

interface ExpectedRow {
  id: string; name: string; client: string; pm: string;
  totalTaskBudget: number; expectedBudget: number;
  overshoot: number; overshootPct: number;
  _missing?: boolean;
  [key: string]: unknown;
}

interface ExpectedBulkApprovalItem {
  projectId: string;
  approvedExpected: number;
}

interface EditDraft {
  signedOfferValue: string;
  vendorCosts: string;
  vendorMargin: string;
  riskBuffer: string;
}

// ─── helpers ──────────────────────────────────────────────

function eur(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}
function pct(n: number) { return `${n}%`; }
function calcBudget(d: EditDraft) {
  const sv = parseFloat(d.signedOfferValue) || 0;
  const vc = parseFloat(d.vendorCosts) || 0;
  const vm = parseFloat(d.vendorMargin) || 0;
  const rb = parseFloat(d.riskBuffer) || 10;
  return sv - sv * (rb / 100) - vc * (vm / 100) - vc;
}

function MissingBadge({ label = "ontbreekt" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
      <Pencil size={10} />{label}
    </span>
  );
}

// ─── section header ───────────────────────────────────────

function SectionHeader({
  title, tooltip, badge, open, onToggle, children,
}: {
  title: string; tooltip?: string; badge?: number;
  open: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-1 cursor-pointer select-none" onClick={onToggle}>
      <span className="text-gray-400 transition-transform duration-200"
        style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {tooltip && <InfoTooltip text={tooltip} />}
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded-full">{badge}</span>
      )}
    </div>
  );
}

// ─── mini field for budget form ───────────────────────────

function MiniField({ label, value, locked, onChange }: {
  label: string; value: string; locked: boolean; onChange: (v: string) => void;
}) {
  return (
    <div className="flex-shrink-0">
      <div className="text-xs text-gray-500 mb-1">
        {label}{locked && <span className="ml-1 text-gray-400">(ingevuld)</span>}
      </div>
      {locked ? (
        <div className="px-2 py-1.5 bg-gray-100 border border-gray-200 rounded text-xs text-gray-700 h-8 flex items-center min-w-[80px]">{value}</div>
      ) : (
        <input
          type="number" step="any" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1.5 border border-amber-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white h-8"
        />
      )}
    </div>
  );
}

// ─── budget edit section ──────────────────────────────────

function BudgetEditSection({
  project, draft, onChange, onSave, saving, msg,
}: {
  project: OverviewItem; draft: EditDraft;
  onChange: (key: keyof EditDraft, val: string) => void;
  onSave: () => void; saving: boolean; msg: string | null;
}) {
  const preview = calcBudget(draft);
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget invullen</div>
      <div className="flex flex-wrap items-end gap-3">
        <MiniField label="Signed offer (€)" value={draft.signedOfferValue} locked={!!project.signedOfferValue}
          onChange={(v) => onChange("signedOfferValue", v)} />
        <MiniField label="Vendor costs (€)" value={draft.vendorCosts} locked={!!project.vendorCosts}
          onChange={(v) => onChange("vendorCosts", v)} />
        <MiniField label="Vendor margin (%)" value={draft.vendorMargin} locked={!!project.vendorMargin}
          onChange={(v) => onChange("vendorMargin", v)} />
        <MiniField label="Risk buffer (%)" value={draft.riskBuffer || "10"} locked={!!project.riskBuffer}
          onChange={(v) => onChange("riskBuffer", v)} />
        <div className="flex-shrink-0">
          <div className="text-xs text-gray-500 mb-1">Berekend</div>
          <div className="text-sm font-semibold text-gray-800 h-8 flex items-center">{eur(preview)}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
          <button type="button" onClick={onSave} disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-50 h-8">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Opslaan
          </button>
          {msg && (
            <span className={`text-xs font-medium ${msg.startsWith("Fout") ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── expected approval section ────────────────────────────

type ExpectedApprovalState = "none" | "valid" | "exceeded";

function ExpectedApprovalSection({
  row, approval, thresholdValue, onThresholdChange,
  onApprove, onApproveCurrent, onRevoke, saving, msg,
}: {
  row: ExpectedRow;
  approval: { at: string; approvedExpected: number; threshold: number } | null;
  thresholdValue: string;
  onThresholdChange: (v: string) => void;
  onApprove: () => void;
  onApproveCurrent: () => void;
  onRevoke: () => void;
  saving: boolean;
  msg: string | null;
}) {
  const approvedCeiling = approval ? approval.approvedExpected + approval.threshold : 0;
  const state: ExpectedApprovalState = !approval
    ? "none"
    : row.expectedBudget <= approvedCeiling ? "valid" : "exceeded";

  function quickSet(fraction: number) {
    onThresholdChange(String(Math.round(row.expectedBudget * fraction)));
  }

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">PM-akkoord expected overschrijding</div>

      {state === "valid" && approval && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
            ✓ Akkoord tot {eur(approvedCeiling)} ({eur(approval.approvedExpected)} + {eur(approval.threshold)})
          </span>
          <span className="text-xs text-gray-400">{new Date(approval.at).toLocaleDateString("nl-NL")}</span>
          <button type="button" onClick={onRevoke}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors">
            <RotateCcw size={11} />Intrekken
          </button>
        </div>
      )}

      {(state === "none" || state === "exceeded") && (
        <div className="flex flex-wrap items-end gap-2">
          {state === "exceeded" && approval && (
            <div className="w-full text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-1">
              ⚠ Drempel overschreden — akkoord was tot {eur(approvedCeiling)}, huidig expected {eur(row.expectedBudget)} — nieuw akkoord vereist
            </div>
          )}
          <div className="flex-shrink-0">
            <div className="text-xs text-gray-500 mb-1">Max. overschrijding (€) <span className="text-red-500">*</span></div>
            <input
              type="number" step="any" value={thresholdValue}
              onChange={(e) => onThresholdChange(e.target.value)}
              placeholder="bijv. 5000"
              className="w-28 px-2 py-1.5 border border-amber-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white h-8"
            />
          </div>
          <div className="flex items-end gap-1 pb-0.5">
            <div className="text-xs text-gray-500 mb-1 w-full">Snelkiezen</div>
            {[10, 20, 30].map((p) => (
              <button key={p} type="button" onClick={() => quickSet(p / 100)}
                className="px-2.5 py-1.5 text-xs rounded bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700 font-medium h-8 transition-colors">
                +{p}%
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <button type="button" onClick={onApprove} disabled={!thresholdValue || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-50 h-8">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Akkoord geven
            </button>
            <button
              type="button"
              onClick={onApproveCurrent}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 h-8"
            >
              Akkoord huidig overschot
            </button>
            {msg && (
              <span className={`text-xs font-medium ${msg.startsWith("Fout") ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────

export default function FinancialTables({
  burnRows, expectedRows, missingRows, approvals,
  onPmAllow, onPmExpectedApprove, onPmExpectedApproveBulk, onPmExpectedRevoke,
}: {
  burnRows: BurnRow[];
  expectedRows: ExpectedRow[];
  missingRows: OverviewItem[];
  approvals: Approvals;
  onPmAllow: (projectId: string) => void;
  onPmExpectedApprove: (projectId: string, threshold: number, approvedExpected: number) => void;
  onPmExpectedApproveBulk: (items: ExpectedBulkApprovalItem[]) => Promise<void>;
  onPmExpectedRevoke: (projectId: string) => void;
}) {
  const [loadingPm, setLoadingPm] = useState<string | null>(null);
  const [showApprovedPm, setShowApprovedPm] = useState(false);
  const [showApprovedExpected, setShowApprovedExpected] = useState(false);

  // Optimistic complete: immediately mark as complete in UI; revert + warn on API failure
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const [completeWarning, setCompleteWarning] = useState<Record<string, string>>({});

  const [openExpected, setOpenExpected] = useState(true);
  const [openBurn, setOpenBurn] = useState(true);

  // shared inline-edit state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({});
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  // Map missing rows by id for budget editing
  const missingMap = Object.fromEntries(missingRows.map((p) => [p.id, p]));

  function getDraft(p: OverviewItem): EditDraft {
    return drafts[p.id] ?? {
      signedOfferValue: p.signedOfferValue ? String(p.signedOfferValue) : "",
      vendorCosts: p.vendorCosts ? String(p.vendorCosts) : "",
      vendorMargin: p.vendorMargin ? String(p.vendorMargin) : "",
      riskBuffer: p.riskBuffer ? String(p.riskBuffer) : "",
    };
  }

  function updateDraft(id: string, key: keyof EditDraft, val: string) {
    const base = missingMap[id];
    if (!base) return;
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(base), [key]: val } }));
  }

  function setMsg(id: string, msg: string) {
    setSaveMsg((prev) => ({ ...prev, [id]: msg }));
    setTimeout(() => setSaveMsg((prev) => { const n = { ...prev }; delete n[id]; return n; }), 3000);
  }

  const handleSave = useCallback(async (p: OverviewItem) => {
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
      if (Object.keys(fields).length === 0) { setSaving(null); return; }
      const res = await fetch("/api/clickup-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: p.id, fields }),
      });
      const data = await res.json();
      setMsg(p.id, data.ok ? "✓ Opgeslagen in ClickUp" : `Fout: ${data.error}`);
    } catch (e) {
      setMsg(p.id, `Fout: ${e instanceof Error ? e.message : "onbekend"}`);
    }
    setSaving(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, missingMap]);

  const handleComplete = useCallback(async (projectId: string) => {
    // Optimistic: mark complete immediately
    setLocalCompleted((prev) => new Set(prev).add(projectId));
    try {
      const res = await fetch("/api/clickup-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: projectId, action: "complete" }),
      });
      const data = await res.json();
      if (!data.ok) {
        // Revert optimistic update and show warning
        setLocalCompleted((prev) => { const n = new Set(prev); n.delete(projectId); return n; });
        setCompleteWarning((prev) => ({ ...prev, [projectId]: `Mislukt: ${data.error}` }));
        setTimeout(() => setCompleteWarning((prev) => { const n = { ...prev }; delete n[projectId]; return n; }), 5000);
      }
    } catch (e) {
      setLocalCompleted((prev) => { const n = new Set(prev); n.delete(projectId); return n; });
      setCompleteWarning((prev) => ({ ...prev, [projectId]: `Mislukt: ${e instanceof Error ? e.message : "onbekend"}` }));
      setTimeout(() => setCompleteWarning((prev) => { const n = { ...prev }; delete n[projectId]; return n; }), 5000);
    }
  }, []);

  const handleExpectedApprove = useCallback(async (row: ExpectedRow) => {
    const threshold = parseFloat(thresholdDrafts[row.id] ?? "");
    if (isNaN(threshold) || threshold <= 0) {
      setMsg(row.id, "Vul een bedrag in");
      return;
    }
    setSaving(row.id);
    try {
      onPmExpectedApprove(row.id, threshold, row.expectedBudget);
      setMsg(row.id, "✓ Akkoord gegeven");
    } catch (e) {
      setMsg(row.id, `Fout: ${e instanceof Error ? e.message : "onbekend"}`);
    }
    setSaving(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholdDrafts, onPmExpectedApprove]);

  const handleExpectedApproveCurrent = useCallback(async (row: ExpectedRow) => {
    setSaving(row.id);
    try {
      // Akkoord only for current overshoot; retrigger zodra expected verder stijgt.
      onPmExpectedApprove(row.id, 0, row.expectedBudget);
      setMsg(row.id, "✓ Akkoord op huidig overschot");
    } catch (e) {
      setMsg(row.id, `Fout: ${e instanceof Error ? e.message : "onbekend"}`);
    }
    setSaving(null);
  }, [onPmExpectedApprove]);

  const handleExpectedRevoke = useCallback(async (projectId: string) => {
    onPmExpectedRevoke(projectId);
    setMsg(projectId, "✓ Akkoord ingetrokken");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPmExpectedRevoke]);

  const handleExpectedApproveCurrentBulk = useCallback(async () => {
    const items = expectedRows
      .filter((row) => expectedApprovalState(row) !== "valid")
      .map((row) => ({ projectId: row.id, approvedExpected: row.expectedBudget }));

    if (items.length === 0) {
      setBulkMsg("Geen projecten die akkoord vereisen");
      setTimeout(() => setBulkMsg(null), 3000);
      return;
    }

    setSaving("__bulk_expected_current__");
    try {
      await onPmExpectedApproveBulk(items);
      setBulkMsg(`✓ Akkoord op huidig overschot voor ${items.length} project${items.length === 1 ? "" : "en"}`);
    } catch (e) {
      setBulkMsg(`Fout: ${e instanceof Error ? e.message : "bulk akkoord mislukt"}`);
    }
    setSaving(null);
    setTimeout(() => setBulkMsg(null), 4000);
  }, [expectedRows, onPmExpectedApproveBulk]);

  // ── expand content builders ───────────────────────────────

  function renderBudgetAndStatus(row: { id: string; _missing?: boolean }) {
    const p = missingMap[row.id];
    if (!p) return null;
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <BudgetEditSection
          project={p} draft={getDraft(p)}
          onChange={(key, val) => updateDraft(row.id, key, val)}
          onSave={() => handleSave(p)}
          saving={saving === row.id}
          msg={saveMsg[row.id] ?? null}
        />
      </div>
    );
  }

  function renderExpectedExpand(row: ExpectedRow) {
    const approval = approvals.pm_expected_exceed[row.id] ?? null;
    const p = missingMap[row.id];
    if (row._missing && !p) return null;
    return (
      <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
        {p && (
          <BudgetEditSection
            project={p} draft={getDraft(p)}
            onChange={(key, val) => updateDraft(row.id, key, val)}
            onSave={() => handleSave(p)}
            saving={saving === row.id}
            msg={saveMsg[row.id] ?? null}
          />
        )}
        {!row._missing && (
          <ExpectedApprovalSection
            row={row}
            approval={approval}
            thresholdValue={thresholdDrafts[row.id] ?? ""}
            onThresholdChange={(v) => setThresholdDrafts((prev) => ({ ...prev, [row.id]: v }))}
            onApprove={() => handleExpectedApprove(row)}
            onApproveCurrent={() => handleExpectedApproveCurrent(row)}
            onRevoke={() => handleExpectedRevoke(row.id)}
            saving={saving === row.id}
            msg={saveMsg[row.id] ?? null}
          />
        )}
      </div>
    );
  }

  // ── adapt missingRows ─────────────────────────────────────

  const missingAsBurnRow: BurnRow[] = missingRows
    .filter((p) => p.taskCount === 0)
    .map((p) => ({ ...p, _missing: true, ohwPct: 0, statusColor: "green" as StatusColor, statusLabel: "" } as BurnRow));

  const missingAsExpected: ExpectedRow[] = missingRows
    .filter((p) => p.taskCount === 0)
    .map((p) => ({ ...p, _missing: true, expectedBudget: 0, overshoot: 0, overshootPct: 0 } as ExpectedRow));

  // ── expected approval status helpers ─────────────────────

  function expectedApprovalState(row: ExpectedRow): ExpectedApprovalState {
    const a = approvals.pm_expected_exceed[row.id];
    if (!a) return "none";
    // Alert when expectedBudget > approvedExpected + threshold
    // e.g. approved at €10k with €1k threshold → re-trigger when expected > €11k
    return row.expectedBudget <= a.approvedExpected + a.threshold ? "valid" : "exceeded";
  }

  // ── visible rows ─────────────────────────────────────────

  const burnRowsVisible = [
    ...(showApprovedPm ? burnRows : burnRows.filter((r) => !approvals.pm_ohw_exceed[r.id])),
    ...missingAsBurnRow,
  ];

  const expectedBase = showApprovedExpected
    ? expectedRows
    : expectedRows.filter((r) => {
        const state = expectedApprovalState(r);
        return state === "none" || state === "exceeded";
      });
  const expectedVisible = [...expectedBase, ...missingAsExpected];

  const expectedNeedsAttention = expectedRows.filter((r) => {
    const state = expectedApprovalState(r);
    return state === "none" || state === "exceeded";
  }).length;

  // ── status column (shared across all tables) ──────────────

  function statusCol<T extends Record<string, unknown>>(): Column<T> {
    return {
      key: "_status_action" as keyof T & string,
      label: "Status",
      width: "110px",
      sortable: false,
      render: (r) => {
        const id = String(r.id);
        const rawStatus = (r.status as string) ?? "";
        const isComplete = rawStatus.toLowerCase() === "complete" || localCompleted.has(id);
        const optimistic = localCompleted.has(id) && rawStatus.toLowerCase() !== "complete";
        const warning = completeWarning[id];
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded-full truncate max-w-[64px] leading-none whitespace-nowrap
              ${isComplete ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}
              ${optimistic ? "opacity-60 italic" : ""}`}
            >
              {isComplete ? "complete" : (rawStatus || "—")}
            </span>
            {!isComplete && (
              <button type="button" title="Zet op complete"
                onClick={(e) => { e.stopPropagation(); handleComplete(id); }}
                className="text-gray-400 hover:text-emerald-600 transition-colors flex-shrink-0">
                <Check size={12} />
              </button>
            )}
            {warning && (
              <span className="text-xs text-amber-600 font-medium" title={warning}>⚠</span>
            )}
          </div>
        );
      },
    };
  }

  // ── column definitions ────────────────────────────────────

  const burnCols: Column<BurnRow>[] = [
    {
      key: "statusColor", label: "", width: "100px", sortable: false,
      render: (r) => r._missing ? null : <StatusBadge color={r.statusColor} label={r.statusLabel} />,
    },
    {
      key: "name", label: "Project", width: "22%",
      render: (r) => <span className="flex items-center gap-2">{r.name}{r._missing && <MissingBadge />}</span>,
    },
    { key: "client", label: "Klant" },
    { key: "pm", label: "PM" },
    statusCol<BurnRow>(),
    {
      key: "totalTaskBudget", label: "Budget", align: "right",
      render: (r) => (r._missing || !r.totalTaskBudget) ? <MissingBadge label="invullen" /> : eur(r.totalTaskBudget),
    },
    { key: "plannedBudget", label: "Gepland", align: "right", render: (r) => r._missing ? <span className="text-gray-400">—</span> : eur(r.plannedBudget) },
    { key: "spentBudget", label: "Werkelijk", align: "right", render: (r) => r._missing ? <span className="text-gray-400">—</span> : eur(r.spentBudget) },
    { key: "ohw", label: "OHW", align: "right", render: (r) => r._missing ? <span className="text-gray-400">—</span> : eur(r.ohw) },
    {
      key: "ohwPct", label: "OHW %", align: "right",
      render: (r) => {
        if (r._missing) return <span className="text-gray-400">—</span>;
        const cls = r.ohwPct >= 100 ? "text-red-600 font-semibold" : r.ohwPct >= 85 ? "text-amber-600 font-medium" : "";
        return <span className={cls}>{pct(r.ohwPct)}</span>;
      },
    },
    {
      key: "pm_allow", label: "PM toegestaan", width: "120px", sortable: false,
      render: (r) => {
        if (r._missing) return null;
        const approved = approvals.pm_ohw_exceed[r.id];
        if (approved) return <span className="text-emerald-600 text-sm font-medium" title={approved.at}>✓ Toegestaan</span>;
        if (r.ohwPct < 85) return <span className="text-gray-400">—</span>;
        return (
          <button type="button"
            onClick={(e) => { e.stopPropagation(); setLoadingPm(r.id); onPmAllow(r.id); setLoadingPm(null); }}
            disabled={loadingPm === r.id}
            className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium">
            {loadingPm === r.id ? "..." : "Toestaan"}
          </button>
        );
      },
    },
    {
      key: "plannedHours", label: "Uren (gepl)", align: "right",
      render: (r) => r._missing ? <span className="text-gray-400">—</span> : String(r.plannedHours),
    },
    {
      key: "actualHours", label: "Uren (act)", align: "right",
      render: (r) => r._missing ? <span className="text-gray-400">—</span> : String(r.actualHours),
    },
  ];

  const expectedCols: Column<ExpectedRow>[] = [
    {
      key: "name", label: "Project", width: "22%",
      render: (r) => <span className="flex items-center gap-2">{r.name}{r._missing && <MissingBadge />}</span>,
    },
    { key: "client", label: "Klant" },
    { key: "pm", label: "PM" },
    statusCol<ExpectedRow>(),
    {
      key: "totalTaskBudget", label: "Task budget", align: "right",
      render: (r) => (r._missing || !r.totalTaskBudget) ? <MissingBadge label="invullen" /> : eur(r.totalTaskBudget),
    },
    {
      key: "expectedBudget", label: "Expected", align: "right",
      render: (r) => r._missing ? <span className="text-gray-400">—</span> : <span className="font-medium">{eur(r.expectedBudget)}</span>,
    },
    {
      key: "overshoot", label: "Overschot (€)", align: "right",
      render: (r) => r._missing ? <span className="text-gray-400">—</span>
        : <span className="text-red-600 font-semibold">+{eur(r.overshoot)}</span>,
    },
    {
      key: "overshootPct", label: "Overschot (%)", align: "right",
      render: (r) => {
        if (r._missing) return <span className="text-gray-400">—</span>;
        const cls = r.overshootPct >= 20 ? "text-red-600 font-semibold" : r.overshootPct >= 10 ? "text-amber-600 font-medium" : "text-yellow-600";
        return <span className={cls}>+{pct(r.overshootPct)}</span>;
      },
    },
    {
      key: "pm_expected", label: "PM-akkoord", width: "150px", sortable: false,
      render: (r) => {
        if (r._missing) return null;
        const state = expectedApprovalState(r);
        const approval = approvals.pm_expected_exceed[r.id];
        if (state === "valid" && approval) {
          const ceiling = approval.approvedExpected + approval.threshold;
          return (
            <span className="text-emerald-600 text-xs font-medium"
              title={`Geaccordeerd op ${new Date(approval.at).toLocaleDateString("nl-NL")} · plafond ${eur(ceiling)}`}>
              ✓ Akkoord (tot {eur(ceiling)})
            </span>
          );
        }
        if (state === "exceeded") {
          return <span className="text-red-600 text-xs font-medium">⚠ Drempel overschreden</span>;
        }
        return <span className="text-amber-700 text-xs font-medium cursor-pointer">Akkoord vereist ↓</span>;
      },
    },
  ];

  return (
    <div className="space-y-10">

      {/* Expected task budget — bovenaan */}
      <section>
        <SectionHeader
          title="Expected task budget"
          tooltip="Projecten die dreigen uit de bocht te vliegen. Formule per taak: IF(afgerond → spent; anders → max(spent, budget)). Klik een rij om PM-akkoord te geven of status aan te passen."
          badge={expectedNeedsAttention}
          open={openExpected}
          onToggle={() => setOpenExpected((v) => !v)}
        >
          <div className="ml-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleExpectedApproveCurrentBulk}
              disabled={expectedNeedsAttention === 0 || saving === "__bulk_expected_current__"}
              className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving === "__bulk_expected_current__" ? "Bezig..." : "Bulk: akkoord huidig overschot"}
            </button>
            <button
              type="button"
              onClick={() => setShowApprovedExpected((v) => !v)}
              className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            >
              {showApprovedExpected ? "Verberg geaccordeerd" : "Toon geaccordeerd"}
            </button>
          </div>
        </SectionHeader>

        {openExpected && (
          <>
            <p className="text-sm text-gray-500 mb-4 mt-1">
              Klik een rij om PM-akkoord te geven voor de overschrijding. Geef een drempel op — zodra de overschrijding die drempel overstijgt komt het project automatisch terug.
            </p>
            {bulkMsg && (
              <p className={`text-sm mb-3 ${bulkMsg.startsWith("Fout") ? "text-red-600" : "text-emerald-600"}`}>
                {bulkMsg}
              </p>
            )}
            {expectedVisible.length === 0 ? (
              <div className="bg-emerald-50 text-emerald-800 text-sm px-4 py-3 rounded-lg">
                Geen projecten met overschrijding of ontbrekende gegevens.
              </div>
            ) : (
              <DataTable
                data={expectedVisible} columns={expectedCols}
                searchKeys={["name", "client", "pm"]}
                defaultSort={{ key: "overshootPct", dir: "desc" }}
                expandRow={(r) => renderExpectedExpand(r)}
                isExpandable={() => true}
                expandedId={expandedId} onExpandChange={setExpandedId}
                rowClassName={(r) => {
                  if (r._missing || !r.totalTaskBudget) return "bg-amber-50/50";
                  const state = expectedApprovalState(r);
                  if (state === "exceeded") return "bg-red-50/40";
                  return "";
                }}
              />
            )}
          </>
        )}
      </section>

      {/* Geplande waarde vs Werkelijk */}
      <section>
        <SectionHeader
          title="Geplande waarde vs. Waarde werkelijk geschreven uren"
          tooltip="OHW = Onderhanden Werk, gemaximeerd op opdrachtwaarde. OHW % = OHW / Total task budget × 100. Klik een rij om status aan te passen of budget in te vullen."
          open={openBurn}
          onToggle={() => setOpenBurn((v) => !v)}
        >
          <button type="button"
            onClick={(e) => { e.stopPropagation(); setShowApprovedPm((v) => !v); }}
            className="ml-2 text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            {showApprovedPm ? "Verberg toegestaan" : "Toon toegestaan"}
          </button>
        </SectionHeader>

        {openBurn && (
          <>
            <p className="text-sm text-gray-500 mb-4 mt-1">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Op schema (&lt;85%)</span>
              {" · "}
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Let op (≥85%)</span>
              {" · "}
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Overschrijding (≥100%)</span>
              {" · Klik een rij om status/budget te bewerken"}
            </p>
            <DataTable
              data={burnRowsVisible} columns={burnCols}
              searchKeys={["name", "client", "pm"]}
              defaultSort={{ key: "ohwPct", dir: "desc" }}
              expandRow={(r) => renderBudgetAndStatus(r)}
              isExpandable={(r) => !!(r._missing || !r.totalTaskBudget)}
              expandedId={expandedId} onExpandChange={setExpandedId}
              rowClassName={(r) => (r._missing || !r.totalTaskBudget) ? "bg-amber-50/50" : ""}
            />
          </>
        )}
      </section>
    </div>
  );
}

