jest.mock("../services/helcim.service", () => ({ createHelcimPayment: jest.fn() }));


/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
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
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) => next(),
}));

jest.mock("../config/pool", () => ({
  pool: {
    connect: jest.fn(() => ({
      query: jest.fn().mockResolvedValue({ rows: [{ id: "550e8400-e29b-41d4-a716-446655440001", subtotal_amount: "100", total_amount: "115", tax_amount: "10", delivery_fee: "5", discount_amount: "0" }] }),
      release: jest.fn(),
    })),
  },
}));

import request from "supertest";
import express from "express";
import OrderRouter from "../routes/order.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

const app = express();
app.use(express.json());
app.use("/api/orders", OrderRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockOrder = { 
  id: TEST_UUID, 
  user_id: TEST_UUID, 
  address_id: TEST_UUID,
  order_status: "pending",
  subtotal_amount: 100,
  total_amount: 115
};

describe("Order Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/orders/createOrder → success", async () => {
    mockService.getDataById.mockResolvedValue({ id: TEST_UUID, full_name: "Test User" } as any);
    (DBconnection.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [{ id: TEST_UUID, store_id: TEST_UUID, name: "Product" }], error: null }),
    });

    const res = await request(app)
      .post("/api/orders/createOrder")
      .send({
        user_id: TEST_UUID,
        address_id: TEST_UUID,
        tax_amount: 10,
        delivery_fee: 5,
        items: [{
          quantity: 1,
          unit_price: 100,
          product_id: TEST_UUID
        }]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET LIST ================= */
  it("GET /api/orders/getList → success", async () => {
    (DBconnection.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [mockOrder], count: 1, error: null }),
    });

    const res = await request(app).get("/api/orders/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/orders/getOrderById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockOrder as any);

    const res = await request(app).get(`/api/orders/getOrderById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/orders/updateOrder/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockOrder, order_status: "confirmed" } as any);

    const res = await request(app)
      .put(`/api/orders/updateOrder/${TEST_UUID}`)
      .send({ order_status: "confirmed" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/orders/deleteOrder/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/orders/deleteOrder/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY USER ================= */
  it("GET /api/orders/getOrdersByUserId/:userId → success", async () => {
    mockService.getDataByField.mockImplementation(async (table: string) => {
      if (table === "orders") return [mockOrder];
      if (table === "order_items") return [{ id: "item-1", quantity: 1 }];
      return [];
    });

    const res = await request(app).get(`/api/orders/getOrdersByUserId/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= APPROVE ================= */
  it("PUT /api/orders/ApproveOrderById/approve/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockOrder, approval_status: "APPROVED" } as any);

    const res = await request(app)
      .put(`/api/orders/ApproveOrderById/approve/${TEST_UUID}`)
      .send({ approved_by: TEST_UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= REJECT ================= */
  it("PUT /api/orders/RejectOrderById/reject/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockOrder, approval_status: "REJECTED" } as any);

    const res = await request(app)
      .put(`/api/orders/RejectOrderById/reject/${TEST_UUID}`)
      .send({ rejected_by: TEST_UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
