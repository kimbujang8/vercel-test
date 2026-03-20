"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  fromBackendDinnerMenu,
  isDinnerMenuEmptyForDisplay,
  toBackendDinnerMenu,
} from "@/app/dinnerMenuSentinel";
import { normalizeMealCounts, totalFromRow } from "@/app/mealCounts";
import {
  normalizePersonName,
  normalizePhoneKR,
} from "@/app/personFields";

type Meal = "dinner";

type ApplicationRow = {
  id: number;
  date: string; // YYYY-MM-DD
  meal: Meal;
  name: string;
  phone: string;
  ranchNumber?: string | null;
  count: number; // total (legacy)
  adultCount?: number;
  childCount?: number;
  preschoolCount?: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type DinnerMenusRangeResponse = {
  ok: boolean;
  from: string;
  to: string;
  rows: Array<{ date: string; dinnerMenu: string; updated_at: string | null }>;
};

type ErrorResponse = { error?: { message?: string } };

type MyApplication = {
  id: number;
  date: string;
  meal: Meal;
  name: string;
  phone: string;
  ranchNumber?: string;
  count: number; // total (legacy)
  adultCount?: number;
  childCount?: number;
  preschoolCount?: number;
  note: string;
  updated_at: string;
};

function todayKST(): string {
  // KST(UTC+9) 기준 YYYY-MM-DD
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nowKST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function isDinnerApplicationOpen(dateYmd: string): boolean {
  // 신청 마감: KST 기준 당일 14:00
  const today = todayKST();
  if (dateYmd < today) return false;
  if (dateYmd > today) return true;
  const kstNow = nowKST();
  const h = kstNow.getUTCHours();
  // 14:00 정각부터 마감
  return h < 14;
}

function isEditAllowedForDate(dateYmd: string): boolean {
  // 신청 정정 마감: KST 기준 당일 18:30
  const today = todayKST();
  if (dateYmd < today) return false;
  if (dateYmd > today) return true;

  const kstNow = nowKST();
  const cutoff = nowKST();
  cutoff.setUTCHours(18, 30, 0, 0);
  return kstNow.getTime() <= cutoff.getTime();
}

function dinnerDeadlineLabel(dateYmd: string): string {
  return `${formatMonthDay(dateYmd)} 14:00`;
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const parts = ymd.split("-").map((x) => Number(x));
  return {
    y: parts[0] ?? 1970,
    m: parts[1] ?? 1,
    d: parts[2] ?? 1,
  };
}

/**
 * YYYY-MM-DD 달력 날짜의 요일 (0=일 … 6=토).
 * Date.UTC 기준이라 Vercel(UTC) SSR과 브라우저 로컬 TZ와 무관하게 동일 → hydration 안전.
 */
function weekdayForYmd(ymd: string): number {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const u = new Date(t);
  const yy = u.getUTCFullYear();
  const mm = String(u.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(u.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function mondayOfWeek(ymd: string): string {
  const day = weekdayForYmd(ymd);
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(ymd, delta);
}

function currentWeekMondayForMenus(): string {
  const today = todayKST();
  const day = weekdayForYmd(today);
  // 토요일이면 다음 주 월요일 기준으로 이동
  const pivot = day === 6 ? addDays(today, 2) : today;
  return mondayOfWeek(pivot);
}

function formatMonthDay(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m ?? 1)}/${Number(d ?? 1)}`;
}

function weekdayLabel(ymd: string): string {
  const names = ["일", "월", "화", "수", "목", "금", "토"];
  return names[weekdayForYmd(ymd)] ?? "";
}

const ADMIN_ID = "pjbc";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function Home() {
  const [queryDate, setQueryDate] = useState<string>(todayKST());
  // 페이지를 켜둔 채로 날짜가 바뀌면(자정 통과) 메뉴 조회가 갱신되도록
  const [todayForMenus, setTodayForMenus] = useState<string>(todayKST());

  // 관리자 모드
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminIdInput, setAdminIdInput] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminView, setAdminView] = useState<"menu" | "applications">("menu");

  // 관리자 전용 목록
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  // 관리자 전용: 날짜별 저녁 메뉴
  const [menuDate, setMenuDate] = useState<string>(todayKST());
  const [dinnerMenu, setDinnerMenu] = useState<string>("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuMsg, setMenuMsg] = useState<string>("");

  // 사용자 전용: 주간(월~금) 저녁 메뉴
  const [weekMenus, setWeekMenus] = useState<
    Array<{ date: string; dinnerMenu: string }>
  >([]);
  const [weekMenuLoading, setWeekMenuLoading] = useState(false);
  const [weekMenuError, setWeekMenuError] = useState<string>("");

  // 상태 메시지
  const [status, setStatus] = useState<string>("");
  // 신청 전용 메시지 (신청 카드 내부 표시)
  const [submitStatus, setSubmitStatus] = useState<string>("");
  const [submitStatusTone, setSubmitStatusTone] = useState<
    "success" | "warning" | "error" | ""
  >("");

  // 로딩 분리
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 신청 폼
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [ranchNumber, setRanchNumber] = useState<string>("");
  const [adultCount, setAdultCount] = useState<number>(0);
  const [childCount, setChildCount] = useState<number>(0);
  const [preschoolCount, setPreschoolCount] = useState<number>(0);
  const [note, setNote] = useState<string>("");

  // 내 신청내역 모달
  const [showMyModal, setShowMyModal] = useState(false);
  const [showMyUpdateDoneModal, setShowMyUpdateDoneModal] = useState(false);
  const [myDate, setMyDate] = useState<string>(queryDate);
  const [myName, setMyName] = useState<string>("");
  const [myPhone, setMyPhone] = useState<string>("");
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState<string | null>(null);
  const [myApp, setMyApp] = useState<MyApplication | null>(null);
  const [myNoteEdit, setMyNoteEdit] = useState<string>("");
  const [myAdultCountEdit, setMyAdultCountEdit] = useState<number>(0);
  const [myChildCountEdit, setMyChildCountEdit] = useState<number>(0);
  const [myPreschoolCountEdit, setMyPreschoolCountEdit] = useState<number>(0);

  const adminQueryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("from", queryDate);
    sp.set("to", queryDate);
    sp.set("meal", "dinner");
    return sp.toString();
  }, [queryDate]);

  const submitCounts = useMemo(() => {
    return normalizeMealCounts(
      { adultCount, childCount, preschoolCount },
      { maxPerField: 50, maxTotal: 50, requireTotalAtLeastOne: false },
    );
  }, [adultCount, childCount, preschoolCount]);

  const canEditMyApplication = myApp
    ? isEditAllowedForDate(myApp.date)
    : false;

  const canSubmitApplication =
    !submitting &&
    !!name.trim() &&
    !!phone.trim() &&
    !!ranchNumber.trim() &&
    !!queryDate &&
    submitCounts.total >= 1 &&
    submitCounts.total <= 50;

  const listTotals = useMemo(() => {
    let adult = 0;
    let child = 0;
    let preschool = 0;
    for (const r of rows) {
      const c = normalizeMealCounts(r, { requireTotalAtLeastOne: false });
      adult += c.adultCount;
      child += c.childCount;
      preschool += c.preschoolCount;
    }
    return { adult, child, preschool };
  }, [rows]);

  const orderedRows = useMemo(() => {
    // created_at 오름차순 = 신청순서
    return rows
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.created_at ?? "").getTime();
        const tb = new Date(b.created_at ?? "").getTime();
        const fa = Number.isFinite(ta);
        const fb = Number.isFinite(tb);
        if (fa && fb) return ta - tb;
        if (fa) return -1;
        if (fb) return 1;
        return a.id - b.id;
      });
  }, [rows]);

  async function refresh() {
    setRefreshing(true);
    setStatus("");

    try {
      if (isAdmin) {
        // 관리자만 목록 조회 가능
        const res = await fetch(`/api/admin/applications?${adminQueryString}`, {
          cache: "no-store",
        });
        const text = await res.text();

        if (res.status === 401) {
          setIsAdmin(false);
          setRows([]);
          setStatus("관리자 인증이 필요합니다.");
          return;
        }
        if (!res.ok) throw new Error(text);

        const list = JSON.parse(text) as ApplicationRow[];
        setRows(list);
      } else {
        // 일반 사용자는 관리자용 신청자 목록을 조회하지 않습니다.
        setRows([]);
      }
    } catch (e) {
      setStatus(`조회 실패: ${String(e)}`);
      setRows([]);
    } finally {
      setRefreshing(false);
    }
  }

  function exportApplicationsToPdf() {
    try {
      const w = window.open("", "_blank");
      if (!w) {
        setStatus("PDF 저장을 위한 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
        return;
      }

      const title = `신청자 목록 (${queryDate} · dinner)`;

      const rowsHtml = rows
        .slice()
        // "신청순서"를 created_at 오름차순으로 정의
        .sort((a, b) => {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
          return a.id - b.id;
        })
        .map((r, idx) => {
          const c = normalizeMealCounts(r, {
            maxPerField: 50,
            maxTotal: 50,
            requireTotalAtLeastOne: false,
          });
          return `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(r.date)}</td>
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.phone)}</td>
            <td>${escapeHtml(r.ranchNumber ?? "")}</td>
            <td>${totalFromRow(r)}</td>
            <td>${c.adultCount}</td>
            <td>${c.childCount}</td>
            <td>${c.preschoolCount}</td>
            <td>${escapeHtml(r.note ?? "")}</td>
            <td>${escapeHtml(r.updated_at)}</td>
          </tr>`;
        })
        .join("");

      const totalsLine = rows.length
        ? `어른 ${listTotals.adult}명 · 자녀 ${listTotals.child}명 · 미취학 아동 ${listTotals.preschool}명`
        : "해당 날짜에 신청자가 없습니다.";

      w.document.open();
      w.document.write(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(title)}</title>
            <style>
              body{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:24px; color:#0f172a;}
              h1{font-size:18px; margin:0 0 8px; letter-spacing:-0.01em;}
              .meta{font-size:12px; color:#475569; margin-bottom:14px; line-height:1.4;}
              table{width:100%; border-collapse:collapse; font-size:12px;}
              th,td{border:1px solid #e2e8f0; padding:8px; vertical-align:top; text-align:left; white-space:nowrap;}
              th{background:#f8fafc; font-size:12px; color:#475569;}
              td{white-space:normal;}
            </style>
          </head>
          <body>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              ${escapeHtml(totalsLine)}
              <br/>
              생성 시각: ${escapeHtml(new Date().toLocaleString())}
            </div>
            <table>
              <thead>
                <tr>
                  <th>신청순서</th>
                  <th>date</th>
                  <th>name</th>
                  <th>phone</th>
                  <th>목장 번호</th>
                  <th>총 인원</th>
                  <th>어른</th>
                  <th>자녀</th>
                  <th>미취학</th>
                  <th>note</th>
                  <th>updated_at</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length ? rowsHtml : `<tr><td colspan="11">해당 날짜에 신청자가 없습니다.</td></tr>`}
              </tbody>
            </table>
          </body>
        </html>`);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
      }, 150);
    } catch (e) {
      setStatus(`PDF 생성 실패: ${String(e)}`);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDate, isAdmin, adminQueryString]);

  useEffect(() => {
    if (isAdmin) return;
    const baseMonday = currentWeekMondayForMenus();
    const targetMonday = baseMonday;
    const dates = [0, 1, 2, 3, 4].map((i) => addDays(targetMonday, i));
    const from = dates[0]!;
    const to = dates[dates.length - 1]!;

    let cancelled = false;
    setWeekMenuLoading(true);
    setWeekMenuError("");

    (async () => {
      try {
        const res = await fetch(
          `/api/dinner-menus?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => null)) as
          | DinnerMenusRangeResponse
          | ErrorResponse
          | null;
        if (!res.ok) {
          throw new Error(
            (data as ErrorResponse | null)?.error?.message ?? `HTTP ${res.status}`,
          );
        }

        const rows = (data as DinnerMenusRangeResponse | null)?.rows ?? [];
        const results = rows
          .filter((r) => typeof r?.dinnerMenu === "string")
          .map((r) => ({
            date: r.date,
            dinnerMenu: fromBackendDinnerMenu(r.dinnerMenu),
          }));

        const byDate = new Map<string, string>();
        for (const r of results) {
          // 동일 날짜가 여러 번 오면 마지막 값을 사용
          byDate.set(r.date, r.dinnerMenu);
        }

        // 월~금 중 "오늘 이후(포함)" 날짜만 보이되,
        // 메뉴가 입력되지 않은 날짜는 섹션은 유지하고 문구만 표시
        const visibleDates = dates.filter((d) => d >= todayForMenus);
        const weekData = visibleDates
          .map((d) => ({
            date: d,
            dinnerMenu: byDate.get(d) ?? "",
          }))
          // 빈 메뉴도 날짜 섹션은 유지합니다.
          ;

        if (cancelled) return;
        setWeekMenus(weekData);

        // 선택 날짜가 이번에 렌더링되는 목록에 없으면, 첫 메뉴 날짜로 자동 선택
        setQueryDate((prev) => {
          if (weekData.some((w) => w.date === prev)) return prev;
          return weekData[0]?.date ?? prev;
        });
      } catch (e) {
        if (cancelled) return;
        setWeekMenuError(String(e));
        setWeekMenus([]);
      } finally {
        if (cancelled) return;
        setWeekMenuLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, todayForMenus]);

  useEffect(() => {
    if (!isAdmin) return;
    setMenuMsg("");
    // 관리자 모드 진입 시에만 기본값 동기화 (탭 이동은 유지)
    setMenuDate(queryDate);
  }, [isAdmin, queryDate]);

  async function fetchDinnerMenu(targetDate?: string) {
    const d = targetDate ?? menuDate;
    if (!d) return;
    setMenuLoading(true);
    setMenuMsg("");
    try {
      const res = await fetch(`/api/admin/dinner-menu?date=${encodeURIComponent(d)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMenuMsg(data?.error?.message ?? `조회 실패: ${res.status}`);
        return;
      }
      setDinnerMenu(
        fromBackendDinnerMenu(
          typeof data?.dinnerMenu === "string" ? data.dinnerMenu : "",
        ),
      );
      setMenuMsg(data?.updated_at ? `불러오기 완료 (updated ${data.updated_at})` : "불러오기 완료");
    } catch (e) {
      setMenuMsg(`조회 실패: ${String(e)}`);
    } finally {
      setMenuLoading(false);
    }
  }

  async function saveDinnerMenu() {
    if (!menuDate) return;
    setMenuLoading(true);
    setMenuMsg("");
    try {
      const res = await fetch(`/api/admin/dinner-menu`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: menuDate,
          dinnerMenu: toBackendDinnerMenu(dinnerMenu),
        }),
      });
      const raw = await res.text();
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      const payload =
        parsed && typeof parsed === "object"
          ? (parsed as {
              error?: { message?: string };
              dinnerMenu?: string;
            })
          : null;
      if (!res.ok) {
        const msg =
          payload?.error?.message ??
          (raw.trim()
            ? raw.trim().slice(0, 400)
            : `저장 실패: HTTP ${res.status}`);
        setMenuMsg(msg);
        return;
      }
      setDinnerMenu(
        fromBackendDinnerMenu(
          typeof payload?.dinnerMenu === "string"
            ? payload.dinnerMenu
            : dinnerMenu,
        ),
      );
      setMenuMsg("저장 완료");
    } catch (e) {
      setMenuMsg(`저장 실패: ${String(e)}`);
    } finally {
      setMenuLoading(false);
    }
  }

  useEffect(() => {
    // 입력이 바뀌면 이전 신청 메시지는 숨김
    setSubmitStatus("");
    setSubmitStatusTone("");
  }, [queryDate, name, phone, ranchNumber, adultCount, childCount, preschoolCount]);

  function openApplyModalForDate(date: string) {
    setQueryDate(date);
    setShowApplyModal(true);
    setSubmitStatus("");
    setSubmitStatusTone("");
  }

  function closeApplyModal() {
    setShowApplyModal(false);
  }

  function resetApplyForm() {
    setName("");
    setPhone("");
    setRanchNumber("");
    setAdultCount(0);
    setChildCount(0);
    setPreschoolCount(0);
    setNote("");
  }

  function confirmMyUpdateDone() {
    setShowMyUpdateDoneModal(false);
    setShowMyModal(false);
    setMyApp(null);
    setMyError(null);
    setMyNoteEdit("");
    setMyAdultCountEdit(0);
    setMyChildCountEdit(0);
    setMyPreschoolCountEdit(0);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitStatus("");
    setSubmitStatusTone("");

    try {
      const counts = normalizeMealCounts(
        { adultCount, childCount, preschoolCount },
        { maxPerField: 50, maxTotal: 50, requireTotalAtLeastOne: true },
      );

      const res = await fetch(`/api/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: queryDate,
          meal: "dinner",
          name,
          phone,
          ranchNumber: ranchNumber.trim(),
          adultCount: counts.adultCount,
          childCount: counts.childCount,
          preschoolCount: counts.preschoolCount,
          count: counts.total, // legacy 호환
          note: note || undefined,
        }),
      });

      const text = await res.text();

      if (res.status === 409) {
        setSubmitStatus("이미 신청되어있습니다.");
        setSubmitStatusTone("warning");
      } else if (!res.ok) {
        setSubmitStatus(`신청 실패: ${res.status} ${text}`);
        setSubmitStatusTone("error");
      } else {
        setSubmitStatus("신청 완료");
        setSubmitStatusTone("success");
        resetApplyForm();
        closeApplyModal();
      }

      await refresh();
    } catch (e) {
      setSubmitStatus(`신청 실패: ${String(e)}`);
      setSubmitStatusTone("error");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const t = setInterval(() => {
      setTodayForMenus(todayKST());
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  async function remove(id: number) {
    setRefreshing(true);
    setStatus("");

    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "DELETE",
      });

      if (res.status === 204) setStatus(`삭제 완료 (id=${id})`);
      else if (res.status === 404) setStatus(`이미 없는 항목입니다 (id=${id})`);
      else if (res.status === 401) {
        setIsAdmin(false);
        setStatus("관리자 인증이 필요합니다.");
      } else {
        const text = await res.text().catch(() => "");
        setStatus(`삭제 실패: ${res.status} ${text}`);
      }

      await refresh();
    } catch (e) {
      setStatus(`삭제 실패: ${String(e)}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function removeMine(id: number) {
    if (!confirm("이 신청을 삭제할까요?")) return;

    setMyLoading(true);
    setMyError(null);

    try {
      const res = await fetch(`/api/me/application/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhoneKR(myPhone) }),
      });

      const text = await res.text();

      if (!res.ok) {
        setMyError(`삭제 실패: ${res.status}\n${text}`);
        return;
      }

      // ✅ 1) 즉시 화면에서 사라지게
      setMyApp(null);
      setMyAdultCountEdit(0);
      setMyChildCountEdit(0);
      setMyPreschoolCountEdit(0);
      setMyNoteEdit("");

      // ✅ 2) 즉시 재조회해서 "없음" 확정
      await fetchMyApplication();

      // ✅ 3) 사용자 확인
      alert("삭제되었습니다.");
    } catch (e) {
      setMyError(`삭제 실패: ${String(e)}`);
    } finally {
      setMyLoading(false);
    }
  }

  async function adminLogin() {
    setAdminError(null);

    try {
      if ((adminIdInput ?? "").trim() !== ADMIN_ID) {
        setAdminError("아이디가 올바르지 않습니다.");
        return;
      }

      if (!adminPassword.trim()) {
        setAdminError("비밀번호를 입력하세요.");
        return;
      }

      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });

      const text = await res.text();

      if (!res.ok) {
        const msg = (() => {
          try {
            const j = JSON.parse(text);
            return j?.error?.message;
          } catch {
            return null;
          }
        })();
        setAdminError(msg ?? "관리자 인증 실패");
        return;
      }

      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPassword("");
      setAdminIdInput("");
      setAdminError(null);
      setStatus("관리자 인증 완료");
    } catch (e) {
      setAdminError(`관리자 인증 실패: ${String(e)}`);
    }
  }

  async function adminLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      setIsAdmin(false);
      setRows([]);
      setStatus("관리자 로그아웃");
    }
  }

  async function fetchMyApplication() {
    setMyLoading(true);
    setMyError(null);
    setMyApp(null);

    try {
      const res = await fetch("/api/me/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: myDate,
          name: normalizePersonName(myName),
          phone: normalizePhoneKR(myPhone),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMyError(data?.error?.message ?? "조회 실패");
        return;
      }

      const app = (data?.application ?? null) as MyApplication | null;

      setMyApp(app);
      setMyNoteEdit(app?.note ?? "");
      {
        const c = normalizeMealCounts(app ?? { count: 1 }, {
          maxPerField: 50,
          maxTotal: 50,
          requireTotalAtLeastOne: true,
        });
        setMyAdultCountEdit(c.adultCount);
        setMyChildCountEdit(c.childCount);
        setMyPreschoolCountEdit(c.preschoolCount);
      }

      if (!app) setMyError("해당 정보로 신청내역이 없습니다.");
    } catch (e) {
      setMyError(`조회 실패: ${String(e)}`);
    } finally {
      setMyLoading(false);
    }
  }

  async function updateMyApplication() {
    if (!myApp) return;

    setMyLoading(true);
    setMyError(null);

    try {
      const counts = normalizeMealCounts(
        {
          adultCount: myAdultCountEdit,
          childCount: myChildCountEdit,
          preschoolCount: myPreschoolCountEdit,
        },
        { maxPerField: 50, maxTotal: 50, requireTotalAtLeastOne: true },
      );

      const res = await fetch("/api/me/application/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: myDate,
          name: normalizePersonName(myName),
          phone: normalizePhoneKR(myPhone),
          note: myNoteEdit,
          adultCount: counts.adultCount,
          childCount: counts.childCount,
          preschoolCount: counts.preschoolCount,
          count: counts.total, // legacy 호환
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMyError(data?.error?.message ?? "수정 실패");
        return;
      }

      // 백엔드가 row를 그대로 반환한다고 가정 (PATCH 응답)
      setMyApp((prev) =>
        prev
          ? {
              ...prev,
              note: typeof data?.note === "string" ? data.note : myNoteEdit,
              adultCount:
                typeof data?.adultCount === "number"
                  ? data.adultCount
                  : counts.adultCount,
              childCount:
                typeof data?.childCount === "number"
                  ? data.childCount
                  : counts.childCount,
              preschoolCount:
                typeof data?.preschoolCount === "number"
                  ? data.preschoolCount
                  : counts.preschoolCount,
              count: typeof data?.count === "number" ? data.count : counts.total,
              updated_at:
                typeof data?.updated_at === "string"
                  ? data.updated_at
                  : prev.updated_at,
            }
          : prev,
      );

      setMyError(null);
      await refresh();
      // 수정 완료 팝업 표시 (확인 누르면 홈으로 이동)
      setShowMyUpdateDoneModal(true);
    } catch (e) {
      setMyError(`수정 실패: ${String(e)}`);
    } finally {
      setMyLoading(false);
    }
  }

  const weekRangeStart = currentWeekMondayForMenus();
  const weekRangeEnd = addDays(weekRangeStart, 4);

  return (
    <main className="page">
      <style jsx global>{`
        :root {
          color-scheme: light;
        }
        html,
        body {
          background:
            radial-gradient(circle at top left, #e0f2fe 0, #e5edff 40%, transparent 70%),
            radial-gradient(circle at bottom right, #fef3c7 0, #f9fafb 55%, #eef2ff 100%);
        }
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          background-image: url("/pjbc-silverware.png");
          background-repeat: no-repeat;
          background-position: 50% 10%;
          background-size: min(520px, 92vw) auto;
          opacity: 0.06;
          filter: grayscale(100%) contrast(110%);
          pointer-events: none;
          z-index: 0;
        }
        * {
          box-sizing: border-box;
        }
        .page {
          min-height: 100vh;
          min-height: 100dvh;
          padding-top: max(16px, env(safe-area-inset-top, 0px));
          padding-right: max(12px, env(safe-area-inset-right, 0px));
          padding-bottom: max(48px, env(safe-area-inset-bottom, 0px));
          padding-left: max(12px, env(safe-area-inset-left, 0px));
          font-family: var(--font-noto-sans-kr), "Noto Sans KR", ui-sans-serif, system-ui, -apple-system, sans-serif;
          color: #0f172a;
          position: relative;
          z-index: 1;
          overflow-x: hidden;
          width: 100%;
          max-width: 100vw;
        }
        @media (min-width: 640px) {
          .page {
            padding: max(40px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px))
              max(80px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
          }
        }
        .container {
          max-width: 1120px;
          margin: 0 auto;
          width: 100%;
        }
        .topbar {
          display: flex;
          gap: 16px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          padding: 10px 18px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 999px;
          border: 1px solid rgba(226, 232, 240, 0.85);
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(18px);
        }
        @media (max-width: 639px) {
          .topbar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 20px;
            margin-bottom: 20px;
          }
        }
        .titleWrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .title {
          margin: 0;
          font-size: 26px;
          letter-spacing: -0.03em;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        @media (max-width: 639px) {
          .title {
            font-size: 19px;
            gap: 8px;
            align-items: center;
          }
        }
        .logoWrap {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.9);
          border: none;
          box-shadow: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          flex: 0 0 auto;
          margin-top: 6px;
          padding: 0;
        }
        @media (max-width: 639px) {
          .logoWrap {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            margin-top: 0;
          }
        }
        .logoImg {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          display: block;
          filter: grayscale(100%) contrast(115%);
          opacity: 0.9;
          transform: scale(1.25);
          transform-origin: center;
        }
        .titleText {
          transform: none;
        }
        .titleTextCol {
          display: flex;
          flex-direction: column;
          gap: 2px;
          transform: translateX(2px);
        }
        .subtitleInline {
          font-size: 14px;
          color: #64748b;
          letter-spacing: -0.01em;
          line-height: 1.1;
          margin: 0;
          transform: translateY(-1px);
        }
        @media (max-width: 639px) {
          .subtitleInline {
            font-size: 11px;
          }
        }
        @media (max-width: 520px) {
          .subtitle {
            padding-left: 0;
          }
        }
        .actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        @media (max-width: 639px) {
          .actions {
            justify-content: stretch;
            width: 100%;
            gap: 6px;
          }
          .actions .btn {
            flex: 1 1 calc(33.333% - 4px);
            min-width: 0;
            height: 38px;
            padding: 0 6px;
            font-size: 12px;
            border-radius: 10px;
          }
          .actions .pill {
            flex: 1 1 100%;
            justify-content: center;
            margin: 0;
          }
          /* 관리자: 뱃지 아래 로그아웃 한 줄 전체 */
          .actions > .pill ~ .btn:only-of-type {
            flex: 1 1 100%;
          }
        }
        .hero {
          text-align: center;
          margin-bottom: 32px;
        }
        @media (max-width: 639px) {
          .hero {
            margin-bottom: 20px;
          }
        }
        .heroTitleRow {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 10px 14px;
          margin: 0 0 8px;
        }
        @media (max-width: 639px) {
          .heroTitleRow {
            flex-direction: column;
            gap: 8px;
          }
        }
        .heroTitle {
          margin: 0;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
        }
        @media (max-width: 639px) {
          .heroTitle {
            font-size: 22px;
            width: 100%;
          }
        }
        .heroWeekRange {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 999px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
        @media (max-width: 639px) {
          .heroWeekRange {
            font-size: 12px;
            padding: 5px 10px;
          }
        }
        .heroSub {
          margin: 0;
          font-size: 15px;
          color: #6b7280;
        }
        @media (max-width: 639px) {
          .heroSub {
            font-size: 13px;
            padding: 0 4px;
            line-height: 1.45;
          }
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          font-size: 12px;
          color: #334155;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 860px) {
          .grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .card {
          background: #ffffff;
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 16px;
          padding: 20px 20px 18px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(10px);
        }
        @media (max-width: 639px) {
          .card {
            padding: 16px 14px 14px;
            border-radius: 14px;
          }
        }
        .cardHeader {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .cardTitle {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .cardHint {
          font-size: 12px;
          color: #64748b;
        }
        .weekMenuOuter {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          margin: 0 auto;
          border-radius: 0;
          max-width: min(1120px, 100%);
          width: 100%;
        }
        .weekMenuHead {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          margin-bottom: 4px;
        }
        .weekMenuTitle {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }
        .weekMenuHint {
          margin: 0;
          font-size: 13px;
          color: #64748b;
        }
        .weekDayRows {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-top: 6px;
          align-items: stretch;
        }
        @media (max-width: 900px) {
          .weekDayRows {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        /* 휴대폰: 카드 한 줄 전체 너비(2~5열 압축 깨짐 방지) */
        @media (max-width: 639px) {
          .weekDayRows {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        .weekDayCard {
          background: #ffffff;
          border-radius: 18px;
          padding: 12px 12px 12px;
          box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .weekDayCardSelected {
          box-shadow: 0 18px 60px rgba(37, 99, 235, 0.2);
        }
        .weekDayCardHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .weekDayCardLeft {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1 1 auto;
        }
        .weekDayIcon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 15px;
          letter-spacing: -0.02em;
          flex: 0 0 auto;
        }
        .weekDayCardDate {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #0f172a;
          line-height: 1.25;
        }
        @media (min-width: 700px) {
          .weekDayCardDate {
            font-size: 13px;
          }
        }
        .weekStatusPill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid transparent;
          flex: 0 0 auto;
          white-space: nowrap;
          max-width: 100%;
        }
        .weekStatusOpen {
          background: #ecfeff;
          border-color: #a5f3fc;
          color: #155e75;
        }
        .weekStatusClosed {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #64748b;
        }

        .weekMenuLabel {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-weight: 900;
          font-size: 11px;
        }
        .weekMenuLabelBar {
          width: 4px;
          height: 12px;
          border-radius: 999px;
          background: #1d4ed8;
        }

        .weekMenuFrame {
          margin-top: 6px;
          padding: 10px 10px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          font-size: 13px;
          line-height: 1.45;
          white-space: pre-wrap;
          color: #334155;
          height: auto;
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1 1 auto;
          min-height: 72px;
          max-height: 140px;
        }
        @media (max-width: 639px) {
          .weekMenuFrame {
            max-height: 200px;
            min-height: 80px;
          }
          .weekDayCardDate {
            font-size: 13px;
          }
        }
        /* 메뉴 미등록 / 식사 없음 안내 (본문 메뉴와 시각적 구분) */
        .weekMenuPlaceholder {
          display: block;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          font-style: italic;
          line-height: 1.55;
          letter-spacing: -0.01em;
        }
        .weekCutoffRow {
          margin-top: 6px;
          font-size: 10px;
          color: #64748b;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          line-height: 1.3;
        }

        .weekDayActions {
          display: flex;
          justify-content: center;
          margin-top: auto;
          padding-top: 10px;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 520px) {
          .row2 {
            grid-template-columns: 1fr 1fr;
          }
          .row3 {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }
        label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          color: #334155;
        }
        input,
        select {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #fff;
          outline: none;
          font-size: 14px;
        }
        @media (max-width: 639px) {
          input,
          select,
          textarea {
            font-size: 16px;
          }
        }
        input:focus,
        select:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.25);
        }
        .btn {
          height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #0f172a;
          font-weight: 600;
          cursor: pointer;
          transition:
            transform 80ms ease,
            box-shadow 120ms ease,
            border-color 120ms ease;
        }
        .btn:hover {
          border-color: #cbd5e1;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
        }
        .btn:active {
          transform: translateY(1px);
        }
        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .btnPrimary {
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          border-color: #2563eb;
          color: #ffffff;
        }
        .btnDanger {
          background: #fff;
          border-color: #fecaca;
          color: #b91c1c;
        }
        .btnGhost {
          background: transparent;
        }
        .btnHeaderLight {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
        }
        .status {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          font-size: 13px;
          color: #334155;
          white-space: pre-wrap;
        }
        .alert {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 600;
          white-space: pre-wrap;
        }
        .alertSuccess {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #065f46;
        }
        .alertWarning {
          background: #fffbeb;
          border-color: #fde68a;
          color: #92400e;
        }
        .alertError {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }
        .tableWrap {
          overflow: auto;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          background: #fff;
        }
        th,
        td {
          padding: 10px 12px;
          border-bottom: 1px solid #eef2f7;
          text-align: left;
          white-space: nowrap;
        }
        th {
          font-size: 12px;
          color: #475569;
          background: #f8fafc;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        tr:hover td {
          background: #fbfdff;
        }
        .empty {
          text-align: center;
          padding: 18px;
          color: #64748b;
        }
        .modalBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
            max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
          z-index: 60;
        }
        @media (max-width: 639px) {
          .modalBackdrop {
            align-items: flex-end;
            padding: 0;
          }
        }
        .modal {
          width: 100%;
          max-width: 520px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          box-shadow: 0 20px 60px rgba(2, 6, 23, 0.35);
          padding: 16px;
          max-height: min(92vh, 92dvh);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 639px) {
          .modal {
            max-width: 100%;
            width: 100%;
            max-height: min(88dvh, 100vh);
            border-radius: 18px 18px 0 0;
            padding: 14px 14px max(18px, env(safe-area-inset-bottom, 0px));
          }
        }
        .modalTitle {
          margin: 0;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .modalSub {
          margin: 6px 0 0;
          font-size: 12px;
          color: #64748b;
        }
        .applyModalDateWrap {
          margin-top: 12px;
          margin-bottom: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
        }
        .applyModalDateMain {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #1d4ed8;
          margin: 0;
          line-height: 1.1;
          text-align: center;
        }
        @media (max-width: 639px) {
          .applyModalDateMain {
            font-size: 20px;
          }
        }
        .applyModalDateSub {
          margin-top: 8px;
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
          text-align: center;
        }
        .divider {
          height: 1px;
          background: #eef2f7;
          margin: 12px 0;
        }
        .applySection {
          margin-top: 12px;
          padding: 12px 12px 10px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .applySectionTitle {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: #475569;
        }
        .applyTotalRow {
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .labelWithReq {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .req {
          color: #ef4444;
          font-weight: 800;
          margin-left: 4px;
        }
        .menuFrame {
          margin-top: 8px;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: linear-gradient(180deg, #fafafa 0%, #f8fafc 100%);
          font-size: 14.5px;
          line-height: 1.6;
          white-space: pre-wrap;
          color: #334155;
          height: 152px;
          overflow-y: auto;
        }
        .menuFrame:focus {
          outline: none;
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.2);
        }
      `}</style>

      <div className="container">
        <header className="topbar">
          <div className="titleWrap">
            <h1 className="title">
              <span className="logoWrap">
                <Image
                  className="logoImg"
                  src="/pjbc-silverware.png"
                  alt="PJBC"
                  width={58}
                  height={58}
                  unoptimized
                />
              </span>
              <span className="titleTextCol">
                <span className="titleText">PJBC 식사신청</span>
                <span className="subtitleInline">PJBC Meal Order</span>
              </span>
            </h1>
          </div>

          <div className="actions">
            {isAdmin && <span className="pill">관리자 모드 ON</span>}
            {!isAdmin && (
              <button
                type="button"
                className="btn btnHeaderLight"
                onClick={() => {
                  setShowMyModal(true);
                  setMyDate(queryDate);
                  setMyError(null);
                  setMyApp(null);
                }}
              >
                신청내역
              </button>
            )}
            {!isAdmin && (
              <button
                type="button"
                className="btn btnHeaderLight"
                onClick={() => {
                  window.location.href = "/guide";
                }}
              >
                사용안내
              </button>
            )}

            {!isAdmin ? (
              <button
                type="button"
                className="btn btnHeaderLight"
                onClick={() => {
                  setShowAdminLogin(true);
                  setAdminError(null);
                  setAdminIdInput("");
                  setAdminPassword("");
                }}
              >
                관리자
              </button>
            ) : (
              <button type="button" className="btn" onClick={adminLogout}>
                로그아웃
              </button>
            )}
          </div>
        </header>

        <div className="hero">
          <div className="heroTitleRow">
            <h2 className="heroTitle">주간 식사 신청</h2>
            {!isAdmin && (
              <span className="heroWeekRange">
                {formatMonthDay(weekRangeStart)} ~ {formatMonthDay(weekRangeEnd)}
              </span>
            )}
          </div>
          <p className="heroSub">원하시는 요일의 식사를 간편하게 신청하세요.</p>
        </div>

        <div className="grid">
          {!isAdmin && (
            <section
              className="weekMenuOuter"
              style={{ gridColumn: "1 / -1" }}
            >
              <div className="weekMenuHead">
                <h2 className="weekMenuTitle">주간 저녁 메뉴</h2>
                <p className="weekMenuHint">(식사시간 18:30~19:30)</p>
              </div>

              {weekMenuError && (
                <div className="status">메뉴 조회 실패: {weekMenuError}</div>
              )}

              {!weekMenuError && weekMenus.length === 0 && (
                <div className="status">
                  {weekMenuLoading ? "불러오는 중…" : "등록된 저녁 메뉴가 없습니다."}
                </div>
              )}

              {weekMenus.length > 0 && (
                <div className="weekDayRows">
                  {weekMenus.map((m) => {
                    const day = weekdayLabel(m.date);
                    const open = isDinnerApplicationOpen(m.date);
                    const hasMenu = !isDinnerMenuEmptyForDisplay(m.dinnerMenu);
                    const openPossible = open && hasMenu;
                    const statusText = !hasMenu
                      ? "메뉴 없음"
                      : openPossible
                        ? "신청 가능"
                        : "마감";
                    return (
                      <div
                        key={m.date}
                        className={`weekDayCard ${
                          queryDate === m.date ? "weekDayCardSelected" : ""
                        }`}
                      >
                        <div className="weekDayCardHead">
                          <div className="weekDayCardLeft">
                            <div className="weekDayIcon">{day}</div>
                            <div className="weekDayCardDate">
                              {formatMonthDay(m.date)} ({day})
                            </div>
                          </div>

                          <span
                            className={`weekStatusPill ${
                              openPossible ? "weekStatusOpen" : "weekStatusClosed"
                            }`}
                          >
                            {statusText}
                          </span>
                        </div>

                        <div className="weekMenuLabel">
                          <span className="weekMenuLabelBar" />
                          메뉴
                        </div>

                        <div className="weekMenuFrame">
                          {!isDinnerMenuEmptyForDisplay(m.dinnerMenu) ? (
                            m.dinnerMenu
                          ) : (
                            <span className="weekMenuPlaceholder">
                              {m.date === todayForMenus
                                ? "당일은 식사가 없습니다"
                                : "메뉴가 아직 등록되지 않았거나\n당일은 식사가 없습니다"}
                            </span>
                          )}
                        </div>

                        <div className="weekCutoffRow">마감: {dinnerDeadlineLabel(m.date)}</div>

                        <div className="weekDayActions">
                          <button
                            type="button"
                            className="btn btnPrimary"
                            style={{ width: "100%" }}
                            disabled={!openPossible}
                            onClick={() => openApplyModalForDate(m.date)}
                          >
                            신청하기
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* 신청 모달 */}
        {showApplyModal && (
          <div className="modalBackdrop" onClick={closeApplyModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modalTitle"></h3>
              <p className="modalSub">
              
              </p>

              <div className="divider" />
              <div className="applyModalDateWrap">
                <div className="applyModalDateMain">
                  {queryDate ? `${formatMonthDay(queryDate)} (${weekdayLabel(queryDate)})` : ""}
                </div>
              </div>
              <div className="applySection">
                <div className="applySectionTitle">신청자 정보</div>

                <div className="row row2">
                  <label>
                    <span className="labelWithReq">
                      이름 <span className="req">*</span>
                    </span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="이름"
                    />
                  </label>

                  <label>
                    <span className="labelWithReq">
                      전화번호 <span className="req">*</span>
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010-1234-5678"
                      inputMode="tel"
                    />
                  </label>
                </div>

                <div className="row" style={{ marginTop: 10 }}>
                  <label>
                    <span className="labelWithReq">
                      목장 번호 <span className="req">*</span>
                      <span className="cardHint">(숫자만)</span>
                    </span>
                    <input
                      value={ranchNumber}
                      onChange={(e) => setRanchNumber(e.target.value)}
                      placeholder="예: 12"
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </div>

              <div className="applySection">
                <div className="applySectionTitle">인원 수</div>

                <div className="row row3">
                  <label>
                    어른 식사 수
                    <select
                      value={adultCount}
                      onChange={(e) =>
                        setAdultCount(Number(e.target.value))
                      }
                    >
                      {Array.from({ length: 21 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    자녀 식사 수
                    <select
                      value={childCount}
                      onChange={(e) =>
                        setChildCount(Number(e.target.value))
                      }
                    >
                      {Array.from({ length: 21 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    미취학 아동 식사 수
                    <select
                      value={preschoolCount}
                      onChange={(e) =>
                        setPreschoolCount(Number(e.target.value))
                      }
                    >
                      {Array.from({ length: 21 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="applyTotalRow">
                  <div className="pill" style={{ width: "fit-content" }}>
                    총 {submitCounts.total}명 (어른 {submitCounts.adultCount} · 자녀{" "}
                    {submitCounts.childCount} · 미취학{" "}
                    {submitCounts.preschoolCount})
                  </div>
                </div>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <label>
                  메모 (선택)
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="예: 늦게 도착합니다"
                  />
                </label>
              </div>

              <div className="row row2" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={submit}
                  disabled={!canSubmitApplication}
                >
                  {submitting ? "신청 중…" : "신청"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={closeApplyModal}
                >
                  닫기
                </button>
              </div>

              {submitStatus && (
                <div
                  className={[
                    "alert",
                    submitStatusTone === "success" ? "alertSuccess" : "",
                    submitStatusTone === "warning" ? "alertWarning" : "",
                    submitStatusTone === "error" ? "alertError" : "",
                  ].join(" ")}
                  role={submitStatusTone === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {submitStatus}
                </div>
              )}
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            <section className="card" style={{ marginTop: 12 }}>
              <div className="cardHeader">
                <h2 className="cardTitle">관리자</h2>
                <span className="cardHint">화면 전환</span>
              </div>

              <div className="row row2">
                <button
                  type="button"
                  className={`btn ${adminView === "menu" ? "btnPrimary" : ""}`}
                  onClick={() => setAdminView("menu")}
                >
                  저녁 메뉴
                </button>
                <button
                  type="button"
                  className={`btn ${adminView === "applications" ? "btnPrimary" : ""}`}
                  onClick={() => setAdminView("applications")}
                >
                  신청자 목록
                </button>
              </div>
            </section>

            {adminView === "menu" && (
            <section className="card" style={{ marginTop: 12 }}>
              <div className="cardHeader">
                <h2 className="cardTitle">저녁 메뉴</h2>
                <span className="cardHint">관리자 전용 · 날짜별 입력/수정</span>
              </div>

              <div className="row row2">
                <label>
                  날짜
                  <input
                    type="date"
                    value={menuDate}
                    onChange={(e) => setMenuDate(e.target.value)}
                  />
                </label>
                <div style={{ display: "grid", gap: 10, alignContent: "end" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => fetchDinnerMenu(menuDate)}
                    disabled={menuLoading || !menuDate}
                  >
                    {menuLoading ? "불러오는 중…" : "불러오기"}
                  </button>
                </div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <label style={{ display: "block", width: "100%" }}>
                  저녁 메뉴
                  <textarea
                    className="menuFrame"
                    value={dinnerMenu}
                    onChange={(e) => setDinnerMenu(e.target.value)}
                    placeholder={
                      "제육볶음\n계란국\n김치\n\n※ 비워 두고 저장하면 이용자 화면에 안내 문구만 표시됩니다."
                    }
                    rows={5}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      display: "block",
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={saveDinnerMenu}
                  disabled={menuLoading || !menuDate}
                >
                  {menuLoading ? "저장 중…" : "저장"}
                </button>

                {menuMsg && <div className="status">{menuMsg}</div>}
              </div>
            </section>
            )}

            {adminView === "applications" && (
            <section className="card" style={{ marginTop: 12 }}>
              <div className="cardHeader">
                <h2 className="cardTitle">신청자 목록</h2>
                <span className="cardHint">관리자 전용</span>
              </div>

              <div className="row row2">
                <label>
                  조회 날짜
                  <input
                    type="date"
                    value={queryDate}
                    onChange={(e) => setQueryDate(e.target.value)}
                  />
                </label>
                <div style={{ display: "grid", gap: 10, alignContent: "end" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={refresh}
                    disabled={refreshing}
                  >
                    {refreshing ? "조회 중…" : "새로고침"}
                  </button>
                </div>
              </div>

              {status && <div className="status">{status}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={exportApplicationsToPdf}
                  disabled={refreshing || rows.length === 0}
                >
                  PDF로 저장
                </button>
              </div>

              {rows.length > 0 && (
                <div className="pill" style={{ marginBottom: 12 }}>
                  어른 총합: {listTotals.adult}명 · 자녀 총합: {listTotals.child}명 · 미취학 아동 총합: {listTotals.preschool}명
                </div>
              )}

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                        <th>신청순서</th>
                    <th>date</th>
                    <th>name</th>
                    <th>phone</th>
                    <th>목장 번호</th>
                    <th>총 인원</th>
                    <th>어른</th>
                    <th>자녀</th>
                    <th>미취학</th>
                    <th>note</th>
                    <th>updated_at</th>
                    <th>action</th>
                  </tr>
                </thead>
                <tbody>
                      {orderedRows.map((r, idx) => (
                        <tr key={r.id}>
                          <td>{idx + 1}</td>
                      <td>{r.date}</td>
                      <td>{r.name}</td>
                      <td>{r.phone}</td>
                      <td>{r.ranchNumber ?? ""}</td>
                      <td>{totalFromRow(r)}</td>
                      <td>{normalizeMealCounts(r).adultCount}</td>
                      <td>{normalizeMealCounts(r).childCount}</td>
                      <td>{normalizeMealCounts(r).preschoolCount}</td>
                      <td>{r.note ?? ""}</td>
                      <td>{r.updated_at}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btnDanger"
                          onClick={() => remove(r.id)}
                          disabled={refreshing}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                    {rows.length === 0 && (
                    <tr>
                      <td colSpan={12} className="empty">
                        해당 날짜에 신청자가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </section>
            )}
          </>
        )}

        {/* 내 신청내역 모달 */}
        {showMyModal && (
          <div className="modalBackdrop" onClick={() => setShowMyModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modalTitle">내 신청내역</h3>
              <p className="modalSub">조회/수정/삭제 (식사: dinner)</p>

              <div className="divider" />

              <div className="row row2">
                <label>
                  날짜
                  <input
                    type="date"
                    value={myDate}
                    onChange={(e) => setMyDate(e.target.value)}
                  />
                </label>

                <label>
                  이름 <span className="req">*</span>
                  <input
                    type="text"
                    name="my-application-name"
                    autoComplete="name"
                    enterKeyHint="next"
                    value={myName}
                    onChange={(e) => setMyName(e.target.value)}
                    placeholder="이름"
                  />
                </label>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <label>
                  전화번호 <span className="req">*</span>
                  <input
                    type="tel"
                    name="my-application-phone"
                    autoComplete="tel"
                    enterKeyHint="search"
                    value={myPhone}
                    onChange={(e) => setMyPhone(e.target.value)}
                    placeholder="010-1234-5678 또는 +82 10…"
                    inputMode="tel"
                  />
                </label>
              </div>

              <div className="row row2" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={fetchMyApplication}
                  disabled={
                    myLoading ||
                    !myDate ||
                    !normalizePersonName(myName) ||
                    normalizePhoneKR(myPhone).length < 9
                  }
                >
                  {myLoading ? "조회 중…" : "조회"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowMyModal(false)}
                >
                  닫기
                </button>
              </div>

              {myError && <div className="status">{myError}</div>}

              {myApp && (
                <>
                  <div className="divider" />
                  <div className="applySection" style={{ marginTop: 0 }}>
                    <div className="applySectionTitle">정정 정보</div>

                    <div className="pill" style={{ width: "fit-content" }}>
                      {(() => {
                        const c = normalizeMealCounts(myApp, {
                          maxPerField: 50,
                          maxTotal: 50,
                          requireTotalAtLeastOne: true,
                        });
                        return (
                          <>
                            {myApp.date} · dinner · 총 {c.total}명 (어른{" "}
                            {c.adultCount} · 자녀 {c.childCount} · 미취학{" "}
                            {c.preschoolCount})
                          </>
                        );
                      })()}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color: "#334155",
                        fontWeight: 750,
                      }}
                    >
                      {myApp.name} / {myApp.phone}
                    </div>

                    {myApp.ranchNumber && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          color: "#334155",
                          fontWeight: 700,
                        }}
                      >
                        목장 번호: {myApp.ranchNumber}
                      </div>
                    )}
                  </div>

                  <div className="applySection">
                    <div className="applySectionTitle">인원 수 & 메모</div>

                    <div className="row row2">
                      <label>
                        어른 식사 수(수정)
                        <select
                          value={myAdultCountEdit}
                          onChange={(e) =>
                            setMyAdultCountEdit(Number(e.target.value))
                          }
                          disabled={!canEditMyApplication}
                        >
                          {Array.from({ length: 21 }, (_, i) => i).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label>
                        자녀 식사 수(수정)
                        <select
                          value={myChildCountEdit}
                          onChange={(e) =>
                            setMyChildCountEdit(Number(e.target.value))
                          }
                          disabled={!canEditMyApplication}
                        >
                          {Array.from({ length: 21 }, (_, i) => i).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>

                    <div className="row row2" style={{ marginTop: 10 }}>
                      <label>
                        미취학 아동 식사 수(수정)
                        <select
                          value={myPreschoolCountEdit}
                          onChange={(e) =>
                            setMyPreschoolCountEdit(Number(e.target.value))
                          }
                          disabled={!canEditMyApplication}
                        >
                          {Array.from({ length: 21 }, (_, i) => i).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label>
                        메모(수정)
                        <input
                          value={myNoteEdit}
                          onChange={(e) => setMyNoteEdit(e.target.value)}
                          placeholder="메모를 수정하세요"
                          disabled={!canEditMyApplication}
                        />
                      </label>
                    </div>

                    {!canEditMyApplication && (
                      <div
                        className="status"
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #bfdbfe",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontWeight: 850,
                          fontSize: 13,
                        }}
                      >
                        당일 18시 30분 이후에는 수정이 불가능합니다.
                      </div>
                    )}
                  </div>

                  <div className="row row2" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btnPrimary"
                      onClick={updateMyApplication}
                      disabled={myLoading || !canEditMyApplication}
                    >
                      수정 저장
                    </button>
                    <button
                      type="button"
                      className="btn btnDanger"
                      onClick={() => removeMine(myApp.id)}
                      disabled={myLoading}
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 수정 완료 팝업 */}
        {showMyUpdateDoneModal && (
          <div
            className="modalBackdrop"
            style={{ zIndex: 80 }}
            onClick={() => {}}
          >
            <div
              className="modal"
              style={{ maxWidth: 420 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="modalTitle">수정 완료</h3>
              <p className="modalSub">확인 누르면 메인 페이지로 이동합니다.</p>

              <div className="divider" />

              <div className="row row2" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={confirmMyUpdateDone}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 관리자 로그인 모달 */}
        {showAdminLogin && (
          <div
            className="modalBackdrop"
            style={{ zIndex: 70 }}
            onClick={() => setShowAdminLogin(false)}
          >
            <div
              className="modal"
              style={{ maxWidth: 420 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="modalTitle">관리자 인증</h3>
              <p className="modalSub"></p>

              <div className="divider" />

              <label>
                아이디
                <input
                  type="text"
                  placeholder="아이디"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  autoFocus
                />
              </label>

              <div style={{ height: 10 }} />

              <label>
                비밀번호
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </label>

              {adminError && <div className="status">{adminError}</div>}

              <div className="row row2" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={adminLogin}
                >
                  확인
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowAdminLogin(false)}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
