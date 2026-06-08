
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
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) => next(),
}));

jest.mock("../services/helcim.service", () => ({
  createHelcimPayment: jest.fn().mockResolvedValue({
    status: "APPROVED",
    transactionId: "helcim-123"
  }),
}));

import request from "supertest";
import express from "express";
import PaymentRouter from "../routes/payment.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/payments", PaymentRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockPayment = { 
  id: TEST_UUID, 
  order_id: TEST_UUID, 
  payment_method_id: TEST_UUID, 
  amount: 500, 
  status: "SUCCESS" 
};

describe("Payment Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/payments/createPayment → success", async () => {
    mockService.create.mockResolvedValue(mockPayment as any);
    mockService.getDataByField.mockImplementation(async (table, field, value) => {
      if (table === "payment_methods") return [{ id: TEST_UUID, user_id: TEST_UUID, token_reference: "token" }];
      if (table === "users") return [{ id: TEST_UUID, full_name: "Test User" }];
      if (table === "addresses") return [{ id: TEST_UUID, line1: "Street", is_default: true }];
      return [];
    });
    mockService.updateById.mockResolvedValue({} as any);

    const res = await request(app)
      .post("/api/payments/createPayment")
      .send({
        order_id: TEST_UUID,
        payment_method_id: TEST_UUID,
        amount: 500
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET LIST ================= */
  it("GET /api/payments/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockPayment]);

    const res = await request(app).get("/api/payments/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/payments/getPaymentById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockPayment as any);

    const res = await request(app).get(`/api/payments/getPaymentById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/payments/updatePayment/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockPayment, status: "FAILED" } as any);

    const res = await request(app)
      .put(`/api/payments/updatePayment/${TEST_UUID}`)
      .send({ status: "FAILED" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/payments/deletePayment/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/payments/deletePayment/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ORDER ================= */
  it("GET /api/payments/getPaymentsByOrder/:orderId → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockPayment]);

    const res = await request(app).get(`/api/payments/getPaymentsByOrder/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
