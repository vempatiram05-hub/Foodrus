
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
import CartRouter from "../routes/cart.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/carts", CartRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const mockCart = {
  id: "2a9aa629-6ded-445d-8101-b5273093f9ac",
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  store_id: "550e8400-e29b-41d4-a716-446655440001",
};

describe("Cart Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE CART ================= */
  it("POST /api/carts/CreateCart → create cart", async () => {
    mockService.create.mockResolvedValue(mockCart as any);

    const res = await request(app)
      .post("/api/carts/CreateCart")
      .send({ user_id: mockCart.user_id, store_id: mockCart.store_id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockCart.id);
  });

  /* ================= GET LIST ================= */
  it("GET /api/carts/getList → list carts", async () => {
    mockService.getAllData.mockResolvedValue([mockCart]);

    const res = await request(app).get("/api/carts/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].id).toBe(mockCart.id);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/carts/:id → get cart by id", async () => {
    mockService.getDataById.mockResolvedValue(mockCart as any);

    const res = await request(app).get(`/api/carts/${mockCart.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockCart.id);
  });

  /* ================= GET BY USER + STORE ================= */
  it("GET /api/carts?user_id=&store_id= → find by user and store", async () => {
    mockService.getDataByField.mockResolvedValue([mockCart]);

    const res = await request(app).get(
      `/api/carts?user_id=${mockCart.user_id}&store_id=${mockCart.store_id}`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockCart.id);
  });

  /* ================= DELETE CART ================= */
  it("DELETE /api/carts/delete/:id → delete cart", async () => {
    mockService.getDataById.mockResolvedValue(mockCart as any);
    mockService.deleteData.mockResolvedValue(true as any);

    const res = await request(app).delete(`/api/carts/delete/${mockCart.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});


