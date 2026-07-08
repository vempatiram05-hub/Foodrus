
/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => {
  const queryExecutor = async (isSingle: boolean) => {
    try {
      const { dbPool } = require("../config/dbPool");
      const res = await dbPool.query();
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
    select: jest.fn().mockReturnThis(),
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
  };
});

jest.mock("../config/dbPool", () => ({
  dbPool: { query: jest.fn() },
}));

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "Admin" };
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => next(),
  requirePermission: (_module: string, _action: string) => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: (req: any, _res: any, next: any) => next(),
}));

jest.mock("../middleware/upload", () => ({
  memoryUploader: {
    array: jest.fn(() => (req: any, _res: any, next: any) => {
      req.files = [];
      next();
    }),
  },
}));

jest.mock("../utils/file.util", () => ({
  generateImageName: jest.fn(() => "test.png"),
}));

jest.mock("../utils/localSignedUrl", () => ({
  generateLocalSignedUrl: (p: string) => `http://localhost:3000${p}`,
}));

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock("../utils/deleteFile", () => ({
  deleteFile: jest.fn(),
}));

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (err: any) => ({
    message: err?.message || "Mocked error",
  }),
}));

import request from "supertest";
import express from "express";
import SubcategoryRouter from "../routes/subcategory.routes";
import { dbPool } from "../config/dbPool";

const app = express();
app.use(express.json());
app.use("/api/subcategories", SubcategoryRouter);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockSubcategory = {
  id: TEST_UUID,
  name: "mobiles",
  category_id: TEST_UUID,
  description: null,
  is_active: true,
  images: [],
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

describe("Subcategory Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/subcategories/createSubcategory → success", async () => {
    const qm = dbPool.query as jest.Mock;
    qm.mockResolvedValueOnce({ rows: [{ id: TEST_UUID }], rowCount: 1 }); // category check
    qm.mockResolvedValueOnce({ rows: [], rowCount: 0 });                  // dup check
    qm.mockResolvedValueOnce({ rows: [mockSubcategory], rowCount: 1 });   // INSERT

    const res = await request(app)
      .post("/api/subcategories/createSubcategory")
      .send({ name: "Mobiles", category_id: TEST_UUID });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  it("POST /api/subcategories/createSubcategory → conflict (duplicate name)", async () => {
    const qm = dbPool.query as jest.Mock;
    qm.mockResolvedValueOnce({ rows: [{ id: TEST_UUID }], rowCount: 1 }); // category check
    qm.mockResolvedValueOnce({ rows: [mockSubcategory], rowCount: 1 });   // dup check → conflict

    const res = await request(app)
      .post("/api/subcategories/createSubcategory")
      .send({ name: "Mobiles", category_id: TEST_UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.already_exists).toBe(true);
  });

  /* ================= GET LIST ================= */
  it("GET /api/subcategories/getList → success", async () => {
    (dbPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockSubcategory], rowCount: 1 });

    const res = await request(app).get("/api/subcategories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/subcategories/getSubcategoryById/:id → success", async () => {
    (dbPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockSubcategory], rowCount: 1 });

    const res = await request(app).get(`/api/subcategories/getSubcategoryById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET BY CATEGORY ID ================= */
  it("GET /api/subcategories/getSubcategoryByCategoryId/:category_id → success", async () => {
    (dbPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockSubcategory], rowCount: 1 });

    const res = await request(app).get(`/api/subcategories/getSubcategoryByCategoryId/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/subcategories/updateSubcategory/:id → success", async () => {
    const qm = dbPool.query as jest.Mock;
    qm.mockResolvedValueOnce({ rows: [mockSubcategory], rowCount: 1 });   // fetch existing
    qm.mockResolvedValueOnce({ rows: [], rowCount: 0 });                  // dup check
    qm.mockResolvedValueOnce({ rows: [{ ...mockSubcategory, name: "mobiles updated" }], rowCount: 1 }); // UPDATE

    const res = await request(app)
      .put(`/api/subcategories/updateSubcategory/${TEST_UUID}`)
      .send({ name: "Mobiles Updated" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/subcategories/deleteSubcategory/:id → success", async () => {
    const qm = dbPool.query as jest.Mock;
    qm.mockResolvedValueOnce({ rows: [mockSubcategory], rowCount: 1 }); // fetch existing
    qm.mockResolvedValueOnce({ rows: [], rowCount: 1 });                // DELETE

    const res = await request(app).delete(`/api/subcategories/deleteSubcategory/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
