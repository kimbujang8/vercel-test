import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  upstreamFailureResponse,
  upstreamFetch,
} from "../../_shared/upstreamProxy";

function adminTokenFromPassword(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

function getBackendBaseUrl() {
  const v = process.env.BACKEND_URL ?? process.env.API_BASE;
  if (!v) throw new Error("BACKEND_URL(or API_BASE) not set");
  return v.replace(/\/$/, "");
}

async function requireAdmin() {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: "ADMIN_PASSWORD not set" } },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value ?? "";
  const expected = adminTokenFromPassword(ADMIN_PASSWORD);
  if (!token || token !== expected) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "admin auth required" } },
      { status: 401 },
    );
  }

  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth) return auth;

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
  const upstream = `${backend}/api/dinner-menu?date=${encodeURIComponent(date)}`;

  let r: Response;
  try {
    r = await upstreamFetch(upstream, { apiKey: API_KEY });
  } catch (e) {
    return upstreamFailureResponse(upstream, e);
  }

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: "API_KEY not set" } },
      { status: 500 },
    );
  }

  const backend = getBackendBaseUrl();
  const upstream = `${backend}/api/dinner-menu`;

  const body = await req.text();
  let r: Response;
  try {
    r = await upstreamFetch(upstream, {
      method: "PUT",
      apiKey: API_KEY,
      headers: { "content-type": "application/json" },
      body,
    });
  } catch (e) {
    return upstreamFailureResponse(upstream, e);
  }

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}

