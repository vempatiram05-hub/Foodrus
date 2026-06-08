
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
import DeliveryPartnerRouter from "../routes/deliveryPartner.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/delivery-partners", DeliveryPartnerRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const validUserId = "550e8400-e29b-41d4-a716-446655440001";
const mockPartner = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  user_id: validUserId,
  vehicle_type: "BIKE",
};

describe("Delivery Partner Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /Create → success", async () => {
    mockService.getDataByField.mockResolvedValue([]);
    mockService.create.mockResolvedValue(mockPartner as any);

    const res = await request(app)
      .post("/api/delivery-partners/Create")
      .send({ user_id: validUserId, vehicle_type: "BIKE" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockPartner.id);
  });

  /* ================= GET LIST ================= */
  it("GET /getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockPartner]);

    const res = await request(app).get("/api/delivery-partners/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /GetById/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockPartner as any);

    const res = await request(app).get(`/api/delivery-partners/GetById/${mockPartner.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockPartner.id);
  });

  /* ================= UPDATE ================= */
  it("PATCH /update/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockPartner, vehicle_type: "CAR" } as any);

    const res = await request(app)
      .patch(`/api/delivery-partners/update/${mockPartner.id}`)
      .send({ vehicle_type: "CAR" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /delete/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({} as any);

    const res = await request(app).delete(`/api/delivery-partners/delete/${mockPartner.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});


