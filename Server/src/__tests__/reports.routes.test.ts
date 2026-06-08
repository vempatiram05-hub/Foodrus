
/* ======================================================================
 * reports.routes.test.ts
 *
 * Verifies that `GET /api/reports/stores` enforces the
 * requirePermission("Reports", "view") guard:
 *   - A user without Reports permissions receives 403.
 *   - A user with Reports.view allowed receives 200.
 * ====================================================================== */

/* ================= MOCKS ================= */

jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    })),
  },
}));

jest.mock("../config/pool", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("../middleware/auth", () => {
  const actual = jest.requireActual("../middleware/auth");
  return {
    ...actual,
    authMiddleware: (_req: any, _res: any, next: any) => next(),
  };
});

/* ================= IMPORTS ================= */

import request from "supertest";
import express from "express";
import ReportsRouter from "../routes/reports.routes";
import { pool } from "../config/pool";

/* ================= APP SETUP ================= */

const unauthorizedApp = express();
unauthorizedApp.use(express.json());
unauthorizedApp.use((req: any, _res: any, next: any) => {
  req.user = { id: "customer-id", role_name: "Customer", permissions: {} };
  next();
});
unauthorizedApp.use("/api/reports", ReportsRouter);

const authorizedApp = express();
authorizedApp.use(express.json());
authorizedApp.use((req: any, _res: any, next: any) => {
  req.user = {
    id: "store-admin-id",
    role_name: "StoreAdmin",
    permissions: {
      Reports: { view: { allowed: true } },
    },
  };
  next();
});
authorizedApp.use("/api/reports", ReportsRouter);

const mockQuery = pool.query as jest.Mock;

/* ================= TESTS ================= */

beforeEach(() => jest.clearAllMocks());

describe("GET /api/reports/stores – permission guard", () => {
  const ENDPOINT = "/api/reports/stores";

  it("returns 403 for a Customer with no Reports permissions", async () => {
    const res = await request(unauthorizedApp).get(ENDPOINT);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("returns 403 for a user whose permissions object has no Reports key", async () => {
    const noReportsApp = express();
    noReportsApp.use(express.json());
    noReportsApp.use((req: any, _res: any, next: any) => {
      req.user = {
        id: "emp-id",
        role_name: "Employee",
        permissions: { Categories: { view: { allowed: true } } },
      };
      next();
    });
    noReportsApp.use("/api/reports", ReportsRouter);

    const res = await request(noReportsApp).get(ENDPOINT);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("returns 200 for a StoreAdmin with Reports.view allowed", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(authorizedApp).get(ENDPOINT);
    expect(res.status).toBe(200);
  });
});
