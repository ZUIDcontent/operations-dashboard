const API_TOKEN = "pk_90802410_1MU0ZEXG77QFGP48G35BQRBJLCKAST9M";
const TEAM_ID = "9013266744";
const BASE_URL = "https://api.clickup.com/api/v2";

const OVERVIEW_PROJECTS_LIST = "901512698048";

const CONTAINER_TASK_TYPE_INDEX = 1;

export { API_TOKEN, TEAM_ID, BASE_URL, OVERVIEW_PROJECTS_LIST, CONTAINER_TASK_TYPE_INDEX };

let rateLimitRemaining = 100;

async function apiFetch(endpoint: string, params?: Record<string, string>): Promise<unknown> {
  if (rateLimitRemaining < 5) {
    await new Promise((r) => setTimeout(r, 1000));
  }

  const url = new URL(`${BASE_URL}/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: API_TOKEN, "Content-Type": "application/json" },
  });

  rateLimitRemaining = parseInt(res.headers.get("x-ratelimit-remaining") ?? "100", 10);
  if (!res.ok) throw new Error(`ClickUp API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Types ────────────────────────────────────────────────

export interface CUSpace {
  id: string;
  name: string;
}

export interface CUFolder {
  id: string;
  name: string;
}

export interface CUList {
  id: string;
  name: string;
  archived?: boolean;
  _folderName?: string;
  _folderId?: string;
}

export interface CUCustomField {
  name: string;
  type: string;
  value: unknown;
  type_config?: { options?: { id: string; name: string; orderindex: number }[] };
}

export interface CUTask {
  id: string;
  name: string;
  status: { status: string };
  assignees: { username?: string; email?: string }[];
  due_date: string | null;
  start_date: string | null;
  time_estimate: number | null;
  time_spent: number | null;
  parent: string | null;
  url: string;
  custom_fields: CUCustomField[];
  _listName?: string;
  _folderName?: string;
}

// ── API calls ────────────────────────────────────────────

export async function getSpaces(): Promise<CUSpace[]> {
  const data = (await apiFetch(`team/${TEAM_ID}/space`, { archived: "false" })) as { spaces: CUSpace[] };
  return data.spaces ?? [];
}

export async function getFolders(spaceId: string, archived = false): Promise<CUFolder[]> {
  const data = (await apiFetch(`space/${spaceId}/folder`, { archived: String(archived) })) as { folders: CUFolder[] };
  return data.folders ?? [];
}

export async function getLists(folderId: string, archived = false): Promise<CUList[]> {
  const data = (await apiFetch(`folder/${folderId}/list`, { archived: String(archived) })) as { lists: CUList[] };
  return data.lists ?? [];
}

export async function getTasksPage(listId: string, page = 0, includeClosed = true): Promise<CUTask[]> {
  const data = (await apiFetch(`list/${listId}/task`, {
    subtasks: "true",
    include_closed: String(includeClosed),
    page: String(page),
  })) as { tasks: CUTask[] };
  return data.tasks ?? [];
}

export async function getAllTasksInList(listId: string, includeClosed = true): Promise<CUTask[]> {
  const all: CUTask[] = [];
  let page = 0;
  while (true) {
    const tasks = await getTasksPage(listId, page, includeClosed);
    if (tasks.length === 0) break;
    all.push(...tasks);
    page++;
  }
  return all;
}

// ── Helpers ──────────────────────────────────────────────

export function extractField(task: CUTask, fieldName: string): unknown {
  const cf = task.custom_fields?.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());
  return cf?.value ?? null;
}

export function extractFieldMulti(task: CUTask, ...names: string[]): unknown {
  for (const name of names) {
    const val = extractField(task, name);
    if (val !== null && val !== undefined) return val;
  }
  return null;
}

export function isContainerTask(task: CUTask): boolean {
  const cf = task.custom_fields?.find((f) => f.name === "Task type");
  if (!cf) return false;
  try {
    return Number(cf.value) === CONTAINER_TASK_TYPE_INDEX;
  } catch {
    return false;
  }
}

export function msToHours(ms: number | null): number {
  return (ms ?? 0) / 3_600_000;
}

export function extractListIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = String(url).match(/\/li\/(\d+)/);
  return match ? match[1] : null;
}
