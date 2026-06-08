
/**
 * Safely get a string query parameter from req.query
 * @param query - req.query object
 * @param key - the query key to fetch
 * @param defaultValue - value to return if key not found
 * @returns string
 */

/*Get a string query parameter safely, with type safety and edge case handling*/
export function getQueryString(
  query: Record<string, unknown>,
  key: string,
  defaultValue = ""
): string {
  const val = query[key];
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val) && typeof val[0] === "string") return val[0].trim();
  return defaultValue;
}

/**
 * Safely get a number query parameter from req.query
 * @param query - req.query object
 * @param key - the query key to fetch
 * @param defaultValue - value to return if key not found
 * @returns number
 */

/*Get a number query parameter safely, with type safety and edge case handling*/
export function getQueryNumber(
  query: Record<string, unknown>,
  key: string,
  defaultValue = 1
): number {
  const val = query[key];
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const parsed = Number.parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  if (Array.isArray(val) && typeof val[0] === "string") {
    const parsed = Number.parseInt(val[0], 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}
