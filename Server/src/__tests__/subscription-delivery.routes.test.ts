
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
import SubscriptionDeliveryRouter from "../routes/subscription-delivery.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/subscription-deliveries", SubscriptionDeliveryRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockDelivery = { 
  id: TEST_UUID, 
  user_subscription_id: TEST_UUID, 
  order_id: TEST_UUID, 
  is_trial_delivery: false 
};

describe("Subscription Delivery Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/subscription-deliveries/ → success", async () => {
    mockService.create.mockResolvedValue(mockDelivery as any);

    const res = await request(app)
      .post("/api/subscription-deliveries/")
      .send({
        user_subscription_id: TEST_UUID,
        order_id: TEST_UUID
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order_id).toBe(TEST_UUID);
  });

  /* ================= GET BY SUBSCRIPTION ================= */
  it("GET /api/subscription-deliveries/subscription/:user_subscription_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockDelivery]);

    const res = await request(app).get(`/api/subscription-deliveries/subscription/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  /* ================= GET BY ORDER ================= */
  it("GET /api/subscription-deliveries/order/:order_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockDelivery]);

    const res = await request(app).get(`/api/subscription-deliveries/order/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order_id).toBe(TEST_UUID);
  });
});
