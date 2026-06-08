
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
    req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "Customer" };
    next();
  },
}));

import request from "supertest";
import express from "express";
import CartItemRouter from "../routes/cartItem.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/cart-items", CartItemRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const validCartId = "550e8400-e29b-41d4-a716-446655440001";
const validProductId = "550e8400-e29b-41d4-a716-446655440002";
const mockCartItem = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  cart_id: validCartId,
  product_id: validProductId,
  quantity: 2,
  unit_price: 100,
};

describe("CartItem Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= ADD ITEM ================= */
  it("POST /api/cart-items/AddCartItem → add item", async () => {
    mockService.create.mockResolvedValue(mockCartItem as any);

    const res = await request(app)
      .post("/api/cart-items/AddCartItem")
      .send({
        cart_id: validCartId,
        product_id: validProductId,
        quantity: 2,
        unit_price: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockCartItem.id);
  });

  /* ================= GET LIST ================= */
  it("GET /api/cart-items/getList → list items", async () => {
    mockService.getAllData.mockResolvedValue([mockCartItem]);

    const res = await request(app).get("/api/cart-items/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].id).toBe(mockCartItem.id);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/cart-items/GetCartItemById/:id → get by id", async () => {
    mockService.getDataById.mockResolvedValue(mockCartItem as any);

    const res = await request(app).get(`/api/cart-items/GetCartItemById/${mockCartItem.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockCartItem.id);
  });

  /* ================= UPDATE QUANTITY ================= */
  it("PUT /api/cart-items/UpdateQuantity/:id → update quantity", async () => {
    mockService.updateById.mockResolvedValue({ ...mockCartItem, quantity: 5 } as any);

    const res = await request(app)
      .put(`/api/cart-items/UpdateQuantity/${mockCartItem.id}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.quantity).toBe(5);
  });

  /* ================= DELETE ITEM ================= */
  it("DELETE /api/cart-items/Remove/:id → remove item", async () => {
    mockService.deleteData.mockResolvedValue(true as any);

    const res = await request(app).delete(`/api/cart-items/Remove/${mockCartItem.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= CLEAR CART ================= */
  it("DELETE /api/cart-items/Clear/:cart_id → clear cart", async () => {
    mockService.getDataByField.mockResolvedValue([mockCartItem]);
    mockService.deleteData.mockResolvedValue(true as any);

    const res = await request(app).delete(`/api/cart-items/Clear/${validCartId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});







