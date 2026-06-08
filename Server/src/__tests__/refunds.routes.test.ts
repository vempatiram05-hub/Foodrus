
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

import request from "supertest";
import express from "express";
import RefundRouter from "../routes/refunds.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/refunds", RefundRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockRefund = { 
  id: TEST_UUID, 
  payment_id: TEST_UUID, 
  amount: 100, 
  status: "PENDING" 
};

describe("Refund Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/refunds/Create → success", async () => {
    mockService.create.mockResolvedValue(mockRefund as any);

    const res = await request(app)
      .post("/api/refunds/Create")
      .send({
        payment_id: TEST_UUID,
        amount: 100
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/refunds/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockRefund]);

    const res = await request(app).get("/api/refunds/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/refunds/getById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockRefund as any);

    const res = await request(app).get(`/api/refunds/getById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE STATUS ================= */
  it("PATCH /api/refunds/status/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockRefund, status: "SUCCESS" } as any);

    const res = await request(app)
      .patch(`/api/refunds/status/${TEST_UUID}`)
      .send({ status: "SUCCESS" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= MARK FAILED ================= */
  it("PATCH /api/refunds/failed/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockRefund, status: "FAILED" } as any);

    const res = await request(app)
      .patch(`/api/refunds/failed/${TEST_UUID}`)
      .send({ reason: "Network error" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= MARK SUCCESS ================= */
  it("PATCH /api/refunds/success/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockRefund, status: "SUCCESS" } as any);

    const res = await request(app)
      .patch(`/api/refunds/success/${TEST_UUID}`)
      .send({ provider_refund_id: "resp-123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/refunds/delete/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/refunds/delete/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});