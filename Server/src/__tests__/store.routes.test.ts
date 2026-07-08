
/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
      rpc: jest.fn(),
    })),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (err: any) => ({
    message: err?.message || "Mocked error",
  }),
}));

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "SubAdmin" };
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => next(),
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) => next(),
}));

import request from "supertest";
import express from "express";
import StoreRouter from "../routes/store.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/stores", StoreRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockStore = { 
  id: TEST_UUID, 
  name: "Store A", 
  type: "GROCERY",
  region_id: TEST_UUID,
  store_admin_id: TEST_UUID
};

describe("Store Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/stores/createStore → success", async () => {
    mockService.create.mockResolvedValue(mockStore as any);

    const res = await request(app)
      .post("/api/stores/createStore")
      .send({
        name: "Store A",
        type: "GROCERY",
        region_id: TEST_UUID,
        store_admin_id: TEST_UUID
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET LIST ================= */
  it("GET /api/stores/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockStore]);

    const res = await request(app).get("/api/stores/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/stores/getStoreById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockStore as any);

    const res = await request(app).get(`/api/stores/getStoreById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/stores/updateStore/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockStore as any);
    mockService.updateById.mockResolvedValue({ ...mockStore, name: "Store Updated" } as any);

    const res = await request(app)
      .put(`/api/stores/updateStore/${TEST_UUID}`)
      .send({ name: "Store Updated" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/stores/deleteStore/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockStore as any);
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/stores/deleteStore/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY REGION ================= */
  it("GET /api/stores/getStoresByRegion/:regionId → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockStore]);

    const res = await request(app).get(`/api/stores/getStoresByRegion/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ADMIN ================= */
  it("GET /api/stores/getStoresByStoreAdminId/:adminId → success", async () => {
    // Controller calls getDataByFieldPaginated if query params exist (or default to 1/10)
    mockService.getDataByFieldPaginated.mockResolvedValue({
      data: [mockStore],
      total: 1
    } as any);

    const res = await request(app).get(`/api/stores/getStoresByStoreAdminId/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
