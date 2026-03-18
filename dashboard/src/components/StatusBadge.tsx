import clsx from "clsx";
import type { StatusColor } from "@/lib/types";

const colorClasses: Record<StatusColor, string> = {
  green: "bg-emerald-100 text-emerald-800",
  orange: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

const dots: Record<StatusColor, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
};

export default function StatusBadge({
  color,
  label,
}: {
  color: StatusColor;
  label: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        colorClasses[color]
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", dots[color])} />
      {label}
    </span>
  );
}
