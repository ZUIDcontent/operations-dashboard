import { NextRequest, NextResponse } from "next/server";

const API_TOKEN = "pk_90802410_1MU0ZEXG77QFGP48G35BQRBJLCKAST9M";
const BASE = "https://api.clickup.com/api/v2";

const FIELD_IDS: Record<string, { id: string; type: "currency" | "number" }> = {
  signedOfferValue: { id: "d447d470-fd7e-4aec-baf0-7a008bb1b0a3", type: "currency" },
  vendorCosts:      { id: "c2354e8e-1b24-44e6-b774-802e80fc36a0", type: "currency" },
  vendorMargin:     { id: "4fe35a1e-f74b-4256-beb7-a6c652085c17", type: "number" },
  riskBuffer:       { id: "d3a5c46a-be99-4103-b55e-a4472e91f556", type: "number" },
};

async function cuFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: API_TOKEN,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, action, fields, statusValue } = body as {
      taskId: string;
      action?: "complete" | "setStatus";
      fields?: Record<string, number>;
      statusValue?: string;
    };

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const results: string[] = [];

    if (fields && Object.keys(fields).length > 0) {
      for (const [key, value] of Object.entries(fields)) {
        const def = FIELD_IDS[key];
        if (!def) {
          results.push(`${key}: unknown field`);
          continue;
        }
        await cuFetch(`${BASE}/task/${taskId}/field/${def.id}`, {
          method: "POST",
          body: JSON.stringify({ value }),
        });
        results.push(`${key}: set to ${value}`);
      }
    }

    if (action === "complete") {
      await cuFetch(`${BASE}/task/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "complete" }),
      });
      results.push("status: set to complete");
    }

    if (action === "setStatus" && statusValue) {
      await cuFetch(`${BASE}/task/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status: statusValue }),
      });
      results.push(`status: set to ${statusValue}`);
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
