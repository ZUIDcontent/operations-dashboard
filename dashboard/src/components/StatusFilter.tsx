"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, Check } from "lucide-react";

interface StatusFilterProps {
  /** Alle unieke statuswaarden uit de data */
  statuses: string[];
  /** Geselecteerde statuswaarden (leeg = alles tonen) */
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
}

export default function StatusFilter({ statuses, selected, onChange, label = "Filter op status" }: StatusFilterProps) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === 0 || selected.length === statuses.length;

  function toggle(s: string) {
    let next: string[];
    if (selected.length === 0) {
      next = statuses.filter((x) => x !== s);
    } else if (selected.includes(s)) {
      next = selected.filter((x) => x !== s);
    } else {
      next = [...selected, s];
    }
    onChange(next.length === statuses.length ? [] : next);
  }

  function selectAll() {
    onChange([]);
    setOpen(false);
  }

  if (statuses.length === 0) return null;

  const displayLabel = allSelected
    ? "Alle statuses"
    : selected.length === 1
      ? selected[0]
      : `${selected.length} geselecteerd`;

  return (
    <div className="relative">
      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          "inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors min-w-[180px]",
          "border-gray-200 bg-white hover:bg-gray-50 text-left"
        )}
      >
        <span className="flex-1">{displayLabel}</span>
        <ChevronDown size={16} className={clsx("text-gray-400 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-64 rounded-xl border border-gray-200 bg-white shadow-lg py-2 max-h-72 overflow-y-auto">
            <div className="px-3 py-1.5 border-b border-gray-100">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-orange-500 hover:underline font-medium"
              >
                Alles tonen
              </button>
            </div>
            {statuses.map((s) => {
              const isSelected = allSelected || selected.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-gray-50"
                >
                  <span
                    className={clsx(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300"
                    )}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </span>
                  <span className="capitalize">{s || "(leeg)"}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
