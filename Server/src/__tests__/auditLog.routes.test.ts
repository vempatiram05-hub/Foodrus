
/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
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
import { DBconnection } from "../config/DBConnect";
import AuditLogRouter from "../routes/auditLog.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/audit-logs", AuditLogRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const mockLog = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  entity_type: "order",
  entity_id: "550e8400-e29b-41d4-a716-446655440002",
  action: "CREATED",
  metadata: { price: 100 },
};

describe("Audit Log Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/audit-logs/create → create audit log", async () => {
    mockService.create.mockResolvedValue(mockLog as any);

    const res = await request(app).post("/api/audit-logs/create").send({
      user_id: mockLog.user_id,
      entity_type: mockLog.entity_type,
      entity_id: mockLog.entity_id,
      action: mockLog.action,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockLog.id);
  });

  /* ================= GET LIST ================= */
  it("GET /api/audit-logs/getList → get all", async () => {
    mockService.getAllData.mockResolvedValue([mockLog]);

    const res = await request(app).get("/api/audit-logs/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].id).toBe(mockLog.id);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/audit-logs/getById/:id → get by id", async () => {
    mockService.getDataById.mockResolvedValue(mockLog as any);

    const res = await request(app).get(`/api/audit-logs/getById/${mockLog.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockLog.id);
  });

  /* ================= GET BY USER ================= */
  it("GET /api/audit-logs/user/:user_id → get by user", async () => {
    (DBconnection.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [mockLog], error: null }),
    });

    const res = await request(app).get(`/api/audit-logs/user/${mockLog.user_id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].user_id).toBe(mockLog.user_id);
  });

  /* ================= GET BY ENTITY ================= */
  it("GET /api/audit-logs/entity/:entity_type/:entity_id → get by entity", async () => {
    (DBconnection.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [mockLog], error: null }),
    });

    const res = await request(app).get(`/api/audit-logs/entity/${mockLog.entity_type}/${mockLog.entity_id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].entity_type).toBe(mockLog.entity_type);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/audit-logs/update/:id → update log", async () => {
    mockService.updateById.mockResolvedValue({ ...mockLog, action: "UPDATED" });

    const res = await request(app)
      .put(`/api/audit-logs/update/${mockLog.id}`)
      .send({ action: "UPDATED" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe("UPDATED");
  });

  /* ================= DELETE ================= */
  it("DELETE /api/audit-logs/delete/:id → delete log", async () => {
    mockService.deleteData.mockResolvedValue(true as any);

    const res = await request(app).delete(`/api/audit-logs/delete/${mockLog.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});


