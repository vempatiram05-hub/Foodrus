
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
import NotificationChannelRouter from "../routes/notificationChannel.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/notification-channels", NotificationChannelRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockChannel = { id: TEST_UUID, name: "EMAIL", provider: "SMTP" };

describe("Notification Channel Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/notification-channels/create → success", async () => {
    mockService.getDataByField.mockResolvedValue([]);
    mockService.create.mockResolvedValue(mockChannel as any);

    const res = await request(app)
      .post("/api/notification-channels/create")
      .send({ name: "EMAIL", provider: "SMTP" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/notification-channels/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockChannel]);

    const res = await request(app).get("/api/notification-channels/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/notification-channels/getbyid/:id → success", async () => {
    mockService.getDataById.mockResolvedValue(mockChannel as any);

    const res = await request(app).get(`/api/notification-channels/getbyid/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE ================= */
  it("PATCH /api/notification-channels/update/:id → success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockChannel, provider: "AWS" } as any);

    const res = await request(app)
      .patch(`/api/notification-channels/update/${TEST_UUID}`)
      .send({ provider: "AWS" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/notification-channels/delete/:id → success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/notification-channels/delete/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
