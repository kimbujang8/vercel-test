import { NextResponse } from "next/server";

/**
 * 관리자 세션 쿠키(admin_session) 제거.
 * app/page.tsx 의 adminLogout() 이 POST 로 호출함.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "admin_session",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
