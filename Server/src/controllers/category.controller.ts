import { Request, Response } from "express";
import { deleteFile } from "../utils/deleteFile";
import path from "node:path";
import fs from "node:fs";
import { generateImageName } from "../utils/file.util";
import { generateLocalSignedUrl } from "../utils/localSignedUrl";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { DBconnection } from "../config/DBConnect";
import { logger } from "../utils/logger";

const UPLOAD_DIR = path.join(process.cwd(), "src/uploads/categories");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const normalizeName = (name: string) => name.trim().toLowerCase();

const mapImages = (images: any): string[] => {
  if (!images) return [];
  const arr = Array.isArray(images) ? images : [];
  return arr.map((img: string) => generateLocalSignedUrl(img));
};

const saveFiles = (files: Express.Multer.File[], name: string): string[] => {
  const lastTimestampRef = { value: 0 };
  return files.map(file => {
    const filename = generateImageName(name, file.originalname, lastTimestampRef);
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
    return `/uploads/categories/${filename}`;
  });
};

// Base columns that always exist
const CAT_COLS_BASE = "id, name, description, is_active, type, images, created_at, updated_at, created_by";
// Full columns including the new is_global column (used when column exists in Supabase)
const CAT_COLS_FULL = "id, name, description, is_active, type, images, is_global, created_at, updated_at, created_by";

const SUBADMIN_ROLES = ["SubAdmin", "StoreAdmin"];
const ADMIN_ROLES = ["Admin", "SuperAdmin"];

// ── Column existence detection ─────────────────────────────────────────────────
// Both columns are probed once per process and cached forever.

let _createdByExists: boolean | null = null;
async function detectCreatedByCol(): Promise<boolean> {
  if (_createdByExists !== null) return _createdByExists;
  const { error } = await (DBconnection.from("categories") as any).select("created_by").limit(1);
  _createdByExists = !error || !error.message.includes("created_by");
  if (!_createdByExists) {
    console.warn(
      "[categories] ⚠️  categories.created_by column not found in Supabase.\n" +
      "  Run in your Supabase SQL editor:\n" +
      "  ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_by UUID;\n" +
      "  CREATE INDEX IF NOT EXISTS idx_categories_created_by ON public.categories (created_by);"
    );
  }
  return _createdByExists;
}

let _isGlobalColExists: boolean | null = null;
async function detectIsGlobalCol(): Promise<boolean> {
  if (_isGlobalColExists !== null) return _isGlobalColExists;
  const { error } = await (DBconnection.from("categories") as any).select("is_global").limit(1);
  _isGlobalColExists = !error || !error.message.includes("is_global");
  if (!_isGlobalColExists) {
    console.warn(
      "[categories] ⚠️  categories.is_global column not found in Supabase.\n" +
      "  Run this SQL in your Supabase SQL editor (Dashboard → SQL Editor → New query):\n\n" +
      "  ALTER TABLE public.categories\n" +
      "    ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;\n\n" +
      "  UPDATE public.categories\n" +
      "    SET is_global = TRUE\n" +
      "   WHERE created_by IN (\n" +
      "     SELECT id FROM public.users WHERE role_name IN ('Admin', 'SuperAdmin')\n" +
      "   );\n\n" +
      "  CREATE INDEX IF NOT EXISTS idx_categories_is_global\n" +
      "    ON public.categories (is_global) WHERE is_global = TRUE;\n"
    );
  }
  return _isGlobalColExists;
}

/** Returns the correct SELECT columns string based on DB column availability */
async function getCatCols(): Promise<string> {
  const hasIsGlobal = await detectIsGlobalCol();
  return hasIsGlobal ? CAT_COLS_FULL : CAT_COLS_BASE;
}

// ── Admin ID cache ────────────────────────────────────────────────────────────
// Used for: isAdminOwned() guard in update/delete, getAdminId() in promotion,
// and computing is_global as a fallback when the DB column doesn't exist yet.
interface AdminIdCache { ids: Set<string>; fetchedAt: number }
let _adminIdCache: AdminIdCache | null = null;
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;

async function getAdminIdSet(): Promise<Set<string>> {
  const now = Date.now();
  if (_adminIdCache && now - _adminIdCache.fetchedAt < ADMIN_CACHE_TTL_MS) {
    return _adminIdCache.ids;
  }
  const { data } = await DBconnection
    .from("users").select("id").in("role_name", ["Admin", "SuperAdmin"]);
  const ids = new Set<string>((data ?? []).map((u: any) => u.id));
  _adminIdCache = { ids, fetchedAt: now };
  return ids;
}

function invalidateAdminIdCache(): void {
  _adminIdCache = null;
}

/**
 * Returns true if the given created_by user ID belongs to an Admin or SuperAdmin.
 * Used to protect admin-owned categories from SubAdmin modification/deletion.
 */
async function isAdminOwned(createdById: string | null | undefined): Promise<boolean> {
  if (!createdById) return true;
  const adminIds = await getAdminIdSet();
  return adminIds.has(createdById);
}

/**
 * Resolve is_global for a category row.
 * If the DB column exists, reads it directly; otherwise computes from created_by.
 */
async function resolveIsGlobal(row: any): Promise<boolean> {
  const hasCol = await detectIsGlobalCol();
  if (hasCol) return Boolean(row.is_global);
  // Fallback: compute from created_by
  if (!row.created_by) return false;
  const adminIds = await getAdminIdSet();
  return adminIds.has(row.created_by);
}

/** Resolve the Admin user ID to use as created_by when promoting a category to global */
async function getAdminId(fallbackId: string): Promise<string> {
  const adminIds = await getAdminIdSet();
  const firstId = Array.from(adminIds)[0];
  return firstId ?? fallbackId;
}


export class CategoryController {

  static async create(req: any, res: Response) {
    try {
      const { name, description, is_active, type } = req.body;
      if (!name) return res.status(400).json({ success: false, message: "Category name is required" });

      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required to create a category" });
      }

      const normalized = normalizeName(name);
      const CAT_COLS = await getCatCols();
      const hasIsGlobalCol = await detectIsGlobalCol();

      // ── 1. Check if a category with this name already exists ─────────────────
      const { data: existing } = await (DBconnection.from("categories") as any)
        .select(CAT_COLS).ilike("name", normalized).limit(1).maybeSingle();

      if (existing) {
        const existingIsGlobal = await resolveIsGlobal(existing);

        // 1a. Already globally promoted — return as-is
        if (existingIsGlobal) {
          return res.status(200).json({
            success: true,
            already_global: true,
            message: "This is already a shared global category — it has been added to your view.",
            data: { ...existing, images: mapImages(existing.images), type: existing.type ?? "food", is_global: true },
          });
        }

        // 1b. Admin/SuperAdmin caller — they see all categories, just return it
        if (ADMIN_ROLES.includes(req.user.role_name)) {
          return res.status(200).json({
            success: true,
            already_global: true,
            message: "This category already exists.",
            data: { ...existing, images: mapImages(existing.images), type: existing.type ?? "food", is_global: existingIsGlobal },
          });
        }

        // 1c. SubAdmin/StoreAdmin/Employee — check hierarchy
        const governingSubAdminId: string | null =
          req.user.role_name === "SubAdmin" ? req.user.id :
          (req.user.sub_admin_id ?? null);

        if (governingSubAdminId) {
          const { data: hierarchyUsers } = await DBconnection
            .from("users").select("id").eq("sub_admin_id", governingSubAdminId);
          const hierarchyIdSet = new Set((hierarchyUsers ?? []).map((u: any) => u.id));
          hierarchyIdSet.add(governingSubAdminId);

          if (existing.created_by && hierarchyIdSet.has(existing.created_by)) {
            // Same hierarchy → duplicate
            return res.status(409).json({ success: false, message: "Category name already exists in your scope" });
          }

          // Foreign hierarchy → promote to global: set is_global = true in DB
          const adminId = await getAdminId(req.user.id);
          if (!adminId || adminId === req.user.id) {
            throw new Error("Cannot promote category: no Admin user exists to take ownership. Please contact your administrator.");
          }
          const now = new Date().toISOString();
          const updatePayload: any = { created_by: adminId, updated_at: now };
          if (hasIsGlobalCol) updatePayload.is_global = true;

          const { data: promoted, error: promoteErr } = await (DBconnection.from("categories") as any)
            .update(updatePayload)
            .eq("id", existing.id)
            .select(CAT_COLS)
            .single();
          if (promoteErr) throw new Error(promoteErr.message);

          invalidateAdminIdCache();

          return res.status(200).json({
            success: true,
            promoted: true,
            message: "This category already existed and has been made available to all stores.",
            data: { ...promoted, images: mapImages(promoted.images), type: promoted.type ?? "food", is_global: true },
          });
        }

        // Fallback (Employee without sub_admin_id context)
        return res.status(200).json({
          success: true,
          already_global: true,
          message: "This category already exists.",
          data: { ...existing, images: mapImages(existing.images), type: existing.type ?? "food", is_global: existingIsGlobal },
        });
      }

      // ── 2. Create new category ────────────────────────────────────────────────
      let images: string[] | undefined;
      if (req.files?.length) images = saveFiles(req.files, normalized);

      const resolvedType = type ?? "food";
      const now = new Date().toISOString();
      const createdByExists = await detectCreatedByCol();
      // Admin/SuperAdmin-created categories are global from birth
      const callerIsAdmin = ADMIN_ROLES.includes(req.user?.role_name);

      const insertPayload: any = {
        name: normalized,
        description: description ?? null,
        is_active: is_active ?? true,
        type: resolvedType,
        images: JSON.stringify(images ?? []),
        created_at: now,
        updated_at: now,
      };
      if (createdByExists) insertPayload.created_by = req.user.id;
      if (hasIsGlobalCol) insertPayload.is_global = callerIsAdmin;

      const { data: row, error } = await (DBconnection.from("categories") as any)
        .insert(insertPayload)
        .select(CAT_COLS)
        .single();

      if (error) throw new Error(error.message);

      return res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: { ...row, type: resolvedType, images: mapImages(row.images), is_global: callerIsAdmin },
      });
    } catch (err: any) {
      if (req.files?.length) req.files.forEach((f: any) => deleteFile(`/uploads/categories/${f.filename}`));
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const typeFilter = ((req.query.type as string | undefined) || "").toLowerCase().trim();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      if (typeFilter && typeFilter !== "food" && typeFilter !== "grocery" && typeFilter !== "bakery") {
        return res.status(400).json({ success: false, message: `Invalid type "${typeFilter}". Must be one of: food, grocery, bakery.` });
      }

      const passesTypeFilter = (c: any): boolean => {
        if (typeFilter !== "food" && typeFilter !== "grocery" && typeFilter !== "bakery") return true;
        return (c.type ?? "food") === typeFilter;
      };

      const userPayload = (req as any).user as any;
      const callerRole: string | undefined = userPayload?.role_name;
      const isScopedRole = callerRole === "SubAdmin" || callerRole === "StoreAdmin" || callerRole === "Employee";

      let governingSubAdminId: string | null = null;
      if (userPayload) {
        if (callerRole === "SubAdmin") {
          governingSubAdminId = userPayload.id;
        } else if (callerRole === "StoreAdmin") {
          governingSubAdminId = userPayload.sub_admin_id ?? null;
        } else if (callerRole === "Employee") {
          governingSubAdminId = userPayload.sub_admin_id ?? null;
          if (!governingSubAdminId && userPayload.store_admin_id) {
            const { data: saUser } = await DBconnection
              .from("users").select("sub_admin_id").eq("id", userPayload.store_admin_id).single();
            governingSubAdminId = (saUser as any)?.sub_admin_id ?? null;
          }
        }
      }

      if (isScopedRole && !governingSubAdminId) {
        const empty = { success: true, message: "No records found", data: [], total: 0 };
        return isPaginated
          ? res.json({ ...empty, page: getQueryNumber(req.query, "page", 1), limit: getQueryNumber(req.query, "limit", 10) })
          : res.json(empty);
      }

      const CAT_COLS = await getCatCols();
      const hasIsGlobalCol = await detectIsGlobalCol();
      const createdByExists = await detectCreatedByCol();

      let dbQuery = (DBconnection.from("categories") as any)
        .select(CAT_COLS)
        .order("created_at", { ascending: false });

      if (governingSubAdminId && createdByExists) {
        const { data: hierarchyUsers } = await DBconnection
          .from("users").select("id").eq("sub_admin_id", governingSubAdminId);
        const hierarchyIds = (hierarchyUsers ?? []).map((u: any) => u.id);
        const allHierarchyIds = [governingSubAdminId, ...hierarchyIds];

        if (hasIsGlobalCol) {
          // Use stored is_global: include hierarchy-owned OR globally shared categories
          dbQuery = dbQuery.or(`created_by.in.(${allHierarchyIds.join(",")}),is_global.eq.true`);
        } else {
          // Fallback: include hierarchy-owned + admin-owned (computed from admin ID set)
          const adminIdSet = await getAdminIdSet();
          const allowedCreatorIds = [...allHierarchyIds, ...Array.from(adminIdSet)];
          dbQuery = dbQuery.in("created_by", allowedCreatorIds);
        }
      }

      const { data: allCats, error: fetchErr } = await dbQuery;
      if (fetchErr) throw new Error(fetchErr.message);

      // Build admin ID set once for fallback is_global computation (skipped if column exists)
      const adminIdSet = hasIsGlobalCol ? null : await getAdminIdSet();

      let data: any[] = allCats ?? [];

      data = data.filter(passesTypeFilter);
      if (search) {
        data = data.filter((c: any) =>
          c.name?.toLowerCase().includes(search) || c.description?.toLowerCase().includes(search)
        );
      }

      const total = data.length;

      const tagDto = (c: any) => ({
        ...c,
        images: mapImages(c.images),
        // If column exists, use stored value; otherwise compute from created_by
        is_global: hasIsGlobalCol
          ? Boolean(c.is_global)
          : (c.created_by != null && adminIdSet!.has(c.created_by)),
      });

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const offset = (page - 1) * limit;
        const mapped = data.slice(offset, offset + limit).map(tagDto);
        return res.json({
          success: true,
          message: mapped.length ? "Categories fetched successfully" : "No records found",
          data: mapped, total, page, limit,
        });
      }

      const mapped = data.map(tagDto);
      return res.json({
        success: true,
        message: mapped.length ? "Categories fetched successfully" : "No records found",
        data: mapped, total,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch categories" });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const CAT_COLS = await getCatCols();
      const hasIsGlobalCol = await detectIsGlobalCol();

      const { data, error } = await DBconnection
        .from("categories").select(CAT_COLS).eq("id", req.params.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Category not found");

      const isGlobal = await resolveIsGlobal(data);
      return res.json({
        success: true,
        message: "Category retrieved successfully",
        data: { ...data, images: mapImages(data.images), type: data.type ?? "food", is_global: isGlobal },
      });
    } catch (err: any) {
      return res.status(404).json({ success: false, message: err.message });
    }
  }

  static async update(req: any, res: Response) {
    try {
      const { name, description, is_active, type } = req.body;
      const CAT_COLS = await getCatCols();

      const { data: existing, error: fetchErr } = await DBconnection
        .from("categories").select(CAT_COLS).eq("id", req.params.id).maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing) return res.status(404).json({ success: false, message: "Category not found" });

      // Guard: SubAdmin/StoreAdmin cannot modify globally shared categories
      if (SUBADMIN_ROLES.includes(req.user?.role_name)) {
        const globalCheck = await resolveIsGlobal(existing);
        if (globalCheck) {
          return res.status(403).json({
            success: false,
            message: "Global categories cannot be modified.",
          });
        }
      }

      let normalizedName = existing.name;
      if (name) {
        normalizedName = normalizeName(name);
        const { data: dup } = await DBconnection
          .from("categories").select("id")
          .ilike("name", normalizedName).neq("id", req.params.id).maybeSingle();
        if (dup) return res.status(409).json({ success: false, message: "A category with this name already exists" });
      }

      let images = existing.images;
      if (req.files?.length) {
        if (Array.isArray(existing.images)) existing.images.forEach(deleteFile);
        images = saveFiles(req.files, normalizedName);
      }

      const responseType = type ?? existing.type ?? "food";
      const now = new Date().toISOString();

      const { data: row, error: updErr } = await DBconnection
        .from("categories")
        .update({
          name: normalizedName,
          description: description ?? existing.description,
          is_active: is_active ?? existing.is_active,
          type: responseType,
          images: JSON.stringify(Array.isArray(images) ? images : []),
          updated_at: now,
        })
        .eq("id", req.params.id)
        .select(CAT_COLS)
        .single();

      if (updErr) throw new Error(updErr.message);

      const updatedIsGlobal = await resolveIsGlobal(row);
      return res.json({
        success: true,
        message: "Category updated successfully",
        data: { ...row, type: responseType, images: mapImages(row.images), is_global: updatedIsGlobal },
      });
    } catch (err: any) {
      if (req.files?.length) req.files.forEach((f: any) => deleteFile(`/uploads/categories/${f.filename}`));
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async delete(req: any, res: Response) {
    try {
      const { data: existing, error: fetchErr } = await DBconnection
        .from("categories").select("id, images, created_by, is_global").eq("id", req.params.id).maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing) return res.status(404).json({ success: false, message: "Category not found" });

      // Guard: SubAdmin/StoreAdmin cannot delete global categories
      if (SUBADMIN_ROLES.includes(req.user?.role_name)) {
        const globalCheck = await resolveIsGlobal(existing);
        if (globalCheck) {
          return res.status(403).json({
            success: false,
            message: "Global categories cannot be modified.",
          });
        }
      }

      const { count } = await DBconnection
        .from("subcategories").select("id", { count: "exact", head: true }).eq("category_id", req.params.id);
      if ((count ?? 0) > 0) throw new Error("Cannot delete category — subcategories exist.");

      if (Array.isArray(existing.images)) existing.images.forEach(deleteFile);

      const { error: delErr } = await DBconnection.from("categories").delete().eq("id", req.params.id);
      if (delErr) throw new Error(delErr.message);

      return res.json({ success: true, message: "Category deleted successfully" });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
