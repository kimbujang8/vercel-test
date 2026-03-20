/**
 * 일부 백엔드는 dinnerMenu 빈 문자열을 거절합니다.
 * 저장 시 이 값으로 보내고, UI에서는 "메뉴 없음"과 동일하게 취급합니다.
 */
export const DINNER_MENU_EMPTY_SENTINEL = "__PJBC_NO_DINNER__";

export function isDinnerMenuEmptyForDisplay(v: string | null | undefined): boolean {
  const t = String(v ?? "").trim();
  return t.length === 0 || t === DINNER_MENU_EMPTY_SENTINEL;
}

/** 백엔드로 보낼 문자열 (빈 입력 → sentinel) */
export function toBackendDinnerMenu(text: string): string {
  return text.trim() === "" ? DINNER_MENU_EMPTY_SENTINEL : text;
}

/** 백엔드/저장소에서 온 값 → 관리자 입력란·표시용 (sentinel → 빈 문자열) */
export function fromBackendDinnerMenu(v: string | null | undefined): string {
  return isDinnerMenuEmptyForDisplay(v) ? "" : String(v);
}
