/**
 * 신청 조회/수정 시 모바일 IME·복사 붙여넣기로 인한 미세한 문자 차이 보정
 */

/** 이름: NFKC, 제로폭/다양한 공백 제거 후 비교용 */
export function normalizePersonName(input: string): string {
  return String(input ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\s\u00A0\u3000]+/g, " ")
    .trim();
}

/**
 * 한국 휴대전화: 숫자만 남기고 +82 → 0 접두, 선행 0 누락(10xxxxxxxx) 보정
 */
export function normalizePhoneKR(input: string): string {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length >= 10) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.length === 10 && digits.startsWith("10")) {
    digits = `0${digits}`;
  }
  return digits;
}
