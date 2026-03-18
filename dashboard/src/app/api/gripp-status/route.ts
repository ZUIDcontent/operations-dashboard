import { NextResponse } from "next/server";
import { loadCache } from "@/lib/data";

const GRIPP_BASE =
  process.env.GRIPP_BASE_URL ||
  process.env.gripp_base_url ||
  "";
const GRIPP_KEY =
  process.env.GRIPP_API_KEY ||
  process.env.gripp_api_token ||
  "";
const GRIPP_API_URL = process.env.gripp_api_url || process.env.GRIPP_API_URL || "";

/** Normaliseer Gripp-opdracht: of deze als 'open' of 'gearchiveerd/afgesloten' telt */
function isOrderOpen(order: Record<string, unknown>): boolean {
  const status = String(order.status ?? order.Status ?? "").toLowerCase();
  const closed = order.closed ?? order.Closed ?? order.afgesloten;
  const archived = order.archived ?? order.Archived ?? order.gearchiveerd;
  if (typeof closed === "boolean" && closed) return false;
  if (typeof archived === "boolean" && archived) return false;
  if (["afgesloten", "gearchiveerd", "closed", "archived"].some((s) => status.includes(s)))
    return false;
  return true;
}

/** Haal uit Gripp-response een lijst op met { id, number, open } */
function normalizeGrippOrders(data: unknown): { id: string; number: string; open: boolean }[] {
  if (!data || typeof data !== "object") return [];
  const arr = Array.isArray(data) ? data : (data as Record<string, unknown>).data ?? (data as Record<string, unknown>).opdrachten ?? (data as Record<string, unknown>).orders ?? [];
  if (!Array.isArray(arr)) return [];
  return arr.map((o: Record<string, unknown>) => {
    const id = String(o.id ?? o.ID ?? o.OpdrachtId ?? "");
    const number = String(o.number ?? o.Number ?? o.Opdrachtnummer ?? o.Nummer ?? id);
    return { id, number, open: isOrderOpen(o) };
  });
}

export async function GET() {
  const cache = loadCache();
  if (!cache) {
    return NextResponse.json(
      { error: "Geen ClickUp-cache. Draai eerst sync." },
      { status: 503 }
    );
  }

  const projects = cache.projects.filter((p) => {
    const nr = String(p.grippNr ?? "").trim();
    const id = String(p.grippId ?? "").trim();
    return nr !== "" || id !== "";
  });

  if (!GRIPP_KEY || (!GRIPP_BASE && !GRIPP_API_URL)) {
    return NextResponse.json({
      ok: true,
      grippConfigured: false,
      message: "Zet gripp_base_url (of gripp_api_url) en gripp_api_token in .env.",
      projectsWithGrippId: projects.length,
      archivedInCuOpenInGripp: [],
      openInCuArchivedInGripp: [],
    });
  }

  const apiUrl = GRIPP_API_URL
    ? GRIPP_API_URL.replace(/\/$/, "")
    : (() => {
        const base = GRIPP_BASE.replace(/\/$/, "");
        return base.includes("/api") ? base : `${base}/public/api3.php`;
      })();

  let grippOrders: { id: string; number: string; open: boolean }[] = [];
  let grippError: string | undefined;

  try {
    const url = new URL(apiUrl);
    url.searchParams.set("key", GRIPP_KEY);
    url.searchParams.set("action", "opdrachten"); // veel Gripp-API's gebruiken ?action=...
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    const text = await res.text();
    if (!res.ok) {
      grippError = `Gripp API ${res.status}: ${text.slice(0, 200)}`;
    } else {
      const data = text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : null;
      grippOrders = normalizeGrippOrders(data);
      if (grippOrders.length === 0 && data != null && typeof data === "object" && !data.opdrachten && !data.orders && !Array.isArray(data)) {
        grippOrders = normalizeGrippOrders((data as Record<string, unknown>).data ?? (data as Record<string, unknown>).result);
      }
    }
  } catch (e) {
    grippError = e instanceof Error ? e.message : "Gripp request failed";
  }

  const byNumber = new Map<string, boolean>();
  const byId = new Map<string, boolean>();
  for (const o of grippOrders) {
    if (o.number) byNumber.set(String(o.number).trim(), o.open);
    if (o.id) byId.set(String(o.id).trim(), o.open);
  }

  const archivedInCuOpenInGripp: Array<{
    id: string;
    name: string;
    pm: string;
    grippNr: string;
    grippId: string;
    listArchived: boolean;
    grippOpen: boolean | null;
  }> = [];
  const openInCuArchivedInGripp: Array<{
    id: string;
    name: string;
    pm: string;
    grippNr: string;
    grippId: string;
    listArchived: boolean;
    grippOpen: boolean;
  }> = [];

  for (const p of projects) {
    const nr = String(p.grippNr ?? "").trim();
    const id = String(p.grippId ?? "").trim();
    const cuArchived = !!p.listArchived;
    let grippOpen: boolean | null = null;
    if (id && byId.has(id)) grippOpen = byId.get(id) ?? null;
    else if (nr && byNumber.has(nr)) grippOpen = byNumber.get(nr) ?? null;

    if (cuArchived && grippOpen === true) {
      archivedInCuOpenInGripp.push({
        id: p.id,
        name: p.name,
        pm: p.pm ?? "",
        grippNr: p.grippNr ?? "",
        grippId: p.grippId ?? "",
        listArchived: true,
        grippOpen: true,
      });
    } else if (!cuArchived && grippOpen === false) {
      openInCuArchivedInGripp.push({
        id: p.id,
        name: p.name,
        pm: p.pm ?? "",
        grippNr: p.grippNr ?? "",
        grippId: p.grippId ?? "",
        listArchived: false,
        grippOpen: false,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    grippConfigured: true,
    projectsWithGrippId: projects.length,
    grippOrdersCount: grippOrders.length,
    grippError: grippError ?? undefined,
    archivedInCuOpenInGripp,
    openInCuArchivedInGripp,
  });
}
