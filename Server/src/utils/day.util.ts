export const WEEKDAY_MAP: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export const REVERSE_WEEKDAY_MAP: Record<number, string> = Object.entries(WEEKDAY_MAP).reduce(
  (acc, [key, value]) => ({ ...acc, [value]: key }),
  {}
);

/**
 * Maps a string (case-insensitive) or integer weekday to its integer representation (0=Sunday ... 6=Saturday).
 * Returns undefined if invalid.
 */
export function mapToIntegerDay(day: string | number | undefined | null): number | undefined {
  if (day === undefined || day === null) return undefined;

  if (typeof day === "number") {
    if (day >= 0 && day <= 6) return day;
    return undefined;
  }

  const upperDay = day.trim().toUpperCase();
  if (upperDay in WEEKDAY_MAP) {
    return WEEKDAY_MAP[upperDay];
  }

  // Handle cases where the string might be a number string "1", "2"...
  const parsed = parseInt(upperDay, 10);
  if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) {
    return parsed;
  }

  return undefined;
}

/**
 * Maps an integer day back to its string representation (MONDAY, etc.).
 */
export function mapToStringDay(day: number | undefined | null): string | undefined {
  if (day === undefined || day === null) return undefined;
  return REVERSE_WEEKDAY_MAP[day];
}
