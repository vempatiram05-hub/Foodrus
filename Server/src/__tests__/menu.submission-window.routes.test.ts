/**
 * menu.submission-window.routes.test.ts
 *
 * Route-level (supertest) tests verifying that the menu controller enforces
 * the 7-day submission window for CreateMenus and UpdateMenu endpoints.
 *
 * Window rules:
 *   Opens  : 168 hours (7 days) before target midnight UTC
 *   Closes :  40 hours before target midnight UTC
 *
 * Coverage:
 *   CREATE – rejected when date is > 7 days away (window not open)
 *   CREATE – rejected when date is within 40 hours  (window closed)
 *   CREATE – accepted when called exactly at the 7-day open boundary
 *   UPDATE – rejected when menu date is outside window (within 40 h)
 *   UPDATE – accepted when called within the window (mid-window)
 */

/* ================= MOCKS ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "StoreAdmin" };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePermission: (_mod: string, _act: string) => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: [(_req: any, _res: any, next: any) => next()],
}));

jest.mock("../services/menuNotification.service", () => ({
  notifySubAdminsOfSubmission: jest.fn().mockResolvedValue(undefined),
  notifyStoreOfDecision: jest.fn().mockResolvedValue(undefined),
  notifyStoreAdminOfFinalRevision: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import express from "express";
import MenuRouter from "../routes/menu.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

const HOURS_MS = 60 * 60 * 1000;

const app = express();
app.use(express.json());
app.use("/api/menus", MenuRouter);

const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";

const mockService = jest.mocked(UniqueService.prototype);

/** Build a chainable Supabase query mock where `terminalMethod` resolves to `value`. */
function makeChain(value: object, terminalMethod = "single") {
  const methods = [
    "select", "eq", "neq", "in", "or", "order", "limit",
    "update", "maybeSingle", "single", "is", "range",
  ];
  const chain: any = {};
  methods.forEach((m) => {
    chain[m] =
      m === terminalMethod
        ? jest.fn().mockResolvedValue(value)
        : jest.fn().mockReturnValue(chain);
  });
  return chain;
}

const BASE_PAYLOAD = {
  store_id: TEST_UUID,
  products: [TEST_UUID],
  time_slot_id: TEST_UUID,
  submitted_by: TEST_UUID,
};

describe("Menu submission window – route enforcement (CreateMenus)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 400 when the date is more than 7 days away (window not open yet)", async () => {
    const targetStr = "2026-09-01";
    const targetMidnight = new Date("2026-09-01T00:00:00.000Z");
    // Set current time to 200 hours before target midnight (> 168 h → before opensAt)
    jest.setSystemTime(new Date(targetMidnight.getTime() - 200 * HOURS_MS));

    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send({ ...BASE_PAYLOAD, date: targetStr });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not opened yet/i);
  });

  it("returns 400 when the date is within 40 hours (window already closed)", async () => {
    const targetStr = "2026-09-01";
    const targetMidnight = new Date("2026-09-01T00:00:00.000Z");
    // Set current time to 20 hours before target midnight (< 40 h → after closesAt)
    jest.setSystemTime(new Date(targetMidnight.getTime() - 20 * HOURS_MS));

    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send({ ...BASE_PAYLOAD, date: targetStr });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/closed/i);
  });

  it("returns 201 when called exactly at the 7-day open boundary", async () => {
    const targetStr = "2026-09-01";
    const targetMidnight = new Date("2026-09-01T00:00:00.000Z");
    const opensAt = new Date(targetMidnight.getTime() - 168 * HOURS_MS);

    // Set current time exactly to the open boundary
    jest.setSystemTime(opensAt);

    (DBconnection.from as jest.Mock)
      // 1. Products approval check → all approved
      .mockReturnValueOnce(makeChain({ data: [{ id: TEST_UUID }], error: null }, "eq"))
      // 2. Rejected-menu check (re-submission path) → no rejected menu
      .mockReturnValueOnce(makeChain({ data: null, error: null }, "maybeSingle"))
      // 3. Duplicate-check → no existing non-rejected menu
      .mockReturnValueOnce(makeChain({ data: [], error: null }, "is"))
      // 4. getStoreAndSlotNames → store name
      .mockReturnValueOnce(makeChain({ data: { name: "TestStore" }, error: null }, "single"))
      // 5. getStoreAndSlotNames → slot name
      .mockReturnValueOnce(makeChain({ data: { name: "Lunch" }, error: null }, "single"));

    mockService.create.mockResolvedValue({
      id: TEST_UUID,
      status: "PENDING",
      store_id: TEST_UUID,
    } as any);

    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send({ ...BASE_PAYLOAD, date: targetStr });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });
});

describe("Menu submission window – route enforcement (UpdateMenu)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 400 when the menu date is within 40 hours (window already closed)", async () => {
    const targetStr = "2026-09-01";
    const targetMidnight = new Date("2026-09-01T00:00:00.000Z");
    // Set current time to 20 hours before target midnight (window closed)
    jest.setSystemTime(new Date(targetMidnight.getTime() - 20 * HOURS_MS));

    // getDataById returns a menu whose date is in the closed window
    mockService.getDataById.mockResolvedValue({
      id: TEST_UUID,
      status: "PENDING",
      date: targetStr,
    } as any);

    const res = await request(app)
      .put(`/api/menus/UpdateMenu/${TEST_UUID}`)
      .send({ notes: "Late update attempt" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/closed/i);
  });

  it("returns 200 when called within the window (mid-window)", async () => {
    const targetStr = "2026-09-01";
    const targetMidnight = new Date("2026-09-01T00:00:00.000Z");
    // Set current time to 100 hours before target midnight (within window)
    jest.setSystemTime(new Date(targetMidnight.getTime() - 100 * HOURS_MS));

    // getDataById returns a menu with the target date
    mockService.getDataById.mockResolvedValue({
      id: TEST_UUID,
      status: "PENDING",
      date: targetStr,
    } as any);

    mockService.updateById.mockResolvedValue({
      id: TEST_UUID,
      status: "PENDING",
      date: targetStr,
      notes: "Updated",
    } as any);

    const res = await request(app)
      .put(`/api/menus/UpdateMenu/${TEST_UUID}`)
      .send({ notes: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
