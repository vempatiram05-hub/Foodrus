
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
import UserSubscriptionRouter from "../routes/user-subscriptions.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/user-subscriptions", UserSubscriptionRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockSubscription = { 
  id: TEST_UUID, 
  user_id: TEST_UUID, 
  subscription_plan_id: TEST_UUID, 
  start_date: "2026-01-01T00:00:00Z", 
  end_date: "2026-02-01T00:00:00Z", 
  remaining_deliveries: 5, 
  is_trial: true,
  status: "ACTIVE"
};

describe("User Subscription Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/user-subscriptions/Create → success", async () => {
    mockService.create.mockResolvedValue(mockSubscription as any);

    const res = await request(app)
      .post("/api/user-subscriptions/Create")
      .send({
        user_id: TEST_UUID,
        subscription_plan_id: TEST_UUID,
        start_date: "2026-01-01",
        end_date: "2026-02-01",
        remaining_deliveries: 5,
        is_trial: true
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/user-subscriptions/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockSubscription]);

    const res = await request(app).get("/api/user-subscriptions/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/user-subscriptions/GetById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockSubscription as any);

    const res = await request(app).get(`/api/user-subscriptions/GetById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET BY USER ID ================= */
  it("GET /api/user-subscriptions/GetByuserId/:user_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockSubscription]);

    const res = await request(app).get(`/api/user-subscriptions/GetByuserId/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/user-subscriptions/Delete/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/user-subscriptions/Delete/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= CANCEL ================= */
  it("PATCH /api/user-subscriptions/cancel/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockSubscription, status: "CANCELLED" } as any);

    const res = await request(app).patch(`/api/user-subscriptions/cancel/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("CANCELLED");
  });

  /* ================= EXPIRE ================= */
  it("PATCH /api/user-subscriptions/expire/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockSubscription, status: "EXPIRED" } as any);

    const res = await request(app).patch(`/api/user-subscriptions/expire/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("EXPIRED");
  });
});
