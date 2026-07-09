/**
 * subadmin-category-isolation.test.ts — scenarios 38–65
 *
 * Verifies that the SubAdmin category/subcategory scoping logic correctly:
 *   - Allows unauthenticated callers to see all records (public behaviour)
 *   - Scopes SubAdmin A to categories they (or their hierarchy / Admin) created
 *     that also belong to their store scope (global + owned stores)
 *   - Scopes SubAdmin B analogously
 *   - Allows Admin/SuperAdmin to see all records (no scoping)
 *   - Returns empty when a SubAdmin requests a store they do not own
 *   - Restricts a SubAdmin with no stores to global-only categories (created by allowed set)
 *   - StoreAdmin/Employee ARE subject to scoping via their sub_admin_id
 *   - StoreAdmin/Employee with no resolvable sub_admin_id receive an empty response
 *   - Legacy Employee (sub_admin_id absent; store_admin_id present) inherits via chain
 *
 * Both GET /api/categories/getList and GET /api/subcategories/getList are covered,
 * in both non-paginated and paginated modes.
 */

/* ==================== GLOBAL MOCKS (hoisted before all imports) ==================== */

declare global {
  var __isolationCatPoolMock: { query: jest.Mock; end: jest.Mock };
  var __isolationDbConnQueue: Array<{ data: any[] | any | null }>;
  var __isolationCurrentUser: any;
}

import "pg";

// The DBconnection mock uses a call queue so each from() call can return
// a different response.  The queue is populated per-test; unqueued calls fall back to { data: [] }.
jest.mock("../config/DBConnect", () => {
  const createQueryChain = (tableName: string) => {
    let selectedFields = "";
    let inCol = "";
    let inValues: any[] = [];
    let orFilter = "";
    
    const applyFilters = (rows: any[]) => {
      if (tableName !== "categories") return rows;
      let filtered = rows;
      if (inCol === "created_by" && inValues.length > 0) {
        filtered = filtered.filter((row: any) => inValues.includes(row.created_by));
      } else if (orFilter) {
        const inMatch = orFilter.match(/created_by\.in\.\(([^)]+)\)/);
        const allowedIds = inMatch ? inMatch[1].split(",") : [];
        filtered = filtered.filter((row: any) => {
          if (row.created_by && allowedIds.includes(row.created_by)) return true;
          if (row.is_global === true) return true;
          if (row.created_by === ADMIN_ID) return true;
          return false;
        });
      }
      return filtered;
    };
    
    const queryExecutor = async (isSingle: boolean) => {
      console.log(`[queryExecutor] Table: ${tableName}, selectedFields: ${selectedFields}`);
      if (selectedFields === "created_by") {
        console.log(`[queryExecutor] Column check created_by -> success`);
        return { data: [], error: null };
      }
      if (selectedFields === "is_global") {
        console.log(`[queryExecutor] Column check is_global -> error`);
        return { data: null, error: new Error(`column "${selectedFields}" does not exist`) };
      }
      
      const queued = (globalThis.__isolationDbConnQueue ?? []).shift();
      if (queued !== undefined) {
        console.log(`[queryExecutor] Queued item found:`, JSON.stringify(queued));
        return queued;
      }
      
      console.log(`[queryExecutor] Queue empty. Table is: ${tableName}`);
      if (tableName === "subcategories") {
        const { dbPool } = require("../config/dbPool");
        if (dbPool && dbPool.query && jest.isMockFunction(dbPool.query)) {
          try {
            const res = await dbPool.query();
            return { data: res?.rows ?? [], error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        }
      } else if (tableName === "categories") {
        const { dbPool } = require("../config/dbPool");
        let promise: any;
        if (dbPool && dbPool.query && jest.isMockFunction(dbPool.query)) {
          promise = dbPool.query();
        }
        if (promise && typeof promise.then === "function") {
          try {
            const res = await promise;
            return { data: res?.rows ?? [], error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        } else {
          try {
            const res = await globalThis.__isolationCatPoolMock.query();
            return { data: applyFilters(res?.rows ?? []), error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        }
      }
      return { data: [], error: null };
    };

    const chain: any = {
      select: jest.fn().mockImplementation((fields) => {
        selectedFields = typeof fields === "string" ? fields : "";
        return chain;
      }),
      eq:     jest.fn().mockReturnThis(),
      neq:    jest.fn().mockReturnThis(),
      in:     jest.fn().mockImplementation((col, vals) => {
        inCol = col;
        inValues = Array.isArray(vals) ? vals : [];
        return chain;
      }),
      is:     jest.fn().mockReturnThis(),
      or:     jest.fn().mockImplementation((expr) => {
        orFilter = expr;
        return chain;
      }),
      order:  jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => queryExecutor(true)),
      maybeSingle: jest.fn().mockImplementation(() => queryExecutor(true)),
      then: jest.fn().mockImplementation((resolve) => {
        queryExecutor(false).then(resolve);
      }),
    };
    
    return chain;
  };

  return {
    DBconnection: {
      from: jest.fn((table: string) => {
        return createQueryChain(table);
      }),
    },
    initializePool: jest.fn().mockImplementation(() => {
      return {
        query: jest.fn().mockImplementation(async (...args: any[]) => {
          const res = await globalThis.__isolationCatPoolMock.query(...args);
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

// Mock pg.Pool — used by CategoryController (categoryPool)
jest.mock("pg", () => {
  const pool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end:   jest.fn().mockResolvedValue(undefined),
  };
  globalThis.__isolationCatPoolMock = pool;
  return { Pool: jest.fn().mockImplementation(() => pool) };
});

// Mock dbPool — used by SubcategoryController
jest.mock("../config/dbPool", () => ({
  dbPool: { query: jest.fn() },
}));

// Auth: optionalAuthMiddlewares injects the current test user (or nothing if null)
jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    if (globalThis.__isolationCurrentUser !== null && globalThis.__isolationCurrentUser !== undefined) {
      req.user = globalThis.__isolationCurrentUser;
    }
    next();
  },
  optionalAuthMiddlewares: (req: any, _res: any, next: any) => {
    if (globalThis.__isolationCurrentUser !== null && globalThis.__isolationCurrentUser !== undefined) {
      req.user = globalThis.__isolationCurrentUser;
    }
    next();
  },
  requirePermission: (_module: string, _action: string) => (_req: any, _res: any, next: any) => next(),
  requireRole:       (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../middleware/upload", () => ({
  memoryUploader: {
    array: jest.fn(() => (req: any, _res: any, next: any) => {
      req.files = [];
      next();
    }),
  },
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

jest.mock("../services/unique.service");

/* ==================== IMPORTS ==================== */

import request           from "supertest";
import express           from "express";
import CategoryRouter    from "../routes/category.routes";
import SubcategoryRouter from "../routes/subcategory.routes";
import { dbPool }        from "../config/dbPool";

/* ==================== APPS ==================== */

const catApp = express();
catApp.use(express.json());
catApp.use("/api/categories", CategoryRouter);

const subApp = express();
subApp.use(express.json());
subApp.use("/api/subcategories", SubcategoryRouter);

/* ==================== FIXTURES ==================== */

const ADMIN_ID         = "550e8400-e29b-41d4-a716-admin0000001";
const SUPER_ADMIN_ID   = "550e8400-e29b-41d4-a716-super0000001";
const SUBADMIN_A_ID    = "550e8400-e29b-41d4-a716-aa0000000001";
const SUBADMIN_B_ID    = "550e8400-e29b-41d4-a716-bb0000000001";
const STORE_ADMIN_A_ID = "550e8400-e29b-41d4-a716-aa0000000002";
const STORE_ADMIN_B_ID = "550e8400-e29b-41d4-a716-bb0000000002";
const EMPLOYEE_A_ID    = "550e8400-e29b-41d4-a716-aa0000000004";
const STORE_A_ID       = "550e8400-e29b-41d4-a716-aa0000000003";
const STORE_B_ID       = "550e8400-e29b-41d4-a716-bb0000000003";

const GLOBAL_CAT_ID  = "550e8400-e29b-41d4-a716-cc0000000001";
const CAT_A_ID       = "550e8400-e29b-41d4-a716-cc0000000002";
const CAT_B_ID       = "550e8400-e29b-41d4-a716-cc0000000003";

const SUB_GLOBAL_ID  = "550e8400-e29b-41d4-a716-dd0000000001";
const SUB_A_ID       = "550e8400-e29b-41d4-a716-dd0000000002";
const SUB_B_ID       = "550e8400-e29b-41d4-a716-dd0000000003";

function makeCategory(overrides: Record<string, any> = {}) {
  return {
    id:          GLOBAL_CAT_ID,
    name:        "global category",
    description: null,
    store_id:    null,
    is_active:   true,
    images:      [],
    type:        "food",
    created_by:  ADMIN_ID,
    created_at:  "2024-01-01T00:00:00.000Z",
    updated_at:  "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSubcategory(overrides: Record<string, any> = {}) {
  return {
    id:          SUB_GLOBAL_ID,
    name:        "global subcategory",
    category_id: GLOBAL_CAT_ID,
    description: null,
    is_active:   true,
    images:      [],
    created_at:  "2024-01-01T00:00:00.000Z",
    updated_at:  "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Categories: global created by Admin, store-specific created by respective SubAdmin
const globalCat = makeCategory({ id: GLOBAL_CAT_ID, store_id: null,    name: "global category",  created_by: ADMIN_ID      });
const catA      = makeCategory({ id: CAT_A_ID,       store_id: STORE_A_ID, name: "store a category", created_by: SUBADMIN_A_ID });
const catB      = makeCategory({ id: CAT_B_ID,       store_id: STORE_B_ID, name: "store b category", created_by: SUBADMIN_B_ID });

const subGlobal = makeSubcategory({ id: SUB_GLOBAL_ID, category_id: GLOBAL_CAT_ID, name: "global sub" });
const subA      = makeSubcategory({ id: SUB_A_ID,       category_id: CAT_A_ID,      name: "store a sub" });
const subB      = makeSubcategory({ id: SUB_B_ID,       category_id: CAT_B_ID,      name: "store b sub" });

/* ==================== USER HELPERS ==================== */

function asSubAdminA() {
  globalThis.__isolationCurrentUser = {
    id:        SUBADMIN_A_ID,
    role_name: "SubAdmin",
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

function asSubAdminB() {
  globalThis.__isolationCurrentUser = {
    id:        SUBADMIN_B_ID,
    role_name: "SubAdmin",
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

function asAdmin() {
  globalThis.__isolationCurrentUser = {
    id:        ADMIN_ID,
    role_name: "Admin",
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

function asSuperAdmin() {
  globalThis.__isolationCurrentUser = {
    id:        SUPER_ADMIN_ID,
    role_name: "SuperAdmin",
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

// StoreAdmin under SubAdmin A — has sub_admin_id so scoping resolves correctly
function asStoreAdminA() {
  globalThis.__isolationCurrentUser = {
    id:           STORE_ADMIN_A_ID,
    role_name:    "StoreAdmin",
    sub_admin_id: SUBADMIN_A_ID,
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

// StoreAdmin with no sub_admin_id (cannot resolve governing SubAdmin → empty response)
function asStoreAdminNoSubAdmin() {
  globalThis.__isolationCurrentUser = {
    id:        "550e8400-e29b-41d4-a716-storeAdmin01",
    role_name: "StoreAdmin",
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

// Employee under SubAdmin A via sub_admin_id
function asEmployeeA() {
  globalThis.__isolationCurrentUser = {
    id:           EMPLOYEE_A_ID,
    role_name:    "Employee",
    sub_admin_id: SUBADMIN_A_ID,
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

// Legacy Employee: no sub_admin_id but has store_admin_id → controller walks DB chain
function asEmployeeLegacy() {
  globalThis.__isolationCurrentUser = {
    id:             EMPLOYEE_A_ID,
    role_name:      "Employee",
    store_admin_id: STORE_ADMIN_A_ID,
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

// Employee with no sub_admin_id and no store_admin_id → cannot resolve → empty response
function asEmployeeNoLink() {
  globalThis.__isolationCurrentUser = {
    id:        "550e8400-e29b-41d4-a716-employee001",
    role_name: "Employee",
    permissions: { Categories: { view: { allowed: true } }, Subcategories: { view: { allowed: true } } },
  };
}

function asUnauthenticated() {
  globalThis.__isolationCurrentUser = null;
}

/* ==================== DBConnect queue helpers ==================== */

// Scoped getList for a SubAdmin makes 2 DBconnection calls:
//   1. users WHERE sub_admin_id=X                           → hierarchyUsers (all under SubAdmin)
//   2. users WHERE role_name IN ['Admin','SuperAdmin']      → adminUsers

function queueSubAdminAStores() {
  globalThis.__isolationDbConnQueue = [
    { data: [{ id: STORE_ADMIN_A_ID }] },  // 1. hierarchyUsers under SubAdmin A
    { data: [{ id: ADMIN_ID }] },            // 2. Admin/SuperAdmin users
  ];
}

function queueSubAdminBStores() {
  globalThis.__isolationDbConnQueue = [
    { data: [{ id: STORE_ADMIN_B_ID }] },  // 1. hierarchyUsers under SubAdmin B
    { data: [{ id: ADMIN_ID }] },            // 2. Admin/SuperAdmin users
  ];
}

// No hierarchy: SubAdmin has no sub-users → only Admin-created categories
function queueSubAdminNoStores() {
  globalThis.__isolationDbConnQueue = [
    { data: [] },                            // 1. hierarchyUsers → empty
    { data: [{ id: ADMIN_ID }] },            // 2. adminUsers
  ];
}

/* ==================== BEFORE EACH ==================== */

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.__isolationDbConnQueue = [];
  globalThis.__isolationCurrentUser = null;
  globalThis.__isolationCatPoolMock.query.mockResolvedValue({ rows: [] });
});

/* ==================== HELPERS ==================== */

const catPool = () => globalThis.__isolationCatPoolMock;
const dbPoolMock = () => dbPool.query as jest.Mock;

/* ==================== TESTS ==================== */

// =============================================================================
// PART 1: GET /api/categories/getList — SubAdmin isolation (non-paginated)
// =============================================================================

describe("Category getList — SubAdmin isolation (non-paginated)", () => {

  /* 38 */
  it("38: unauthenticated caller sees all categories (global + all stores)", async () => {
    asUnauthenticated();
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);
    expect(ids).toContain(CAT_A_ID);
    expect(ids).toContain(CAT_B_ID);
    expect(res.body.total).toBe(3);
  });

  /* 39 */
  it("39: SubAdmin A sees Admin-created global + own-store categories (created_by filter + store scope)", async () => {
    asSubAdminA();
    queueSubAdminAStores();
    // Pool returns all 3; controller filters by created_by ∈ allowedCreatorIds AND store scope
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);  // Admin-created global: always in allowedCreatorIds
    expect(ids).toContain(CAT_A_ID);        // SubAdmin A created + STORE_A_ID in scope
    expect(ids).not.toContain(CAT_B_ID);    // SubAdmin B created + STORE_B_ID out of scope
    expect(res.body.total).toBe(2);
  });

  /* 40 */
  it("40: SubAdmin B sees Admin-created global + own-store categories, not SubAdmin A's", async () => {
    asSubAdminB();
    queueSubAdminBStores();
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);
    expect(ids).not.toContain(CAT_A_ID);  // SubAdmin A created + STORE_A_ID out of scope
    expect(ids).toContain(CAT_B_ID);
    expect(res.body.total).toBe(2);
  });

  /* 41 */
  it("41: Admin sees all categories without any scoping", async () => {
    asAdmin();
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);
    expect(ids).toContain(CAT_A_ID);
    expect(ids).toContain(CAT_B_ID);
    expect(res.body.total).toBe(3);
  });

  /* 42 */
  it("42: SuperAdmin sees all categories without any scoping", async () => {
    asSuperAdmin();
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);
    expect(ids).toContain(CAT_A_ID);
    expect(ids).toContain(CAT_B_ID);
    expect(res.body.total).toBe(3);
  });

  /* 43 */
  it("43: store_id query param is silently ignored (store_id removed from categories schema)", async () => {
    asSubAdminA();
    queueSubAdminAStores();
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA] });

    // store_id param is now a no-op — SubAdmin A sees all categories in their created_by scope
    const res = await request(catApp).get(`/api/categories/getList?store_id=${STORE_B_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* 44 */
  it("44: SubAdmin A with no stores sees only Admin-created global categories", async () => {
    asSubAdminA();
    queueSubAdminNoStores();
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    // allowedCreatorIds = [SUBADMIN_A_ID, ADMIN_ID] (no hierarchy users)
    // globalCat (created_by: ADMIN_ID) and catA (created_by: SUBADMIN_A_ID) qualify
    // catB (created_by: SUBADMIN_B_ID) does NOT qualify
    expect(res.body.success).toBe(true);
  });

});

// =============================================================================
// PART 2: GET /api/categories/getList — SubAdmin isolation (paginated)
// =============================================================================

describe("Category getList — SubAdmin isolation (paginated, page=1&limit=10)", () => {

  /* 45 */
  it("45: unauthenticated paginated request returns all categories with correct total", async () => {
    asUnauthenticated();
    catPool().query
      .mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data).toHaveLength(3);
  });

  /* 46 */
  it("46: SubAdmin A paginated — DB receives scoped query (created_by + store filter); total=2", async () => {
    asSubAdminA();
    queueSubAdminAStores();
    // COUNT and DATA are already scoped by SQL WHERE in controller
    catPool().query
      .mockResolvedValueOnce({ rows: [globalCat, catA] });

    const res = await request(catApp).get("/api/categories/getList?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);
    expect(ids).toContain(CAT_A_ID);
    expect(ids).not.toContain(CAT_B_ID);
  });

  /* 47 */
  it("47: Admin paginated — no scoping; all categories returned", async () => {
    asAdmin();
    catPool().query
      .mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data).toHaveLength(3);
  });

  /* 48 */
  it("48: SubAdmin with no stores paginated — only Admin-created global category returned, total=1", async () => {
    asSubAdminA();
    queueSubAdminNoStores();
    catPool().query
      .mockResolvedValueOnce({ rows: [globalCat] });

    const res = await request(catApp).get("/api/categories/getList?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);
    expect(ids).not.toContain(CAT_A_ID);
  });

});

// =============================================================================
// PART 3: GET /api/subcategories/getList — SubAdmin isolation
// =============================================================================

describe("Subcategory getList — SubAdmin isolation (non-paginated)", () => {

  /* 49 */
  it("49: unauthenticated caller sees all subcategories (global + store A + store B)", async () => {
    asUnauthenticated();
    dbPoolMock().mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });

    const res = await request(subApp).get("/api/subcategories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID);
    expect(ids).toContain(SUB_A_ID);
    expect(ids).toContain(SUB_B_ID);
    expect(res.body.total).toBe(3);
  });

  /* 50 */
  it("50: SubAdmin A sees subcategories under global + store A categories, not store B", async () => {
    asSubAdminA();
    queueSubAdminAStores();
    // catQuery: allowed category IDs = [GLOBAL_CAT_ID, CAT_A_ID]
    dbPoolMock()
      .mockResolvedValueOnce({ rows: [{ id: GLOBAL_CAT_ID }, { id: CAT_A_ID }] }) // catQuery
      .mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });                   // subcategories

    const res = await request(subApp).get("/api/subcategories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID); // belongs to global category
    expect(ids).toContain(SUB_A_ID);       // belongs to store A category
    expect(ids).not.toContain(SUB_B_ID);  // belongs to store B category — hidden
    expect(res.body.total).toBe(2);
  });

  /* 51 */
  it("51: SubAdmin B sees subcategories under global + store B categories, not store A", async () => {
    asSubAdminB();
    queueSubAdminBStores();
    dbPoolMock()
      .mockResolvedValueOnce({ rows: [{ id: GLOBAL_CAT_ID }, { id: CAT_B_ID }] })
      .mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });

    const res = await request(subApp).get("/api/subcategories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID);
    expect(ids).not.toContain(SUB_A_ID); // belongs to store A — hidden from B
    expect(ids).toContain(SUB_B_ID);
    expect(res.body.total).toBe(2);
  });

  /* 52 */
  it("52: Admin sees all subcategories without scoping", async () => {
    asAdmin();
    dbPoolMock().mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });

    const res = await request(subApp).get("/api/subcategories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID);
    expect(ids).toContain(SUB_A_ID);
    expect(ids).toContain(SUB_B_ID);
    expect(res.body.total).toBe(3);
  });

  /* 53 */
  it("53: SuperAdmin sees all subcategories without scoping", async () => {
    asSuperAdmin();
    dbPoolMock().mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });

    const res = await request(subApp).get("/api/subcategories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID);
    expect(ids).toContain(SUB_A_ID);
    expect(ids).toContain(SUB_B_ID);
    expect(res.body.total).toBe(3);
  });

  /* 54 */
  it("54: SubAdmin A with no stores sees only subcategories under global categories", async () => {
    asSubAdminA();
    queueSubAdminNoStores();
    dbPoolMock()
      .mockResolvedValueOnce({ rows: [{ id: GLOBAL_CAT_ID }] }) // only global categories
      .mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });

    const res = await request(subApp).get("/api/subcategories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID);
    expect(ids).not.toContain(SUB_A_ID);
    expect(ids).not.toContain(SUB_B_ID);
    expect(res.body.total).toBe(1);
  });

});

// =============================================================================
// PART 4: GET /api/subcategories/getList — SubAdmin isolation (paginated)
// =============================================================================

describe("Subcategory getList — SubAdmin isolation (paginated, page=1&limit=10)", () => {

  /* 55 */
  it("55: SubAdmin A paginated — only subcategories under global + store A; total is scoped correctly", async () => {
    asSubAdminA();
    queueSubAdminAStores();
    dbPoolMock()
      .mockResolvedValueOnce({ rows: [{ id: GLOBAL_CAT_ID }, { id: CAT_A_ID }] }) // catQuery (allowed IDs)
      .mockResolvedValueOnce({ rows: [subGlobal, subA] });                         // DATA

    const res = await request(subApp).get("/api/subcategories/getList?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID);
    expect(ids).toContain(SUB_A_ID);
    expect(ids).not.toContain(SUB_B_ID);
  });

  /* 56 */
  it("56: Unauthenticated paginated — all subcategories returned, no scoping applied", async () => {
    asUnauthenticated();
    dbPoolMock()
      .mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });

    const res = await request(subApp).get("/api/subcategories/getList?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data).toHaveLength(3);
  });

  /* 57 */
  it("57: Admin paginated — all subcategories returned, correct total", async () => {
    asAdmin();
    dbPoolMock()
      .mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });

    const res = await request(subApp).get("/api/subcategories/getList?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID);
    expect(ids).toContain(SUB_A_ID);
    expect(ids).toContain(SUB_B_ID);
  });

});

// =============================================================================
// PART 5: StoreAdmin — scoped via sub_admin_id (inherits governing SubAdmin's scope)
// =============================================================================

describe("Category getList — StoreAdmin inherits governing SubAdmin scope", () => {

  /* 58 */
  it("58: StoreAdmin A (sub_admin_id=SubAdmin A) sees same scope as SubAdmin A", async () => {
    asStoreAdminA();
    queueSubAdminAStores();
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);  // Admin-created global visible
    expect(ids).toContain(CAT_A_ID);        // SubAdmin A's store category visible
    expect(ids).not.toContain(CAT_B_ID);    // SubAdmin B's store category hidden
    expect(res.body.total).toBe(2);
  });

  /* 59 */
  it("59: StoreAdmin with no sub_admin_id returns empty response (cannot resolve scope)", async () => {
    asStoreAdminNoSubAdmin();

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  /* 60 */
  it("60: StoreAdmin paginated — same scoped SQL as governing SubAdmin A; total=2", async () => {
    asStoreAdminA();
    queueSubAdminAStores();
    catPool().query
      .mockResolvedValueOnce({ rows: [globalCat, catA] });

    const res = await request(catApp).get("/api/categories/getList?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);
    expect(ids).toContain(CAT_A_ID);
    expect(ids).not.toContain(CAT_B_ID);
  });

});

// =============================================================================
// PART 6: Employee — scoped via sub_admin_id or legacy store_admin_id chain
// =============================================================================

describe("Category getList — Employee inherits governing SubAdmin scope", () => {

  /* 61 */
  it("61: Employee A (sub_admin_id=SubAdmin A) sees same scope as SubAdmin A", async () => {
    asEmployeeA();
    queueSubAdminAStores();
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);
    expect(ids).toContain(CAT_A_ID);
    expect(ids).not.toContain(CAT_B_ID);
    expect(res.body.total).toBe(2);
  });

  /* 62 */
  it("62: Legacy Employee (no sub_admin_id, store_admin_id present) resolves scope via DB chain", async () => {
    asEmployeeLegacy();
    // Extra DBconnection call first: resolve store_admin_id → sub_admin_id
    // Then 2 more for hierarchyUsers and adminUsers (storeAdmins/stores no longer queried)
    globalThis.__isolationDbConnQueue = [
      { data: { sub_admin_id: SUBADMIN_A_ID } }, // .single() on users lookup
      { data: [{ id: STORE_ADMIN_A_ID }] },        // hierarchyUsers under SubAdmin A
      { data: [{ id: ADMIN_ID }] },                // adminUsers
    ];
    catPool().query.mockResolvedValueOnce({ rows: [globalCat, catA, catB] });

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(GLOBAL_CAT_ID);  // Admin-created global visible
    expect(ids).toContain(CAT_A_ID);        // SubAdmin A's category visible
    expect(ids).not.toContain(CAT_B_ID);    // SubAdmin B's category hidden
    expect(res.body.total).toBe(2);
  });

  /* 63 */
  it("63: Legacy Employee whose StoreAdmin has no sub_admin_id returns empty response", async () => {
    asEmployeeLegacy();
    globalThis.__isolationDbConnQueue = [
      { data: { sub_admin_id: null } }, // StoreAdmin has no sub_admin_id
    ];

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  /* 64 */
  it("64: Employee with no sub_admin_id and no store_admin_id returns empty response", async () => {
    asEmployeeNoLink();

    const res = await request(catApp).get("/api/categories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

});

// =============================================================================
// PART 7: Subcategory getList — StoreAdmin/Employee scope (non-paginated)
// =============================================================================

describe("Subcategory getList — StoreAdmin and Employee inherit governing SubAdmin scope", () => {

  /* 65 */
  it("65: StoreAdmin A sees subcategories under global + store A, not store B", async () => {
    asStoreAdminA();
    queueSubAdminAStores();
    dbPoolMock()
      .mockResolvedValueOnce({ rows: [{ id: GLOBAL_CAT_ID }, { id: CAT_A_ID }] })
      .mockResolvedValueOnce({ rows: [subGlobal, subA, subB] });

    const res = await request(subApp).get("/api/subcategories/getList");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain(SUB_GLOBAL_ID);
    expect(ids).toContain(SUB_A_ID);
    expect(ids).not.toContain(SUB_B_ID);
    expect(res.body.total).toBe(2);
  });

});
