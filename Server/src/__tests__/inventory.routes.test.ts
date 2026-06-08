
/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
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
}));

import request from "supertest";
import express from "express";
import InventoryRouter from "../routes/inventory.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

const app = express();
app.use(express.json());
app.use("/api/inventories", InventoryRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const validProductId = "550e8400-e29b-41d4-a716-446655440001";
const mockInventory = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  product_id: validProductId,
  current_stock: 10,
  stock_threshold: 5,
};

describe("Inventory Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /createInventory → success", async () => {
    mockService.create.mockResolvedValue(mockInventory as any);

    const res = await request(app)
      .post("/api/inventories/createInventory")
      .send({ product_id: validProductId, current_stock: 10 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET LIST ================= */
  it("GET /getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockInventory]);

    const res = await request(app).get("/api/inventories/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET LOW STOCK ================= */
  it("GET /getLowStock → success", async () => {
    (DBconnection.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ data: [mockInventory], error: null }),
    });

    const res = await request(app).get("/api/inventories/getLowStock");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /getById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockInventory as any);

    const res = await request(app).get(`/api/inventories/getById/${mockInventory.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY PRODUCT ================= */
  it("GET /productByProductId/:product_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockInventory]);

    const res = await request(app).get(`/api/inventories/productByProductId/${validProductId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE STOCK ================= */
  it("PATCH /productByProductId/UpdateStock/:product_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockInventory]);
    mockService.updateById.mockResolvedValue({ ...mockInventory, current_stock: 15 } as any);

    const res = await request(app)
      .patch(`/api/inventories/productByProductId/UpdateStock/${validProductId}`)
      .send({ current_stock: 15 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /deleteById/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/inventories/deleteById/${mockInventory.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
