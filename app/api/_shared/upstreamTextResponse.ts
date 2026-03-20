import { NextResponse } from "next/server";

export function upstreamTextResponse(
  res: Response,
  bodyText: string,
  defaultContentType: string,
) {
  return new NextResponse(bodyText, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? defaultContentType,
    },
  });
}

export function upstreamNullResponse(status: number) {
  // 204/205 등 body 금지 상태를 그대로 전달하기 위함
  return new NextResponse(null, { status });
}

