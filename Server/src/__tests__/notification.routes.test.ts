
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
    if (!req.user) {
      req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "Admin" };
    }
    next();
  },
}));

import request from "supertest";
import express from "express";
import NotificationRouter from "../routes/notification.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

const ADMIN_UUID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_UUID = "550e8400-e29b-41d4-a716-446655440099";

const app = express();
app.use(express.json());
app.use("/api/notifications", NotificationRouter);

const nonAdminApp = express();
nonAdminApp.use(express.json());
nonAdminApp.use((req: any, _res: any, next: any) => {
  req.user = { id: OTHER_UUID, role_name: "SubAdmin" };
  next();
});
nonAdminApp.use("/api/notifications", NotificationRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockNotif = { id: TEST_UUID, user_id: TEST_UUID, status: "PENDING" };

describe("Notification Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/notifications/Create - success", async () => {
    (DBconnection.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: TEST_UUID }, error: null }),
    });
    mockService.create.mockResolvedValue(mockNotif as any);

    const res = await request(app)
      .post("/api/notifications/Create")
      .send({
        user_id: TEST_UUID,
        channel: "EMAIL",
        payload: { key: "value" },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/notifications/getList - success", async () => {
    mockService.getAllData.mockResolvedValue([mockNotif]);

    const res = await request(app).get("/api/notifications/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET PENDING ================= */
  it("GET /api/notifications/pending - success", async () => {
    mockService.getDataByField.mockResolvedValue([mockNotif]);

    const res = await request(app).get("/api/notifications/pending");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY USER (ownership) ================= */
  it("GET /api/notifications/user/:user_id - Admin can fetch any user's notifications", async () => {
    mockService.getDataByField.mockResolvedValue([mockNotif]);

    const res = await request(app).get(`/api/notifications/user/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/notifications/user/:user_id - non-Admin fetching own notifications succeeds", async () => {
    mockService.getDataByField.mockResolvedValue([mockNotif]);

    const res = await request(nonAdminApp).get(`/api/notifications/user/${OTHER_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/notifications/user/:user_id - 403 when non-Admin requests another user's notifications (IDOR prevention)", async () => {
    const res = await request(nonAdminApp).get(`/api/notifications/user/${ADMIN_UUID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/notifications/:id - success", async () => {
    mockService.getDataById.mockResolvedValue(mockNotif as any);

    const res = await request(app).get(`/api/notifications/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= MARK SENT ================= */
  it("PATCH /api/notifications/sent/:id - success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockNotif, status: "SENT" } as any);

    const res = await request(app).patch(`/api/notifications/sent/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= MARK FAILED ================= */
  it("PATCH /api/notifications/failed/:id - success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockNotif, status: "FAILED" } as any);

    const res = await request(app)
      .patch(`/api/notifications/failed/${TEST_UUID}`)
      .send({ error_message: "Network Error" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/notifications/delete/:id - success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/notifications/delete/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
