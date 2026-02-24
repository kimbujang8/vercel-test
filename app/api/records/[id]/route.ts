import { NextResponse } from "next/server";

const base = process.env.API_BASE!;
const key = process.env.API_KEY!;

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const res = await fetch(`${base}/api/records/${id}`, {
    method: "DELETE",
    headers: { "x-api-key": key },
  });

  return new NextResponse(null, { status: res.status });
}
