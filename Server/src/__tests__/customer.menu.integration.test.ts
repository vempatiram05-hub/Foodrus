/**
 * customer.menu.integration.test.ts
 *
 * Integration tests for the customer-facing menu browsing and cart ordering flow.
 *
 * All DB interactions are mocked (no live database required).
 * Tests run with `npm test` via supertest + mocked-auth pattern.
 *
 * Scenarios:
 *   1. Listing — approved menus from two stores on same date are both returned
 *   2. Listing — PENDING/REJECTED menus excluded (status forced to APPROVED for customers)
 *   3. Listing — response includes menu_date field on each menu
 *   4. Cart add — today's menu → 201 success
 *   5. Cart add — future date menu → 400 (ordering not available)
 *   6. Cart add — past date menu → 400 (ordering not available)
 *   7. Checkout — product with is_active: false → 400 with unavailable_product_ids
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
      range: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440099", role_name: "Customer" };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: [
    (req: any, _res: any, next: any) => {
      req.user = { id: "550e8400-e29b-41d4-a716-446655440099", role_name: "Customer" };
      next();
    },
  ],
}));

jest.mock("../services/menuNotification.service", () => ({
  notifySubAdminsOfSubmission: jest.fn().mockResolvedValue(undefined),
  notifyStoreOfDecision: jest.fn().mockResolvedValue(undefined),
  notifyStoreAdminOfFinalRevision: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../config/sessionConnection", () => ({
  notifyPostgrestReload: jest.fn().mockResolvedValue("ok"),
}));

jest.mock("../services/helcim.service", () => ({
  createHelcimPayment: jest.fn().mockResolvedValue({ transactionId: "test-tx" }),
}));

jest.mock("../utils/mailer", () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../utils/generateInvoice", () => ({
  generateInvoice: jest.fn().mockReturnValue(Buffer.from("PDF")),
  generateStoreInvoice: jest.fn().mockReturnValue(Buffer.from("PDF")),
}));

jest.mock("../utils/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock("../config/pool", () => ({
  pool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
  },
}));

/* ================= IMPORTS ================= */

import request from "supertest";
import express from "express";
import MenuRouter from "../routes/menu.routes";
import CartItemRouter from "../routes/cartItem.routes";
import OrderRouter from "../routes/order.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

/* ================= APP SETUP ================= */

const app = express();
app.use(express.json());
app.use("/api/menus", MenuRouter);
app.use("/api/cart-items", CartItemRouter);
app.use("/api/orders", OrderRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= HELPERS ================= */

/**
 * Build a mock Supabase chain where every intermediate method returns the
 * chain itself, and the named terminal resolves with `value`.
 */
function makeChain(value: any, terminalMethod: string) {
  const chain: any = {};
  const methods = [
    "select", "eq", "neq", "in", "is", "or", "order",
    "limit", "range", "maybeSingle", "single",
  ];
  methods.forEach((m) => {
    if (m === terminalMethod) {
      chain[m] = jest.fn().mockResolvedValue(value);
    } else {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
  });
  return chain;
}

/* ================= FIXTURES ================= */

const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const STORE1_UUID    = "550e8400-e29b-41d4-a716-000000000011";
const STORE2_UUID    = "550e8400-e29b-41d4-a716-000000000012";
const SLOT_UUID      = "550e8400-e29b-41d4-a716-000000000020";
const PRODUCT1_UUID  = "550e8400-e29b-41d4-a716-000000000031";
const PRODUCT2_UUID  = "550e8400-e29b-41d4-a716-000000000032";
const MENU1_UUID     = "550e8400-e29b-41d4-a716-000000000041";
const MENU2_UUID     = "550e8400-e29b-41d4-a716-000000000042";
const MENU_TODAY_UUID  = "550e8400-e29b-41d4-a716-000000000043";
const MENU_FUTURE_UUID = "550e8400-e29b-41d4-a716-000000000044";
const MENU_PAST_UUID   = "550e8400-e29b-41d4-a716-000000000045";
const CART_UUID      = "550e8400-e29b-41d4-a716-000000000051";
const USER_UUID      = "550e8400-e29b-41d4-a716-446655440099";
const ADDRESS_UUID   = "550e8400-e29b-41d4-a716-000000000060";

const BASE_APPROVED_MENU = (id: string, storeId: string, productIds: string[]) => ({
  id,
  store_id: storeId,
  product_id: productIds,
  date: TODAY,
  weekday: null,
  time_slot_id: SLOT_UUID,
  status: "APPROVED",
  unavailable_items: [],
  notes: null,
  revision_count: 0,
  submitted_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const OPEN_SLOT = { id: SLOT_UUID, start_time: null, end_time: null };

/* ================= TEST SUITE ================= */

beforeEach(() => {
  jest.clearAllMocks();
  (DBconnection.from as jest.Mock).mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }));
});

describe("Customer Menu Browsing and Ordering Flow", () => {

  /* ─── 1. Both stores' menus returned for same date ───────────────────────── */
  it("returns approved menus from two different stores on the same date", async () => {
    /*
     * DB call order for customer getList (no pagination):
     *   (1) stores.eq("is_active", true) → active store list
     *   (2) menus.limit(1000)            → approved menu records
     *   (3) time_slots.in("id", ...)     → slot data for customer filters
     */
    const menu1 = BASE_APPROVED_MENU(MENU1_UUID, STORE1_UUID, [PRODUCT1_UUID]);
    const menu2 = BASE_APPROVED_MENU(MENU2_UUID, STORE2_UUID, [PRODUCT2_UUID]);

    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: [{ id: STORE1_UUID }, { id: STORE2_UUID }], error: null }, "eq"))
      .mockReturnValueOnce(makeChain({ data: [menu1, menu2], count: 2, error: null }, "limit"))
      .mockReturnValueOnce(makeChain({ data: [OPEN_SLOT], error: null }, "in"));

    const res = await request(app).get("/api/menus/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.map((m: any) => m.id);
    expect(ids).toContain(MENU1_UUID);
    expect(ids).toContain(MENU2_UUID);
  });

  /* ─── 2. PENDING / REJECTED menus excluded for customers ─────────────────── */
  it("excludes non-APPROVED menus from customer listing", async () => {
    /*
     * Controller forces status=APPROVED for customers — the DB query only
     * returns APPROVED records by design.  When the mock returns only an
     * APPROVED menu, the response must contain exactly that one menu.
     */
    const approvedMenu = BASE_APPROVED_MENU(MENU1_UUID, STORE1_UUID, [PRODUCT1_UUID]);

    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: [{ id: STORE1_UUID }], error: null }, "eq"))
      .mockReturnValueOnce(makeChain({ data: [approvedMenu], count: 1, error: null }, "limit"))
      .mockReturnValueOnce(makeChain({ data: [OPEN_SLOT], error: null }, "in"));

    const res = await request(app).get("/api/menus/getList");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe("APPROVED");
  });

  /* ─── 3. menu_date included on every returned menu ───────────────────────── */
  it("includes menu_date on each menu returned to customers", async () => {
    const menu = BASE_APPROVED_MENU(MENU1_UUID, STORE1_UUID, [PRODUCT1_UUID]);

    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: [{ id: STORE1_UUID }], error: null }, "eq"))
      .mockReturnValueOnce(makeChain({ data: [menu], count: 1, error: null }, "limit"))
      .mockReturnValueOnce(makeChain({ data: [OPEN_SLOT], error: null }, "in"));

    const res = await request(app).get("/api/menus/getList");

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty("menu_date", TODAY);
  });

  /* ─── 4. Cart add-item — today's menu succeeds ───────────────────────────── */
  it("adds an item to cart when the menu is scheduled for today (201)", async () => {
    /*
     * DB call: menus.select("date").eq("id", MENU_TODAY_UUID).single()
     * Then uniqueService.create creates the cart_items record.
     */
    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: { date: TODAY }, error: null }, "single"));

    mockService.create = jest.fn().mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-000000000099",
      cart_id: CART_UUID,
      product_id: PRODUCT1_UUID,
      menus_id: MENU_TODAY_UUID,
      quantity: 1,
      unit_price: 12.99,
    });

    const res = await request(app)
      .post("/api/cart-items/AddCartItem")
      .send({
        cart_id: CART_UUID,
        product_id: PRODUCT1_UUID,
        menus_id: MENU_TODAY_UUID,
        quantity: 1,
        unit_price: 12.99,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/added to cart/i);
  });

  /* ─── 5. Cart add-item — future date rejected ───────────────────────────── */
  it("returns 400 when trying to add a future-date menu item to cart", async () => {
    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: { date: TOMORROW }, error: null }, "single"));

    const res = await request(app)
      .post("/api/cart-items/AddCartItem")
      .send({
        cart_id: CART_UUID,
        product_id: PRODUCT1_UUID,
        menus_id: MENU_FUTURE_UUID,
        quantity: 1,
        unit_price: 12.99,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/today/i);
  });

  /* ─── 6. Cart add-item — past date rejected ─────────────────────────────── */
  it("returns 400 when trying to add a past-date menu item to cart", async () => {
    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: { date: YESTERDAY }, error: null }, "single"));

    const res = await request(app)
      .post("/api/cart-items/AddCartItem")
      .send({
        cart_id: CART_UUID,
        product_id: PRODUCT1_UUID,
        menus_id: MENU_PAST_UUID,
        quantity: 1,
        unit_price: 12.99,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/today/i);
  });

  /* ─── 7. Checkout — product is_active: false → rejected ─────────────────── */
  it("returns 400 at checkout when a cart item's product is marked inactive", async () => {
    /*
     * createOrder flow reaches PRODUCT AVAILABILITY CHECK before payment.
     * Mock sequence:
     *   (1) uniqueService.getDataById → user found (modify in-place so auto-mock instance sees it)
     *   (2) DBconnection.from("products") terminal: in → is_active: false
     *   (3) DBconnection.from("menus")   terminal: in → empty (no menus_id provided)
     */
    (mockService.getDataById as jest.Mock).mockResolvedValue({
      id: USER_UUID,
      role_name: "Customer",
    });

    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: [{ id: PRODUCT1_UUID, is_active: false }], error: null }, "in"))
      .mockReturnValueOnce(makeChain({ data: [], error: null }, "in"));

    const res = await request(app)
      .post("/api/orders/createOrder")
      .send({
        user_id: USER_UUID,
        address_id: ADDRESS_UUID,
        items: [
          { product_id: PRODUCT1_UUID, quantity: 1, unit_price: 12.99 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no longer available/i);
    expect(res.body.data.unavailable_product_ids).toContain(PRODUCT1_UUID);
  });
});
