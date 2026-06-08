const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

type StringParam = { ok: true; value: string | undefined } | { ok: false };

export function extractString(raw: unknown): StringParam {
  if (raw === undefined) return { ok: true, value: undefined };
  if (typeof raw === "string") return { ok: true, value: raw };
  return { ok: false };
}

const MAX_REGION_LENGTH = 100;

export interface FilterParams {
  from?: string;
  to?: string;
  region?: string;
}

export type FilterParseResult =
  | { ok: true; filters: FilterParams }
  | { ok: false; status: number; message: string };

export function parseFilterParams(query: Record<string, unknown>): FilterParseResult {
  const fromParam = extractString(query.from);
  const toParam = extractString(query.to);
  const regionParam = extractString(query.region);

  if (!fromParam.ok) {
    return { ok: false, status: 400, message: "Invalid 'from' parameter." };
  }
  if (!toParam.ok) {
    return { ok: false, status: 400, message: "Invalid 'to' parameter." };
  }
  if (!regionParam.ok) {
    return { ok: false, status: 400, message: "Invalid 'region' parameter." };
  }

  const from = fromParam.value;
  const to = toParam.value;
  const rawRegion = regionParam.value;

  if (from !== undefined && !isValidISODate(from)) {
    return {
      ok: false,
      status: 400,
      message: "Invalid 'from' date. Expected format: YYYY-MM-DD.",
    };
  }

  if (to !== undefined && !isValidISODate(to)) {
    return {
      ok: false,
      status: 400,
      message: "Invalid 'to' date. Expected format: YYYY-MM-DD.",
    };
  }

  const region =
    rawRegion !== undefined
      ? rawRegion.trim().slice(0, MAX_REGION_LENGTH)
      : undefined;

  return { ok: true, filters: { from, to, region } };
}
