/**
 * Submission window rules:
 *   - Opens: 7 days (168 hours) before the target date (at midnight UTC)
 *   - Closes: 40 hours before the target date (at midnight UTC)
 */

export interface WindowCheck {
  valid: boolean;
  opensAt: Date;
  closesAt: Date;
  message?: string;
}

export function checkSubmissionWindow(targetDateStr: string): WindowCheck {
  const targetMidnight = new Date(`${targetDateStr}T00:00:00.000Z`);

  const opensAt = new Date(targetMidnight.getTime() - 168 * 60 * 60 * 1000);
  const closesAt = new Date(targetMidnight.getTime() - 40 * 60 * 60 * 1000);
  const now = new Date();

  const valid = now >= opensAt && now <= closesAt;

  if (!valid) {
    const msg =
      now < opensAt
        ? `Submission window has not opened yet. It opens at ${opensAt.toISOString()} (7 days before target date).`
        : `Submission window has closed. It closed at ${closesAt.toISOString()} (40 hours before target date).`;
    return { valid: false, opensAt, closesAt, message: msg };
  }

  return { valid: true, opensAt, closesAt };
}

export function autoRejectDeadline(targetDateStr: string): Date {
  const targetMidnight = new Date(`${targetDateStr}T00:00:00.000Z`);
  return new Date(targetMidnight.getTime() - 40 * 60 * 60 * 1000);
}

