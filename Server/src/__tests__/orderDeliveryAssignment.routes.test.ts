
/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
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
import OrderDeliveryAssignmentRouter from "../routes/orderDeliveryAssignment.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

const app = express();
app.use(express.json());
app.use("/api/order-delivery-assignments", OrderDeliveryAssignmentRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockAssignment = { 
  id: TEST_UUID, 
  order_id: TEST_UUID, 
  delivery_partner_id: TEST_UUID,
  status: "assigned"
};

describe("Order Delivery Assignment Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= ASSIGN ================= */
  it("POST /api/order-delivery-assignments/assign → success", async () => {
    mockService.create.mockResolvedValue(mockAssignment as any);

    const res = await request(app)
      .post("/api/order-delivery-assignments/assign")
      .send({
        order_id: TEST_UUID,
        delivery_partner_id: TEST_UUID
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/order-delivery-assignments/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockAssignment]);

    const res = await request(app).get("/api/order-delivery-assignments/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= PICKED ================= */
  it("PATCH /api/order-delivery-assignments/picked/:id → success", async () => {
    (DBconnection.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ 
        data: { ...mockAssignment, picked_at: new Date().toISOString() }, 
        error: null 
      }),
    });

    const res = await request(app).patch(`/api/order-delivery-assignments/picked/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Order marked as picked");
  });

  /* ================= DELIVERED ================= */
  it("PATCH /api/order-delivery-assignments/delivered/:id → success", async () => {
    (DBconnection.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ 
        data: { ...mockAssignment, delivered_at: new Date().toISOString() }, 
        error: null 
      }),
    });

    const res = await request(app).patch(`/api/order-delivery-assignments/delivered/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Order marked as delivered");
  });

  /* ================= GET BY ORDER ================= */
  it("GET /api/order-delivery-assignments/order/:order_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockAssignment]);

    const res = await request(app).get(`/api/order-delivery-assignments/order/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY PARTNER ================= */
  it("GET /api/order-delivery-assignments/partner/:delivery_partner_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockAssignment]);

    const res = await request(app).get(`/api/order-delivery-assignments/partner/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
