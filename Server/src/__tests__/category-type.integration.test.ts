/**
 * category-type.integration.test.ts — scenarios 22–37
 *
 * Covers the `type` field across create/update/getById/getList.
 * CategoryController now uses direct pg.Pool; tests drive it through a
 * mocked pool exposed on globalThis.__categoryPoolMock.
 */

declare global {
  var __categoryPoolMock: { query: jest.Mock; end: jest.Mock };
}

/* ==================== MOCKS (hoisted before all imports) ==================== */

jest.mock("pg", () => {
  const pool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end:   jest.fn().mockResolvedValue(undefined),
  };
  globalThis.__categoryPoolMock = pool;
  return { Pool: jest.fn().mockImplementation(() => pool) };
});

import "pg";

jest.mock("../config/DBConnect", () => {
  let selectedFields = "";
  const queryExecutor = async (isSingle: boolean) => {
    try {
      if (selectedFields === "is_global" || selectedFields === "created_by") {
        return { data: [], error: null };
      }
      const res = await globalThis.__categoryPoolMock.query();
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
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
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
      rpc: jest.fn(),
    },
  };
});

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = {
      id:        "550e8400-e29b-41d4-a716-000000000001",
      role_name: "SubAdmin",
      permissions: {
        Categories: {
          create:     { allowed: true },
          edit:       { allowed: true },
          delete:     { allowed: true },
          view:       { allowed: true },
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
  requireRole:             (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: [(_req: any, _res: any, next: any) => next()],
}));

jest.mock("../utils/localSignedUrl", () => ({
  generateLocalSignedUrl: (p: string) => p,
}));

jest.mock("../utils/file.util", () => ({
  generateImageName: (_name: string, orig: string, _ref: any) => orig,
}));

jest.mock("../utils/deleteFile", () => ({ deleteFile: jest.fn() }));

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (e: any) =>
    e instanceof Error ? e : new Error(String(e?.message ?? e)),
}));

/* ==================== IMPORTS ==================== */

import request        from "supertest";
import express        from "express";
import CategoryRouter from "../routes/category.routes";

/* ==================== APP SETUP ==================== */

const app = express();
app.use(express.json());
app.use("/api/categories", CategoryRouter);

/* ==================== HELPERS ==================== */

function catPool() {
  return globalThis.__categoryPoolMock;
}

/* ==================== FIXTURES ==================== */

const CAT_ID_1  = "550e8400-e29b-41d4-a716-100000000001";
const STORE_ID  = "550e8400-e29b-41d4-a716-100000000010";

function makeCategory(overrides: Record<string, any> = {}) {
  return {
    id:          CAT_ID_1,
    name:        "test category",
    description: null,
    store_id:    null,
    is_active:   true,
    images:      [],
    type:        "food",
    created_at:  "2024-01-01T00:00:00.000Z",
    updated_at:  "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/* ==================== BEFORE EACH ==================== */

beforeEach(() => {
  jest.clearAllMocks();
  // Restore the default fallback: any unmocked query returns empty rows.
  catPool().query.mockResolvedValue({ rows: [] });
});

/* ==================== TESTS ==================== */

describe("Category type field — full integration coverage", () => {

  /* ── CREATE ────────────────────────────────────────────────────────────── */

  describe("POST /api/categories/CreateCategory — type field", () => {

    /* 22 */
    it("22: type='food' → 201 with response.data.type === 'food'", async () => {
      catPool().query
        .mockResolvedValueOnce({ rows: [] })                                      // dup check: no conflict
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] });      // INSERT RETURNING *

      const res = await request(app)
        .post("/api/categories/CreateCategory")
        .send({ name: "Curries", type: "food" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("food");
    });

    /* 23 */
    it("23: type='grocery' → 201 with response.data.type === 'grocery'", async () => {
      catPool().query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "grocery" })] });

      const res = await request(app)
        .post("/api/categories/CreateCategory")
        .send({ name: "Produce", type: "grocery" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("grocery");
    });

    /* 24 */
    it("24: no type in body → 201 with response.data.type === 'food' (default)", async () => {
      catPool().query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] });

      const res = await request(app)
        .post("/api/categories/CreateCategory")
        .send({ name: "Beverages" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("food");
    });

    /* 25 */
    it("25: type='invalid' → 400 (validator rejects unknown enum value)", async () => {
      const res = await request(app)
        .post("/api/categories/CreateCategory")
        .send({ name: "Bad Type", type: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    /* 26 — PGRST204 resilience: DB mock returns object WITHOUT type field */
    it("26: DB mock omits type field → response.data.type still equals resolvedType (PGRST204 resilience)", async () => {
      const categoryWithoutType: any = makeCategory();
      delete categoryWithoutType.type;

      catPool().query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [categoryWithoutType] });

      const res = await request(app)
        .post("/api/categories/CreateCategory")
        .send({ name: "Snacks", type: "food" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Controller always merges resolvedType even if DB row omitted it
      expect(res.body.data.type).toBe("food");
    });

  });

  /* ── UPDATE ────────────────────────────────────────────────────────────── */

  describe("PUT /api/categories/UpdateCategory/:id — type field", () => {

    /* 27 */
    it("27: type='food' on a category currently 'food' → 200, type === 'food'", async () => {
      catPool().query
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] })     // GET existing
        .mockResolvedValueOnce({ rows: [] })                                   // dup check: no conflict
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] });   // UPDATE RETURNING *

      const res = await request(app)
        .put(`/api/categories/UpdateCategory/${CAT_ID_1}`)
        .send({ name: "Test Category", type: "food" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("food");
    });

    /* 28 */
    it("28: type='grocery' → 200, response.data.type === 'grocery'", async () => {
      catPool().query
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "grocery" })] });

      const res = await request(app)
        .put(`/api/categories/UpdateCategory/${CAT_ID_1}`)
        .send({ name: "Test Category", type: "grocery" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("grocery");
    });

    /* 29 */
    it("29: no type sent, existing type='food' → 200, type still 'food' (preserved)", async () => {
      catPool().query
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] });

      const res = await request(app)
        .put(`/api/categories/UpdateCategory/${CAT_ID_1}`)
        .send({ name: "Test Category" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("food");
    });

    /* 30 — PGRST204 resilience */
    it("30: DB updateById omits type field → response.data.type still correct (PGRST204 resilience)", async () => {
      const updatedWithoutType: any = makeCategory();
      delete updatedWithoutType.type;

      catPool().query
        .mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [updatedWithoutType] });

      const res = await request(app)
        .put(`/api/categories/UpdateCategory/${CAT_ID_1}`)
        .send({ name: "Test Category", type: "grocery" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Controller always merges responseType regardless of DB return
      expect(res.body.data.type).toBe("grocery");
    });

  });

  /* ── GET BY ID ─────────────────────────────────────────────────────────── */

  describe("GET /api/categories/getCategoryById/:id — type field", () => {

    /* 31 */
    it("31: DB returns category with type='food' → 200, response.data.type === 'food'", async () => {
      catPool().query.mockResolvedValueOnce({ rows: [makeCategory({ type: "food" })] });

      const res = await request(app).get(`/api/categories/getCategoryById/${CAT_ID_1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("food");
    });

    /* 32 */
    it("32: DB returns category WITHOUT type field → 200, response.data.type === 'food' (fallback)", async () => {
      const catWithoutType: any = makeCategory();
      delete catWithoutType.type;
      catPool().query.mockResolvedValueOnce({ rows: [catWithoutType] });

      const res = await request(app).get(`/api/categories/getCategoryById/${CAT_ID_1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("food");
    });

  });

  /* ── GET LIST (paginated) ───────────────────────────────────────────────── */

  describe("GET /api/categories/getList?page=1&limit=10 — paginated with type filter", () => {

    const foodCat      = makeCategory({ id: "550e8400-e29b-41d4-a716-200000000001", name: "curries",    type: "food",    store_id: null });
    const groceryCat   = makeCategory({ id: "550e8400-e29b-41d4-a716-200000000002", name: "produce",    type: "grocery", store_id: null });
    const bakeryCat    = makeCategory({ id: "550e8400-e29b-41d4-a716-200000000003", name: "croissants", type: "bakery",  store_id: null });
    const storeFoodCat = makeCategory({ id: "550e8400-e29b-41d4-a716-200000000004", name: "sandwiches", type: "food",    store_id: STORE_ID });

    /* 33 */
    it("33: ?page=1&limit=10&type=food → only food-type categories in result", async () => {
      // Paginated path filters at SQL level; DATA mock returns DB-filtered rows only
      catPool().query
        .mockResolvedValueOnce({ rows: [foodCat] });          // DATA — DB already filtered

      const res = await request(app).get("/api/categories/getList?page=1&limit=10&type=food");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).toContain(foodCat.id);
      expect(ids).not.toContain(groceryCat.id);
      expect(ids).not.toContain(bakeryCat.id);
    });

    /* 34 */
    it("34: ?page=1&limit=10&type=grocery → only grocery-type categories in result", async () => {
      catPool().query
        .mockResolvedValueOnce({ rows: [groceryCat] });       // DATA — DB already filtered

      const res = await request(app).get("/api/categories/getList?page=1&limit=10&type=grocery");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).toContain(groceryCat.id);
      expect(ids).not.toContain(foodCat.id);
      expect(ids).not.toContain(bakeryCat.id);
    });

    /* 35 */
    it("35: ?page=1&limit=10 (no type filter) → all categories returned regardless of type", async () => {
      catPool().query
        .mockResolvedValueOnce({ rows: [foodCat, groceryCat, bakeryCat] });

      const res = await request(app).get("/api/categories/getList?page=1&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
    });

    /* 36 */
    it("36: ?page=1&limit=10&type=food → food type filter (store_id param ignored, removed from schema)", async () => {
      // store_id is no longer a column on categories; the param is silently ignored.
      // DB mock returns food-typed rows (type filtering still applies).
      catPool().query
        .mockResolvedValueOnce({ rows: [foodCat, storeFoodCat] });

      const res = await request(app)
        .get(`/api/categories/getList?page=1&limit=10&type=food`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

  });

  /* ── GET LIST (non-paginated) — search + type ──────────────────────────── */

  describe("GET /api/categories/getList — non-paginated search + type", () => {

    /* 37 */
    it("37: ?type=food&search=curry → only food categories matching search term", async () => {
      const curryFood    = makeCategory({ id: "550e8400-e29b-41d4-a716-300000000001", name: "curry house",  type: "food" });
      const pastryFood   = makeCategory({ id: "550e8400-e29b-41d4-a716-300000000002", name: "pastries",     type: "food" });
      const curryGrocery = makeCategory({ id: "550e8400-e29b-41d4-a716-300000000003", name: "curry spices", type: "grocery" });

      catPool().query.mockResolvedValueOnce({ rows: [curryFood, pastryFood, curryGrocery] });

      const res = await request(app).get("/api/categories/getList?type=food&search=curry");

      console.log("TEST 37 RES BODY:", JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).toContain(curryFood.id);        // food + matches 'curry' ✓
      expect(ids).not.toContain(pastryFood.id);   // food but no 'curry'
      expect(ids).not.toContain(curryGrocery.id); // matches 'curry' but wrong type
    });

  });

  /* ── GET LIST — invalid type value rejected ─────────────────────────────── */

  describe("GET /api/categories/getList — invalid type values rejected with 400", () => {

    /* 38 */
    it("38: ?type=all → 400 (all is no longer a valid category type)", async () => {
      const res = await request(app).get("/api/categories/getList?type=all");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid type/i);
    });

    /* 39 */
    it("39: ?type=unknown → 400 (unknown values rejected)", async () => {
      const res = await request(app).get("/api/categories/getList?type=unknown");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid type/i);
    });

    /* 40 */
    it("40: no ?type param → 200 (omitting type is allowed — returns all)", async () => {
      const cat = makeCategory({ id: "550e8400-e29b-41d4-a716-400000000001", type: "food" });
      catPool().query.mockResolvedValueOnce({ rows: [cat] });
      const res = await request(app).get("/api/categories/getList");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

  });

});
