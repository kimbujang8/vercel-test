import { NextRequest, NextResponse } from "next/server";
import { normalizeMealCounts } from "@/app/mealCounts";
import {
  upstreamFailureResponse,
  upstreamFetch,
} from "../_shared/upstreamProxy";

const base = process.env.BACKEND_URL ?? process.env.API_BASE;
const key = process.env.API_KEY;

function mustEnv() {
  if (!base || !key) {
    return NextResponse.json(
      {
        error: {
          code: "SERVER_MISCONFIG",
          message: "BACKEND_URL(or API_BASE)/API_KEY not set",
        },
      },
      { status: 500 },
    );
  }
  return null;
}

type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// POST /api/applications
export async function POST(req: NextRequest) {
  const mis = mustEnv();
  if (mis) return mis;

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "invalid JSON" } },
      { status: 400 },
    );
  }

  if (!isObject(parsed)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "JSON object required" } },
      { status: 400 },
    );
  }

  const counts = normalizeMealCounts(parsed, {
    maxPerField: 50,
    maxTotal: 50,
    requireTotalAtLeastOne: true,
  });

  // 새 필드가 있으면 그것을 우선하고, 항상 count=합계로 동기화
  const body: JsonObject = {
    ...parsed,
    adultCount: counts.adultCount,
    childCount: counts.childCount,
    preschoolCount: counts.preschoolCount,
    count: counts.total,
  };

  const url = `${base}/api/applications`;
  try {
    const res = await upstreamFetch(url, {
      method: "POST",
      apiKey: key!,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "text/plain",
      },
    });
  } catch (e) {
    return upstreamFailureResponse(url, e);
  }
}
