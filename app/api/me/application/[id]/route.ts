import { NextResponse } from "next/server";

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

function normalizePhone(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

type AppRow = {
  id: number;
  phone: string;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ✅ Next 16 Route Handler 타입에 맞게 params는 Promise가 아니라 객체로 받습니다.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const mis = mustEnv();
  if (mis) return mis;

  // ✅ mustEnv 통과 후 string으로 고정 (TS/빌드 안전)
  const apiBase = base as string;
  const apiKey = key as string;

  const { id } = params;
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

  const phone = normalizePhone(parsed.phone);
  if (!phone) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "phone required" } },
      { status: 400 },
    );
  }

  // 1) 해당 id 레코드 조회
  const r1 = await fetch(`${apiBase}/api/applications/${id}`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });

  const t1 = await r1.text();
  if (!r1.ok) {
    return new NextResponse(t1, {
      status: r1.status,
      headers: {
        "content-type": r1.headers.get("content-type") ?? "text/plain",
      },
    });
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
  if (normalizePhone(row.phone) !== phone) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "not your application" } },
      { status: 403 },
    );
  }

  // 3) 백엔드 삭제 호출
  const r2 = await fetch(`${apiBase}/api/applications/${id}`, {
    method: "DELETE",
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });

  // ✅ 204/205는 body 금지
  if (r2.status === 204 || r2.status === 205) {
    return new NextResponse(null, { status: r2.status });
  }

  const t2 = await r2.text();
  return new NextResponse(t2, {
    status: r2.status,
    headers: { "content-type": r2.headers.get("content-type") ?? "text/plain" },
  });
}
