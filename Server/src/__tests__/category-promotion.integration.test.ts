/**
 * category-promotion.integration.test.ts
 *
 * Unit/integration tests verifying the admin-ownership guard logic across
 * CategoryController and SubcategoryController.
 *
 * Covered scenarios
 * ─────────────────
 * CategoryController.create
 *   P-01  Name already exists → 200 with already_global: true (no insert)
 *   P-02  Name does not exist → 201 new category created
 *
 * CategoryController.update
 *   P-03  SubAdmin tries to update an admin-owned category → 403
 *   P-04  StoreAdmin tries to update an admin-owned category → 403
 *   P-05  Admin updates a category → 200 (allowed)
 *
 * CategoryController.delete
 *   P-06  SubAdmin tries to delete an admin-owned category → 403
 *   P-07  StoreAdmin tries to delete an admin-owned category → 403
 *   P-08  Admin deletes a category (no subcats) → 200
 *
 * SubcategoryController.update
 *   P-09  SubAdmin tries to update a subcategory whose parent is admin-owned → 403
 *   P-10  StoreAdmin tries to update a subcategory whose parent is admin-owned → 403
 *
 * SubcategoryController.delete
 *   P-11  SubAdmin tries to delete a subcategory whose parent is admin-owned → 403
 *   P-12  StoreAdmin tries to delete a subcategory whose parent is admin-owned → 403
 */

/* ==================== GLOBAL STATE ==================== */

declare global {
  var __promoDbQueue: Array<{ data: any; error?: any }>;
  var __promoCurrentUser: any;
}

/* ==================== MOCKS (hoisted before all imports) ==================== */

/**
 * Queue-based DBconnection mock.
 *
 * Each call to DBconnection.from() that ends with maybeSingle() or single()
 * pops the next entry from __promoDbQueue.  Entries that are not consumed by a
 * terminal method (e.g. detectCreatedByCol awaits .limit(1) directly) simply
 * resolve to the chainable proxy object without popping the queue.
 */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn((_table: string) => {
      const dequeue = () => {
        const entry = (globalThis.__promoDbQueue ?? []).shift();
        return Promise.resolve(entry ?? { data: null, error: null });
      };

      const chain: any = {
        select:      function() { return this; },
        eq:          function() { return this; },
        neq:         function() { return this; },
        in:          function() { return this; },
        is:          function() { return this; },
        not:         function() { return this; },
        ilike:       function() { return this; },
        order:       function() { return this; },
        limit:       function() { return this; },
        insert:      function() { return this; },
        update:      function() { return this; },
        delete:      function() { return this; },
        maybeSingle: function() { return dequeue(); },
        single:      function() { return dequeue(); },
      };
      return chain;
    }),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    if (globalThis.__promoCurrentUser) req.user = globalThis.__promoCurrentUser;
    next();
  },
  requirePermission: (_mod: string, _action: string) => (req: any, res: any, next: any) => {
    const user = req.user as any;
    const allowed = user?.permissions?.["Categories"]?.["create"]?.allowed
      || user?.permissions?.["Categories"]?.["edit"]?.allowed
      || user?.permissions?.["Categories"]?.["delete"]?.allowed
      || user?.permissions?.["Subcategories"]?.["edit"]?.allowed
      || user?.permissions?.["Subcategories"]?.["delete"]?.allowed;
    if (!allowed) return res.status(403).json({ success: false, message: "Forbidden" });
    next();
  },
  requireRole:             (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: [(_req: any, _res: any, next: any) => next()],
}));

jest.mock("../middleware/upload", () => ({
  memoryUploader: {
    array: jest.fn(() => (req: any, _res: any, next: any) => {
      req.files = [];
      next();
    }),
  },
}));

jest.mock("../utils/deleteFile",      () => ({ deleteFile: jest.fn() }));
jest.mock("../utils/localSignedUrl",  () => ({ generateLocalSignedUrl: (p: string) => p }));
jest.mock("../utils/file.util",       () => ({ generateImageName: () => "test.jpg" }));
jest.mock("../utils/supabaseError",   () => ({
  normalizeSupabaseError: (e: any) => e instanceof Error ? e : new Error(String(e?.message ?? e)),
}));
jest.mock("../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync:    jest.fn(() => true),
  mkdirSync:     jest.fn(),
  writeFileSync: jest.fn(),
}));

/* ==================== IMPORTS ==================== */

import request           from "supertest";
import express           from "express";
import CategoryRouter    from "../routes/category.routes";
import SubcategoryRouter from "../routes/subcategory.routes";

/* ==================== APP SETUP ==================== */

const catApp = express();
catApp.use(express.json());
catApp.use("/api/categories", CategoryRouter);

const subApp = express();
subApp.use(express.json());
subApp.use("/api/subcategories", SubcategoryRouter);

/* ==================== FIXTURES ==================== */

const ADMIN_ID       = "550e8400-e29b-41d4-a716-aaaaaaaaaaaa";
const SUBADMIN_ID    = "550e8400-e29b-41d4-a716-bbbbbbbbbbbb";
const STORE_ADMIN_ID = "550e8400-e29b-41d4-a716-cccccccccccc";
const CAT_ID         = "550e8400-e29b-41d4-a716-333333333333";
const SUB_ID         = "550e8400-e29b-41d4-a716-444444444444";

function makeCategory(overrides: Record<string, any> = {}) {
  return {
    id:          CAT_ID,
    name:        "pizza",
    description: null,
    is_active:   true,
    images:      JSON.stringify([]),
    type:        "food",
    created_by:  ADMIN_ID,
    created_at:  "2024-01-01T00:00:00.000Z",
    updated_at:  "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSubcategory(overrides: Record<string, any> = {}) {
  return {
    id:          SUB_ID,
    name:        "margherita",
    category_id: CAT_ID,
    description: null,
    is_active:   true,
    images:      JSON.stringify([]),
    created_by:  SUBADMIN_ID,
    created_at:  "2024-01-01T00:00:00.000Z",
    updated_at:  "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/* ==================== USER HELPERS ==================== */

const ALL_CAT_PERMS = {
  Categories:    { create: { allowed: true }, edit: { allowed: true }, delete: { allowed: true }, view: { allowed: true } },
  Subcategories: { create: { allowed: true }, edit: { allowed: true }, delete: { allowed: true }, view: { allowed: true } },
};

function asAdmin() {
  globalThis.__promoCurrentUser = { id: ADMIN_ID, role_name: "Admin", permissions: ALL_CAT_PERMS };
}
function asSubAdmin() {
  globalThis.__promoCurrentUser = { id: SUBADMIN_ID, role_name: "SubAdmin", permissions: ALL_CAT_PERMS };
}
function asStoreAdmin() {
  globalThis.__promoCurrentUser = { id: STORE_ADMIN_ID, role_name: "StoreAdmin", permissions: ALL_CAT_PERMS };
}

/* ==================== QUEUE HELPER ==================== */

function enqueue(...entries: Array<{ data: any; error?: any }>) {
  globalThis.__promoDbQueue = [...(globalThis.__promoDbQueue ?? []), ...entries];
}

const nil  = { data: null,      error: null };
const ok   = (data: any) => ({ data, error: null });

/* ==================== BEFORE EACH ==================== */

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.__promoDbQueue    = [];
  globalThis.__promoCurrentUser = null;
});

/* ================================================================
 * PART 1 — CategoryController.create
 * ================================================================ */

describe("CategoryController.create — name uniqueness", () => {

  /* P-01 ──────────────────────────────────────────────────────── */
  it("P-01: name already exists → 200 already_global: true (no insert)", async () => {
    asSubAdmin();
    const existingCat = makeCategory();
    enqueue(ok(existingCat)); // existing name check → found

    const res = await request(catApp)
      .post("/api/categories/CreateCategory")
      .send({ name: "pizza" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.already_global).toBe(true);
    expect(res.body.message).toMatch(/already a shared global/i);
  });

  /* P-02 ──────────────────────────────────────────────────────── */
  it("P-02: unique name → 201 new category created", async () => {
    asSubAdmin();
    const newCat = makeCategory({ name: "burgers" });
    enqueue(nil);        // existing name check → not found
    enqueue(ok(newCat)); // detectCreatedByCol: direct await → no dequeue; insert → single()

    const res = await request(catApp)
      .post("/api/categories/CreateCategory")
      .send({ name: "burgers" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/created/i);
  });

});

/* ================================================================
 * PART 2 — CategoryController.update (admin-owned guard)
 * ================================================================ */

describe("CategoryController.update — admin-owned category guard", () => {

  /* P-03 ──────────────────────────────────────────────────────── */
  it("P-03: SubAdmin tries to update an admin-owned category → 403", async () => {
    asSubAdmin();
    // fetch existing category (created_by: ADMIN_ID)
    enqueue(ok(makeCategory({ created_by: ADMIN_ID })));
    // isAdminOwned: user role lookup → Admin
    enqueue(ok({ role_name: "Admin" }));

    const res = await request(catApp)
      .put(`/api/categories/UpdateCategory/${CAT_ID}`)
      .send({ name: "updated pizza" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/global categories cannot be modified/i);
  });

  /* P-04 ──────────────────────────────────────────────────────── */
  it("P-04: StoreAdmin tries to update an admin-owned category → 403", async () => {
    asStoreAdmin();
    enqueue(ok(makeCategory({ created_by: ADMIN_ID })));
    enqueue(ok({ role_name: "Admin" }));

    const res = await request(catApp)
      .put(`/api/categories/UpdateCategory/${CAT_ID}`)
      .send({ name: "updated pizza" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/global categories cannot be modified/i);
  });

  /* P-05 ──────────────────────────────────────────────────────── */
  it("P-05: Admin updates a category → 200 (allowed)", async () => {
    asAdmin();
    const existing = makeCategory();
    const updated  = makeCategory({ name: "updated pizza" });

    enqueue(ok(existing)); // fetch existing
    enqueue(nil);          // dup check → no conflict
    enqueue(ok(updated));  // UPDATE → single

    const res = await request(catApp)
      .put(`/api/categories/UpdateCategory/${CAT_ID}`)
      .send({ name: "Updated Pizza" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

});

/* ================================================================
 * PART 3 — CategoryController.delete (admin-owned guard)
 * ================================================================ */

describe("CategoryController.delete — admin-owned category guard", () => {

  /* P-06 ──────────────────────────────────────────────────────── */
  it("P-06: SubAdmin tries to delete an admin-owned category → 403", async () => {
    asSubAdmin();
    enqueue(ok({ id: CAT_ID, images: [], created_by: ADMIN_ID }));
    enqueue(ok({ role_name: "Admin" }));

    const res = await request(catApp)
      .delete(`/api/categories/deleteCategory/${CAT_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/global categories cannot be modified/i);
  });

  /* P-07 ──────────────────────────────────────────────────────── */
  it("P-07: StoreAdmin tries to delete an admin-owned category → 403", async () => {
    asStoreAdmin();
    enqueue(ok({ id: CAT_ID, images: [], created_by: ADMIN_ID }));
    enqueue(ok({ role_name: "Admin" }));

    const res = await request(catApp)
      .delete(`/api/categories/deleteCategory/${CAT_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/global categories cannot be modified/i);
  });

  /* P-08 ──────────────────────────────────────────────────────── */
  it("P-08: Admin deletes a category with no subcategories → 200", async () => {
    asAdmin();
    // fetch existing — Admin bypasses guard (no isAdminOwned call)
    enqueue(ok({ id: CAT_ID, images: [], created_by: ADMIN_ID }));
    // subcategory count and delete are direct awaits — not dequeued

    const res = await request(catApp)
      .delete(`/api/categories/deleteCategory/${CAT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);
  });

});

/* ================================================================
 * PART 4 — SubcategoryController.update (admin-owned parent guard)
 * ================================================================ */

describe("SubcategoryController.update — admin-owned parent category guard", () => {

  /* P-09 ──────────────────────────────────────────────────────── */
  it("P-09: SubAdmin tries to update a subcategory whose parent is admin-owned → 403", async () => {
    asSubAdmin();
    // SubcategoryController.update:
    //   1. Fetch existing subcategory
    //   2. isCategoryAdminOwned → fetch categories.created_by → fetch users.role_name
    enqueue(ok(makeSubcategory({ category_id: CAT_ID }))); // fetch subcategory
    enqueue(ok({ created_by: ADMIN_ID }));                  // fetch category created_by
    enqueue(ok({ role_name: "Admin" }));                    // fetch user role → Admin → admin-owned

    const res = await request(subApp)
      .put(`/api/subcategories/updateSubcategory/${SUB_ID}`)
      .send({ name: "Updated Sub" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/global categories cannot be modified/i);
  });

  /* P-10 ──────────────────────────────────────────────────────── */
  it("P-10: StoreAdmin tries to update a subcategory whose parent is admin-owned → 403", async () => {
    asStoreAdmin();
    enqueue(ok(makeSubcategory({ category_id: CAT_ID })));
    enqueue(ok({ created_by: ADMIN_ID }));
    enqueue(ok({ role_name: "Admin" }));

    const res = await request(subApp)
      .put(`/api/subcategories/updateSubcategory/${SUB_ID}`)
      .send({ name: "Updated Sub" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/global categories cannot be modified/i);
  });

});

/* ================================================================
 * PART 5 — SubcategoryController.delete (admin-owned parent guard)
 * ================================================================ */

describe("SubcategoryController.delete — admin-owned parent category guard", () => {

  /* P-11 ──────────────────────────────────────────────────────── */
  it("P-11: SubAdmin tries to delete a subcategory whose parent is admin-owned → 403", async () => {
    asSubAdmin();
    // SubcategoryController.delete:
    //   1. Fetch existing subcategory
    //   2. isCategoryAdminOwned → fetch categories.created_by → fetch users.role_name
    enqueue(ok(makeSubcategory({ category_id: CAT_ID }))); // fetch subcategory
    enqueue(ok({ created_by: ADMIN_ID }));                  // fetch category created_by
    enqueue(ok({ role_name: "Admin" }));                    // fetch user role → Admin → admin-owned

    const res = await request(subApp)
      .delete(`/api/subcategories/deleteSubcategory/${SUB_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/global categories cannot be modified/i);
  });

  /* P-12 ──────────────────────────────────────────────────────── */
  it("P-12: StoreAdmin tries to delete a subcategory whose parent is admin-owned → 403", async () => {
    asStoreAdmin();
    enqueue(ok(makeSubcategory({ category_id: CAT_ID })));
    enqueue(ok({ created_by: ADMIN_ID }));
    enqueue(ok({ role_name: "Admin" }));

    const res = await request(subApp)
      .delete(`/api/subcategories/deleteSubcategory/${SUB_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/global categories cannot be modified/i);
  });

});
