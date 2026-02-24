import { NextResponse } from "next/server";

const base = process.env.API_BASE!;
const key = process.env.API_KEY!;

export async function PUT(
  req: Request,
  { params }: { params: { date: string; meal: string } },
) {
  const { date, meal } = params;
  const body = await req.text();

  const res = await fetch(`${base}/api/records/by-key/${date}/${meal}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
    },
    body,
  });

  // 204/205 대비(혹시 백엔드가 204를 주면 body 없이 반환)
  if (res.status === 204 || res.status === 205) {
    return new NextResponse(null, { status: res.status });
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "text/plain",
    },
  });
}
