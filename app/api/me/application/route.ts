import { NextRequest, NextResponse } from "next/server";
import { normalizeMealCounts } from "@/app/mealCounts";
import {
  normalizePersonName,
  normalizePhoneKR,
} from "@/app/personFields";
import {
  backendBaseWithFallback,
  upstreamFailureResponse,
  upstreamFetch,
} from "../../_shared/upstreamProxy";

type ApplicationRow = {
  id: number;
  date: string;
  meal: "dinner";
  name: string;
  phone: string;
  ranchNumber?: string | null;
  count: number;
  adultCount?: number;
  childCount?: number;
  preschoolCount?: number;
  note: string | null;
  updated_at: string;
};

export async function POST(req: NextRequest) {
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
  const name = normalizePersonName(body?.name ?? "");
  const phone = normalizePhoneKR(body?.phone ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "날짜를 선택해 주세요.",
        },
      },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "이름을 입력해 주세요.",
        },
      },
      { status: 400 },
    );
  }
  if (phone.length < 9) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "전화번호를 확인해 주세요. (010 또는 +82 형식, 숫자 9자리 이상)",
        },
      },
      { status: 400 },
    );
  }

  let backend: string;
  try {
    backend = backendBaseWithFallback();
  } catch (e) {
    return NextResponse.json(
      { error: { code: "SERVER_MISCONFIG", message: String(e) } },
      { status: 500 },
    );
  }
  const qs = new URLSearchParams({
    from: date,
    to: date,
    meal: "dinner",
    phone,
  }).toString();

  const url = `${backend}/api/applications?${qs}`;
  let r: Response;
  try {
    r = await upstreamFetch(url, { apiKey: API_KEY });
  } catch (e) {
    return upstreamFailureResponse(url, e);
  }

  const text = await r.text();
  if (!r.ok) {
    return new NextResponse(text, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "text/plain",
      },
    });
  }

  let list: ApplicationRow[];
  try {
    list = JSON.parse(text) as ApplicationRow[];
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_BACKEND_RESPONSE", message: "invalid JSON" } },
      { status: 502 },
    );
  }

  const found = list.find(
    (x) => normalizePersonName(x.name) === name,
  );

  if (!found) {
    return NextResponse.json({ ok: true, application: null }, { status: 200 });
  }

  const counts = normalizeMealCounts(found, {
    maxPerField: 50,
    maxTotal: 50,
    requireTotalAtLeastOne: true,
  });

  return NextResponse.json(
    {
      ok: true,
      application: {
        id: found.id,
        date: found.date,
        meal: found.meal,
        name: found.name,
        phone: found.phone,
        ranchNumber:
          typeof found.ranchNumber === "string" ? found.ranchNumber : "",
        adultCount: counts.adultCount,
        childCount: counts.childCount,
        preschoolCount: counts.preschoolCount,
        count: counts.total,
        note: found.note ?? "",
        updated_at: found.updated_at,
      },
    },
    { status: 200 },
  );
}
