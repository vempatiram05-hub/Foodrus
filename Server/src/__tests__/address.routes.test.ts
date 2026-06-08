
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

/* "mock" prefix lets this variable be referenced inside the hoisted jest.mock() factory. */
const mockCurrentUser = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  role_name: "Customer",
};

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = mockCurrentUser;
    next();
  },
  requirePermission:
    (_module: string, _action: string) =>
    (_req: any, _res: any, next: any) =>
      next(),
}));

import request from "supertest";
import express from "express";
import bodyParser from "body-parser";
import AddressRouter from "../routes/address.routes";
import { UniqueService } from "../services/unique.service";

const app = express();
app.use(bodyParser.json());
app.use("/api/addresses", AddressRouter);

const mockService = jest.mocked(UniqueService.prototype);

/* ================= DATA ================= */

/** UUID of the user making the request (matches mockCurrentUser.id). */
const REQUESTING_USER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

/** UUID of a different user. */
const OTHER_USER_ID = "111e8400-e29b-41d4-a716-446655440111";

const mockAddress = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  user_id: OTHER_USER_ID,
  line1: "Street 1",
  line2: "Area",
  postal_code: "500001",
  city_id: "222e8400-e29b-41d4-a716-446655440222",
  created_at: new Date().toISOString(),
};

/** Same address but owned by the requesting user. */
const ownedMockAddress = { ...mockAddress, user_id: REQUESTING_USER_ID };

/* ================= TESTS ================= */

describe("Address Routes", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCurrentUser.id = REQUESTING_USER_ID;
    mockCurrentUser.role_name = "Customer";
  });

  it("should create address", async () => {
    mockService.create.mockResolvedValueOnce(mockAddress as any);

    const res = await request(app)
      .post("/api/addresses/createAddress")
      .send({ line1: "Street 1", user_id: mockAddress.user_id, city_id: mockAddress.city_id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should get addresses list", async () => {
    mockService.getAllData.mockResolvedValueOnce([mockAddress] as any);

    const res = await request(app).get("/api/addresses/getList");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it("should get address by id", async () => {
    mockService.getDataById.mockResolvedValueOnce(mockAddress as any);

    const res = await request(app).get(`/api/addresses/getAddressById/${mockAddress.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockAddress.id);
  });

  it("should get addresses by user id", async () => {
    mockService.getDataByField.mockResolvedValueOnce([ownedMockAddress] as any);

    const res = await request(app).get(
      `/api/addresses/getAddressesByUserId/${REQUESTING_USER_ID}`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].user_id).toBe(REQUESTING_USER_ID);
  });

  it("should update address", async () => {
    const updated = { ...ownedMockAddress, line1: "Updated Street" };
    mockService.getDataById.mockResolvedValueOnce(ownedMockAddress as any);
    mockService.updateById.mockResolvedValueOnce(updated as any);

    const res = await request(app)
      .put(`/api/addresses/updateAddress/${mockAddress.id}`)
      .send({ line1: "Updated Street" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.line1).toBe("Updated Street");
  });
});

/* ================= DELETE endpoint ================= */

describe("Address DELETE /deleteAddress/:id", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCurrentUser.id = REQUESTING_USER_ID;
    mockCurrentUser.role_name = "Customer";
  });

  it("returns 200 when a customer deletes their own address", async () => {
    mockService.getDataById.mockResolvedValueOnce(ownedMockAddress as any);
    mockService.getDataByField.mockResolvedValueOnce([] as any);
    mockService.deleteData.mockResolvedValueOnce({ message: "Deleted successfully" } as any);

    const res = await request(app).delete(`/api/addresses/deleteAddress/${mockAddress.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Address deleted successfully");
    expect(mockService.deleteData).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when a customer tries to delete another user's address", async () => {
    mockService.getDataById.mockResolvedValueOnce(mockAddress as any);

    const res = await request(app).delete(`/api/addresses/deleteAddress/${mockAddress.id}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/forbidden/i);
    expect(mockService.deleteData).not.toHaveBeenCalled();
  });

  it("returns 200 when an Admin deletes an address belonging to a different user", async () => {
    mockCurrentUser.id = "cccccccc-dddd-4eee-8fff-000000000001";
    mockCurrentUser.role_name = "Admin";

    mockService.getDataByField.mockResolvedValueOnce([] as any);
    mockService.deleteData.mockResolvedValueOnce({ message: "Deleted successfully" } as any);

    const res = await request(app).delete(`/api/addresses/deleteAddress/${mockAddress.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.getDataById).not.toHaveBeenCalled();
    expect(mockService.deleteData).toHaveBeenCalledTimes(1);
  });

  it("returns 200 when a SuperAdmin deletes an address belonging to a different user", async () => {
    mockCurrentUser.id = "cccccccc-dddd-4eee-8fff-000000000002";
    mockCurrentUser.role_name = "SuperAdmin";

    mockService.getDataByField.mockResolvedValueOnce([] as any);
    mockService.deleteData.mockResolvedValueOnce({ message: "Deleted successfully" } as any);

    const res = await request(app).delete(`/api/addresses/deleteAddress/${mockAddress.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.getDataById).not.toHaveBeenCalled();
  });

  it("returns 409 when the address is referenced by an existing order", async () => {
    mockService.getDataById.mockResolvedValueOnce(ownedMockAddress as any);
    mockService.getDataByField.mockResolvedValueOnce([
      { id: "order-aaa", address_id: mockAddress.id },
    ] as any);

    const res = await request(app).delete(`/api/addresses/deleteAddress/${mockAddress.id}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/referenced/i);
    expect(mockService.deleteData).not.toHaveBeenCalled();
  });

  it("returns 404 when the address does not exist", async () => {
    mockService.getDataById.mockResolvedValueOnce(null as any);

    const res = await request(app).delete(`/api/addresses/deleteAddress/${mockAddress.id}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("returns 400 for an invalid UUID", async () => {
    const res = await request(app).delete("/api/addresses/deleteAddress/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
