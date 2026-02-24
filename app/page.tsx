"use client";

import { useEffect, useMemo, useState } from "react";

type Meal = "dinner";

type ApplicationRow = {
  id: number;
  date: string; // YYYY-MM-DD
  meal: Meal;
  name: string;
  phone: string;
  count: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type SummaryResponse = {
  date: string;
  rows: Array<{ meal: string; total: number }>;
};

type MyApplication = {
  id: number;
  date: string;
  meal: Meal;
  name: string;
  phone: string;
  count: number;
  note: string;
  updated_at: string;
};

function todayKST(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sumCounts(list: Array<{ count?: number }>): number {
  return list.reduce(
    (acc, x) => acc + (typeof x.count === "number" ? x.count : 1),
    0,
  );
}

export default function Home() {
  const [queryDate, setQueryDate] = useState<string>(todayKST());

  // 관리자 모드
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);

  // 관리자 전용 목록
  const [rows, setRows] = useState<ApplicationRow[]>([]);

  // 총 인원(저녁) - count 합계
  const [dinnerTotal, setDinnerTotal] = useState<number>(0);

  // 상태 메시지
  const [status, setStatus] = useState<string>("");

  // 로딩 분리
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 신청 폼
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [count, setCount] = useState<number>(1);
  const [note, setNote] = useState<string>("");

  // 내 신청내역 모달
  const [showMyModal, setShowMyModal] = useState(false);
  const [myDate, setMyDate] = useState<string>(queryDate);
  const [myName, setMyName] = useState<string>("");
  const [myPhone, setMyPhone] = useState<string>("");
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState<string | null>(null);
  const [myApp, setMyApp] = useState<MyApplication | null>(null);
  const [myNoteEdit, setMyNoteEdit] = useState<string>("");
  const [myCountEdit, setMyCountEdit] = useState<number>(1);

  const adminQueryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("from", queryDate);
    sp.set("to", queryDate);
    sp.set("meal", "dinner");
    return sp.toString();
  }, [queryDate]);

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
          setDinnerTotal(0);
          setStatus("관리자 인증이 필요합니다.");
          return;
        }
        if (!res.ok) throw new Error(text);

        const list = JSON.parse(text) as ApplicationRow[];
        setRows(list);
        setDinnerTotal(sumCounts(list));
      } else {
        // 일반 사용자는 요약(합계)만 조회
        const res = await fetch(
          `/api/summary?date=${encodeURIComponent(queryDate)}`,
          {
            cache: "no-store",
          },
        );
        const text = await res.text();
        if (!res.ok) throw new Error(text);

        const data = JSON.parse(text) as SummaryResponse;
        const dinner = data.rows.find((r) => r.meal === "dinner");
        setDinnerTotal(dinner?.total ?? 0);
        setRows([]);
      }
    } catch (e) {
      setStatus(`조회 실패: ${String(e)}`);
      setRows([]);
      setDinnerTotal(0);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDate, isAdmin, adminQueryString]);

  async function submit() {
    setSubmitting(true);
    setStatus("");

    try {
      const res = await fetch(`/api/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: queryDate,
          meal: "dinner",
          name,
          phone,
          count,
          note: note || undefined,
        }),
      });

      const text = await res.text();

      if (res.status === 409) {
        setStatus("중복 신청입니다. (같은 날짜/저녁/전화번호)");
      } else if (!res.ok) {
        setStatus(`신청 실패: ${res.status} ${text}`);
      } else {
        setStatus("신청 완료");
        setName("");
        setPhone("");
        setCount(1);
        setNote("");
      }

      await refresh();
    } catch (e) {
      setStatus(`신청 실패: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

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
      const phoneNorm = myPhone.replace(/\D/g, "");

      const res = await fetch(`/api/me/application/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNorm }),
      });

      const text = await res.text();

      if (!res.ok) {
        setMyError(`삭제 실패: ${res.status}\n${text}`);
        return;
      }

      // ✅ 1) 즉시 화면에서 사라지게
      setMyApp(null);
      setMyCountEdit(1);
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
          name: myName,
          phone: myPhone,
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
      setMyCountEdit(app?.count ?? 1);

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
      const res = await fetch("/api/me/application/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: myDate,
          name: myName,
          phone: myPhone,
          note: myNoteEdit,
          count: myCountEdit,
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
              count: typeof data?.count === "number" ? data.count : myCountEdit,
              updated_at:
                typeof data?.updated_at === "string"
                  ? data.updated_at
                  : prev.updated_at,
            }
          : prev,
      );

      setMyError("수정 완료");
      await refresh();
    } catch (e) {
      setMyError(`수정 실패: ${String(e)}`);
    } finally {
      setMyLoading(false);
    }
  }

  return (
    <main className="page">
      <style jsx global>{`
        :root {
          color-scheme: light;
        }
        html,
        body {
          background: #fafafa;
        }
        * {
          box-sizing: border-box;
        }
        .page {
          min-height: 100vh;
          padding: 28px 16px 56px;
          font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            Segoe UI,
            Roboto,
            "Noto Sans KR",
            "Apple SD Gothic Neo",
            "Malgun Gothic",
            "Helvetica Neue",
            Arial,
            "Apple Color Emoji",
            "Segoe UI Emoji";
          color: #0f172a;
        }
        .container {
          max-width: 920px;
          margin: 0 auto;
        }
        .topbar {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .titleWrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .title {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.02em;
        }
        .subtitle {
          margin: 0;
          font-size: 13px;
          color: #64748b;
        }
        .actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
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
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
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
          background: #0f172a;
          border-color: #0f172a;
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
          padding: 16px;
          z-index: 60;
        }
        .modal {
          width: 100%;
          max-width: 520px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          box-shadow: 0 20px 60px rgba(2, 6, 23, 0.35);
          padding: 16px;
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
        .divider {
          height: 1px;
          background: #eef2f7;
          margin: 12px 0;
        }
      `}</style>

      <div className="container">
        <header className="topbar">
          <div className="titleWrap">
            <h1 className="title">저녁 식수 신청</h1>
            <p className="subtitle">
              날짜별 신청 · 내 신청내역 조회/수정/삭제 · 관리자 모드
            </p>
          </div>

          <div className="actions">
            {isAdmin && <span className="pill">관리자 모드 ON</span>}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowMyModal(true);
                setMyDate(queryDate);
                setMyError(null);
                setMyApp(null);
              }}
            >
              신청내역
            </button>

            {!isAdmin ? (
              <button
                type="button"
                className="btn btnGhost"
                onClick={() => setShowAdminLogin(true)}
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

        <div className="grid">
          <section className="card">
            <div className="cardHeader">
              <h2 className="cardTitle">날짜</h2>
              <span className="pill">저녁 총 {dinnerTotal}명</span>
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
          </section>

          <section className="card">
            <div className="cardHeader">
              <h2 className="cardTitle">신청</h2>
              <span className="cardHint">식사: dinner</span>
            </div>

            <div className="row row3">
              <label>
                인원
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                이름
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                />
              </label>

              <label>
                전화번호
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
                메모 (선택)
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="예: 늦게 도착합니다"
                />
              </label>

              <button
                type="button"
                className="btn btnPrimary"
                onClick={submit}
                disabled={
                  submitting || !name.trim() || !phone.trim() || !queryDate
                }
              >
                {submitting ? "신청 중…" : "신청"}
              </button>
            </div>
          </section>
        </div>

        {isAdmin && (
          <section className="card" style={{ marginTop: 12 }}>
            <div className="cardHeader">
              <h2 className="cardTitle">신청자 목록</h2>
              <span className="cardHint">관리자 전용</span>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>id</th>
                    <th>date</th>
                    <th>name</th>
                    <th>phone</th>
                    <th>count</th>
                    <th>note</th>
                    <th>updated_at</th>
                    <th>action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.date}</td>
                      <td>{r.name}</td>
                      <td>{r.phone}</td>
                      <td>{r.count}</td>
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
                      <td colSpan={8} className="empty">
                        해당 날짜에 신청자가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
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
                  이름
                  <input
                    value={myName}
                    onChange={(e) => setMyName(e.target.value)}
                    placeholder="이름"
                  />
                </label>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <label>
                  전화번호
                  <input
                    value={myPhone}
                    onChange={(e) => setMyPhone(e.target.value)}
                    placeholder="010-1234-5678"
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
                    myLoading || !myDate || !myName.trim() || !myPhone.trim()
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
                  <div className="pill" style={{ width: "fit-content" }}>
                    {myApp.date} · dinner · {myApp.count}명 · updated{" "}
                    {myApp.updated_at}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>
                    {myApp.name} / {myApp.phone}
                  </div>

                  <div className="row row2" style={{ marginTop: 12 }}>
                    <label>
                      인원(수정)
                      <select
                        value={myCountEdit}
                        onChange={(e) => setMyCountEdit(Number(e.target.value))}
                      >
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(
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
                      />
                    </label>
                  </div>

                  <div className="row row2" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btnPrimary"
                      onClick={updateMyApplication}
                      disabled={myLoading}
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
              <p className="modalSub">관리자 비밀번호를 입력하세요.</p>

              <div className="divider" />

              <label>
                비밀번호
                <input
                  type="password"
                  placeholder="관리자 비밀번호"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoFocus
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
