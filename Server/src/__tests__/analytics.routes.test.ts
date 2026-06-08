
/* ============================================================
 * analytics.routes.test.ts
 *
 * Integration tests for:
 *   GET /api/analytics/summary
 *   GET /api/analytics/revenue-by-region
 *   GET /api/analytics/menu-compliance-by-store
 *   GET /api/analytics/menu-compliance-by-region
 *   GET /api/analytics/order-trends
 *   GET /api/analytics/revenue-by-category
 *   GET /api/analytics/delivery-distribution
 *   GET /api/reports/stores
 *
 * Verifies:
 *   - Unauthenticated requests are rejected with 401
 *   - Authenticated requests return 200 with the expected response shape
 *   - Empty database (empty rows) returns zeros / empty arrays without errors
 * ============================================================ */

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
    authMiddleware: (req: any, res: any, next: any) => {
      if (req.user) {
        return next();
      }
      if (!req.headers.authorization) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized: Token missing" });
      }
      req.user = {
        id: "test-admin-id",
        role_name: "Admin",
        permissions: {
          Analytics: { view: { allowed: true } },
          Reports: { view: { allowed: true } },
        },
      };
      next();
    },
  };
});

/* ================= IMPORTS ================= */

import request from "supertest";
import express from "express";
import AnalyticsRouter from "../routes/analytics.routes";
import ReportsRouter from "../routes/reports.routes";
import { pool } from "../config/pool";

/* ================= APP SETUP ================= */

const app = express();
app.use(express.json());
app.use("/api/analytics", AnalyticsRouter);
app.use("/api/reports", ReportsRouter);

const unauthorizedApp = express();
unauthorizedApp.use(express.json());
unauthorizedApp.use((req: any, _res: any, next: any) => {
  req.user = { id: "customer-id", role_name: "Customer", permissions: {} };
  next();
});
unauthorizedApp.use("/api/analytics", AnalyticsRouter);
unauthorizedApp.use("/api/reports", ReportsRouter);

const authorizedApp = express();
authorizedApp.use(express.json());
authorizedApp.use((req: any, _res: any, next: any) => {
  req.user = {
    id: "store-admin-id",
    role_name: "StoreAdmin",
    permissions: {
      Analytics: { view: { allowed: true } },
      Reports: { view: { allowed: true } },
    },
  };
  next();
});
authorizedApp.use("/api/analytics", AnalyticsRouter);
authorizedApp.use("/api/reports", ReportsRouter);

const mockQuery = pool.query as jest.Mock;

const AUTH_HEADER = { authorization: "Bearer test-token" };

/* ================= HELPERS ================= */

beforeEach(() => {
  jest.clearAllMocks();
});

/* ================================================================
 * UNAUTHENTICATED — all endpoints must return 401
 * ================================================================ */

describe("Analytics & Reports – unauthenticated requests return 401", () => {
  const endpoints = [
    "/api/analytics/summary",
    "/api/analytics/revenue-by-region",
    "/api/analytics/menu-compliance-by-store",
    "/api/analytics/menu-compliance-by-region",
    "/api/analytics/order-trends",
    "/api/analytics/revenue-by-category",
    "/api/analytics/delivery-distribution",
    "/api/reports/stores",
  ];

  it.each(endpoints)("GET %s → 401 when no token provided", async (endpoint) => {
    const res = await request(app).get(endpoint);
    expect(res.status).toBe(401);
  });
});

/* ================================================================
 * GET /api/analytics/summary
 * ================================================================ */

describe("GET /api/analytics/summary", () => {
  const ENDPOINT = "/api/analytics/summary";

  it("returns 200 with the correct shape when data exists", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          totalRevenue: "1500.00",
          totalOrders: "42",
          avgDeliveryTime: "28.5",
          deliveryRate: "80.95",
          pendingRate: "9.52",
        },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalRevenue).toBe("number");
    expect(typeof res.body.totalOrders).toBe("number");
    expect(typeof res.body.avgDeliveryTime).toBe("number");
    expect(typeof res.body.deliveryRate).toBe("number");
    expect(typeof res.body.pendingRate).toBe("number");
    expect(res.body.totalRevenue).toBe(1500);
    expect(res.body.totalOrders).toBe(42);
  });

  it("returns 200 with zeros when the orders table is empty", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          totalRevenue: "0",
          totalOrders: "0",
          avgDeliveryTime: "0",
          deliveryRate: "0",
          pendingRate: "0",
        },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBe(0);
    expect(res.body.totalOrders).toBe(0);
    expect(res.body.avgDeliveryTime).toBe(0);
    expect(res.body.deliveryRate).toBe(0);
    expect(res.body.pendingRate).toBe(0);
  });

  it("returns 500 when the database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/summary/i);
  });

  it("returns 400 when 'from' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=not-a-date`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when 'to' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?to=99/99/9999`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/to/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 for an impossible 'from' date like 2024-02-31", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-02-31`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("passes valid from/to filter values to the database query", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ totalRevenue: "0", totalOrders: "0", avgDeliveryTime: "0", deliveryRate: "0", pendingRate: "0" }],
    });

    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-01-01&to=2024-01-31`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    const [, sqlValues] = mockQuery.mock.calls[0];
    expect(sqlValues).toContain("2024-01-01");
    expect(sqlValues).toContain("2024-01-31");
  });
});

/* ================================================================
 * GET /api/analytics/revenue-by-region
 * ================================================================ */

describe("GET /api/analytics/revenue-by-region", () => {
  const ENDPOINT = "/api/analytics/revenue-by-region";

  it("returns 200 with an array of region records", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { region: "North", revenue: "5000", orders: "20", stores: "3" },
        { region: "South", revenue: "2500", orders: "10", stores: "2" },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      region: "North",
      revenue: 5000,
      orders: 20,
      stores: 3,
    });
  });

  it("returns 200 with an empty array when no regions exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 when the database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/revenue by region/i);
  });

  it("returns 400 when 'from' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=baddate`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when 'to' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?to=2024-99-01`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/to/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when 'region' is supplied as an array", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?region=North&region=South`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/region/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("passes valid from/to/region filter values to the database query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-03-01&to=2024-03-31&region=North`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    const [, sqlValues] = mockQuery.mock.calls[0];
    expect(sqlValues).toContain("2024-03-01");
    expect(sqlValues).toContain("2024-03-31");
    expect(sqlValues).toContain("North");
  });
});

/* ================================================================
 * GET /api/analytics/menu-compliance-by-store
 * ================================================================ */

describe("GET /api/analytics/menu-compliance-by-store", () => {
  const ENDPOINT = "/api/analytics/menu-compliance-by-store";

  it("returns 200 with an array of store compliance records", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          storeId: "store-1",
          storeName: "Store One",
          submitted: "10",
          approved: "8",
          rejected: "1",
          pending: "1",
          successRate: "80.0",
        },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      storeId: "store-1",
      storeName: "Store One",
      submitted: 10,
      approved: 8,
      rejected: 1,
      pending: 1,
      successRate: 80,
    });
  });

  it("returns 200 with an empty array when no menus have been submitted", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 when the database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/menu compliance by store/i);
  });
});

/* ================================================================
 * GET /api/analytics/menu-compliance-by-region
 * ================================================================ */

describe("GET /api/analytics/menu-compliance-by-region", () => {
  const ENDPOINT = "/api/analytics/menu-compliance-by-region";

  it("returns 200 with an array of region compliance records", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          region: "East",
          submitted: "5",
          approved: "4",
          rejected: "0",
          pending: "1",
          successRate: "80.0",
        },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      region: "East",
      submitted: 5,
      approved: 4,
      rejected: 0,
      pending: 1,
      successRate: 80,
    });
  });

  it("returns 200 with an empty array when no menu submissions exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 when the database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/menu compliance by region/i);
  });
});

/* ================================================================
 * GET /api/analytics/order-trends
 * ================================================================ */

describe("GET /api/analytics/order-trends", () => {
  const ENDPOINT = "/api/analytics/order-trends";

  it("returns 200 with thisWeek and lastWeek objects", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          period: "this_week",
          total: "15",
          completed: "12",
          cancelled: "2",
          revenue: "3000",
        },
        {
          period: "last_week",
          total: "10",
          completed: "9",
          cancelled: "1",
          revenue: "2000",
        },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("thisWeek");
    expect(res.body).toHaveProperty("lastWeek");
    expect(res.body.thisWeek).toMatchObject({
      total: 15,
      completed: 12,
      cancelled: 2,
      revenue: 3000,
    });
    expect(res.body.lastWeek).toMatchObject({
      total: 10,
      completed: 9,
      cancelled: 1,
      revenue: 2000,
    });
  });

  it("returns 200 with zeros when no orders exist this week or last", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.thisWeek).toMatchObject({
      total: 0,
      completed: 0,
      cancelled: 0,
      revenue: 0,
    });
    expect(res.body.lastWeek).toMatchObject({
      total: 0,
      completed: 0,
      cancelled: 0,
      revenue: 0,
    });
  });

  it("returns 500 when the database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/order trends/i);
  });

  it("returns 400 when 'from' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=01-01-2024`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when 'to' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?to=2024-13-01`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/to/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 for an impossible 'to' date like 2024-11-31", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?to=2024-11-31`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("passes valid from/to filter values to the database query", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: "5", completed: "4", cancelled: "1", revenue: "1000" }],
    });

    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-06-01&to=2024-06-30`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    const [, sqlValues] = mockQuery.mock.calls[0];
    expect(sqlValues).toContain("2024-06-01");
    expect(sqlValues).toContain("2024-06-30");
  });
});

/* ================================================================
 * GET /api/analytics/revenue-by-category
 * ================================================================ */

describe("GET /api/analytics/revenue-by-category", () => {
  const ENDPOINT = "/api/analytics/revenue-by-category";

  it("returns 200 with an array of category revenue records", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          categoryId: "cat-1",
          categoryName: "Burgers",
          revenue: "1200",
          orderCount: "30",
          percentage: "60.0",
        },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      categoryId: "cat-1",
      categoryName: "Burgers",
      revenue: 1200,
      orderCount: 30,
      percentage: 60,
    });
  });

  it("returns 200 with an empty array when no category revenue exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 when the database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/revenue by category/i);
  });

  it("returns 400 when 'from' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=2024/01/01`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when 'to' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?to=not-a-date`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/to/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("passes valid from/to filter values to the database query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-04-01&to=2024-04-30`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    const [, sqlValues] = mockQuery.mock.calls[0];
    expect(sqlValues).toContain("2024-04-01");
    expect(sqlValues).toContain("2024-04-30");
  });
});

/* ================================================================
 * GET /api/analytics/delivery-distribution
 * ================================================================ */

describe("GET /api/analytics/delivery-distribution", () => {
  const ENDPOINT = "/api/analytics/delivery-distribution";

  it("returns 200 with an array of delivery distribution buckets", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { label: "0-15 min", count: "10", percentage: "50.0" },
        { label: "16-30 min", count: "6", percentage: "30.0" },
        { label: "31-45 min", count: "4", percentage: "20.0" },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ label: "0-15 min", count: 10, percentage: 50 });
    expect(res.body[1]).toMatchObject({ label: "16-30 min", count: 6, percentage: 30 });
  });

  it("returns 200 with an empty array when no delivery data exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 when the database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/delivery distribution/i);
  });

  it("returns 400 when 'from' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=baddate`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when 'to' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?to=2024-00-01`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/to/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 for an impossible 'from' date like 2024-13-01", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-13-01`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("passes valid from/to filter values to the database query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-05-01&to=2024-05-31`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    const [, sqlValues] = mockQuery.mock.calls[0];
    expect(sqlValues).toContain("2024-05-01");
    expect(sqlValues).toContain("2024-05-31");
  });
});

/* ================================================================
 * GET /api/reports/stores
 * ================================================================ */

describe("GET /api/reports/stores", () => {
  const ENDPOINT = "/api/reports/stores";

  it("returns 200 with an array of store report rows including orders and revenue", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          storeId: "store-abc",
          storeName: "Alpha Store",
          region: "West",
          orders: "15",
          revenue: "7500",
        },
      ],
    });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      storeId: "store-abc",
      storeName: "Alpha Store",
      region: "West",
      orders: "15",
      revenue: "7500",
    });
  });

  it("returns 200 with an empty array when no stores match", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("passes the region filter value to the database query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${ENDPOINT}?region=North`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, sqlValues] = mockQuery.mock.calls[0];
    expect(sqlValues).toContain("North");
  });

  it("passes date range filter values to the database query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-01-01&to=2024-01-31`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    const [, sqlValues] = mockQuery.mock.calls[0];
    expect(sqlValues).toContain("2024-01-01");
    expect(sqlValues).toContain("2024-01-31");
  });

  it("returns 400 when 'from' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=not-a-date`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when 'to' is not a valid ISO date", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?to=13/99/2024`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/to/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when 'from' is a date-like string that doesn't parse (e.g. 2024-99-99)", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-99-99`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 for impossible-but-format-valid 'from' dates like 2024-02-31", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?from=2024-02-31`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 for impossible-but-format-valid 'to' dates like 2024-11-31", async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?to=2024-11-31`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/to/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("trims whitespace from region and caps it at 100 characters before querying", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const longRegion = "B".repeat(200);
    const res = await request(app)
      .get(`${ENDPOINT}?region=  ${longRegion}  `)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    const [, sqlValues] = mockQuery.mock.calls[0];
    expect(sqlValues[0]).toHaveLength(100);
    expect(sqlValues[0]).toBe("B".repeat(100));
  });

  it("returns 500 when the database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get(ENDPOINT).set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/reports/i);
  });
});

/* ================================================================
 * PERMISSION GUARD — Analytics endpoints block unauthorised users
 * ================================================================ */

describe("Analytics – permission guard blocks users without Analytics.view", () => {
  const analyticsEndpoints = [
    "/api/analytics/summary",
    "/api/analytics/revenue-by-region",
    "/api/analytics/menu-compliance-by-store",
    "/api/analytics/menu-compliance-by-region",
    "/api/analytics/order-trends",
    "/api/analytics/revenue-by-category",
    "/api/analytics/delivery-distribution",
  ];

  it.each(analyticsEndpoints)(
    "GET %s → 403 for a Customer with empty permissions",
    async (endpoint) => {
      const res = await request(unauthorizedApp).get(endpoint);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    }
  );

  it.each(analyticsEndpoints)(
    "GET %s → 200 for a StoreAdmin with Analytics.view permission",
    async (endpoint) => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            totalRevenue: "0", totalOrders: "0", avgDeliveryTime: "0",
            deliveryRate: "0", pendingRate: "0",
          },
        ],
      });
      const res = await request(authorizedApp).get(endpoint);
      expect(res.status).toBe(200);
    }
  );
});

/* ================================================================
 * PERMISSION GUARD — Reports endpoint blocks unauthorised users
 * ================================================================ */

describe("Reports – permission guard blocks users without Reports.view", () => {
  const ENDPOINT = "/api/reports/stores";

  it("GET /api/reports/stores → 403 for a Customer with empty permissions", async () => {
    const res = await request(unauthorizedApp).get(ENDPOINT);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("GET /api/reports/stores → 200 for a StoreAdmin with Reports.view permission", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(authorizedApp).get(ENDPOINT);
    expect(res.status).toBe(200);
  });
});
