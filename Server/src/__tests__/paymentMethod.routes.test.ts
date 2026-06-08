
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

import request from "supertest";
import express from "express";
import PaymentMethodRouter from "../routes/paymentMethod.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/paymentMethods", PaymentMethodRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockPM = { 
  id: TEST_UUID, 
  user_id: TEST_UUID, 
  last4: "4242", 
  method_type: "CARD", 
  provider: "STRIPE" 
};

describe("Payment Method Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/paymentMethods/createpaymentMethod → success", async () => {
    mockService.create.mockResolvedValue(mockPM as any);

    const res = await request(app)
      .post("/api/paymentMethods/createpaymentMethod")
      .send({
        user_id: TEST_UUID,
        last4: "4242",
        method_type: "CARD",
        provider: "STRIPE",
        token_reference: "token"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/paymentMethods/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockPM]);

    const res = await request(app).get("/api/paymentMethods/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/paymentMethods/getpaymentMethodById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockPM as any);

    const res = await request(app).get(`/api/paymentMethods/getpaymentMethodById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET BY USER ================= */
  it("GET /api/paymentMethods/getpaymentMethodsByUserId/:userId → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockPM]);

    const res = await request(app).get(`/api/paymentMethods/getpaymentMethodsByUserId/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/paymentMethods/updatepaymentMethod/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockPM, provider: "RAZORPAY" } as any);

    const res = await request(app)
      .put(`/api/paymentMethods/updatepaymentMethod/${TEST_UUID}`)
      .send({ provider: "RAZORPAY" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/paymentMethods/deletepaymentMethod/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/paymentMethods/deletepaymentMethod/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
