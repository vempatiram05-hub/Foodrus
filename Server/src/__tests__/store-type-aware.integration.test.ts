/**
 * store-type-aware.integration.test.ts — scenarios 1–21
 *
 * All DB interactions are mocked — no live database required.
 * Category operations use a direct pg.Pool mock (globalThis.__staCatPoolMock).
 * All other entities (brands, products, subcategories) use UniqueService mock.
 */

declare global {
  var __staCatPoolMock: { query: jest.Mock; end: jest.Mock };
}

import "pg";

/* ================= MOCKS (hoisted before all imports) ================= */

// pg mock for CategoryController (uses direct SQL, bypasses PostgREST)
jest.mock("pg", () => {
  const pool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end:   jest.fn().mockResolvedValue(undefined),
  };
  globalThis.__staCatPoolMock = pool;
  return { Pool: jest.fn().mockImplementation(() => pool) };
});

jest.mock("../config/DBConnect", () => {
  let selectedFields = "";
  
  const queryExecutor = async (isSingle: boolean) => {
    try {
      if (selectedFields === "is_global" || selectedFields === "created_by" || selectedFields === "store_id") {
        return { data: [], error: null };
      }
      const res = await globalThis.__staCatPoolMock.query();
      const rows = res?.rows ?? [];
      if (isSingle) {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const chain: any = {
    select: jest.fn().mockImplementation((fields) => {
      selectedFields = typeof fields === "string" ? fields : "";
      return chain;
    }),
    eq:     jest.fn().mockReturnThis(),
    neq:    jest.fn().mockReturnThis(),
    in:     jest.fn().mockReturnThis(),
    is:     jest.fn().mockReturnThis(),
    or:     jest.fn().mockReturnThis(),
    ilike:  jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    range:  jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => queryExecutor(true)),
    maybeSingle: jest.fn().mockImplementation(() => queryExecutor(true)),
    then: jest.fn().mockImplementation((resolve) => {
      queryExecutor(false).then(resolve);
    }),
  };

  return {
    DBconnection: {
      from: jest.fn(() => chain),
    },
    initializePool: jest.fn().mockImplementation(() => {
      return {
        query: jest.fn().mockImplementation(async (...args: any[]) => {
          const res = await globalThis.__staCatPoolMock.query(...args);
          if (res && typeof res === "object" && "rows" in res) {
            return [res.rows];
          }
          if (Array.isArray(res)) {
            return res;
          }
          return [[]];
        })
      };
    }),
  };
});

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = {
      id: "550e8400-e29b-41d4-a716-000000000001",
      role_name: "SubAdmin",
      permissions: {
        Subcategories: {
          create: { allowed: true },
          edit:   { allowed: true },
          delete: { allowed: true },
          view:   { allowed: true },
          showInMenu: { allowed: true },
        },
        Brands: {
          create: { allowed: true },
          edit:   { allowed: true },
          delete: { allowed: true },
          view:   { allowed: true },
          showInMenu: { allowed: true },
        },
        Categories: {
          create: { allowed: true },
          edit:   { allowed: true },
          delete: { allowed: true },
          view:   { allowed: true },
          showInMenu: { allowed: true },
        },
        Products: {
          create: { allowed: true },
          edit:   { allowed: true },
          delete: { allowed: true },
          view:   { allowed: true },
          showInMenu: { allowed: true },
        },
      },
    };
    next();
  },
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) => {
    const user = req.user as any;
    if (!user?.permissions?.[module]?.[action]?.allowed) {
      return res.status(403).json({ success: false, message: `Forbidden: missing ${module}.${action}` });
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: [
    (req: any, _res: any, next: any) => {
      req.user = undefined;
      next();
    },
  ],
}));

jest.mock("../utils/localSignedUrl", () => ({
  generateLocalSignedUrl: (p: string) => p,
}));

jest.mock("../utils/file.util", () => ({
  generateImageName: (_name: string, orig: string, _ref: any) => orig,
}));

jest.mock("../utils/deleteFile", () => ({ deleteFile: jest.fn() }));

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (e: any) => (e instanceof Error ? e : new Error(String(e?.message || e))),
}));

/* ================= IMPORTS ================= */

import request from "supertest";
import express from "express";
import CategoryRouter      from "../routes/category.routes";
import { CategoryController } from "../controllers/category.controller";
import SubcategoryRouter   from "../routes/subcategory.routes";
import BrandRouter         from "../routes/brands.routes";
import ProductRouter       from "../routes/product.routes";
import { UniqueService }   from "../services/unique.service";
import { DBconnection }    from "../config/DBConnect";

/* ================= APP SETUP ================= */

const app = express();
app.use(express.json());
app.use("/api/categories",    CategoryRouter);
app.use("/api/subcategories", SubcategoryRouter);
app.use("/api/brands",        BrandRouter);
app.use("/api/products",      ProductRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= HELPERS ================= */

function catPool() {
  return globalThis.__staCatPoolMock;
}

function makeChain(value: any, terminalMethod: string) {
  const chain: any = {};
  const methods = [
    "select", "eq", "neq", "in", "is", "ilike", "order",
    "limit", "range", "maybeSingle", "single",
  ];
  methods.forEach(m => {
    chain[m] = m === terminalMethod
      ? jest.fn().mockResolvedValue(value)
      : jest.fn().mockReturnValue(chain);
  });
  return chain;
}

/* ================= FIXTURES ================= */

const RESTAURANT_STORE_ID = "550e8400-e29b-41d4-a716-000000000010";
const GROCERY_STORE_ID    = "550e8400-e29b-41d4-a716-000000000011";
const CATEGORY_ID_A       = "550e8400-e29b-41d4-a716-000000000020";
const CATEGORY_ID_B       = "550e8400-e29b-41d4-a716-000000000021";
const BRAND_ID            = "550e8400-e29b-41d4-a716-000000000030";
const PRODUCT_ID_REST     = "550e8400-e29b-41d4-a716-000000000040";
const PRODUCT_ID_GROC     = "550e8400-e29b-41d4-a716-000000000041";
const SUBCAT_ID           = "550e8400-e29b-41d4-a716-000000000050";

const RESTAURANT_STORE = { id: RESTAURANT_STORE_ID, type: "restaurant", is_active: true };
const GROCERY_STORE    = { id: GROCERY_STORE_ID,    type: "grocery",    is_active: true };

const APPROVED_PRODUCT_REST = {
  id: PRODUCT_ID_REST,
  store_id: RESTAURANT_STORE_ID,
  category_id: CATEGORY_ID_A,
  brand_id: null,
  name: "masala dosa",
  base_price: 8.5,
  is_active: true,
  approval_status: "APPROVED",
  images: [],
};

const APPROVED_PRODUCT_GROC = {
  id: PRODUCT_ID_GROC,
  store_id: GROCERY_STORE_ID,
  category_id: CATEGORY_ID_B,
  brand_id: BRAND_ID,
  name: "amul butter 100g",
  base_price: 3.0,
  is_active: true,
  approval_status: "APPROVED",
  images: [],
};

/* ================= SUITE ================= */

beforeEach(() => {
  jest.clearAllMocks();
  catPool().query.mockReset();

  // Restore pg pool default
  catPool().query.mockResolvedValue({ rows: [] });

  let selectedFields = "";
  const queryExecutor = async (isSingle: boolean) => {
    try {
      if (selectedFields === "is_global" || selectedFields === "created_by" || selectedFields === "store_id") {
        return { data: [], error: null };
      }
      const res = await globalThis.__staCatPoolMock.query();
      const rows = res?.rows ?? [];
      if (isSingle) {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const chain: any = {
    select: jest.fn().mockImplementation((fields) => {
      selectedFields = typeof fields === "string" ? fields : "";
      return chain;
    }),
    eq:     jest.fn().mockReturnThis(),
    neq:    jest.fn().mockReturnThis(),
    in:     jest.fn().mockReturnThis(),
    is:     jest.fn().mockReturnThis(),
    or:     jest.fn().mockReturnThis(),
    ilike:  jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    range:  jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => queryExecutor(true)),
    maybeSingle: jest.fn().mockImplementation(() => queryExecutor(true)),
    then: jest.fn().mockImplementation((resolve) => {
      queryExecutor(false).then(resolve);
    }),
  };

  (DBconnection.from as jest.Mock).mockImplementation(() => chain);
});

describe("Store-Type-Aware Product & Category Management", () => {

  /* ─── 1. Same name different stores — no conflict ────────────────────────── */
  it("allows the same category name in two different stores", async () => {
    // "dairy" exists in GROCERY_STORE_ID — dup check queries for RESTAURANT_STORE_ID → no match
    catPool().query
      .mockResolvedValueOnce({ rows: [] })  // SELECT id WHERE lower(name)=lower($1) AND store_id=$2 (RESTAURANT) → none
      .mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-000000000099", name: "dairy", store_id: RESTAURANT_STORE_ID }] });  // INSERT RETURNING *

    // Create "dairy" in the RESTAURANT store — different store, so no conflict
    const res = await request(app)
      .post("/api/categories/CreateCategory")
      .send({ name: "Dairy", store_id: RESTAURANT_STORE_ID });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ─── 2. Same name same store — rejected ────────────────────────────────── */
  it("rejects a duplicate category name within the same store (409)", async () => {
    // "dairy" already exists in GROCERY_STORE_ID — dup check finds it
    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: CATEGORY_ID_A }] });  // SELECT id WHERE lower(name)=lower($1) AND store_id=$2 → found

    const res = await request(app)
      .post("/api/categories/CreateCategory")
      .send({ name: "Dairy", store_id: GROCERY_STORE_ID });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  /* ─── 3. Brand without category_id/subcategory_id succeeds ──────────────── */
  it("creates a brand without category_id or subcategory_id (fields are nullable)", async () => {
    // Brand controller uses direct pg (dbPool) — same Pool instance as __staCatPoolMock
    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: GROCERY_STORE_ID, type: "grocery" }], rowCount: 1 }) // store check
      .mockResolvedValueOnce({ rows: [{ id: BRAND_ID, name: "fresh farms", store_id: GROCERY_STORE_ID, category_id: null, subcategory_id: null, is_active: true }], rowCount: 1 }); // INSERT

    const res = await request(app)
      .post("/api/brands/CreateBrand")
      .send({ name: "Fresh Farms", store_id: GROCERY_STORE_ID });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("fresh farms");
  });

  /* ─── 4. Brand for grocery store succeeds ───────────────────────────────── */
  it("allows brand creation for a grocery store (201)", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: GROCERY_STORE_ID, type: "grocery" }], rowCount: 1 }) // store check
      .mockResolvedValueOnce({ rows: [{ id: BRAND_ID, name: "amul", store_id: GROCERY_STORE_ID, is_active: true }], rowCount: 1 }); // INSERT

    const res = await request(app)
      .post("/api/brands/CreateBrand")
      .send({ name: "Amul", store_id: GROCERY_STORE_ID });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ─── 5. Brand for restaurant store is rejected ──────────────────────────── */
  it("rejects brand creation for a restaurant store (400)", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: RESTAURANT_STORE_ID, type: "restaurant" }], rowCount: 1 }); // store check → 400

    const res = await request(app)
      .post("/api/brands/CreateBrand")
      .send({ name: "Some Brand", store_id: RESTAURANT_STORE_ID });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/restaurant/i);
    expect(res.body.message).toMatch(/brand/i);
  });

  /* ─── 6. Brand without store_id is rejected ─────────────────────────────── */
  it("rejects brand creation when store_id is missing (400 from validator)", async () => {
    const res = await request(app)
      .post("/api/brands/CreateBrand")
      .send({ name: "No Store Brand" });

    // Zod validator rejects missing required store_id
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  /* ─── 7. type=food → restaurant-store products only ─────────────────────── */
  it("returns only restaurant-store products when type=food", async () => {
    /*
     * DB call order (no auth / Customer path):
     *   (1) stores.eq("is_active", true)  → active store IDs
     *   (2) stores.eq("type", "restaurant") → restaurant store IDs for type filter
     */
    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain(
        { data: [{ id: RESTAURANT_STORE_ID }, { id: GROCERY_STORE_ID }], error: null }, "eq"
      ))
      .mockReturnValueOnce(makeChain(
        { data: [{ id: RESTAURANT_STORE_ID }], error: null }, "eq"
      ));

    mockService.getAllData.mockResolvedValue([
      APPROVED_PRODUCT_REST,
      APPROVED_PRODUCT_GROC,
    ] as any);

    const res = await request(app).get("/api/products/getList?type=food");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.map((p: any) => p.id);
    expect(ids).toContain(PRODUCT_ID_REST);
    expect(ids).not.toContain(PRODUCT_ID_GROC);
  });

  /* ─── 8. type=grocery → grocery-store products only ─────────────────────── */
  it("returns only grocery-store products when type=grocery", async () => {
    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain(
        { data: [{ id: RESTAURANT_STORE_ID }, { id: GROCERY_STORE_ID }], error: null }, "eq"
      ))
      .mockReturnValueOnce(makeChain(
        { data: [{ id: GROCERY_STORE_ID }], error: null }, "eq"
      ));

    mockService.getAllData.mockResolvedValue([
      APPROVED_PRODUCT_REST,
      APPROVED_PRODUCT_GROC,
    ] as any);

    const res = await request(app).get("/api/products/getList?type=grocery");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((p: any) => p.id);
    expect(ids).toContain(PRODUCT_ID_GROC);
    expect(ids).not.toContain(PRODUCT_ID_REST);
  });

  /* ─── 9. Product create — restaurant + brand_id → rejected ──────────────── */
  it("rejects product creation with brand_id on a restaurant store (400)", async () => {
    /*
     * Controller call order:
     *   (1) category existence check → found
     *   (2) store type lookup → restaurant
     */
    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: CATEGORY_ID_A }], rowCount: 1 }) // category check → found
      .mockResolvedValueOnce({ rows: [RESTAURANT_STORE], rowCount: 1 }); // store check

    const res = await request(app)
      .post("/api/products/CreateProduct")
      .field("name", "Paneer Tikka")
      .field("store_id", RESTAURANT_STORE_ID)
      .field("category_id", CATEGORY_ID_A)
      .field("brand_id", BRAND_ID)
      .field("base_price", "12.00")
      .attach("images", Buffer.from("fake-image"), "img.jpg");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/restaurant/i);
    expect(res.body.message).toMatch(/brand/i);
  });

  /* ─── 10. Product create — grocery + brand_id → succeeds ────────────────── */
  it("allows product creation with brand_id on a grocery store (201)", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: CATEGORY_ID_B }], rowCount: 1 }) // category check → found
      .mockResolvedValueOnce({ rows: [GROCERY_STORE], rowCount: 1 }); // store check

    mockService.create.mockResolvedValue({ id: PRODUCT_ID_GROC, name: "amul butter 100g" } as any);
    mockService.updateById.mockResolvedValue({ id: PRODUCT_ID_GROC, name: "amul butter 100g", images: [] } as any);

    const res = await request(app)
      .post("/api/products/CreateProduct")
      .field("name", "Amul Butter 100g")
      .field("store_id", GROCERY_STORE_ID)
      .field("category_id", CATEGORY_ID_B)
      .field("brand_id", BRAND_ID)
      .field("base_price", "3.00")
      .attach("images", Buffer.from("fake-image"), "img.jpg");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ─── 11. Product update — adding brand_id to restaurant product rejected ── */
  it("rejects updating a restaurant product to include a brand_id (400)", async () => {
    /*
     * Controller call order:
     *   (1) uniqueService.getDataById(product_id) → existing restaurant product
     *   (2) DBconnection: store type lookup → maybeSingle → restaurant
     */
    mockService.getDataById.mockResolvedValue(APPROVED_PRODUCT_REST as any);

    catPool().query
      .mockResolvedValueOnce({ rows: [RESTAURANT_STORE], rowCount: 1 }); // store check

    const res = await request(app)
      .put(`/api/products/UpdateProductById/${PRODUCT_ID_REST}`)
      .send({ brand_id: BRAND_ID });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/restaurant/i);
    expect(res.body.message).toMatch(/brand/i);
  });

  /* ─── 11b. Product update — valid category_id passes check (200) ───────────── */
  it("updates a product with a valid category_id without returning Category-not-found (200)", async () => {
    /*
     * Validates the UPDATE path of the direct-pg category check (Task #214).
     * Controller call order:
     *   (1) uniqueService.getDataById(product_id) → existing product
     *   (2) dbPool.query: category existence check → found
     *   (3) no brand_id so getStoreType is skipped
     *   (4) uniqueService.updateById → updated product
     */
    mockService.getDataById.mockResolvedValue(APPROVED_PRODUCT_REST as any);

    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: CATEGORY_ID_A }], rowCount: 1 }); // category check → found

    mockService.updateById.mockResolvedValue({
      ...APPROVED_PRODUCT_REST,
      category_id: CATEGORY_ID_A,
      images: [],
    } as any);

    const res = await request(app)
      .put(`/api/products/UpdateProductById/${PRODUCT_ID_REST}`)
      .send({ category_id: CATEGORY_ID_A });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ─── 12. Product create — unknown category_id rejected ─────────────────── */
  it("rejects product creation when category_id does not exist (400)", async () => {
    const GHOST_CAT = "550e8400-e29b-41d4-a716-000000000099";

    // Category check uses dbPool.query; default catPool mock returns { rows: [] } → not found

    const res = await request(app)
      .post("/api/products/CreateProduct")
      .field("name", "Ghost Product")
      .field("store_id", GROCERY_STORE_ID)
      .field("category_id", GHOST_CAT)
      .field("base_price", "5.00")
      .attach("images", Buffer.from("fake-image"), "img.jpg");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/category not found/i);
  });

  /* ─── 13. Subcategory create — no token returns 401 ─────────────────────── */
  it("returns 401 when creating a subcategory without a Bearer token", async () => {
    /*
     * Build a mini-app that uses inline auth logic reproducing the real
     * authMiddleware behaviour (check for Bearer header, 401 if missing).
     * This avoids coupling to the hoisted mock.
     */
    const unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.post(
      "/api/subcategories/createSubcategory",
      (req: any, res: any, next: any) => {
        if (!req.headers.authorization?.startsWith("Bearer ")) {
          return res.status(401).json({ success: false, message: "Unauthorized: Token missing or malformed" });
        }
        next();
      },
    );

    const res = await request(unauthApp)
      .post("/api/subcategories/createSubcategory")
      .send({ name: "Breads", category_id: CATEGORY_ID_A });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/unauthorized/i);
  });

  /* ─── 14. Subcategory create — SubAdmin with permission succeeds ─────────── */
  it("allows a SubAdmin to create a subcategory (201)", async () => {
    // All three calls go through the shared pg.Pool mock (dbPool uses the same Pool instance)
    globalThis.__staCatPoolMock.query
      .mockResolvedValueOnce({ rows: [{ id: CATEGORY_ID_A }], rowCount: 1 })     // category check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                           // dup check
      .mockResolvedValueOnce({ rows: [{ id: SUBCAT_ID, category_id: CATEGORY_ID_A, name: "breads", images: [] }], rowCount: 1 }); // INSERT

    const res = await request(app)
      .post("/api/subcategories/createSubcategory")
      .send({ name: "Breads", category_id: CATEGORY_ID_A });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("breads");
  });

  /* ─── 15. getList returns all categories (store_id param no longer filters) ── */
  it("getList returns all categories regardless of store_id param (store_id removed from schema)", async () => {
    const catA = { id: "550e8400-e29b-41d4-a716-000000000060", name: "beverages",  images: [], is_active: true, type: "food" };
    const catB = { id: "550e8400-e29b-41d4-a716-000000000061", name: "sandwiches", images: [], is_active: true, type: "food" };
    const catC = { id: "550e8400-e29b-41d4-a716-000000000062", name: "produce",    images: [], is_active: true, type: "grocery" };

    catPool().query
      .mockResolvedValueOnce({ rows: [catA, catB, catC] });

    const res = await request(app)
      .get(`/api/categories/getList`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ─── 16. getList without store_id returns all categories ───────────────── */
  it("getList without store_id filter returns all categories (global + all stores)", async () => {
    const globalCat  = { id: "550e8400-e29b-41d4-a716-000000000060", name: "beverages",  store_id: null,               images: [], is_active: true, type: "food" };
    const storeCat   = { id: "550e8400-e29b-41d4-a716-000000000061", name: "sandwiches", store_id: RESTAURANT_STORE_ID, images: [], is_active: true, type: "food" };
    const otherCat   = { id: "550e8400-e29b-41d4-a716-000000000062", name: "produce",    store_id: GROCERY_STORE_ID,   images: [], is_active: true, type: "grocery" };

    catPool().query
      .mockResolvedValueOnce({ rows: [globalCat, storeCat, otherCat] });  // SELECT * FROM categories ORDER BY created_at DESC

    const res = await request(app).get("/api/categories/getList");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
  });

  /* ─── 17. Category creation — no store_id needed (201) ─────────────────── */
  it("SubAdmin creates a category (201, no store_id in response)", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [] })  // dup check: no existing name match → none
      .mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-000000000060", name: "beverages", is_active: true, type: "food", images: [] }] });  // INSERT RETURNING *

    const res = await request(app)
      .post("/api/categories/CreateCategory")
      .send({ name: "Beverages" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).not.toHaveProperty("store_id");
  });

  /* ─── 18. Duplicate category name — returned as 409 ────── */
  it("returns 409 conflict when category name already exists", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-000000000060" }] });  // existing name check → found

    const res = await request(app)
      .post("/api/categories/CreateCategory")
      .send({ name: "Beverages" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  /* ─── 19. Any authenticated role can create a category ──────────────────── */
  it("StoreAdmin with create permission can create a category (201)", async () => {
    const saApp = express();
    saApp.use(express.json());
    saApp.post(
      "/api/categories/CreateCategory",
      (req: any, _res: any, next: any) => {
        req.user = {
          id: "550e8400-e29b-41d4-a716-000000000099",
          role_name: "StoreAdmin",
          permissions: { Categories: { create: { allowed: true } } },
        };
        next();
      },
      CategoryController.create,
    );

    catPool().query
      .mockResolvedValueOnce({ rows: [] }) // duplicate check → not found
      .mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-000000000099", name: "global attempt", type: "food", images: [] }] }); // insert

    const res = await request(saApp)
      .post("/api/categories/CreateCategory")
      .send({ name: "Global Attempt" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ─── 20. getList type=food → only categories with type='food' ─────────── */
  it("returns only food-typed categories when type=food", async () => {
    // Filter uses the category's own `type` field — no store lookup needed.
    const foodCat    = { id: "550e8400-e29b-41d4-a716-000000000070", name: "curries",    type: "food",    store_id: null, images: [], is_active: true };
    const groceryCat = { id: "550e8400-e29b-41d4-a716-000000000071", name: "produce",    type: "grocery", store_id: null, images: [], is_active: true };
    const bakeryCat  = { id: "550e8400-e29b-41d4-a716-000000000072", name: "croissants", type: "bakery",  store_id: null, images: [], is_active: true };

    catPool().query
      .mockResolvedValueOnce({ rows: [foodCat, groceryCat, bakeryCat] });  // SELECT * FROM categories ORDER BY created_at DESC

    const res = await request(app).get("/api/categories/getList?type=food");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(foodCat.id);
    expect(ids).not.toContain(groceryCat.id);
    expect(ids).not.toContain(bakeryCat.id);
  });

  /* ─── 21. getList type=grocery → only categories with type='grocery' ────── */
  it("returns only grocery-typed categories when type=grocery", async () => {
    const foodCat    = { id: "550e8400-e29b-41d4-a716-000000000073", name: "curries",    type: "food",    store_id: null, images: [], is_active: true };
    const groceryCat = { id: "550e8400-e29b-41d4-a716-000000000074", name: "produce",    type: "grocery", store_id: null, images: [], is_active: true };
    const bakeryCat  = { id: "550e8400-e29b-41d4-a716-000000000075", name: "croissants", type: "bakery",  store_id: null, images: [], is_active: true };

    catPool().query
      .mockResolvedValueOnce({ rows: [foodCat, groceryCat, bakeryCat] });  // SELECT * FROM categories ORDER BY created_at DESC

    const res = await request(app).get("/api/categories/getList?type=grocery");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(groceryCat.id);
    expect(ids).not.toContain(foodCat.id);
    expect(ids).not.toContain(bakeryCat.id);
  });

});
