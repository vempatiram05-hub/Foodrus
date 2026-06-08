/* ================= MOCK ================= */
jest.mock("../config/dbPool", () => ({
  dbPool: { query: jest.fn() },
}));

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      role_name: "SubAdmin",
      permissions: {
        Brands: {
          create:     { allowed: true },
          edit:       { allowed: true },
          delete:     { allowed: true },
          view:       { allowed: true },
          showInMenu: { allowed: true },
        },
      },
    };
    next();
  },
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) => {
    const user = req.user as any;
    if (!user?.permissions?.[module]?.[action]?.allowed) {
      return res.status(403).json({ success: false, message: `Forbidden: missing ${module}.${action}` });
    }
    next();
  },
}));

import request from "supertest";
import express from "express";
import BrandRouter from "../routes/brands.routes";
import { dbPool } from "../config/dbPool";

const mockQuery = dbPool.query as jest.Mock;

const app = express();
app.use(express.json());
app.use("/api/brands", BrandRouter);

/* ================= FIXTURES — all IDs are valid UUIDs ================= */

const GROCERY_STORE_ID   = "550e8400-e29b-41d4-a716-446655440010";
const RESTAURANT_STORE_ID = "550e8400-e29b-41d4-a716-446655440020";
const CATEGORY_ID        = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBCATEGORY_ID     = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BAD_CATEGORY_ID    = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BAD_SUBCATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const GROCERY_STORE    = { id: GROCERY_STORE_ID, type: "grocery", is_active: true };
const RESTAURANT_STORE = { id: RESTAURANT_STORE_ID, type: "restaurant", is_active: true };

const mockBrand = {
  id:             "11111111-1111-4111-8111-111111111111",
  name:           "nike",
  store_id:       GROCERY_STORE_ID,
  category_id:    null,
  subcategory_id: null,
  description:    "sports brand",
  is_active:      true,
  created_at:     new Date().toISOString(),
  updated_at:     new Date().toISOString(),
};

describe("Brand Routes", () => {
  beforeEach(() => {
    // resetAllMocks clears the mockResolvedValueOnce queue AND mock.calls
    jest.resetAllMocks();
  });

  /* ================= CREATE BRAND ================= */
  describe("POST /api/brands/CreateBrand", () => {
    it("creates a brand for a grocery store (201)", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [GROCERY_STORE] })  // store lookup
        .mockResolvedValueOnce({ rows: [mockBrand] });      // INSERT

      const res = await request(app)
        .post("/api/brands/CreateBrand")
        .send({ name: "Nike", store_id: GROCERY_STORE_ID, description: "sports brand" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("nike");
    });

    it("rejects when name is missing (400)", async () => {
      const res = await request(app)
        .post("/api/brands/CreateBrand")
        .send({ store_id: GROCERY_STORE_ID });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects when store_id is missing (400)", async () => {
      const res = await request(app)
        .post("/api/brands/CreateBrand")
        .send({ name: "Nike" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects when store is not found (400)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });  // store not found

      const res = await request(app)
        .post("/api/brands/CreateBrand")
        .send({ name: "Nike", store_id: GROCERY_STORE_ID });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/store not found/i);
    });

    it("rejects creation for a restaurant store (400)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [RESTAURANT_STORE] });

      const res = await request(app)
        .post("/api/brands/CreateBrand")
        .send({ name: "Some Brand", store_id: RESTAURANT_STORE_ID });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/restaurant/i);
    });

    it("rejects when category_id does not exist (404)", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [GROCERY_STORE] })  // store lookup
        .mockResolvedValueOnce({ rows: [] });               // category not found

      const res = await request(app)
        .post("/api/brands/CreateBrand")
        .send({ name: "Nike", store_id: GROCERY_STORE_ID, category_id: BAD_CATEGORY_ID });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/category not found/i);
    });

    it("rejects when subcategory_id does not exist (404)", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [GROCERY_STORE] })        // store lookup
        .mockResolvedValueOnce({ rows: [{ id: CATEGORY_ID }] })  // category found
        .mockResolvedValueOnce({ rows: [] });                     // subcategory not found

      const res = await request(app)
        .post("/api/brands/CreateBrand")
        .send({ name: "Nike", store_id: GROCERY_STORE_ID, category_id: CATEGORY_ID, subcategory_id: BAD_SUBCATEGORY_ID });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/subcategory not found/i);
    });
  });

  /* ================= GET LIST ================= */
  describe("GET /api/brands/getList", () => {
    it("returns all brands without pagination", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockBrand] });

      const res = await request(app).get("/api/brands/getList");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].id).toBe(mockBrand.id);
    });

    it("returns paginated brands", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })  // count
        .mockResolvedValueOnce({ rows: [mockBrand] });     // data

      const res = await request(app).get("/api/brands/getList?page=1&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
    });

    it("filters by store_id", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockBrand] });

      const res = await request(app).get(`/api/brands/getList?store_id=${GROCERY_STORE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].store_id).toBe(GROCERY_STORE_ID);
    });

    it("returns empty list when no brands found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/api/brands/getList");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.message).toMatch(/no records found/i);
    });
  });

  /* ================= GET ONE ================= */
  describe("GET /api/brands/GetBrandById/:id", () => {
    it("returns a brand by id (200)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockBrand] });

      const res = await request(app).get(`/api/brands/GetBrandById/${mockBrand.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockBrand.id);
    });

    it("returns 404 when brand not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get(`/api/brands/GetBrandById/${mockBrand.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  /* ================= UPDATE BRAND ================= */
  describe("PUT /api/brands/UpdateBrand/:id", () => {
    it("updates brand name (200)", async () => {
      const updated = { ...mockBrand, name: "adidas" };
      mockQuery
        .mockResolvedValueOnce({ rows: [mockBrand] })  // existence check
        .mockResolvedValueOnce({ rows: [updated] });    // UPDATE

      const res = await request(app)
        .put(`/api/brands/UpdateBrand/${mockBrand.id}`)
        .send({ name: "Adidas" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("adidas");
    });

    it("returns 404 when brand to update does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put(`/api/brands/UpdateBrand/${mockBrand.id}`)
        .send({ name: "X" });

      expect(res.status).toBe(404);
    });

    it("returns 404 when updated category_id does not exist", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockBrand] })  // existence check
        .mockResolvedValueOnce({ rows: [] });            // category not found

      const res = await request(app)
        .put(`/api/brands/UpdateBrand/${mockBrand.id}`)
        .send({ category_id: BAD_CATEGORY_ID });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/category not found/i);
    });

    it("returns 404 when updated subcategory_id does not exist", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockBrand] })           // existence check
        .mockResolvedValueOnce({ rows: [{ id: CATEGORY_ID }] }) // category found
        .mockResolvedValueOnce({ rows: [] });                    // subcategory not found

      const res = await request(app)
        .put(`/api/brands/UpdateBrand/${mockBrand.id}`)
        .send({ category_id: CATEGORY_ID, subcategory_id: BAD_SUBCATEGORY_ID });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/subcategory not found/i);
    });

    it("returns 400 when no fields are provided", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockBrand] });

      const res = await request(app)
        .put(`/api/brands/UpdateBrand/${mockBrand.id}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no fields/i);
    });
  });

  /* ================= DELETE BRAND ================= */
  describe("DELETE /api/brands/DeleteBrand/:id", () => {
    it("deletes a brand (200)", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockBrand.id }] })  // existence check
        .mockResolvedValueOnce({ rows: [] });                       // DELETE

      const res = await request(app).delete(`/api/brands/DeleteBrand/${mockBrand.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 404 when brand to delete does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete(`/api/brands/DeleteBrand/${mockBrand.id}`);

      expect(res.status).toBe(404);
    });
  });
});
