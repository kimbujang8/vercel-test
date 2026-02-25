import { NextRequest, NextResponse } from "next/server";

const base = process.env.API_BASE!;
const key = process.env.API_KEY!;

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const res = await fetch(`${base}/api/records/${id}`, {
    method: "DELETE",
    headers: { "x-api-key": key },
    cache: "no-store",
  });

  // 204/205는 body 없이
  if (res.status === 204 || res.status === 205) {
    return new NextResponse(null, { status: res.status });
  }

  // 그 외에는 응답을 그대로 전달(에러 메시지 보존)
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "text/plain",
    },
  });
}
