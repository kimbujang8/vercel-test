import { NextResponse } from "next/server";

type ApplicationRow = {
  id: number;
  date: string;
  meal: "dinner";
  name: string;
  phone: string;
  count: number;
  note: string | null;
  updated_at: string;
};

function getBackendBaseUrl() {
  const v = process.env.BACKEND_URL || "http://localhost:3000";
  return v.replace(/\/$/, "");
}

function normPhone(input: string) {
  return String(input).replace(/\D/g, "");
}

export async function POST(req: Request) {
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: "API_KEY not set" } },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    date?: string;
    name?: string;
    phone?: string;
    note?: string;
    count?: number;
  } | null;

  const date = body?.date ?? "";
  const name = (body?.name ?? "").trim();
  const phone = normPhone(body?.phone ?? "");
  const note = typeof body?.note === "string" ? body.note : "";
  const count = typeof body?.count === "number" ? body.count : undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name || phone.length < 9) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "invalid input" } },
      { status: 400 },
    );
  }
  if (
    count !== undefined &&
    (!Number.isInteger(count) || count < 1 || count > 50)
  ) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "invalid count" } },
      { status: 400 },
    );
  }

  const backend = getBackendBaseUrl();

  // 1) 본인 조회로 id 확보 (남의 id로 patch 방지)
  const qs = new URLSearchParams({
    from: date,
    to: date,
    meal: "dinner",
    phone,
  }).toString();

  const listRes = await fetch(`${backend}/api/applications?${qs}`, {
    headers: { "x-api-key": API_KEY },
    cache: "no-store",
  });

  const listText = await listRes.text();
  if (!listRes.ok)
    return new NextResponse(listText, { status: listRes.status });

  const list = JSON.parse(listText) as ApplicationRow[];
  const found = list.find((x) => x.name.trim() === name);

  if (!found) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "no application" } },
      { status: 404 },
    );
  }

  // 2) patch
  const patchRes = await fetch(`${backend}/api/applications/${found.id}`, {
    method: "PATCH",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      note: note.trim() ? note.trim() : null,
      ...(count !== undefined ? { count } : {}),
    }),
  });

  const patchText = await patchRes.text();
  return new NextResponse(patchText, {
    status: patchRes.status,
    headers: { "content-type": "application/json" },
  });
}
