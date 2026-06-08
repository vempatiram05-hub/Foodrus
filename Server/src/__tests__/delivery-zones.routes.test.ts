
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
import DeliveryZoneRouter from "../routes/delivery-zones.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/delivery-zones", DeliveryZoneRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const validStoreId = "550e8400-e29b-41d4-a716-446655440001";
const mockZone = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  store_id: validStoreId,
  max_radius_km: 5,
  base_delivery_fee: 30,
  per_km_fee: 5,
};

describe("Delivery Zone Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST / → success", async () => {
    mockService.getDataByField.mockResolvedValue([]);
    mockService.create.mockResolvedValue(mockZone as any);

    const res = await request(app)
      .post("/api/delivery-zones")
      .send({
        store_id: validStoreId,
        max_radius_km: 5,
        base_delivery_fee: 30,
        per_km_fee: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET LIST ================= */
  it("GET /getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockZone]);

    const res = await request(app).get("/api/delivery-zones/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY STORE ================= */
  it("GET /store/:store_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockZone]);

    const res = await request(app).get(`/api/delivery-zones/store/${validStoreId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockZone as any);

    const res = await request(app).get(`/api/delivery-zones/${mockZone.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE ================= */
  it("PATCH /update/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockZone, max_radius_km: 10 } as any);

    const res = await request(app)
      .patch(`/api/delivery-zones/update/${mockZone.id}`)
      .send({ max_radius_km: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /delete/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/delivery-zones/delete/${mockZone.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
