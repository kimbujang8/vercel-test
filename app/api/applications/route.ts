import { NextRequest, NextResponse } from "next/server";

const base = process.env.API_BASE;
const key = process.env.API_KEY;

function mustEnv() {
  if (!base || !key) {
    return NextResponse.json(
      {
        error: {
          code: "SERVER_MISCONFIG",
          message: "API_BASE/API_KEY not set",
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

function normalizeCount(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return 1;
  const i = Math.floor(n);
  return i >= 1 ? i : 1;
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

  const body: JsonObject = { ...parsed, count: normalizeCount(parsed.count) };

  const res = await fetch(`${base}/api/applications`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key!,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "text/plain",
    },
  });
}
