
/* ================= MOCK ================= */
const mockDB = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  rpc: jest.fn(),
};

jest.mock("../config/DBConnect", () => ({
  DBconnection: mockDB,
}));

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: "550e8400-e29b-41d4-a716-446655440000", role_name: "Admin" };
    next();
  },
}));

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (err: any) => ({
    message: err?.message || "Mocked error",
  }),
}));

import request from "supertest";
import express from "express";
import TimeSlotRouter from "../routes/timeSlot.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(express.json());
app.use("/api/time-slots", TimeSlotRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockTimeSlot = { 
  id: TEST_UUID, 
  name: "Morning", 
  code: "MOR",
  normalized_name: "morning",
  normalized_code: "mor",
  start_time: "08:00",
  end_time: "12:00"
};

describe("TimeSlot Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/time-slots/CreateTimeSlot → success", async () => {
    // Duplicate checks
    mockDB.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // nameExists
    mockDB.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // codeExists
    // Insert
    mockDB.single.mockResolvedValueOnce({ data: mockTimeSlot, error: null });

    const res = await request(app)
      .post("/api/time-slots/CreateTimeSlot")
      .send({
        name: "Morning",
        code: "MOR",
        start_time: "08:00",
        end_time: "12:00"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  it("POST /api/time-slots/CreateTimeSlot → conflict (duplicate name/code)", async () => {
    mockDB.maybeSingle.mockResolvedValueOnce({ data: { id: TEST_UUID }, error: null }); // nameExists
    mockDB.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // codeExists

    const res = await request(app)
      .post("/api/time-slots/CreateTimeSlot")
      .send({
        name: "Morning",
        code: "MOR"
      });

    // Controller returns 400 on throws
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("TimeSlot name already exists");
  });

  /* ================= GET LIST ================= */
  it("GET /api/time-slots/getList → success", async () => {
    mockService.getAllData.mockResolvedValue([mockTimeSlot]);

    const res = await request(app).get("/api/time-slots/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/time-slots/GetTimeSlotById/:id → success", async () => {
    // UniqueController is used internally, we need to mock it or UniqueService.prototype if it uses that.
    // TimeSlotController.getById calls uniqueTimeSlotController.getById.
    // UniqueController uses UniqueService internally.
    mockService.getDataById.mockResolvedValue(mockTimeSlot as any);

    const res = await request(app).get(`/api/time-slots/GetTimeSlotById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/time-slots/UpdateTimeSlot/:id → success", async () => {
    // Existing record
    mockDB.maybeSingle.mockResolvedValueOnce({ data: mockTimeSlot, error: null });
    // Duplicate checks (name & code)
    mockDB.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockDB.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Update
    mockDB.single.mockResolvedValueOnce({ data: { ...mockTimeSlot, name: "Morning Updated" }, error: null });

    const res = await request(app)
      .put(`/api/time-slots/UpdateTimeSlot/${TEST_UUID}`)
      .send({ name: "Morning Updated" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Morning Updated");
  });

  /* ================= DELETE ================= */
  it("DELETE /api/time-slots/DeleteTimeSlot/:id → success", async () => {
    // TimeSlotController.delete calls uniqueTimeSlotController.deleteById.
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/time-slots/DeleteTimeSlot/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
