import { NextResponse } from "next/server";

const base = process.env.API_BASE!;
const key = process.env.API_KEY!;

export async function PUT(
  _req: Request,
  ctx: { params: Promise<{ date: string; meal: string }> },
) {
  const { date, meal } = await ctx.params;
  const body = await _req.text();

  const res = await fetch(`${base}/api/records/by-key/${date}/${meal}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
    },
    body,
  });

  const text = await res.text();
  return new NextResponse(text, { status: res.status });
}
