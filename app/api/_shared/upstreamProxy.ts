import { NextResponse } from "next/server";

const DEFAULT_TIMEOUT_MS = 25_000;

/** Vercel 등: 백엔드 fetch 대기 상한(ms). 미설정 시 25000 */
export function getUpstreamTimeoutMs(): number {
  const n = Number(process.env.UPSTREAM_FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120_000) : DEFAULT_TIMEOUT_MS;
}

/** `UPSTREAM_LOG=0` 이면 콘솔 로깅 비활성화 */
export function logUpstreamEvent(
  event: string,
  meta: Record<string, unknown>,
): void {
  if (process.env.UPSTREAM_LOG === "0") return;
  console.error(`[upstream] ${event}`, JSON.stringify(meta));
}

export type UpstreamFetchInit = Omit<RequestInit, "signal" | "cache"> & {
  /** `x-api-key` 헤더로 전달 */
  apiKey?: string;
  /** 이 호출만 다른 타임아웃(ms) */
  timeoutMs?: number;
};

/**
 * 백엔드로 나가는 fetch 공통: no-store, AbortController 타임아웃, 실패 시 로깅.
 * 타임아웃/네트워크 오류 시 Error throw (메시지에 URL 포함).
 */
export async function upstreamFetch(
  url: string,
  init: UpstreamFetchInit = {},
): Promise<Response> {
  const { apiKey, timeoutMs: explicitMs, ...rest } = init;
  const ms = explicitMs ?? getUpstreamTimeoutMs();

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ms);

  const headers = new Headers(rest.headers);
  if (apiKey) headers.set("x-api-key", apiKey);

  try {
    return await fetch(url, {
      ...rest,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    logUpstreamEvent(aborted ? "timeout" : "network_error", {
      url,
      timeoutMs: ms,
      detail: String(e),
    });
    if (aborted) {
      throw new Error(`Upstream timed out after ${ms}ms: ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

export function backendBaseWithFallback(): string {
  const v = process.env.BACKEND_URL ?? process.env.API_BASE;
  if (!v) throw new Error("BACKEND_URL(or API_BASE) not set");
  if (!/^https?:\/\//.test(v))
    throw new Error("BACKEND_URL/API_BASE must start with http:// or https://");
  return v.replace(/\/$/, "");
}

export async function fetchUpstreamText(args: {
  upstream: string;
  apiKey: string;
  defaultContentType: string;
}) {
  const { upstream, apiKey, defaultContentType } = args;
  const r = await upstreamFetch(upstream, {
    apiKey,
    redirect: "manual",
  });

  const contentType = r.headers.get("content-type") ?? defaultContentType;
  const text = await r.text();
  const isHtmlBlocked = text.includes("<html") || text.includes("Cloudflare");

  return {
    text,
    status: r.status,
    contentType,
    isHtmlBlocked,
  };
}

/**
 * upstreamFetch 실패 시 502 JSON 응답으로 변환 (라우트에서 `if (early) return early` 패턴용).
 */
export function upstreamFailureResponse(
  url: string,
  error: unknown,
): NextResponse {
  const message = String(error);
  logUpstreamEvent("route_upstream_failed", { url, message });
  return NextResponse.json(
    {
      error: {
        code: "UPSTREAM_FETCH_FAILED",
        message,
        upstream: url,
      },
    },
    { status: 502 },
  );
}
