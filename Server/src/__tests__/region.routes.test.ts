
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
import RegionRouter from "../routes/region.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/regions", RegionRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockRegion = { 
  id: TEST_UUID, 
  name: "Region 1", 
  code: "R1" 
};

describe("Region Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/regions/createRegion → success", async () => {
    mockService.getData.mockResolvedValue([]);
    mockService.create.mockResolvedValue(mockRegion as any);

    const res = await request(app)
      .post("/api/regions/createRegion")
      .send({ name: "Region 1", code: "R1" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  it("POST /api/regions/createRegion → conflict (duplicate code)", async () => {
    mockService.getData.mockResolvedValue([mockRegion]);

    const res = await request(app)
      .post("/api/regions/createRegion")
      .send({ name: "Region 1", code: "R1" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  /* ================= GET LIST ================= */
  it("GET /api/regions/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockRegion]);

    const res = await request(app).get("/api/regions/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/regions/getRegionById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockRegion as any);

    const res = await request(app).get(`/api/regions/getRegionById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/regions/updateRegion/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockRegion as any);
    mockService.getData.mockResolvedValue([]);
    mockService.updateById.mockResolvedValue({ ...mockRegion, name: "Region Updated" } as any);

    const res = await request(app)
      .put(`/api/regions/updateRegion/${TEST_UUID}`)
      .send({ name: "Region Updated" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/regions/deleteRegion/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/regions/deleteRegion/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
