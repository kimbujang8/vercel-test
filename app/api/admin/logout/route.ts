import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ApplicationRow = {
  id: number;
  date: string;
  meal: "dinner";
  name: string;
  phone: string;
  count: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function adminTokenFromPassword(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

function getBackendBaseUrl() {
  const v = process.env.BACKEND_URL || "http://localhost:3000";
  return v.replace(/\/$/, "");
}

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  const backend = getBackendBaseUrl();
  const upstream = `${backend}/api/applications${qs ? `?${qs}` : ""}`;

  const r = await fetch(upstream, {
    headers: { "x-api-key": API_KEY },
    cache: "no-store",
  });

  const text = await r.text();
  if (!r.ok) return new NextResponse(text, { status: r.status });

  // 타입 체크(최소)
  const list = JSON.parse(text) as ApplicationRow[];
  return NextResponse.json(list, { status: 200 });
}
