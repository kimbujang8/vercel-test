import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

function timingSafeEqualStr(a: string, b: string) {
  // 길이가 다르면 timingSafeEqual 자체가 예외/불가라서,
  // 동일 길이로 맞춰서 비교(시간 누수 줄이기)
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function adminTokenFromPassword(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

export async function POST(req: NextRequest) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      {
        error: { code: "SERVER_MISCONFIG", message: "ADMIN_PASSWORD not set" },
      },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    password?: string;
  } | null;
  const password = body?.password ?? "";

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "password required" } },
      { status: 400 },
    );
  }

  const ok = timingSafeEqualStr(password, ADMIN_PASSWORD);
  if (!ok) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "invalid admin password" } },
      { status: 401 },
    );
  }

  const token = adminTokenFromPassword(ADMIN_PASSWORD);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "admin_session",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
