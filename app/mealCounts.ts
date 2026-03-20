export type MealCounts = {
  adultCount: number;
  childCount: number;
  preschoolCount: number;
};

export type NormalizedMealCounts = MealCounts & {
  total: number;
};

function toInt(v: unknown): number | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return Math.trunc(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

function clampNonNegativeInt(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0;
  const i = Math.trunc(n);
  if (i < 0) return 0;
  if (i > max) return max;
  return i;
}

export function normalizeMealCounts(
  input: unknown,
  opts?: { maxPerField?: number; maxTotal?: number; requireTotalAtLeastOne?: boolean },
): NormalizedMealCounts {
  const maxPerField = opts?.maxPerField ?? 50;
  const maxTotal = opts?.maxTotal ?? 50;
  const requireTotalAtLeastOne = opts?.requireTotalAtLeastOne ?? false;

  const obj = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;

  const hasNew =
    obj.adultCount !== undefined ||
    obj.childCount !== undefined ||
    obj.preschoolCount !== undefined;

  let adult = 0;
  let child = 0;
  let preschool = 0;

  if (hasNew) {
    adult = clampNonNegativeInt(toInt(obj.adultCount) ?? 0, maxPerField);
    child = clampNonNegativeInt(toInt(obj.childCount) ?? 0, maxPerField);
    preschool = clampNonNegativeInt(toInt(obj.preschoolCount) ?? 0, maxPerField);
  } else {
    const legacy = clampNonNegativeInt(toInt(obj.count) ?? 1, maxTotal);
    adult = legacy;
    child = 0;
    preschool = 0;
  }

  let total = adult + child + preschool;
  if (total > maxTotal) {
    // 총합이 maxTotal을 넘으면 adult부터 줄여서 맞춤(최소한의 충돌)
    const overflow = total - maxTotal;
    adult = Math.max(0, adult - overflow);
    total = adult + child + preschool;
  }

  if (requireTotalAtLeastOne && total < 1) {
    adult = 1;
    total = adult + child + preschool;
  }

  return { adultCount: adult, childCount: child, preschoolCount: preschool, total };
}

export function totalFromRow(row: {
  adultCount?: unknown;
  childCount?: unknown;
  preschoolCount?: unknown;
  count?: unknown;
}): number {
  const hasNew =
    row.adultCount !== undefined ||
    row.childCount !== undefined ||
    row.preschoolCount !== undefined;
  if (hasNew) {
    const n = normalizeMealCounts(row, { requireTotalAtLeastOne: false });
    return n.total;
  }
  const c = toInt(row.count);
  return c && c > 0 ? c : 1;
}

