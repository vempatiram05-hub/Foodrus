
/* ======================================================================
 * menu.approval-auth.test.ts
 *
 * Tests for isAuthorizedForMenuRegion (exercised via routes) and for the
 * 403 response bodies produced by approveMenu, rejectMenu, and
 * rejectPendingProducts.
 *
 * isAuthorizedForMenuRegion uses the store-admin hierarchy:
 *   1. stores → store_admin_id
 *   2. users  → sub_admin_id (must equal the SubAdmin's id)
 *
 * Two distinct 403 conditions:
 *   NO_STORE_ADMIN – store has no StoreAdmin assigned (or store not found)
 *   NOT_IN_HIERARCHY – SubAdmin is not the StoreAdmin's sub_admin_id
 * ====================================================================== */

/* ================= MOCKS ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(),
  },
}));

jest.mock("../services/unique.service");

jest.mock("../middleware/auth", () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePermission: (_mod: string, _act: string) => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: [(_req: any, _res: any, next: any) => next()],
}));

import request from "supertest";
import express from "express";
import MenuRouter from "../routes/menu.routes";
import { UniqueService } from "../services/unique.service";
import { DBconnection } from "../config/DBConnect";

/* ================= CONSTANTS ================= */
const MENU_ID        = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STORE_ID       = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const STORE_ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_ID       = "admin-id";
const SUBADMIN_ID    = "subadmin-id";

const MSG_NO_STORE_ADMIN   = "Store not found or has no StoreAdmin assigned.";
const MSG_NOT_IN_HIERARCHY = "You do not have permission to approve menus for this store.";

/* ================= BASE MENU RECORD ================= */
const baseMenu = {
  id: MENU_ID,
  status: "PENDING",
  store_id: STORE_ID,
  product_id: ["prod-1"],
  pending_products: ["prod-2"],
  submitted_by: null,
  date: null,
  time_slot_id: null,
};

/* ================= APPS ================= */
const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res: any, next: any) => {
  req.user = { id: ADMIN_ID, role_name: "Admin" };
  next();
});
adminApp.use("/api/menus", MenuRouter);

const subAdminApp = express();
subAdminApp.use(express.json());
subAdminApp.use((req: any, _res: any, next: any) => {
  req.user = { id: SUBADMIN_ID, role_name: "SubAdmin" };
  next();
});
subAdminApp.use("/api/menus", MenuRouter);

const noIdSubAdminApp = express();
noIdSubAdminApp.use(express.json());
noIdSubAdminApp.use((req: any, _res: any, next: any) => {
  req.user = { role_name: "SubAdmin" };
  next();
});
noIdSubAdminApp.use("/api/menus", MenuRouter);

const mockService = jest.mocked(UniqueService.prototype);
const mockFrom = DBconnection.from as jest.Mock;

/* ================= HELPERS ================= */
function makeChain(resolvedValue: object, terminalMethod: string = "single") {
  const chain: any = {};
  const allMethods = ["select", "eq", "in", "or", "update", "maybeSingle", "single", "is"];
  allMethods.forEach((m) => {
    if (m === terminalMethod) {
      chain[m] = jest.fn().mockResolvedValue(resolvedValue);
    } else {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
  });
  return chain;
}

/* ================= TESTS ================= */

describe("approveMenu – 403 message correctness", () => {
  /**
   * approveMenu DB call sequence for SubAdmin:
   *   1. uniqueService.getDataById → menu
   *   2. from("stores").select("store_admin_id").eq("id", storeId).single() → StoreAdmin id
   *   3. from("users").select("sub_admin_id").eq("id", storeAdminId).single() → sub_admin_id
   */

  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when store has no StoreAdmin assigned", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu } as any);
    mockFrom.mockReturnValueOnce(makeChain({ data: { store_admin_id: null }, error: null }));

    const res = await request(subAdminApp)
      .put(`/api/menus/ApproveMenuById/approve/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(MSG_NO_STORE_ADMIN);
  });

  it("returns 403 when SubAdmin is not in the StoreAdmin's hierarchy", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu } as any);
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { store_admin_id: STORE_ADMIN_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { sub_admin_id: "other-subadmin-id" }, error: null }));

    const res = await request(subAdminApp)
      .put(`/api/menus/ApproveMenuById/approve/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(MSG_NOT_IN_HIERARCHY);
  });

  it("Admin bypasses hierarchy check and can approve", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu } as any);
    mockService.updateById.mockResolvedValue({ ...baseMenu, status: "APPROVED" } as any);

    const res = await request(adminApp)
      .put(`/api/menus/ApproveMenuById/approve/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

/* ====================================================================== */

describe("rejectMenu – 403 message correctness", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when store has no StoreAdmin assigned", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu } as any);
    mockFrom.mockReturnValueOnce(makeChain({ data: { store_admin_id: null }, error: null }));

    const res = await request(subAdminApp)
      .put(`/api/menus/RejectMenuById/reject/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(MSG_NO_STORE_ADMIN);
  });

  it("returns 403 when SubAdmin is not in the StoreAdmin's hierarchy", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu } as any);
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { store_admin_id: STORE_ADMIN_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { sub_admin_id: "other-subadmin-id" }, error: null }));

    const res = await request(subAdminApp)
      .put(`/api/menus/RejectMenuById/reject/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(MSG_NOT_IN_HIERARCHY);
  });

  it("Admin bypasses hierarchy check and can reject", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu } as any);
    mockService.updateById.mockResolvedValue({ ...baseMenu, status: "REJECTED" } as any);

    const res = await request(adminApp)
      .put(`/api/menus/RejectMenuById/reject/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

/* ====================================================================== */

describe("rejectPendingProducts – 403 message correctness", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when store has no StoreAdmin assigned", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu } as any);
    mockFrom.mockReturnValueOnce(makeChain({ data: { store_admin_id: null }, error: null }));

    const res = await request(subAdminApp)
      .put(`/api/menus/RejectPendingProducts/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(MSG_NO_STORE_ADMIN);
  });

  it("returns 403 when SubAdmin is not in the StoreAdmin's hierarchy", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu } as any);
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { store_admin_id: STORE_ADMIN_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { sub_admin_id: "other-subadmin-id" }, error: null }));

    const res = await request(subAdminApp)
      .put(`/api/menus/RejectPendingProducts/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(MSG_NOT_IN_HIERARCHY);
  });

  it("Admin bypasses hierarchy check; proceeds to check pending_products", async () => {
    mockService.getDataById.mockResolvedValue({ ...baseMenu, pending_products: null } as any);

    const res = await request(adminApp)
      .put(`/api/menus/RejectPendingProducts/${MENU_ID}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No pending products found on this menu");
  });
});
