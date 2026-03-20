import { NextRequest, NextResponse } from "next/server";
import {
  upstreamFailureResponse,
  upstreamFetch,
} from "../../../_shared/upstreamProxy";
import {
  upstreamNullResponse,
  upstreamTextResponse,
} from "../../../_shared/upstreamTextResponse";

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

// 🔹 관리자 단건 조회
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const mis = mustEnv();
  if (mis) return mis;

  const apiBase = base as string;
  const apiKey = key as string;

  const { id } = await ctx.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "invalid id" } },
      { status: 400 },
    );
  }

  const url = `${apiBase}/api/applications/${id}`;
  let res: Response;
  try {
    res = await upstreamFetch(url, { apiKey });
  } catch (e) {
    return upstreamFailureResponse(url, e);
  }

  const text = await res.text();

  return upstreamTextResponse(res, text, "application/json");
}

// 🔹 관리자 수정 (PATCH)
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const mis = mustEnv();
  if (mis) return mis;

  const apiBase = base as string;
  const apiKey = key as string;

  const { id } = await ctx.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "invalid id" } },
      { status: 400 },
    );
  }

  const body = await req.text();

  const url = `${apiBase}/api/applications/${id}`;
  let res: Response;
  try {
    res = await upstreamFetch(url, {
      method: "PATCH",
      apiKey,
      headers: { "content-type": "application/json" },
      body,
    });
  } catch (e) {
    return upstreamFailureResponse(url, e);
  }

  const text = await res.text();

  return upstreamTextResponse(res, text, "application/json");
}

// 🔹 관리자 삭제
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const mis = mustEnv();
  if (mis) return mis;

  const apiBase = base as string;
  const apiKey = key as string;

  const { id } = await ctx.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "invalid id" } },
      { status: 400 },
    );
  }

  const url = `${apiBase}/api/applications/${id}`;
  let res: Response;
  try {
    res = await upstreamFetch(url, {
      method: "DELETE",
      apiKey,
    });
  } catch (e) {
    return upstreamFailureResponse(url, e);
  }

  if (res.status === 204 || res.status === 205) {
    return upstreamNullResponse(res.status);
  }

  const text = await res.text();

  return upstreamTextResponse(res, text, "application/json");
}
