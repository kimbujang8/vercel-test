import { NextRequest, NextResponse } from "next/server";
import { backendBaseWithFallback, fetchUpstreamText } from "../_shared/upstreamProxy";

export async function GET(req: NextRequest) {
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: "API_KEY not set" } },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "from/to required (YYYY-MM-DD)" } },
      { status: 400 },
    );
  }

  let upstream: string;
  try {
    const base = backendBaseWithFallback();
    upstream = `${base}/api/dinner-menus?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  } catch (e) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: String(e) } },
      { status: 500 },
    );
  }

  try {
    const { text, status, contentType, isHtmlBlocked } =
      await fetchUpstreamText({
        upstream,
        apiKey: API_KEY,
        defaultContentType: "application/json",
      });

    if (isHtmlBlocked) {
      return NextResponse.json(
        {
          error: {
            code: "UPSTREAM_BLOCKED",
            message:
              "Upstream returned HTML (likely Cloudflare Access / redirect / block).",
            upstream_status: status,
            upstream_content_type: contentType,
          },
        },
        { status: 502 },
      );
    }

    return new NextResponse(text, { status, headers: { "content-type": contentType } });
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

