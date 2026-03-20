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
} from "../../../_shared/upstreamProxy";

type ApplicationRow = {
  id: number;
  date: string;
  meal: "dinner";
  name: string;
  phone: string;
  count: number;
  adultCount?: number;
  childCount?: number;
  preschoolCount?: number;
  note: string | null;
  updated_at: string;
};

function nowKST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function todayKST(): string {
  const kst = nowKST();
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isEditAllowedForDate(dateYmd: string): boolean {
  const today = todayKST();
  if (dateYmd < today) return false;
  if (dateYmd > today) return true;

  // 당일 18:30(KST)까지 수정 가능 (18:30:00 포함)
  const kstNow = nowKST();
  const cutoff = nowKST();
  cutoff.setUTCHours(18, 30, 0, 0);
  return kstNow.getTime() <= cutoff.getTime();
}

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
    note?: string;
    count?: number;
    adultCount?: number;
    childCount?: number;
    preschoolCount?: number;
  } | null;

  const date = body?.date ?? "";
  const name = normalizePersonName(body?.name ?? "");
  const phone = normalizePhoneKR(body?.phone ?? "");
  const note = typeof body?.note === "string" ? body.note : "";
  const hasAnyCountField =
    body?.adultCount !== undefined ||
    body?.childCount !== undefined ||
    body?.preschoolCount !== undefined ||
    body?.count !== undefined;
  const counts = hasAnyCountField
    ? normalizeMealCounts(body, {
        maxPerField: 50,
        maxTotal: 50,
        requireTotalAtLeastOne: true,
      })
    : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "날짜를 선택해 주세요." } },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "이름을 입력해 주세요." } },
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

  // count 관련 검증은 normalizeMealCounts에서 음수/NaN 방지 + 합계 계산으로 처리

  if (!isEditAllowedForDate(date)) {
    return NextResponse.json(
      {
        error: {
          code: "CUTOFF_PASSED",
          message: "당일 18시 30분 이후에는 수정할 수 없습니다.",
        },
      },
      { status: 403 },
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

  // 1) 본인 조회로 id 확보 (남의 id로 patch 방지)
  const qs = new URLSearchParams({
    from: date,
    to: date,
    meal: "dinner",
    phone,
  }).toString();

  const listUrl = `${backend}/api/applications?${qs}`;
  let listRes: Response;
  try {
    listRes = await upstreamFetch(listUrl, { apiKey: API_KEY });
  } catch (e) {
    return upstreamFailureResponse(listUrl, e);
  }

  const listText = await listRes.text();
  if (!listRes.ok) {
    return new NextResponse(listText, {
      status: listRes.status,
      headers: {
        "content-type": listRes.headers.get("content-type") ?? "text/plain",
      },
    });
  }

  let list: ApplicationRow[];
  try {
    list = JSON.parse(listText) as ApplicationRow[];
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BAD_BACKEND_RESPONSE",
          message: "backend did not return valid JSON",
        },
      },
      { status: 502 },
    );
  }

  const found = list.find(
    (x) => normalizePersonName(x.name) === name,
  );

  if (!found) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "no application" } },
      { status: 404 },
    );
  }

  // 2) patch
  const patchUrl = `${backend}/api/applications/${found.id}`;
  let patchRes: Response;
  try {
    patchRes = await upstreamFetch(patchUrl, {
      method: "PATCH",
      apiKey: API_KEY,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: note.trim() ? note.trim() : null,
        ...(counts
          ? {
              adultCount: counts.adultCount,
              childCount: counts.childCount,
              preschoolCount: counts.preschoolCount,
              count: counts.total,
            }
          : {}),
      }),
    });
  } catch (e) {
    return upstreamFailureResponse(patchUrl, e);
  }

  const patchText = await patchRes.text();
  return new NextResponse(patchText, {
    status: patchRes.status,
    headers: {
      "content-type": patchRes.headers.get("content-type") ?? "text/plain",
    },
  });
}
