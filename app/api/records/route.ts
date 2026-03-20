import { NextRequest, NextResponse } from "next/server";
import {
  upstreamFailureResponse,
  upstreamFetch,
} from "../_shared/upstreamProxy";

function mustEnv(): { base: string; key: string } | NextResponse {
  const base = process.env.API_BASE;
  const key = process.env.API_KEY;
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
  return { base, key };
}

export async function GET(_req: NextRequest) {
  void _req;
  const env = mustEnv();
  if (env instanceof NextResponse) return env;
  const url = `${env.base}/api/records`;
  try {
    const res = await upstreamFetch(url, { apiKey: env.key });
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

export async function POST(req: NextRequest) {
  const env = mustEnv();
  if (env instanceof NextResponse) return env;
  const body = await req.text();
  const url = `${env.base}/api/records`;
  try {
    const res = await upstreamFetch(url, {
      method: "POST",
      apiKey: env.key,
      headers: { "content-type": "application/json" },
      body,
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
