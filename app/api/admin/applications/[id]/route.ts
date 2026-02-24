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

  const res = await fetch(`${apiBase}/api/applications/${id}`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
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

  const res = await fetch(`${apiBase}/api/applications/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body,
    cache: "no-store",
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
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

  const res = await fetch(`${apiBase}/api/applications/${id}`, {
    method: "DELETE",
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });

  if (res.status === 204 || res.status === 205) {
    return new NextResponse(null, { status: res.status });
  }

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
