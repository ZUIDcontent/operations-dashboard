import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { CacheData } from "./types";

export type { CacheData, DeliveryTask, OverviewItem, ArchivedIssue, StatusColor } from "./types";
export { getStatusColor, getStatusLabel } from "./status";

export function loadCache(): CacheData | null {
  const cachePath = resolve(process.cwd(), "data", "clickup-cache.json");
  if (!existsSync(cachePath)) return null;
  const raw = readFileSync(cachePath, "utf-8");
  return JSON.parse(raw) as CacheData;
}
