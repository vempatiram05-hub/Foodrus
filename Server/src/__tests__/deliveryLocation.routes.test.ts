
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
import DeliveryLocationRouter from "../routes/deliveryLocation.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/delivery-locations", DeliveryLocationRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const validPartnerId = "550e8400-e29b-41d4-a716-446655440001";
const validOrderId = "550e8400-e29b-41d4-a716-446655440002";
const mockLocation = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  delivery_partner_id: validPartnerId,
  latitude: 12.9716,
  longitude: 77.5946,
  recorded_at: new Date().toISOString(),
};

describe("Delivery Location Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= RECORD ================= */
  it("POST / → success", async () => {
    mockService.create.mockResolvedValue(mockLocation as any);

    const res = await request(app)
      .post("/api/delivery-locations")
      .send({
        delivery_partner_id: validPartnerId,
        latitude: 12.9716,
        longitude: 77.5946,
        order_id: validOrderId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET LIST ================= */
  it("GET /getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockLocation]);

    const res = await request(app).get("/api/delivery-locations/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ORDER ================= */
  it("GET /order/:order_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockLocation]);

    const res = await request(app).get(`/api/delivery-locations/order/${validOrderId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockLocation.id);
  });

  /* ================= GET BY PARTNER ================= */
  it("GET /partner/:delivery_partner_id → success", async () => {
    mockService.getDataByField.mockResolvedValue([mockLocation]);

    const res = await request(app).get(`/api/delivery-locations/partner/${validPartnerId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockLocation.id);
  });
});
