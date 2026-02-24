import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function adminTokenFromPassword(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

function getBackendBaseUrl() {
  const v = process.env.BACKEND_URL || "http://localhost:3000";
  return v.replace(/\/$/, "");
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      {
        error: { code: "SERVER_MISCONFIG", message: "ADMIN_PASSWORD not set" },
      },
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

  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: "API_KEY not set" } },
      { status: 500 },
    );
  }

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "invalid id" } },
      { status: 400 },
    );
  }

  const backend = getBackendBaseUrl();
  const upstream = `${backend}/api/applications/${id}`;

  const r = await fetch(upstream, {
    method: "DELETE",
    headers: { "x-api-key": API_KEY },
    cache: "no-store",
  });

  const text = await r.text();
  if (!r.ok) return new NextResponse(text, { status: r.status });

  // server.js는 { ok: true } 같은 JSON을 줄 가능성이 높음
  try {
    return NextResponse.json(JSON.parse(text), { status: 200 });
  } catch {
    return new NextResponse(text, { status: 200 });
  }
}
