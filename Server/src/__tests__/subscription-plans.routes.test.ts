
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
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => next(),
}));

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (err: any) => ({
    message: err?.message || "Mocked error",
  }),
}));

import request from "supertest";
import express from "express";
import SubscriptionPlanRouter from "../routes/subscription-plans.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/subscription-plans", SubscriptionPlanRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockPlan = { 
  id: TEST_UUID, 
  name: "Basic Plan", 
  max_deliveries: 10,
  period_type: "MONTHLY",
  price: 199
};

describe("Subscription Plan Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/subscription-plans/create → success", async () => {
    mockService.create.mockResolvedValue(mockPlan as any);

    const res = await request(app)
      .post("/api/subscription-plans/create")
      .send({
        name: "Basic Plan",
        max_deliveries: 10,
        period_type: "MONTHLY",
        price: 199
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/subscription-plans/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockPlan]);

    const res = await request(app).get("/api/subscription-plans/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/subscription-plans/getById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockPlan as any);

    const res = await request(app).get(`/api/subscription-plans/getById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE ================= */
  it("PATCH /api/subscription-plans/update/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockPlan, name: "Updated Plan" } as any);

    const res = await request(app)
      .patch(`/api/subscription-plans/update/${TEST_UUID}`)
      .send({ name: "Updated Plan" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/subscription-plans/delete/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/subscription-plans/delete/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
