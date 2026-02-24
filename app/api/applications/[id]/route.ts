import { NextResponse } from "next/server";

function getBackendBaseUrl() {
  const v = process.env.BACKEND_URL || "http://localhost:3000";
  return v.replace(/\/$/, "");
}

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: "API_KEY not set" } },
      { status: 500 },
    );
  }

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "invalid id" } },
      { status: 400 },
    );
  }

  const backend = getBackendBaseUrl();
  const r = await fetch(`${backend}/api/applications/${id}`, {
    method: "DELETE",
    headers: { "x-api-key": API_KEY },
  });

  // 204는 body 없음
  if (r.status === 204) return new NextResponse(null, { status: 204 });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") ?? "application/json",
    },
  });
}
