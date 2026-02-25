import { NextRequest, NextResponse } from "next/server";

function getBackendBaseUrl() {
  const v = process.env.BACKEND_URL || "http://localhost:3000";
  return v.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: "API_KEY not set" } },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";

  const backend = getBackendBaseUrl();
  const upstream = `${backend}/api/summary?date=${encodeURIComponent(date)}`;

  const r = await fetch(upstream, {
    headers: { "x-api-key": API_KEY },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") ?? "text/plain",
    },
  });
}
