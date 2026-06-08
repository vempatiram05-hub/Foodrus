/**
 * subcategory.integration.test.ts — scenarios 1–19
 *
 * All DB operations now use direct pg (dbPool).  UniqueService is no longer
 * used by SubcategoryController, so all mocks target dbPool.query in call-order.
 */

/* ==================== MOCKS (hoisted before all imports) ==================== */

jest.mock("../config/DBConnect", () => ({
  DBconnection: {
    from: jest.fn(() => ({
      select:      jest.fn().mockReturnThis(),
      eq:          jest.fn().mockReturnThis(),
      insert:      jest.fn().mockReturnThis(),
      update:      jest.fn().mockReturnThis(),
      delete:      jest.fn().mockReturnThis(),
      single:      jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock("../config/dbPool", () => ({
  dbPool: { query: jest.fn() },
}));

jest.mock("../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = {
      id: "550e8400-e29b-41d4-a716-000000000001",
      role_name: "SubAdmin",
      permissions: {
        Subcategories: {
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
      return res.status(403).json({
        success: false,
        message: `Forbidden: missing ${module}.${action}`,
      });
    }
    next();
  },
  requireRole:             (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddlewares: [(_req: any, _res: any, next: any) => next()],
}));

jest.mock("../middleware/upload", () => ({
  memoryUploader: {
    array: jest.fn(() => (req: any, _res: any, next: any) => {
      req.files = [];
      next();
    }),
  },
}));

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync:    jest.fn(() => true),
  mkdirSync:     jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock("../utils/file.util", () => ({
  generateImageName: (_name: string, orig: string, _ref: any) => orig,
}));

jest.mock("../utils/localSignedUrl", () => ({
  generateLocalSignedUrl: (p: string) => p,
}));

jest.mock("../utils/deleteFile", () => ({ deleteFile: jest.fn() }));

jest.mock("../utils/supabaseError", () => ({
  normalizeSupabaseError: (e: any) =>
    e instanceof Error ? e : new Error(String(e?.message ?? e)),
}));

/* ==================== IMPORTS ==================== */

import request           from "supertest";
import express           from "express";
import SubcategoryRouter from "../routes/subcategory.routes";
import { dbPool }        from "../config/dbPool";

/* ==================== APP SETUP ==================== */

const app = express();
app.use(express.json());
app.use("/api/subcategories", SubcategoryRouter);

/* ==================== FIXTURES ==================== */

const CAT_ID    = "550e8400-e29b-41d4-a716-100000000001";
const OTHER_CAT = "550e8400-e29b-41d4-a716-100000000002";
const SUB_ID    = "550e8400-e29b-41d4-a716-200000000001";

function makeSub(overrides: Record<string, any> = {}) {
  return {
    id:          SUB_ID,
    name:        "mobiles",
    category_id: CAT_ID,
    description: null,
    is_active:   true,
    images:      [],
    created_at:  "2024-01-01T00:00:00.000Z",
    updated_at:  "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/* ==================== BEFORE EACH ==================== */

beforeEach(() => {
  jest.clearAllMocks();
});

/* ==================== HELPER ==================== */

const qm = () => dbPool.query as jest.Mock;
const ok  = (rows: any[]) => ({ rows, rowCount: rows.length });
const empty = () => ({ rows: [], rowCount: 0 });

/* ==================== TESTS ==================== */

describe("Subcategory integration — FK validation & edge cases", () => {

  /* ── CREATE ──────────────────────────────────────────────────────────────── */

  describe("POST /api/subcategories/createSubcategory", () => {

    /* 1 */
    it("1: success — category exists, no duplicate name → 201", async () => {
      qm()
        .mockResolvedValueOnce(ok([{ id: CAT_ID }]))  // category check
        .mockResolvedValueOnce(empty())                // dup check
        .mockResolvedValueOnce(ok([makeSub()]));       // INSERT

      const res = await request(app)
        .post("/api/subcategories/createSubcategory")
        .send({ name: "Mobiles", category_id: CAT_ID });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(SUB_ID);
    });

    /* 2 */
    it("2: category_id does not exist in categories table → 404", async () => {
      qm().mockResolvedValueOnce(empty());  // category not found

      const res = await request(app)
        .post("/api/subcategories/createSubcategory")
        .send({ name: "Mobiles", category_id: CAT_ID });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/category not found/i);
    });

    /* 3 */
    it("3: missing name → 400 (validator rejects)", async () => {
      const res = await request(app)
        .post("/api/subcategories/createSubcategory")
        .send({ category_id: CAT_ID });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    /* 4 */
    it("4: missing category_id → 400 (validator rejects)", async () => {
      const res = await request(app)
        .post("/api/subcategories/createSubcategory")
        .send({ name: "Mobiles" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    /* 5 */
    it("5: category_id is not a valid UUID → 400 (validator rejects)", async () => {
      const res = await request(app)
        .post("/api/subcategories/createSubcategory")
        .send({ name: "Mobiles", category_id: "not-a-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    /* 6 */
    it("6: duplicate subcategory name in the same category → 409", async () => {
      qm()
        .mockResolvedValueOnce(ok([{ id: CAT_ID }]))  // category check
        .mockResolvedValueOnce(ok([makeSub()]));       // dup found → 409

      const res = await request(app)
        .post("/api/subcategories/createSubcategory")
        .send({ name: "Mobiles", category_id: CAT_ID });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    /* 7 */
    it("7: missing Subcategories.create permission → 403", async () => {
      const restrictedApp = express();
      restrictedApp.use(express.json());
      restrictedApp.use("/api/subcategories", (() => {
        const { Router } = require("express");
        const r = Router();
        const { SubcategoryController } = require("../controllers/subcategory.controller");
        const ctrl = new SubcategoryController();
        r.post(
          "/createSubcategory",
          (req: any, _res: any, next: any) => {
            req.user = {
              id: "000",
              role_name: "Employee",
              permissions: { Subcategories: { view: { allowed: true } } },
            };
            next();
          },
          (req: any, res: any, next: any) => {
            const user = req.user as any;
            if (!user?.permissions?.["Subcategories"]?.["create"]?.allowed) {
              return res.status(403).json({ success: false, message: "Forbidden" });
            }
            next();
          },
          (_req: any, _res: any, next: any) => { (_req as any).files = []; next(); },
          ctrl.create.bind(ctrl)
        );
        return r;
      })());

      const res = await request(restrictedApp)
        .post("/api/subcategories/createSubcategory")
        .send({ name: "Mobiles", category_id: CAT_ID });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

  });

  /* ── UPDATE ──────────────────────────────────────────────────────────────── */

  describe("PUT /api/subcategories/updateSubcategory/:id", () => {

    /* 8 */
    it("8: success — name change, same category → 200", async () => {
      qm()
        .mockResolvedValueOnce(ok([makeSub()]))                          // fetch existing
        .mockResolvedValueOnce(empty())                                  // dup check
        .mockResolvedValueOnce(ok([makeSub({ name: "phones" })]));       // UPDATE

      const res = await request(app)
        .put(`/api/subcategories/updateSubcategory/${SUB_ID}`)
        .send({ name: "Phones" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    /* 9 */
    it("9: subcategory not found → 404", async () => {
      qm().mockResolvedValueOnce(empty());  // fetch existing → not found

      const res = await request(app)
        .put(`/api/subcategories/updateSubcategory/${SUB_ID}`)
        .send({ name: "Phones" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    /* 10 */
    it("10: new category_id does not exist → 404", async () => {
      qm()
        .mockResolvedValueOnce(ok([makeSub()]))  // fetch existing
        .mockResolvedValueOnce(empty());          // new category not found

      const res = await request(app)
        .put(`/api/subcategories/updateSubcategory/${SUB_ID}`)
        .send({ category_id: OTHER_CAT });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/category not found/i);
    });

    /* 11 */
    it("11: duplicate name in target category → 409", async () => {
      const sibling = makeSub({ id: "550e8400-e29b-41d4-a716-999999999999", name: "phones" });
      qm()
        .mockResolvedValueOnce(ok([makeSub()]))  // fetch existing
        .mockResolvedValueOnce(ok([sibling]));   // dup found

      const res = await request(app)
        .put(`/api/subcategories/updateSubcategory/${SUB_ID}`)
        .send({ name: "Phones" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    /* 12 — permission check */
    it("12: missing Subcategories.edit permission → 403", async () => {
      const restrictedApp = express();
      restrictedApp.use(express.json());
      restrictedApp.use("/api/subcategories", (() => {
        const { Router } = require("express");
        const r = Router();
        const { SubcategoryController } = require("../controllers/subcategory.controller");
        const ctrl = new SubcategoryController();
        r.put(
          "/updateSubcategory/:id",
          (req: any, _res: any, next: any) => {
            req.user = {
              id: "000",
              role_name: "Employee",
              permissions: { Subcategories: { view: { allowed: true } } },
            };
            next();
          },
          (req: any, res: any, next: any) => {
            const user = req.user as any;
            if (!user?.permissions?.["Subcategories"]?.["edit"]?.allowed) {
              return res.status(403).json({ success: false, message: "Forbidden" });
            }
            next();
          },
          (_req: any, _res: any, next: any) => { (_req as any).files = []; next(); },
          ctrl.update.bind(ctrl)
        );
        return r;
      })());

      const res = await request(restrictedApp)
        .put(`/api/subcategories/updateSubcategory/${SUB_ID}`)
        .send({ name: "Phones" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

  });

  /* ── DELETE ──────────────────────────────────────────────────────────────── */

  describe("DELETE /api/subcategories/deleteSubcategory/:id", () => {

    /* 13 */
    it("13: success → 200", async () => {
      qm()
        .mockResolvedValueOnce(ok([makeSub()]))  // fetch existing
        .mockResolvedValueOnce(empty());          // DELETE

      const res = await request(app)
        .delete(`/api/subcategories/deleteSubcategory/${SUB_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);
    });

    /* 14 */
    it("14: subcategory not found → 404", async () => {
      qm().mockResolvedValueOnce(empty());  // fetch existing → not found

      const res = await request(app)
        .delete(`/api/subcategories/deleteSubcategory/${SUB_ID}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    /* 15 — permission check */
    it("15: missing Subcategories.delete permission → 403", async () => {
      const restrictedApp = express();
      restrictedApp.use(express.json());
      restrictedApp.use("/api/subcategories", (() => {
        const { Router } = require("express");
        const r = Router();
        const { SubcategoryController } = require("../controllers/subcategory.controller");
        const ctrl = new SubcategoryController();
        r.delete(
          "/deleteSubcategory/:id",
          (req: any, _res: any, next: any) => {
            req.user = {
              id: "000",
              role_name: "Employee",
              permissions: { Subcategories: { view: { allowed: true } } },
            };
            next();
          },
          (req: any, res: any, next: any) => {
            const user = req.user as any;
            if (!user?.permissions?.["Subcategories"]?.["delete"]?.allowed) {
              return res.status(403).json({ success: false, message: "Forbidden" });
            }
            next();
          },
          ctrl.delete.bind(ctrl)
        );
        return r;
      })());

      const res = await request(restrictedApp)
        .delete(`/api/subcategories/deleteSubcategory/${SUB_ID}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

  });

  /* ── GET LIST ────────────────────────────────────────────────────────────── */

  describe("GET /api/subcategories/getList", () => {

    /* 16 */
    it("16: returns all subcategories → 200", async () => {
      const subs = [makeSub(), makeSub({ id: "550e8400-e29b-41d4-a716-200000000002", name: "laptops" })];
      qm().mockResolvedValueOnce(ok(subs));

      const res = await request(app).get("/api/subcategories/getList");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

  });

  /* ── GET BY ID ───────────────────────────────────────────────────────────── */

  describe("GET /api/subcategories/getSubcategoryById/:id", () => {

    /* 17 */
    it("17: subcategory found → 200", async () => {
      qm().mockResolvedValueOnce(ok([makeSub()]));

      const res = await request(app).get(`/api/subcategories/getSubcategoryById/${SUB_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(SUB_ID);
    });

    /* 18 */
    it("18: subcategory not found → 404", async () => {
      qm().mockResolvedValueOnce(empty());

      const res = await request(app).get(`/api/subcategories/getSubcategoryById/${SUB_ID}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

  });

  /* ── GET BY CATEGORY ID ──────────────────────────────────────────────────── */

  describe("GET /api/subcategories/getSubcategoryByCategoryId/:category_id", () => {

    /* 19 */
    it("19: returns subcategories belonging to the given category → 200", async () => {
      const subs = [makeSub(), makeSub({ id: "550e8400-e29b-41d4-a716-200000000002", name: "tablets" })];
      qm().mockResolvedValueOnce(ok(subs));

      const res = await request(app)
        .get(`/api/subcategories/getSubcategoryByCategoryId/${CAT_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].category_id).toBe(CAT_ID);
    });

  });

});
