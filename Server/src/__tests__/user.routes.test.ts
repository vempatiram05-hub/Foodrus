/* ================= MOCK ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      rpc: jest.fn(),
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
    otp: "1234",
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

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: "admin-1", role_name: "Admin", permissions: { Users: { view: { allowed: true }, create: { allowed: true }, edit: { allowed: true }, delete: { allowed: true } } } };
    next();
  },
  optionalAuthMiddlewares: (req: any, res: any, next: any) => next(),
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => next(),
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) => next(),
}));

jest.mock("argon2", () => ({
  hash: jest.fn(),
  verify: jest.fn(),
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
import argon2 from "argon2";

/* ================= APP SETUP ================= */
const app = express();
app.use(express.json());
app.use("/api/users", UserRouter);

describe("User Routes", () => {
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    full_name: "Test User",
    phone: "+919999999999",
    password: "hashedpassword",
    role_name: "Customer",
    is_active: true,
    account_status: "active",
    permissions: {},
    images: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    (argon2.hash as jest.Mock).mockResolvedValue("hashedpassword");
  });

  /* ================= REGISTER ================= */
  describe("POST /register", () => {
    it("should register a new user", async () => {
      (DBconnection.rpc as jest.Mock).mockResolvedValue({ data: [{ id: "circle-1" }], error: null });
      (UniqueService.prototype.getDataByField as jest.Mock)
        .mockResolvedValueOnce([]) // email check
        .mockResolvedValueOnce([]) // phone check
        .mockResolvedValueOnce([{ id: "role-1", name: "User" }]); // role check logic (if any)

      (UniqueService.prototype.create as jest.Mock).mockResolvedValue(mockUser);
      (UniqueService.prototype.updateById as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/users/register")
        .send({
          email: mockUser.email,
          full_name: mockUser.full_name,
          password: "Password123!",
          phone: "9999999999",
          role_name: "Customer",
          latitude: 12.34,
          longitude: 56.78,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should fail if required fields missing", async () => {
      const res = await request(app).post("/api/users/register").send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  /* ================= LOGIN ================= */
  describe("POST /login", () => {
    it("should login successfully", async () => {
      (UniqueService.prototype.getDataByField as jest.Mock).mockResolvedValue([mockUser]);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post("/api/users/login")
        .send({ emailOrPhone: mockUser.email, password: "Password123!" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it("should fail invalid credentials", async () => {
      (UniqueService.prototype.getDataByField as jest.Mock).mockResolvedValue([mockUser]);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      const res = await request(app)
        .post("/api/users/login")
        .send({ emailOrPhone: mockUser.email, password: "wrongpass" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  /* ================= GET LIST ================= */
  describe("GET /getList", () => {
    it("should return users list", async () => {
      (UniqueService.prototype.getAllData as jest.Mock).mockResolvedValue([mockUser]);

      const res = await request(app).get("/api/users/getList");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  /* ================= GET USER BY ID ================= */
  describe("GET /getallusers/:id", () => {
    it("should return user by id", async () => {
      (UniqueService.prototype.getDataById as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app).get(`/api/users/getallusers/${mockUser.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockUser.id);
    });

    it("should 404 if user not found", async () => {
      (UniqueService.prototype.getDataById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get("/api/users/getallusers/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  /* ================= UPDATE USER ================= */
  describe("PUT /updateuser/:id", () => {
    it("should update user", async () => {
      const superAdminUser = { ...mockUser, role_name: "SuperAdmin" };
      (UniqueService.prototype.getDataById as jest.Mock).mockResolvedValue(superAdminUser);
      (UniqueService.prototype.updateById as jest.Mock).mockResolvedValue({
        ...superAdminUser,
        full_name: "Updated Name",
      });

      const res = await request(app)
        .put(`/api/users/updateuser/${mockUser.id}`)
        .send({ full_name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.full_name).toBe("Updated Name");
    });
  });

  /* ================= DELETE USER ================= */
  describe("DELETE /deleteuser/:id", () => {
    it("should delete user", async () => {
      const superAdminUser = { ...mockUser, role_name: "SuperAdmin" };
      (UniqueService.prototype.getDataById as jest.Mock).mockResolvedValue(superAdminUser);
      (UniqueService.prototype.deleteData as jest.Mock).mockResolvedValue({ message: "deleted" });

      const res = await request(app).delete(`/api/users/deleteuser/${mockUser.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  /* ================= OTP VALIDATE ================= */
  describe("POST /validateOTP", () => {
    it("should validate OTP", async () => {
      // Mock getUserOtp (internal helper) via mocking UniqueService calls it uses
      (UniqueService.prototype.getDataByField as jest.Mock)
        .mockResolvedValueOnce([mockUser]) // user fetch
        .mockResolvedValueOnce([{ id: "otp-1", otp: "hashed", expires_at: new Date(Date.now() + 10000).toISOString() }]); // otp fetch
      
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (UniqueService.prototype.updateById as jest.Mock).mockResolvedValue(mockUser);
      (UniqueService.prototype.deleteData as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post("/api/users/validateOTP")
        .send({ emailOrPhone: mockUser.email, otp: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
