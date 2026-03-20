import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneKR } from "@/app/personFields";
import {
  upstreamFailureResponse,
  upstreamFetch,
} from "../../_shared/upstreamProxy";
import {
  upstreamNullResponse,
  upstreamTextResponse,
} from "../../_shared/upstreamTextResponse";

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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type AppRow = { id: number; phone: string };

// ✅ 빌드가 요구하는 시그니처에 정확히 맞춤
export async function DELETE(
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

  // body에서 phone 받기
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

  const phone = normalizePhoneKR(String(parsed.phone ?? ""));
  if (!phone) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "phone required" } },
      { status: 400 },
    );
  }

  const url1 = `${apiBase}/api/applications/${id}`;
  let r1: Response;
  try {
    r1 = await upstreamFetch(url1, { apiKey });
  } catch (e) {
    return upstreamFailureResponse(url1, e);
  }

  const t1 = await r1.text();
  if (!r1.ok) {
    return upstreamTextResponse(r1, t1, "text/plain");
  }

  let row: AppRow;
  try {
    row = JSON.parse(t1) as AppRow;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BAD_BACKEND_RESPONSE",
          message: "backend did not return valid JSON",
          backendText: t1.slice(0, 300),
        },
      },
      { status: 502 },
    );
  }

  // 2) 소유권 검증
  if (normalizePhoneKR(row.phone) !== phone) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "not your application" } },
      { status: 403 },
    );
  }

  const url2 = `${apiBase}/api/applications/${id}`;
  let r2: Response;
  try {
    r2 = await upstreamFetch(url2, {
      method: "DELETE",
      apiKey,
    });
  } catch (e) {
    return upstreamFailureResponse(url2, e);
  }

  // 204/205는 body 금지
  if (r2.status === 204 || r2.status === 205) {
    return upstreamNullResponse(r2.status);
  }

  const t2 = await r2.text();
  return upstreamTextResponse(r2, t2, "text/plain");
}
