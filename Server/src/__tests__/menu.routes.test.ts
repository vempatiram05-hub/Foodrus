
/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
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
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) => next(),
  optionalAuthMiddlewares: [(req: any, res: any, next: any) => next()],
}));

import request from "supertest";
import express from "express";
import MenuRouter from "../routes/menu.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

const ADMIN_UUID = "550e8400-e29b-41d4-a716-446655440000";
const SUBADMIN_UUID = "550e8400-e29b-41d4-a716-446655440099";

const app = express();
app.use(express.json());
app.use("/api/menus", MenuRouter);

const subAdminApp = express();
subAdminApp.use(express.json());
subAdminApp.use((req: any, _res: any, next: any) => {
  req.user = { id: SUBADMIN_UUID, role_name: "SubAdmin" };
  next();
});
subAdminApp.use("/api/menus", MenuRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockMenu = { id: TEST_UUID, status: "PENDING", store_id: TEST_UUID };

/** Build a full chainable query mock where `terminalMethod` resolves to `value`. */
function makeChain(value: object, terminalMethod = "single") {
  const methods = ["select", "eq", "neq", "in", "or", "order", "limit", "update", "maybeSingle", "single", "is"];
  const chain: any = {};
  methods.forEach((m) => {
    chain[m] = m === terminalMethod
      ? jest.fn().mockResolvedValue(value)
      : jest.fn().mockReturnValue(chain);
  });
  return chain;
}

describe("Menu Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= CREATE ================= */
  it("POST /api/menus/CreateMenus - success", async () => {
    (DBconnection.from as jest.Mock)
      // 1. products approval-status check
      .mockReturnValueOnce(makeChain({ data: [{ id: TEST_UUID }], error: null }, "eq"))
      // 2. duplicate-menu check (weekday menu, terminal = .is())
      .mockReturnValueOnce(makeChain({ data: [], error: null }, "is"));

    mockService.create.mockResolvedValue(mockMenu as any);

    const res = await request(app)
      .post("/api/menus/CreateMenus")
      .send({
        store_id: TEST_UUID,
        products: [TEST_UUID],
        time_slot_id: TEST_UUID,
        weekday: "MONDAY",
        submitted_by: TEST_UUID,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= GET LIST ================= */
  it("GET /api/menus/getList - success", async () => {
    // Controller calls for Admin role (no pagination):
    //   1. users active StoreAdmins (neq terminal)
    //   2. stores for those admins (eq terminal)
    //   3. menus query (limit terminal)
    (DBconnection.from as jest.Mock)
      .mockReturnValueOnce(makeChain({ data: [], error: null }, "neq"))   // active admins
      .mockReturnValueOnce(makeChain({ data: [], error: null }, "eq"))    // active stores
      .mockReturnValueOnce(makeChain({ data: [mockMenu], count: 1, error: null }, "limit")); // menus

    const res = await request(app).get("/api/menus/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= GET BY ID ================= */
  it("GET /api/menus/GetMenuById/:id - success", async () => {
    mockService.getDataById.mockResolvedValue(mockMenu as any);

    const res = await request(app).get(`/api/menus/GetMenuById/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_UUID);
  });

  /* ================= UPDATE ================= */
  it("PUT /api/menus/UpdateMenu/:id - success", async () => {
    mockService.getDataById.mockResolvedValue({ ...mockMenu, date: null } as any);
    mockService.updateById.mockResolvedValue({ ...mockMenu, notes: "Updated" } as any);

    const res = await request(app)
      .put(`/api/menus/UpdateMenu/${TEST_UUID}`)
      .send({ notes: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= UPDATE STATUS ================= */
  it("PATCH /api/menus/UpdateMenuStatus/:id - success", async () => {
    mockService.updateById.mockResolvedValue({ ...mockMenu, status: "APPROVED" } as any);

    const res = await request(app)
      .patch(`/api/menus/UpdateMenuStatus/${TEST_UUID}`)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= DELETE ================= */
  it("DELETE /api/menus/DeleteMenu/:id - success", async () => {
    mockService.deleteData.mockResolvedValue({ message: "deleted" } as any);

    const res = await request(app).delete(`/api/menus/DeleteMenu/${TEST_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= ADD PENDING PRODUCTS ================= */
  it("POST /api/menus/AddPendingProducts/:id - success", async () => {
    mockService.getDataById.mockResolvedValue({ ...mockMenu, status: "APPROVED", product_id: [] } as any);
    mockService.updateById.mockResolvedValue(mockMenu as any);

    const res = await request(app)
      .post(`/api/menus/AddPendingProducts/${TEST_UUID}`)
      .send({ products: [TEST_UUID] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ================= TOGGLE ITEM AVAILABILITY ================= */
  it("PATCH /api/menus/ToggleItemAvailability/:id - 403 for Admin role", async () => {
    const res = await request(app)
      .patch(`/api/menus/ToggleItemAvailability/${TEST_UUID}`)
      .send({ product_id: TEST_UUID, available: false });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
