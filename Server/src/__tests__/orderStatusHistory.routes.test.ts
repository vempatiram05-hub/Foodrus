
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
import OrderStatusHistoryRouter from "../routes/orderStatusHistory.route";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/order-status-history", OrderStatusHistoryRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockHistory = { 
  id: TEST_UUID, 
  order_id: TEST_UUID, 
  from_status: "pending", 
  to_status: "confirmed" 
};

describe("Order Status History Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/order-status-history/Create → success", async () => {
    mockService.create.mockResolvedValue(mockHistory as any);

    const res = await request(app)
      .post("/api/order-status-history/Create")
      .send({
        order_id: TEST_UUID,
        from_status: "pending",
        to_status: "confirmed",
        changed_by: TEST_UUID,
        note: "Approved"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/order-status-history/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockHistory]);

    const res = await request(app).get("/api/order-status-history/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/order-status-history/getById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockHistory as any);

    const res = await request(app).get(`/api/order-status-history/getById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET BY ORDER ID ================= */
  it("GET /api/order-status-history/order/:order_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockHistory]);

    const res = await request(app).get(`/api/order-status-history/order/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/order-status-history/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/order-status-history/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
