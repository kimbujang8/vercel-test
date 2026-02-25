import { NextRequest, NextResponse } from "next/server";

function backendBase() {
  const v = process.env.BACKEND_URL; // ✅ localhost fallback 제거
  if (!v) throw new Error("BACKEND_URL not set");
  if (!/^https?:\/\//.test(v))
    throw new Error("BACKEND_URL must start with http:// or https://");
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
  if (!date) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "date is required" } },
      { status: 400 },
    );
  }

  let upstream: string;
  try {
    const base = backendBase();
    upstream = `${base}/api/summary?date=${encodeURIComponent(date)}`;
  } catch (e) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: String(e) } },
      { status: 500 },
    );
  }

  try {
    const r = await fetch(upstream, {
      headers: { "x-api-key": API_KEY },
      cache: "no-store",
      redirect: "manual",
    });

    const ct = r.headers.get("content-type") ?? "text/plain";
    const text = await r.text();

    // ✅ Cloudflare Access/HTML 리다이렉트/차단을 눈에 보이게
    if (text.includes("<html") || text.includes("Cloudflare")) {
      return NextResponse.json(
        {
          error: {
            code: "UPSTREAM_BLOCKED",
            message:
              "Upstream returned HTML (likely Cloudflare Access / redirect / block).",
            upstream_status: r.status,
            upstream_content_type: ct,
          },
        },
        { status: 502 },
      );
    }

    return new NextResponse(text, {
      status: r.status,
      headers: { "content-type": ct },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_FETCH_FAILED",
          message: String(e),
          upstream,
        },
      },
      { status: 502 },
    );
  }
}
