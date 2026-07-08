/* ================= MOCKS ================= */

// Mutable variable that each test can set to simulate authenticated/unauthenticated requests.
let _mockUser: any = undefined;

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, res: any, next: any) => next(),
  optionalAuthMiddlewares: (req: any, _res: any, next: any) => {
    req.user = _mockUser;
    next();
  },
  requireRole: (..._roles: string[]) => (req: any, res: any, next: any) => next(),
  requirePermission: (_module: string, _action: string) => (req: any, res: any, next: any) => next(),
}));

jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    rpc: jest.fn(),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../utils/token", () => ({
  generateToken: jest.fn(() => "mocked-token"),
  verifyRefreshToken: jest.fn(),
  generateAccessToken: jest.fn(),
}));

jest.mock("../utils/mailer", () => ({
  generateOTP: jest.fn(() => ({
    otp: "123456",
    otp_expires_at: new Date(Date.now() + 10 * 60 * 1000),
  })),
  sendOTPToEmail: jest.fn().mockResolvedValue(true),
  sendForgotPasswordEmail: jest.fn().mockResolvedValue(true),
  sendSMS: jest.fn().mockResolvedValue(true),
}));

jest.mock("../utils/file.util", () => ({
  generateImageName: jest.fn(() => "test.png"),
  uploadFiles: jest.fn().mockResolvedValue([]),
  deleteFiles: jest.fn().mockResolvedValue(true),
}));

jest.mock("argon2", () => ({
  hash: jest.fn().mockResolvedValue("hashedpassword"),
  verify: jest.fn().mockResolvedValue(true),
}));

jest.mock("../middleware/upload", () => ({
  memoryUploader: {
    array: jest.fn(() => (req: any, res: any, next: any) => next()),
    single: jest.fn(() => (req: any, res: any, next: any) => next()),
  },
}));

import request from "supertest";
import express from "express";
import { DBconnection } from "../config/DBConnect";
import UserRouter from "../routes/user.routes";
import { UniqueService } from "../services/unique.service";
import { DEFAULT_PERMISSIONS } from "../constants/permissions";

/* ================= APP ================= */
const app = express();
app.use(express.json());
app.use("/api/users", UserRouter);

/* ================= HELPERS ================= */
const baseCustomer = {
  id: "user-abc-123",
  email: "new@example.com",
  full_name: "New User",
  phone: null,
  role_name: "Customer",
  is_active: false,
  account_status: "pending",
  permissions: DEFAULT_PERMISSIONS["Customer"],
  images: [],
};

function setupForCustomerCreate() {
  (UniqueService.prototype.getDataByField as jest.Mock)
    .mockResolvedValueOnce([]) // email check → no duplicate
    .mockResolvedValueOnce([]) // phone check → no duplicate
    .mockResolvedValue([{ id: "otp-1", otp: "hashed-otp", expires_at: new Date(Date.now() + 60000).toISOString() }]);
  (UniqueService.prototype.create as jest.Mock).mockResolvedValue(baseCustomer);
  (UniqueService.prototype.deleteData as jest.Mock).mockResolvedValue(true);
  (UniqueService.prototype.updateById as jest.Mock).mockResolvedValue(baseCustomer);
  (DBconnection.rpc as jest.Mock).mockResolvedValue({ data: [{ id: "circle-1" }], error: null });
}

const STORE_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const STORE_ADMIN_UUID = "b1b2c3d4-e5f6-7890-abcd-ef1234567890";
const storeRecord = { id: STORE_UUID, store_admin_id: STORE_ADMIN_UUID };

const storeAdminCreator = {
  id: STORE_ADMIN_UUID,
  role_name: "StoreAdmin",
  admin_id: "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
  superadmin_id: "d1b2c3d4-e5f6-7890-abcd-ef1234567890",
  sub_admin_id: "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
  permissions: {
    Users: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      approve: { allowed: true },
      showInMenu: { allowed: true },
    },
  },
};

function setupForEmployeeCreate(empRole = "Employee") {
  const empUser = {
    id: "emp-xyz",
    email: "emp@example.com",
    full_name: "New Employee",
    phone: null,
    role_name: empRole,
    is_active: true,
    account_status: "active",
    permissions: {},
    images: [],
  };
  (UniqueService.prototype.getDataByField as jest.Mock)
    .mockResolvedValueOnce([]) // email check
    .mockResolvedValueOnce([]) // phone check
    .mockResolvedValue([]);
  (UniqueService.prototype.create as jest.Mock).mockResolvedValue(empUser);
  (UniqueService.prototype.deleteData as jest.Mock).mockResolvedValue(true);
  (UniqueService.prototype.updateById as jest.Mock).mockResolvedValue(empUser);
  (DBconnection.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: storeRecord, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: storeRecord, error: null }),
  });
}

/* ================= TESTS ================= */

describe("POST /api/users/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _mockUser = undefined; // default: unauthenticated
  });

  /* ── 1. Customer self-registration: succeeds & permissions match defaults ── */
  describe("Customer self-registration", () => {
    it("succeeds and stored permissions equal DEFAULT_PERMISSIONS.Customer", async () => {
      setupForCustomerCreate();

      const res = await request(app).post("/api/users/register").send({
        email: "new@example.com",
        full_name: "New User",
        password: "Password123!",
        phone: "+919999999999",
        role_name: "Customer",
        latitude: 12.34,
        longitude: 56.78,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const createCall = (UniqueService.prototype.create as jest.Mock).mock.calls[0];
      const storedPermissions = createCall[1].permissions;
      expect(storedPermissions).toEqual(DEFAULT_PERMISSIONS["Customer"]);
    });

    it("with injected Analytics module: stored permissions must NOT contain Analytics", async () => {
      setupForCustomerCreate();

      const res = await request(app).post("/api/users/register").send({
        email: "new@example.com",
        full_name: "New User",
        password: "Password123!",
        phone: "+919999999999",
        role_name: "Customer",
        latitude: 12.34,
        longitude: 56.78,
        permissions: { Analytics: { view: { allowed: true } } },
      });

      expect(res.status).toBe(201);
      const createCall = (UniqueService.prototype.create as jest.Mock).mock.calls[0];
      const storedPermissions = createCall[1].permissions;
      expect(storedPermissions).not.toHaveProperty("Analytics");
    });
  });

  /* ── 2. Authenticated user creating a role outside their hierarchy → 403 ── */
  describe("Hierarchy enforcement", () => {
    it("StoreAdmin attempting to create a SubAdmin returns 403", async () => {
      _mockUser = {
        id: "store-admin-1",
        role_name: "StoreAdmin",
        permissions: { Users: { create: { allowed: true }, view: { allowed: true }, edit: { allowed: true }, delete: { allowed: true }, approve: { allowed: true }, showInMenu: { allowed: true } } },
      };
      // No duplicate mocks needed — hierarchy check fires before DB calls
      (UniqueService.prototype.getDataByField as jest.Mock).mockResolvedValue([]);

      const res = await request(app).post("/api/users/register").send({
        email: "sub@example.com",
        full_name: "Sub Admin",
        password: "Password123!",
        phone: "+918888888888",
        role_name: "SubAdmin",
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("Employee attempting to create another Employee returns 403 (not in hierarchy)", async () => {
      _mockUser = {
        id: "emp-1",
        role_name: "Employee",
        permissions: { Users: { create: { allowed: true }, view: { allowed: true } } },
      };
      (UniqueService.prototype.getDataByField as jest.Mock).mockResolvedValue([]);

      const res = await request(app).post("/api/users/register").send({
        email: "someone@example.com",
        full_name: "Someone",
        password: "Password123!",
        phone: "+917777777777",
        role_name: "Employee",
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("Admin can register a StoreAdmin directly and sets direct parent IDs", async () => {
      _mockUser = {
        id: "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
        role_name: "Admin",
        permissions: { Users: { create: { allowed: true }, view: { allowed: true } } },
      };
      const storeAdminUser = {
        id: "store-admin-xyz",
        email: "storeadmin@example.com",
        full_name: "New Store Admin",
        phone: "+919000000000",
        role_name: "StoreAdmin",
        is_active: true,
        account_status: "active",
        permissions: {},
        images: [],
      };
      (UniqueService.prototype.getDataByField as jest.Mock)
        .mockResolvedValueOnce([]) // email check
        .mockResolvedValueOnce([]) // phone check
        .mockResolvedValue([]);
      (UniqueService.prototype.create as jest.Mock).mockResolvedValue(storeAdminUser);

      const res = await request(app).post("/api/users/register").send({
        email: "storeadmin@example.com",
        full_name: "New Store Admin",
        password: "Password123!",
        phone: "+919000000000",
        role_name: "StoreAdmin",
      });

      expect(res.status).toBe(201);
      const createCall = (UniqueService.prototype.create as jest.Mock).mock.calls[0];
      const createdPayload = createCall[1];
      expect(createdPayload.admin_id).toBe("c1b2c3d4-e5f6-7890-abcd-ef1234567890");
      expect(createdPayload.superadmin_id).toBeNull();
      expect(createdPayload.sub_admin_id).toBeNull();
      expect(createdPayload.store_admin_id).toBeNull();
    });

    it("SubAdmin attempting to register a StoreAdmin returns 403 (no longer in hierarchy)", async () => {
      _mockUser = {
        id: "sub-admin-1",
        role_name: "SubAdmin",
        permissions: { Users: { create: { allowed: true }, view: { allowed: true } } },
      };
      (UniqueService.prototype.getDataByField as jest.Mock).mockResolvedValue([]);

      const res = await request(app).post("/api/users/register").send({
        email: "storeadmin@example.com",
        full_name: "New Store Admin",
        password: "Password123!",
        phone: "+919000000000",
        role_name: "StoreAdmin",
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  /* ── 3. Authenticated Customer creation by any admin → 403 ── */
  describe("Customer creation by admin is forbidden", () => {
    it("StoreAdmin trying to register a Customer returns 403", async () => {
      _mockUser = {
        id: "store-admin-1",
        role_name: "StoreAdmin",
        permissions: { Users: { create: { allowed: true }, view: { allowed: true } } },
      };
      (UniqueService.prototype.getDataByField as jest.Mock).mockResolvedValue([]);

      const res = await request(app).post("/api/users/register").send({
        email: "cust@example.com",
        full_name: "A Customer",
        password: "Password123!",
        phone: "+916666666666",
        role_name: "Customer",
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/self-register/i);
    });

    it("SubAdmin trying to register a Customer returns 403", async () => {
      _mockUser = {
        id: "subadmin-1",
        role_name: "SubAdmin",
        permissions: { Users: { create: { allowed: true }, view: { allowed: true } } },
      };
      (UniqueService.prototype.getDataByField as jest.Mock).mockResolvedValue([]);

      const res = await request(app).post("/api/users/register").send({
        email: "cust2@example.com",
        full_name: "Another Customer",
        password: "Password123!",
        phone: "+915555555555",
        role_name: "Customer",
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  /* ── 4. Duplicate checks ── */
  describe("Duplicate email/phone returns 400", () => {
    it("duplicate email → 400", async () => {
      (UniqueService.prototype.getDataByField as jest.Mock)
        .mockResolvedValueOnce([{ id: "existing" }]); // email exists

      const res = await request(app).post("/api/users/register").send({
        email: "dup@example.com",
        full_name: "Dup User",
        password: "Password123!",
        phone: "+914444444444",
        role_name: "Customer",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/email already exists/i);
    });

    it("duplicate phone → 400", async () => {
      (UniqueService.prototype.getDataByField as jest.Mock)
        .mockResolvedValueOnce([]) // email ok
        .mockResolvedValueOnce([{ id: "existing" }]); // phone exists

      const res = await request(app).post("/api/users/register").send({
        email: "unique@example.com",
        full_name: "Dup Phone User",
        password: "Password123!",
        phone: "+913333333333",
        role_name: "Customer",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/phone already exists/i);
    });
  });

  /* ── 5. Employee created by StoreAdmin has correct default permissions ── */
  describe("Employee created by StoreAdmin", () => {
    it("new Employee has Products.create.allowed === false and Products.view.allowed === true", async () => {
      _mockUser = storeAdminCreator;
      setupForEmployeeCreate();

      const res = await request(app).post("/api/users/register").send({
        email: "emp@example.com",
        full_name: "New Employee",
        password: "Password123!",
        phone: "+912222222222",
        role_name: "Employee",
        store_id: STORE_UUID,
      });

      expect(res.status).toBe(201);
      const createCall = (UniqueService.prototype.create as jest.Mock).mock.calls[0];
      const storedPermissions = createCall[1].permissions;
      expect(storedPermissions["Products"]["create"]["allowed"]).toBe(false);
      expect(storedPermissions["Products"]["view"]["allowed"]).toBe(true);
      expect(storedPermissions["Menus"]["create"]["allowed"]).toBe(false);
      expect(storedPermissions["Menus"]["view"]["allowed"]).toBe(true);
    });

    it("caller-supplied Employee override granting Products.create is accepted", async () => {
      _mockUser = storeAdminCreator;
      setupForEmployeeCreate();

      const res = await request(app).post("/api/users/register").send({
        email: "emp2@example.com",
        full_name: "Empowered Employee",
        password: "Password123!",
        phone: "+911111111111",
        role_name: "Employee",
        store_id: STORE_UUID,
        permissions: { Products: { create: { allowed: true } } },
      });

      expect(res.status).toBe(201);
      const createCall = (UniqueService.prototype.create as jest.Mock).mock.calls[0];
      const storedPermissions = createCall[1].permissions;
      expect(storedPermissions["Products"]["create"]["allowed"]).toBe(true);
      expect(storedPermissions["Products"]["view"]["allowed"]).toBe(true);
    });
  });
});
