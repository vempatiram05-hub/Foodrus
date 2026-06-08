
/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      rpc: jest.fn(),
    })),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "Admin" };
    next();
  },
}));

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (err: any) => ({
    message: err?.message || "Mocked error",
  }),
}));

import request from "supertest";
import express from "express";
import VariantRouter from "../routes/variant.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/variants", VariantRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockVariant = { 
  id: TEST_UUID, 
  name: "Large", 
  description: "Large size" 
};

describe("Variant Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/variants/CreateVariants → success", async () => {
    mockService.create.mockResolvedValue(mockVariant as any);

    const res = await request(app)
      .post("/api/variants/CreateVariants")
      .send({
        name: "Large",
        description: "Large size"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/variants/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockVariant]);

    const res = await request(app).get("/api/variants/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/variants/GetVariantById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockVariant as any);

    const res = await request(app).get(`/api/variants/GetVariantById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/variants/UpdateVariant/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockVariant, name: "Extra Large" } as any);

    const res = await request(app)
      .put(`/api/variants/UpdateVariant/${TEST_UUID}`)
      .send({ name: "Extra Large" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/variants/DeleteVariant/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/variants/DeleteVariant/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
