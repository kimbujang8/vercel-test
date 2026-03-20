import { NextRequest, NextResponse } from "next/server";
import { totalFromRow } from "@/app/mealCounts";
import { fetchUpstreamText } from "../_shared/upstreamProxy";

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "invalid date" } },
      { status: 400 },
    );
  }

  let upstream: string;
  try {
    const base = backendBase();
    // summary를 백엔드에 의존하지 않고, 신청 목록을 기준으로 직접 집계
    const qs = new URLSearchParams({
      from: date,
      to: date,
      meal: "dinner",
    }).toString();
    upstream = `${base}/api/applications?${qs}`;
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
        defaultContentType: "text/plain",
      });

    // ✅ Cloudflare Access/HTML 리다이렉트/차단을 눈에 보이게
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

    if (status < 200 || status >= 300) {
      return new NextResponse(text, { status, headers: { "content-type": contentType } });
    }

    let list: unknown;
    try {
      list = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_BACKEND_RESPONSE", message: "invalid JSON" } },
        { status: 502 },
      );
    }

    if (!Array.isArray(list)) {
      return NextResponse.json(
        { error: { code: "BAD_BACKEND_RESPONSE", message: "array required" } },
        { status: 502 },
      );
    }

    const total = list.reduce((acc, row) => {
      if (typeof row !== "object" || row === null) return acc;
      return acc + totalFromRow(row as Record<string, unknown>);
    }, 0);

    return NextResponse.json(
      {
        date,
        rows: [{ meal: "dinner", total }],
      },
      { status: 200 },
    );
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
