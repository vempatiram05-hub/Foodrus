
/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
      in: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      rpc: jest.fn(),
    })),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "StoreAdmin" };
    next();
  },
  optionalAuthMiddlewares: (req: any, res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "Customer" };
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => next(),
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) => next(),
}));

jest.mock("../middleware/upload", () => ({
  memoryUploader: {
    array: jest.fn(() => (req: any, res: any, next: any) => {
      // Populate fields needed for validation if they are missing
      // Real multer would populate this from the multipart stream
      if (req.method === 'POST' || req.method === 'PUT') {
        req.body = {
          name: "Pizza",
          ...req.body
        };
      }
      req.files = [
        {
          originalname: "test.png",
          buffer: Buffer.from("test"),
          mimetype: "image/png"
        }
      ];
      next();
    }),
  },
}));

jest.mock("../utils/file.util", () => ({
  generateImageName: jest.fn(() => "test.png"),
}));

jest.mock("../utils/localSignedUrl", () => ({
  generateLocalSignedUrl: (p: string) => `http://localhost:3000${p}`,
}));

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (err: any) => ({
    message: err?.message || "Mocked error",
  }),
}));

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

import request from "supertest";
import express from "express";
import ProductRouter from "../routes/product.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/products", ProductRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockProduct = { 
  id: TEST_UUID, 
  name: "Pizza", 
  price: 15, 
  store_id: TEST_UUID,
  images: ["/uploads/test.png"]
};

describe("Product Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/products/CreateProduct → success", async () => {
    mockService.getData.mockResolvedValue([]);
    mockService.create.mockResolvedValue(mockProduct as any);
    mockService.updateById.mockResolvedValue(mockProduct as any);

    const res = await request(app)
      .post("/api/products/CreateProduct")
      .field("name", "Pizza")
      .attach("images", Buffer.from("test"), "test.png");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET LIST ================= */
  it("GET /api/products/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockProduct]);

    const res = await request(app).get("/api/products/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/products/GetProductById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockProduct as any);

    const res = await request(app).get(`/api/products/GetProductById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/products/UpdateProductById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockProduct as any);
    mockService.getData.mockResolvedValue([]);
    mockService.updateById.mockResolvedValue({ ...mockProduct, name: "Pizza Updated" } as any);

    const res = await request(app)
      .put(`/api/products/UpdateProductById/${TEST_UUID}`)
      .field("name", "Pizza Updated")
      .attach("images", Buffer.from("test"), "test.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/products/DeleteProduct/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockProduct as any);
    mockService.getDataByField.mockResolvedValue([{ id: TEST_UUID }]);
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/products/DeleteProduct/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

});
