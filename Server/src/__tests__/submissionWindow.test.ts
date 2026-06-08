/**
 * submissionWindow.test.ts
 *
 * Unit tests for checkSubmissionWindow() boundary conditions.
 *
 * Window rules:
 *   Opens  : 168 hours (7 days) before target midnight UTC
 *   Closes :  40 hours before target midnight UTC
 *
 * Boundary cases tested:
 *   1. Exactly at the open boundary  → valid
 *   2. One millisecond before open   → invalid (not opened yet)
 *   3. More than 7 days before date  → invalid (not opened yet)
 *   4. Mid-window                    → valid
 *   5. Exactly at the close boundary → valid
 *   6. One millisecond after close   → invalid (window closed)
 *   7. Within 40 hours (well inside close) → invalid
 */

import { checkSubmissionWindow } from "../utils/submissionWindow";

const HOURS_MS = 60 * 60 * 1000;

describe("checkSubmissionWindow – boundary conditions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns valid=true when called exactly at the open boundary (7 days before target)", () => {
    const targetStr = "2026-05-01";
    const targetMidnight = new Date("2026-05-01T00:00:00.000Z");
    const opensAt = new Date(targetMidnight.getTime() - 168 * HOURS_MS);

    jest.setSystemTime(opensAt);

    const result = checkSubmissionWindow(targetStr);

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
    expect(result.opensAt.toISOString()).toBe(opensAt.toISOString());
    expect(result.closesAt.toISOString()).toBe(
      new Date(targetMidnight.getTime() - 40 * HOURS_MS).toISOString()
    );
  });

  it("returns valid=false one millisecond before the open boundary", () => {
    const targetStr = "2026-05-01";
    const targetMidnight = new Date("2026-05-01T00:00:00.000Z");
    const justBeforeOpen = new Date(targetMidnight.getTime() - 168 * HOURS_MS - 1);

    jest.setSystemTime(justBeforeOpen);

    const result = checkSubmissionWindow(targetStr);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/not opened yet/i);
  });

  it("returns valid=false when the date is more than 7 days away (window not open)", () => {
    const targetStr = "2026-05-10";
    const targetMidnight = new Date("2026-05-10T00:00:00.000Z");
    const wayTooEarly = new Date(targetMidnight.getTime() - 200 * HOURS_MS);

    jest.setSystemTime(wayTooEarly);

    const result = checkSubmissionWindow(targetStr);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/not opened yet/i);
  });

  it("returns valid=true when called mid-window (e.g. 100 hours before target)", () => {
    const targetStr = "2026-05-01";
    const targetMidnight = new Date("2026-05-01T00:00:00.000Z");
    const midWindow = new Date(targetMidnight.getTime() - 100 * HOURS_MS);

    jest.setSystemTime(midWindow);

    const result = checkSubmissionWindow(targetStr);

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("returns valid=true when called exactly at the close boundary (40 hours before target)", () => {
    const targetStr = "2026-05-01";
    const targetMidnight = new Date("2026-05-01T00:00:00.000Z");
    const closesAt = new Date(targetMidnight.getTime() - 40 * HOURS_MS);

    jest.setSystemTime(closesAt);

    const result = checkSubmissionWindow(targetStr);

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("returns valid=false one millisecond after the close boundary", () => {
    const targetStr = "2026-05-01";
    const targetMidnight = new Date("2026-05-01T00:00:00.000Z");
    const justAfterClose = new Date(targetMidnight.getTime() - 40 * HOURS_MS + 1);

    jest.setSystemTime(justAfterClose);

    const result = checkSubmissionWindow(targetStr);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/closed/i);
  });

  it("returns valid=false when the date is within 40 hours (window already closed)", () => {
    const targetStr = "2026-05-01";
    const targetMidnight = new Date("2026-05-01T00:00:00.000Z");
    const tooLate = new Date(targetMidnight.getTime() - 20 * HOURS_MS);

    jest.setSystemTime(tooLate);

    const result = checkSubmissionWindow(targetStr);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/closed/i);
  });

  it("includes the correct opensAt and closesAt timestamps in every result", () => {
    const targetStr = "2026-06-15";
    const targetMidnight = new Date("2026-06-15T00:00:00.000Z");
    const expectedOpensAt = new Date(targetMidnight.getTime() - 168 * HOURS_MS);
    const expectedClosesAt = new Date(targetMidnight.getTime() - 40 * HOURS_MS);

    jest.setSystemTime(new Date(targetMidnight.getTime() - 80 * HOURS_MS));

    const result = checkSubmissionWindow(targetStr);

    expect(result.opensAt.toISOString()).toBe(expectedOpensAt.toISOString());
    expect(result.closesAt.toISOString()).toBe(expectedClosesAt.toISOString());
  });
});
