
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
import LocationRouter from "../routes/location.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/locations", LocationRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockCountry = { id: TEST_UUID, name: "America" };

describe("Location Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/locations/create (country) → success", async () => {
    mockService.getDataByField.mockResolvedValue([]);
    mockService.create.mockResolvedValue(mockCountry as any);

    const res = await request(app)
      .post("/api/locations/create")
      .send({ table: "country", payload: { name: "America" } });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/locations/:table/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockCountry]);

    const res = await request(app).get("/api/locations/country/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/locations/:table/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockCountry as any);

    const res = await request(app).get(`/api/locations/country/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/locations/:table/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockCountry, name: "USA" } as any);

    const res = await request(app)
      .put(`/api/locations/country/${TEST_UUID}`)
      .send({ name: "USA" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("USA");
  });

  /* ================= DELETE ================= */
  it("DELETE /api/locations/:table/:id → success", async () => {
    mockService.getDataByField.mockResolvedValue([]); // no state for country
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/locations/country/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET STATES BY COUNTRY ================= */
  it("GET /api/locations/state/by-country → success", async () => {
    mockService.getDataByField.mockResolvedValue([{ id: TEST_UUID, name: "Tamil Nadu" }]);

    const res = await request(app)
      .get("/api/locations/state/by-country")
      .query({ country_id: TEST_UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET CITIES BY STATE ================= */
  it("GET /api/locations/city/by-state → success", async () => {
    mockService.getDataByField.mockResolvedValue([{ id: TEST_UUID, name: "Chennai" }]);

    const res = await request(app)
      .get("/api/locations/city/by-state")
      .query({ state_id: TEST_UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
