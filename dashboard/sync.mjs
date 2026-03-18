/**
 * Data sync — haalt alle ClickUp data op en slaat op als JSON cache.
 *
 * Structuur:
 * - Overview/Projects → project-level financiële data (signed offer, vendor costs, etc.)
 * - Overview/Estimates → estimate-level data
 * - Delivery/{klant}/{projectnaam} → taak-level data (rate, budget, spent)
 *
 * Draai: node sync.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_TOKEN = "pk_90802410_1MU0ZEXG77QFGP48G35BQRBJLCKAST9M";
const TEAM_ID = "9013266744";
const BASE = "https://api.clickup.com/api/v2";
const OVERVIEW_PROJECTS_LIST = "901512698048";
const OVERVIEW_ESTIMATES_LIST = "901512693345";
const CONTAINER_TYPE = 1;

let remaining = 100;

async function api(endpoint, params = {}) {
  if (remaining < 5) await sleep(1200);
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: API_TOKEN, "Content-Type": "application/json" },
  });
  remaining = parseInt(res.headers.get("x-ratelimit-remaining") ?? "100", 10);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function field(task, name) {
  const cf = task.custom_fields?.find((f) => f.name.toLowerCase() === name.toLowerCase());
  return cf?.value ?? null;
}

function fieldNum(task, name) {
  const v = field(task, name);
  return v !== null && v !== undefined ? parseFloat(v) || 0 : 0;
}

function fieldStr(task, name) {
  const v = field(task, name);
  return v !== null && v !== undefined ? String(v) : "";
}

function fieldRel(task, name) {
  const v = field(task, name);
  if (Array.isArray(v) && v.length > 0) return v[0]?.name ?? "";
  return "";
}

function fieldUsers(task, name) {
  const cf = task.custom_fields?.find((f) => f.name === name);
  if (!cf || !cf.value) return [];
  if (Array.isArray(cf.value)) return cf.value.map((u) => u.username || u.email || "?");
  return [];
}

function isContainer(task) {
  const cf = task.custom_fields?.find((f) => f.name === "Task type");
  return cf ? Number(cf.value) === CONTAINER_TYPE : false;
}

function listIdFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(/\/li\/(\d+)/);
  return m ? m[1] : null;
}

function msH(ms) {
  return (ms ?? 0) / 3_600_000;
}

async function allTasksInList(listId) {
  const all = [];
  let page = 0;
  while (true) {
    const data = await api(`list/${listId}/task`, {
      subtasks: "true",
      include_closed: "true",
      page: String(page),
    });
    const tasks = data.tasks ?? [];
    if (!tasks.length) break;
    all.push(...tasks);
    page++;
  }
  return all;
}

/**
 * Process an overview task (project or estimate) + its delivery list tasks.
 */
async function processOverviewItem(item, index, total, type) {
  const signedOffer = fieldNum(item, "Signed offer value");
  const vendorCosts = fieldNum(item, "Vendor costs");
  const vendorMargin = fieldNum(item, "Vendor margin");
  const riskBuffer = fieldNum(item, "Risk buffer (10% guideline)");
  const totalTaskBudget = fieldNum(item, "Total task budget");
  const spentBudgetOverview = fieldNum(item, "Spent task budget");
  const budgetLeft = fieldNum(item, "Budget left");
  const ohwOverview = fieldNum(item, "OHW Bedrag");
  const pctBudgetScheduled = fieldNum(item, "% budget scheduled of total");
  const pctHoursUsed = fieldNum(item, "% hours used");
  const timeEstimateOverview = fieldNum(item, "Time estimate");
  const timeTrackedOverview = fieldNum(item, "Time tracked");

  const grippNumber = fieldStr(item, "Gripp Number");
  const grippId = fieldStr(item, "Gripp ID");
  const listUrl = field(item, "List");
  const clientName = fieldRel(item, "Client") || fieldRel(item, "Clients");
  const estimateRel = fieldRel(item, "Estimate");
  const pm = fieldUsers(item, "PM");

  const listId = listIdFromUrl(listUrl);

  let deliveryTasks = [];
  let sumPlannedHours = 0;
  let sumActualHours = 0;
  // Planned value is derived strictly from delivery tasks: rate * hour estimate
  let sumPlannedValue = 0;
  let sumSpent = 0;
  let taskCount = 0;

  if (listId) {
    try {
      process.stdout.write(
        `   [${index + 1}/${total}] ${item.name.slice(0, 55).padEnd(55)}`,
      );
      const tasks = await allTasksInList(listId);

      for (const t of tasks) {
        const container = isContainer(t);
        const estMs = t.time_estimate ?? 0;
        const spentMs = t.time_spent ?? 0;
        const estH = msH(estMs);
        const spentH = msH(spentMs);
        const rate = fieldNum(t, "Rate");
        const tPlannedValue = rate > 0 && estH > 0 ? rate * estH : 0;
        const tSpent = fieldNum(t, "Spent task budget") || fieldNum(t, "Spent task budget (ruben)");
        const ohwBedrag = fieldNum(t, "OHW Bedrag");
        const assignees = (t.assignees ?? []).map((a) => a.username || a.email || "?").join(", ");

        if (!container) {
          sumPlannedHours += estH;
          sumActualHours += spentH;
          sumPlannedValue += tPlannedValue;
          sumSpent += tSpent;
          taskCount++;
        }

        // Collect issues for hygiene/PM board (only for task type 'task', not container)
        const issues = [];
        if (!container) {
          if (!t.assignees?.length) issues.push("no_assignee");
          if (!t.time_estimate) issues.push("no_estimate");
          if (!t.start_date) issues.push("no_start_date");
          if (!t.due_date) issues.push("no_due_date");
        }
        // Hours on container (not subtasks) - flag for hygiene
        const hoursOnContainer = container && spentH > 0 ? round(spentH, 2) : 0;

        deliveryTasks.push({
          id: t.id,
          name: t.name,
          status: t.status?.status ?? "",
          assignees,
          dueDate: t.due_date ? new Date(parseInt(t.due_date)).toISOString() : null,
          startDate: t.start_date ? new Date(parseInt(t.start_date)).toISOString() : null,
          dateDone: t.date_done ? parseInt(t.date_done) : 0,
          timeEstimate: round(estH, 2),
          timeSpent: round(spentH, 2),
          rate,
          budget: round(tPlannedValue, 2),
          spentBudget: round(tSpent, 2),
          ohwBedrag: round(ohwBedrag, 2),
          url: t.url,
          issues,
          isContainer: container,
          parent: t.parent,
          hoursOnContainer,
        });
      }
      console.log(` ${taskCount} tasks`);
    } catch (e) {
      console.log(` ❌ ${e.message.slice(0, 60)}`);
    }
  } else {
    if (index % 25 === 0)
      process.stdout.write(`   [${index + 1}/${total}] (no list)\n`);
  }

  // Planned value should always come from delivery tasks (rate * estimate).
  const plannedBudget = sumPlannedValue;
  const spentBudget = sumSpent > 0 ? sumSpent : spentBudgetOverview;
  const availableBudget = totalTaskBudget > 0 ? totalTaskBudget : signedOffer;

  const planPct = availableBudget > 0 ? (plannedBudget / availableBudget) * 100 : 0;
  const burnPct = availableBudget > 0 ? (spentBudget / availableBudget) * 100 : spentBudget > 0 ? 999 : 0;
  // OHW: use sum of OHW Bedrag from tasks when available; cap at opdrachtwaarde
  const ohwFromTasks = deliveryTasks.reduce((s, t) => s + (t.ohwBedrag || 0), 0);
  const ohwRaw = ohwFromTasks > 0 ? ohwFromTasks : ohwOverview;
  const ohw = signedOffer > 0 ? Math.min(ohwRaw, signedOffer) : ohwRaw;

  return {
    id: item.id,
    type,
    name: item.name,
    status: item.status?.status ?? "",
    client: clientName,
    pm: pm.length > 0 ? pm.join(", ") : "",
    grippNr: grippNumber,
    grippId,
    url: item.url,

    // Financial overview fields
    signedOfferValue: signedOffer,
    vendorCosts,
    vendorMargin,
    riskBuffer,
    totalTaskBudget: round(totalTaskBudget, 2),

    // Aggregated from delivery tasks
    plannedBudget: round(plannedBudget, 2),
    spentBudget: round(spentBudget, 2),
    plannedHours: round(sumPlannedHours > 0 ? sumPlannedHours : timeEstimateOverview, 1),
    actualHours: round(sumActualHours > 0 ? sumActualHours : timeTrackedOverview, 1),

    // Calculated
    planPct: round(planPct, 1),
    burnPct: round(burnPct, 1),
    ohw: round(ohw, 2),
    ohwFromTasks: round(ohwFromTasks, 2),
    ohwOverview: round(ohwOverview, 2),
    budgetLeft: round(budgetLeft, 2),
    marge: round(fieldNum(item, "💶 Marge"), 2),

    taskCount,
    hasList: !!listId,
    listId: listId || null,
    listUrl: listUrl || null,

    tasks: deliveryTasks,
  };
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

// ── Main sync ────────────────────────────────────────────

async function sync() {
  const start = Date.now();
  console.log("🔄 Sync gestart...\n");

  // 1. Spaces
  const spacesData = await api(`team/${TEAM_ID}/space`, { archived: "false" });
  const spaces = spacesData.spaces ?? [];
  const spaceMap = {};
  for (const s of spaces) {
    const key = s.name.toLowerCase();
    if (["growth", "delivery", "operations", "overview"].includes(key))
      spaceMap[key] = s.id;
  }
  console.log(`✅ Spaces: ${JSON.stringify(spaceMap)}\n`);

  // 2. Projects
  console.log("📋 Overview/Projects laden...");
  const overviewProjects = await allTasksInList(OVERVIEW_PROJECTS_LIST);
  console.log(`   ${overviewProjects.length} projecten\n`);

  const projects = [];
  for (let i = 0; i < overviewProjects.length; i++) {
    const record = await processOverviewItem(overviewProjects[i], i, overviewProjects.length, "project");
    projects.push(record);
  }

  // 3. Estimates
  console.log("\n📋 Overview/Estimates laden...");
  const overviewEstimates = await allTasksInList(OVERVIEW_ESTIMATES_LIST);
  console.log(`   ${overviewEstimates.length} estimates\n`);

  const estimates = [];
  for (let i = 0; i < overviewEstimates.length; i++) {
    const record = await processOverviewItem(overviewEstimates[i], i, overviewEstimates.length, "estimate");
    estimates.push(record);
  }

  // 4. Archived lists check + set listArchived per project
  console.log("\n🗄️  Gearchiveerde lijsten controleren...");
  const archivedIssues = [];
  const archivedListIds = new Set();
  const deliveryId = spaceMap.delivery;
  if (deliveryId) {
    const { folders } = await api(`space/${deliveryId}/folder`, { archived: "false" });
    for (const folder of folders.slice(0, 50)) {
      try {
        const { lists } = await api(`folder/${folder.id}/list`, { archived: "true" });
        for (const lst of lists ?? []) {
          archivedListIds.add(lst.id);
          try {
            const tasks = await allTasksInList(lst.id);
            for (const t of tasks) {
              if ((t.time_spent ?? 0) > 0) {
                archivedIssues.push({
                  taskName: t.name,
                  project: folder.name,
                  list: lst.name,
                  hours: round(msH(t.time_spent), 1),
                  url: t.url,
                });
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }
  for (const p of projects) {
    p.listArchived = !!(p.listId && archivedListIds.has(p.listId));
  }
  console.log(`   ${archivedIssues.length} taken met uren op gearchiveerde lijsten`);
  console.log(`   ${archivedListIds.size} gearchiveerde lijsten; ${projects.filter((p) => p.listArchived).length} projecten met gearchiveerde lijst`);

  // 5. Save
  const allItems = [...projects, ...estimates];
  const cache = {
    syncedAt: new Date().toISOString(),
    spaces: spaceMap,
    projects,
    estimates,
    archivedIssues,
    stats: {
      totalProjects: projects.length,
      totalEstimates: estimates.length,
      projectsWithTasks: projects.filter((p) => p.taskCount > 0).length,
      projectsWithOrderValue: projects.filter((p) => p.signedOfferValue > 0).length,
      totalTasks: allItems.reduce((s, p) => s + p.taskCount, 0),
    },
  };

  const outPath = resolve(__dirname, "data", "clickup-cache.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(cache, null, 2));

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Sync voltooid in ${elapsed}s`);
  console.log(`   ${cache.stats.totalProjects} projecten, ${cache.stats.totalEstimates} estimates`);
  console.log(`   ${cache.stats.totalTasks} taken`);
  console.log(`   Opgeslagen: ${outPath}`);
}

sync().catch((e) => {
  console.error("❌ Sync mislukt:", e);
  process.exit(1);
});
