/**
 * menu.submission.integration.test.ts
 *
 * Integration tests for the complete menu submission flow:
 *   select a product → add to planned menu → submit for approval
 *
 * All DB interactions are mocked (no live database required).
 * Tests run with `npm test` via the same supertest + mocked-auth
 * pattern used in menu.routes.test.ts.
 *
 * Scenarios:
 *   1. Happy path        – date-based menu created → 201, status PENDING
 *   2. Duplicate guard   – existing non-rejected menu → 200, existing menu returned (idempotent)
 *   3. Window closed     – submission deadline passed → 400, no DB calls
 *   4. Unapproved product– product not APPROVED → 400
 *   5. Re-submission     – previously REJECTED menu → 200, revision_count++
 */

/* ================= MOCKS (hoisted before imports) ================= */

jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440009", role_name: "StoreAdmin" };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: [(_req: any, _res: any, next: any) => next()],
}));

jest.mock("../services/menuNotification.service", () => ({
  notifySubAdminsOfSubmission: jest.fn().mockResolvedValue(undefined),
  notifyStoreOfDecision: jest.fn().mockResolvedValue(undefined),
  notifyStoreAdminOfFinalRevision: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../config/sessionConnection", () => ({
  notifyPostgrestReload: jest.fn().mockResolvedValue("session"),
}));

/* ================= IMPORTS ================= */

import request from "supertest";
import express from "express";
import MenuRouter from "../routes/menu.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

/* ================= APP SETUP ================= */

const app = express();
app.use(express.json());
app.use("/api/menus", MenuRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= FIXTURES ================= */

const STORE_UUID   = "550e8400-e29b-41d4-a716-000000000001";
const SLOT_UUID    = "550e8400-e29b-41d4-a716-000000000002";
const PRODUCT_UUID = "550e8400-e29b-41d4-a716-000000000003";
const USER_UUID    = "550e8400-e29b-41d4-a716-446655440009";
const MENU_UUID    = "550e8400-e29b-41d4-a716-000000000004";

/**
 * A date 4 days from now — always inside the 7-day-open / 40-hour-close
 * submission window, regardless of when the test runs.
 */
const OPEN_DATE = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

/**
 * Yesterday — the 40-hour submission deadline fell two days ago,
 * so the window is always closed for this date.
 */
const CLOSED_DATE = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

/** Baseline request body shared by most tests. */
const BASE_PAYLOAD = {
  store_id: STORE_UUID,
  products: [{ product_id: PRODUCT_UUID }],
  time_slot_id: SLOT_UUID,
  date: OPEN_DATE,
  submitted_by: USER_UUID,
};

const MOCK_CREATED_MENU = {
  id: MENU_UUID,
  store_id: STORE_UUID,
  time_slot_id: SLOT_UUID,
  product_id: [PRODUCT_UUID],
  date: OPEN_DATE,
  weekday: null,
  status: "PENDING",
  revision_count: 0,
  submitted_by: USER_UUID,
  notes: null,
};

/**
 * Build a full chainable query mock where only `terminalMethod` resolves to
 * `value`; all other methods return the chain synchronously.
 */
function makeChain(value: object, terminalMethod: string) {
  const methods = [
    "select", "eq", "neq", "in", "or", "order",
    "limit", "update", "maybeSingle", "single", "is",
  ];
  const chain: any = {};
  methods.forEach((m) => {
    chain[m] = m === terminalMethod
      ? jest.fn().mockResolvedValue(value)
      : jest.fn().mockReturnValue(chain);
  });
  return chain;
}

/* ================= TESTS ================= */

describe("Menu Submission Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ─── 1. Happy path ─────────────────────────────────────────────────────── */
  it("creates a date-based menu in PENDING state (happy path)", async () => {
    /*
     * DB call order for a date-based create with no prior rejected/duplicate:
     *   1. products table  – approval-status filter  (terminal: .eq)
     *   2. menus table     – rejected-menu check     (terminal: .maybeSingle)
     *   3. menus table     – duplicate check         (terminal: .is)
     *   4. stores table    – store name lookup       (terminal: .single)
     *   5. time_slots table– slot name lookup        (terminal: .single)
     */
    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: [{ id: PRODUCT_UUID }], error: null }, "eq"))
      .mockReturnValueOnce(makeChain({ data: null, error: null }, "maybeSingle"))
      .mockReturnValueOnce(makeChain({ data: [], error: null }, "is"))
      .mockReturnValueOnce(makeChain({ data: { name: "Downtown Store" }, error: null }, "single"))
      .mockReturnValueOnce(makeChain({ data: { name: "Lunch Slot" }, error: null }, "single"));

    mockService.create.mockResolvedValue(MOCK_CREATED_MENU as any);

    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(MENU_UUID);
    expect(res.body.data.status).toBe("PENDING");
    expect(mockService.create).toHaveBeenCalledTimes(1);
  });

  /* ─── 2. Duplicate guard ─────────────────────────────────────────────────── */
  it("returns the existing PENDING menu (200) when a second identical POST is made", async () => {
    /*
     * Simulates the second POST in the flow: the duplicate check finds an
     * existing non-rejected menu and the controller returns it directly (200,
     * idempotent) without creating a second insert.
     *
     * DB call order: products check → rejected check → duplicate check (match found).
     */
    const EXISTING_MENU = {
      id: MENU_UUID,
      store_id: STORE_UUID,
      time_slot_id: SLOT_UUID,
      product_id: [PRODUCT_UUID],
      date: OPEN_DATE,
      weekday: null,
      status: "PENDING",
      revision_count: 0,
      submitted_by: USER_UUID,
      notes: null,
    };

    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: [{ id: PRODUCT_UUID }], error: null }, "eq"))
      .mockReturnValueOnce(makeChain({ data: null, error: null }, "maybeSingle"))
      .mockReturnValueOnce(makeChain({ data: [EXISTING_MENU], error: null }, "is"));

    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/already exists/i);
    expect(res.body.data.id).toBe(MENU_UUID);
    expect(res.body.data.status).toBe("PENDING");
    expect(mockService.create).not.toHaveBeenCalled();
  });

  /* ─── 3. Submission window closed ───────────────────────────────────────── */
  it("returns 400 when the submission window has already closed", async () => {
    /*
     * checkSubmissionWindow() is a pure function — the controller returns
     * immediately before touching the database.
     */
    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send({ ...BASE_PAYLOAD, date: CLOSED_DATE });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/submission window has closed/i);
    expect(res.body.data).toHaveProperty("opens_at");
    expect(res.body.data).toHaveProperty("closes_at");
    expect(DBconnection.from).not.toHaveBeenCalled();
  });

  /* ─── 4. Unapproved product ──────────────────────────────────────────────── */
  it("returns 400 when a product does not have APPROVED status", async () => {
    /*
     * DB call order: products check returns empty → no APPROVED products found.
     * Controller rejects with 400 before any menus queries.
     */
    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: [], error: null }, "eq"));

    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/approved status/i);
    expect(res.body.data.not_approved).toContain(PRODUCT_UUID);
    expect(mockService.create).not.toHaveBeenCalled();
  });

  /* ─── 5. Re-submission after rejection ──────────────────────────────────── */
  it("resets a rejected menu to PENDING and increments revision_count", async () => {
    /*
     * DB call order: products check → rejected check (match found).
     * Controller takes the re-submission branch: updateById → getStoreAndSlotNames.
     * No duplicate check or new insert is performed.
     */
    const REJECTED_MENU = {
      id: MENU_UUID,
      store_id: STORE_UUID,
      time_slot_id: SLOT_UUID,
      date: OPEN_DATE,
      weekday: null,
      status: "REJECTED",
      revision_count: 1,
      product_id: [PRODUCT_UUID],
      submitted_by: USER_UUID,
      rejected_at: "2026-04-20T10:00:00Z",
      rejected_by: "some-subadmin-uuid",
    };

    const RESUBMITTED_MENU = {
      ...REJECTED_MENU,
      status: "PENDING",
      revision_count: 2,
      rejected_at: null,
      rejected_by: null,
    };

    (DBconnection.from as jest.Mock)
      // 1. products check → approved
      .mockReturnValueOnce(makeChain({ data: [{ id: PRODUCT_UUID }], error: null }, "eq"))
      // 2. rejected-menu check → returns the REJECTED menu
      .mockReturnValueOnce(makeChain({ data: REJECTED_MENU, error: null }, "maybeSingle"))
      // 3. getStoreAndSlotNames – stores (for notification, awaited before response)
      .mockReturnValueOnce(makeChain({ data: { name: "Downtown Store" }, error: null }, "single"))
      // 4. getStoreAndSlotNames – time_slots
      .mockReturnValueOnce(makeChain({ data: { name: "Lunch Slot" }, error: null }, "single"));

    mockService.updateById.mockResolvedValue(RESUBMITTED_MENU as any);

    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/re-submitted/i);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.revision_count).toBe(2);

    expect(mockService.updateById).toHaveBeenCalledTimes(1);
    expect(mockService.updateById).toHaveBeenCalledWith(
      "menus",
      MENU_UUID,
      expect.objectContaining({
        status: "PENDING",
        revision_count: 2,
        rejected_at: null,
        rejected_by: null,
      })
    );
    expect(mockService.create).not.toHaveBeenCalled();
  });
});
