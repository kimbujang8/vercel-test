import { NextResponse } from "next/server";

const base = process.env.API_BASE!;
const key = process.env.API_KEY!;

export async function GET() {
  const res = await fetch(`${base}/api/records`, {
    headers: { "x-api-key": key },
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status });
}

export async function POST(req: Request) {
  const body = await req.text();

  const res = await fetch(`${base}/api/records`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
    },
    body,
  });

  const text = await res.text();
  return new NextResponse(text, { status: res.status });
}
