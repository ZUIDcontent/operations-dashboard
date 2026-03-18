import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const APPROVALS_PATH = resolve(process.cwd(), "data", "approvals.json");

export type ApprovalType = "mt_overspend" | "pm_ohw_exceed" | "pm_expected_exceed";

interface ApprovalRecord {
  at: string;
  by?: string;
}

interface ExpectedApprovalRecord extends ApprovalRecord {
  /** The expected budget value at the moment of approval */
  approvedExpected: number;
  /** Max allowed additional amount on top of approvedExpected before re-triggering */
  threshold: number;
}

interface ApprovalsData {
  mt_overspend: Record<string, ApprovalRecord>;
  pm_ohw_exceed: Record<string, ApprovalRecord>;
  pm_expected_exceed: Record<string, ExpectedApprovalRecord>;
}

function load(): ApprovalsData {
  if (!existsSync(APPROVALS_PATH)) {
    return { mt_overspend: {}, pm_ohw_exceed: {}, pm_expected_exceed: {} };
  }
  const raw = readFileSync(APPROVALS_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<ApprovalsData>;
  return {
    mt_overspend: parsed.mt_overspend ?? {},
    pm_ohw_exceed: parsed.pm_ohw_exceed ?? {},
    pm_expected_exceed: parsed.pm_expected_exceed ?? {},
  };
}

function save(data: ApprovalsData) {
  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
  writeFileSync(APPROVALS_PATH, JSON.stringify(data, null, 2));
}

export async function GET() {
  try {
    const data = load();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to load approvals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, projectId, by, threshold, approvedExpected } = body as {
      type: ApprovalType;
      projectId: string;
      by?: string;
      threshold?: number;
      approvedExpected?: number;
    };

    if (!type || !projectId) {
      return NextResponse.json({ error: "type and projectId required" }, { status: 400 });
    }
    if (!["mt_overspend", "pm_ohw_exceed", "pm_expected_exceed"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const data = load();

    if (type === "pm_expected_exceed") {
      if (threshold === undefined || threshold === null || isNaN(threshold)) {
        return NextResponse.json({ error: "threshold required for pm_expected_exceed" }, { status: 400 });
      }
      if (approvedExpected === undefined || approvedExpected === null || isNaN(approvedExpected)) {
        return NextResponse.json({ error: "approvedExpected required for pm_expected_exceed" }, { status: 400 });
      }
      data.pm_expected_exceed[projectId] = {
        at: new Date().toISOString(),
        by: by || undefined,
        approvedExpected,
        threshold,
      };
    } else {
      data[type][projectId] = { at: new Date().toISOString(), by: by || undefined };
    }

    save(data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save approval" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as ApprovalType | null;
    const projectId = searchParams.get("projectId");

    if (!type || !projectId) {
      return NextResponse.json({ error: "type and projectId required" }, { status: 400 });
    }

    const data = load();
    if (type === "pm_expected_exceed" && data.pm_expected_exceed[projectId]) {
      delete data.pm_expected_exceed[projectId];
      save(data);
    } else if (type in data && (data as Record<string, unknown>)[type]) {
      const section = (data as Record<string, Record<string, unknown>>)[type];
      if (section[projectId]) {
        delete section[projectId];
        save(data);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove approval" }, { status: 500 });
  }
}
