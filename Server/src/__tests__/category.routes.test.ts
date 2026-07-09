/* ================= MOCK ================= */

declare global {
  var __catRoutePoolMock: { query: jest.Mock; end: jest.Mock };
}

// CategoryController now uses direct pg.Pool — mock it before any imports
jest.mock("pg", () => {
  const pool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end:   jest.fn().mockResolvedValue(undefined),
  };
  globalThis.__catRoutePoolMock = pool;
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
      const res = await globalThis.__catRoutePoolMock.query();
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
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
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
    initializePool: jest.fn().mockImplementation(() => {
      return {
        query: jest.fn().mockImplementation(async (...args: any[]) => {
          const res = await globalThis.__catRoutePoolMock.query(...args);
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

jest.mock("../middleware/auth", () => {
  const actual = jest.requireActual("../middleware/auth");
  return {
    ...actual,
    authMiddleware: (req: any, _res: any, next: any) => {
      if (!req.user) {
        req.user = {
          id: "550e8400-e29b-41d4-a716-446655440000",
          role_name: "Admin",
          permissions: {
            Categories: {
              create: { allowed: true },
              edit:   { allowed: true },
              delete: { allowed: true },
            },
          },
        };
      }
      next();
    },
  };
});

jest.mock("../middleware/upload", () => ({
  memoryUploader: {
    array: () => (req: any, res: any, next: any) => next(),
  },
}));

jest.mock("../utils/deleteFile", () => ({ deleteFile: jest.fn() }));
jest.mock("../utils/localSignedUrl", () => ({ generateLocalSignedUrl: (p: string) => `signed-${p}` }));
jest.mock("../utils/file.util", () => ({ generateImageName: () => "test-image.jpg" }));

import request from "supertest";
import express from "express";
import CategoryRouter from "../routes/category.routes";

const app = express();
app.use(express.json());
app.use("/api/categories", CategoryRouter);

const unauthorizedApp = express();
unauthorizedApp.use(express.json());
unauthorizedApp.use((req: any, _res: any, next: any) => {
  req.user = { id: "employee-id", role_name: "Employee", permissions: {} };
  next();
});
unauthorizedApp.use("/api/categories", CategoryRouter);

const authorizedApp = express();
authorizedApp.use(express.json());
authorizedApp.use((req: any, _res: any, next: any) => {
  req.user = {
    id: "staff-id",
    role_name: "StoreAdmin",
    permissions: {
      Categories: {
        create: { allowed: true },
        edit:   { allowed: true },
        delete: { allowed: true },
      },
    },
  };
  next();
});
authorizedApp.use("/api/categories", CategoryRouter);

function catPool() {
  return globalThis.__catRoutePoolMock;
}

/* ================= DATA ================= */
const validStoreId = "550e8400-e29b-41d4-a716-446655440001";
const mockCategory = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  name: "electronics",
  store_id: validStoreId,
  images: ["/img1.jpg"],
  type: "food",
  is_active: true,
  description: null,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

describe("Category Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    catPool().query.mockResolvedValue({ rows: [] });
  });

  /* ================= CREATE ================= */
  it("POST /api/categories/CreateCategory → success", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [] })                      // dup check: no conflict
      .mockResolvedValueOnce({ rows: [mockCategory] });         // INSERT RETURNING *

    const res = await request(app)
      .post("/api/categories/CreateCategory")
      .send({ name: "Electronics", store_id: validStoreId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("POST /api/categories/CreateCategory → 409 conflict when case-insensitive name exists", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [{ name: "electronics" }] }); // dup check: found category with lower-cased name

    const res = await request(app)
      .post("/api/categories/CreateCategory")
      .send({ name: "Electronics", store_id: validStoreId });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Category name already exists/i);
  });

  /* ================= GET LIST ================= */
  it("GET /api/categories/getList → success", async () => {
    catPool().query.mockResolvedValueOnce({ rows: [mockCategory] }); // SELECT * FROM categories

    const res = await request(app).get("/api/categories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].images[0]).toContain("signed-");
  });

  /* ================= GET BY ID ================= */
  it("GET /api/categories/getCategoryById/:id → success", async () => {
    catPool().query.mockResolvedValueOnce({ rows: [mockCategory] }); // SELECT * WHERE id

    const res = await request(app).get(`/api/categories/getCategoryById/${mockCategory.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY STORE ID ================= */
  it("GET /api/categories/getCategoryByStoreId/:store_id → success", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [{ id: validStoreId }] }) // check store exists
      .mockResolvedValueOnce({ rows: [{ category_id: mockCategory.id }] }) // get products category_ids
      .mockResolvedValueOnce({ rows: [mockCategory] }); // get categories

    const res = await request(app).get(`/api/categories/getCategoryByStoreId/${validStoreId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].id).toBe(mockCategory.id);
  });

  it("GET /api/categories/getCategoryByStoreId/:store_id → 404 store not found", async () => {
    catPool().query.mockResolvedValueOnce({ rows: [] }); // check store exists: not found

    const res = await request(app).get(`/api/categories/getCategoryByStoreId/non-existent-store`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Store not found/i);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/categories/UpdateCategory/:id → success", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [mockCategory] })                             // GET existing
      .mockResolvedValueOnce({ rows: [] })                                         // dup check: no conflict
      .mockResolvedValueOnce({ rows: [{ ...mockCategory, name: "fashion" }] });   // UPDATE RETURNING *

    const res = await request(app)
      .put(`/api/categories/UpdateCategory/${mockCategory.id}`)
      .send({ name: "Fashion", store_id: validStoreId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("PUT /api/categories/UpdateCategory/:id → 409 conflict when case-insensitive name exists on another category", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [mockCategory] })                               // GET existing
      .mockResolvedValueOnce({ rows: [{ id: "some-other-id", name: "fashion" }] }); // dup check: found other category with name

    const res = await request(app)
      .put(`/api/categories/UpdateCategory/${mockCategory.id}`)
      .send({ name: "Fashion", store_id: validStoreId });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/categories/deleteCategory/:id → success", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [mockCategory] })                    // fetch existing
      .mockResolvedValueOnce({ rows: [] });                               // subcats check: none

    const res = await request(app).delete(`/api/categories/deleteCategory/${mockCategory.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("DELETE /api/categories/deleteCategory/:id → 404 when category does not exist", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [] });                               // fetch existing: not found

    const res = await request(app).delete(`/api/categories/deleteCategory/non-existent-id`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });
});

/* ================================================================
 * PERMISSION GUARD — write endpoints block unauthorised users
 * ================================================================ */

describe("Category Routes – permission guard blocks users without Categories permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    catPool().query.mockResolvedValue({ rows: [] });
  });

  it("POST /CreateCategory → 403 for Employee with empty permissions", async () => {
    const res = await request(unauthorizedApp)
      .post("/api/categories/CreateCategory")
      .send({ name: "Electronics", store_id: validStoreId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("PUT /UpdateCategory/:id → 403 for Employee with empty permissions", async () => {
    const res = await request(unauthorizedApp)
      .put(`/api/categories/UpdateCategory/${mockCategory.id}`)
      .send({ name: "Fashion", store_id: validStoreId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("DELETE /deleteCategory/:id → 403 for Employee with empty permissions", async () => {
    const res = await request(unauthorizedApp)
      .delete(`/api/categories/deleteCategory/${mockCategory.id}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("POST /CreateCategory → 403 for StoreAdmin with Categories.create permission (restricted to Admin/SuperAdmin)", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [] })              // dup check: no conflict
      .mockResolvedValueOnce({ rows: [mockCategory] }); // INSERT RETURNING *

    const res = await request(authorizedApp)
      .post("/api/categories/CreateCategory")
      .send({ name: "Electronics", store_id: validStoreId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("PUT /UpdateCategory/:id → 403 for StoreAdmin with Categories.edit permission (restricted to Admin/SuperAdmin)", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [mockCategory] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...mockCategory, name: "fashion" }] });

    const res = await request(authorizedApp)
      .put(`/api/categories/UpdateCategory/${mockCategory.id}`)
      .send({ name: "Fashion", store_id: validStoreId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("DELETE /deleteCategory/:id → 403 for StoreAdmin with Categories.delete permission (restricted to Admin/SuperAdmin)", async () => {
    catPool().query
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ images: mockCategory.images }] });

    const res = await request(authorizedApp)
      .delete(`/api/categories/deleteCategory/${mockCategory.id}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

/* ================================================================
 * PUBLIC READ ROUTES — no auth required
 * ================================================================ */

describe("Category Routes – read endpoints are public (no auth required)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    catPool().query.mockResolvedValue({ rows: [] });
  });

  it("GET /getList → 200 without any user set", async () => {
    const publicApp = express();
    publicApp.use(express.json());
    publicApp.use("/api/categories", CategoryRouter);

    catPool().query.mockResolvedValueOnce({ rows: [mockCategory] });

    const res = await request(publicApp).get("/api/categories/getList");
    expect(res.status).toBe(200);
  });

  it("GET /getCategoryById/:id → 200 without any user set", async () => {
    const publicApp = express();
    publicApp.use(express.json());
    publicApp.use("/api/categories", CategoryRouter);

    catPool().query.mockResolvedValueOnce({ rows: [mockCategory] });

    const res = await request(publicApp).get(`/api/categories/getCategoryById/${mockCategory.id}`);
    expect(res.status).toBe(200);
  });

  it("GET /getList?type=all → 400 ('all' is no longer a valid category type)", async () => {
    const publicApp = express();
    publicApp.use(express.json());
    publicApp.use("/api/categories", CategoryRouter);

    const res = await request(publicApp).get("/api/categories/getList?type=all");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid type/i);
  });
});
