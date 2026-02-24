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
  } | null;

  const date = body?.date ?? "";
  const name = (body?.name ?? "").trim();
  const phone = normPhone(body?.phone ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name || phone.length < 9) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "invalid input" } },
      { status: 400 },
    );
  }

  const backend = getBackendBaseUrl();
  const qs = new URLSearchParams({
    from: date,
    to: date,
    meal: "dinner",
    phone,
  }).toString();

  const r = await fetch(`${backend}/api/applications?${qs}`, {
    headers: { "x-api-key": API_KEY },
    cache: "no-store",
  });

  const text = await r.text();
  if (!r.ok) return new NextResponse(text, { status: r.status });

  const list = JSON.parse(text) as ApplicationRow[];
  const found = list.find((x) => x.name.trim() === name);

  if (!found) {
    return NextResponse.json({ ok: true, application: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      ok: true,
      application: {
        id: found.id,
        date: found.date,
        meal: found.meal,
        name: found.name,
        phone: found.phone,
        count: found.count ?? 1,
        note: found.note ?? "",
        updated_at: found.updated_at,
      },
    },
    { status: 200 },
  );
}
