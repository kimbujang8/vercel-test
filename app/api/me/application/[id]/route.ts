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
  const s = String(v ?? "");
  return s.replace(/\D/g, "");
}

type AppRow = {
  id: number;
  phone: string;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const mis = mustEnv();
  if (mis) return mis;

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
  const phone = normalizePhone(parsed.phone);
  if (!phone) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "phone required" } },
      { status: 400 },
    );
  }

  // 1) 해당 id 레코드 조회
  // 1) 해당 id 레코드 조회
  const r1 = await fetch(`${base}/api/applications/${id}`, {
    headers: { "x-api-key": key! },
    cache: "no-store",
  });

  const t1 = await r1.text();
  if (!r1.ok) return new NextResponse(t1, { status: r1.status });

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
  const ownerPhone = normalizePhone(row.phone);
  if (ownerPhone !== phone) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "not your application" } },
      { status: 403 },
    );
  }
  if (normalizePhone(row.phone) !== normalizePhone(phone)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "not your application" } },
      { status: 403 },
    );
  }

  // 3) 백엔드 삭제 호출
  // 3) 삭제 실행
  const r2 = await fetch(`${base}/api/applications/${id}`, {
    method: "DELETE",
    headers: { "x-api-key": key! },
    cache: "no-store",
  });

  // ✅ 여기 중요: JSON 파싱 시도하지 말고 text로 받아서 그대로 반환
  // 204/205는 body를 넣으면 NextResponse가 예외를 냅니다.
  if (r2.status === 204 || r2.status === 205) {
    return new NextResponse(null, { status: r2.status });
  }

  // 그 외에는 body를 그대로 프록시
  const t2 = await r2.text();
  return new NextResponse(t2, {
    status: r2.status,
    headers: { "content-type": r2.headers.get("content-type") ?? "text/plain" },
  });
}
