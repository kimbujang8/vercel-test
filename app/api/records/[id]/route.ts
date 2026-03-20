import { NextRequest, NextResponse } from "next/server";
import {
  upstreamFailureResponse,
  upstreamFetch,
} from "../../_shared/upstreamProxy";

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

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const env = mustEnv();
  if (env instanceof NextResponse) return env;
  const { id } = await ctx.params;
  const url = `${env.base}/api/records/${id}`;
  try {
    const res = await upstreamFetch(url, {
      method: "DELETE",
      apiKey: env.key,
    });

    if (res.status === 204 || res.status === 205) {
      return new NextResponse(null, { status: res.status });
    }

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
