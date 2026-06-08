
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
import ProductChangeLogsRouter from "../routes/productChangeLogs.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/product-change-logs", ProductChangeLogsRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockLog = { 
  id: TEST_UUID, 
  product_id: TEST_UUID, 
  changed_by: TEST_UUID, 
  change_type: "PRICE_UPDATE" 
};

describe("Product Change Logs Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/product-change-logs/createLog → success", async () => {
    mockService.create.mockResolvedValue(mockLog as any);

    const res = await request(app)
      .post("/api/product-change-logs/createLog")
      .send({
        product_id: TEST_UUID,
        changed_by: TEST_UUID,
        change_type: "PRICE_UPDATE"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY PRODUCT ================= */
  it("GET /api/product-change-logs/productByProductId/:product_id → success", async () => {
    mockService.getData.mockResolvedValue([{ ...mockLog, created_at: new Date().toISOString() }]);

    const res = await request(app).get(`/api/product-change-logs/productByProductId/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY USER ================= */
  it("GET /api/product-change-logs/userByUserId/:user_id → success", async () => {
    mockService.getData.mockResolvedValue([{ ...mockLog, created_at: new Date().toISOString() }]);

    const res = await request(app).get(`/api/product-change-logs/userByUserId/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET RECENT ================= */
  it("GET /api/product-change-logs/recent → success", async () => {
    mockService.getData.mockResolvedValue([{ ...mockLog, created_at: new Date().toISOString() }]);

    const res = await request(app).get("/api/product-change-logs/recent");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
