export type StatusColor = "green" | "orange" | "red";

export function getStatusColor(burnPct: number): StatusColor {
  if (burnPct >= 100) return "red";
  if (burnPct >= 85) return "orange";
  return "green";
}

export function getStatusLabel(burnPct: number): string {
  if (burnPct >= 100) return "Overschrijding";
  if (burnPct >= 85) return "Let op (>85%)";
  return "Op schema";
}
