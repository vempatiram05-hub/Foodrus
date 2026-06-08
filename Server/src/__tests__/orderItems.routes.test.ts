
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

jest.mock("../utils/generateInvoice", () => ({
  generateInvoice: jest.fn().mockResolvedValue("/tmp/invoice.pdf"),
}));

jest.mock("../utils/mailer", () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({ id: "mock-email-id" }),
}));

import request from "supertest";
import express from "express";
import OrderItemsRouter from "../routes/orderItems.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

const app = express();
app.use(express.json());
app.use("/api/order-items", OrderItemsRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockItem = { 
  id: TEST_UUID, 
  order_id: TEST_UUID, 
  product_id: TEST_UUID, 
  quantity: 2, 
  unit_price: 100 
};

describe("Order Items Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(10000); // 10s timeout for parallel runs
  });

  /* ================= CREATE ================= */
  it("POST /api/order-items/create → success", async () => {
    mockService.create.mockResolvedValue(mockItem as any);
    mockService.getDataById.mockImplementation(async (id, table) => {
      if (table === "orders") return { id: TEST_UUID, user_id: TEST_UUID, address_id: TEST_UUID, order_number: "ORD-123" };
      if (table === "users") return { id: TEST_UUID, email: "test@example.com" };
      if (table === "addresses") return { id: TEST_UUID, line1: "Street" };
      if (table === "products") return { id: TEST_UUID, name: "Product" };
      return null;
    });
    mockService.getDataByField.mockResolvedValue([mockItem]);

    const res = await request(app)
      .post("/api/order-items/create")
      .send({
        order_id: TEST_UUID,
        product_id: TEST_UUID,
        quantity: 2,
        unit_price: 100
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/order-items/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockItem]);

    const res = await request(app).get("/api/order-items/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/order-items/getById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockItem as any);

    const res = await request(app).get(`/api/order-items/getById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET BY ORDER ID ================= */
  it("GET /api/order-items/getByOrder/:order_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockItem]);

    const res = await request(app).get(`/api/order-items/getByOrder/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE ================= */
  it("PATCH /api/order-items/update/:id → success", async () => {
    (DBconnection.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { ...mockItem, quantity: 5 }, error: null }),
    });

    const res = await request(app)
      .patch(`/api/order-items/update/${TEST_UUID}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.quantity).toBe(5);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/order-items/delete/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/order-items/delete/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
