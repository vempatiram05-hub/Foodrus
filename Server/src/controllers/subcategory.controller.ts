import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { getQueryString, getQueryNumber } from "../utils/queryParser";
import { deleteFile } from "../utils/deleteFile";
import { generateImageName } from "../utils/file.util";
import { generateLocalSignedUrl } from "../utils/localSignedUrl";
import { DBconnection } from "../config/DBConnect";

const uploadDir = path.join(process.cwd(), "src/uploads/subcategories");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const normalize = (name: string) => name.trim().toLowerCase();

const mapImages = (images?: any): string[] => {
  const arr = parseImages(images);
  return arr.map((img: string) => generateLocalSignedUrl(img));
};

const parseImages = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }
  return [];
};

const SUBCAT_COLS = "id, name, description, category_id, images, is_active, created_at, updated_at, created_by";

const SUBADMIN_ROLES = ["SubAdmin", "StoreAdmin"];
const ADMIN_ROLES = ["Admin", "SuperAdmin"];

/**
 * Returns true if the given category is owned by an Admin/SuperAdmin user.
 * Admin-owned categories are treated as protected — SubAdmin/StoreAdmin cannot modify their subcategories.
 */
async function isCategoryAdminOwned(categoryId: string): Promise<boolean> {
  const { data: cat } = await DBconnection
    .from("categories").select("created_by").eq("id", categoryId).maybeSingle();
  if (!cat?.created_by) return true;
  const { data: user } = await DBconnection
    .from("users").select("role_name").eq("id", cat.created_by).maybeSingle();
  return ADMIN_ROLES.includes((user as any)?.role_name ?? "");
}

export class SubcategoryController {

  async create(req: any, res: Response) {
    try {
      const { name, description, category_id } = req.body;
      if (!name || !category_id) {
        return res.status(400).json({ success: false, message: "Name and category_id are required" });
      }

      const normalizedName = normalize(name);

      const { data: cat } = await DBconnection
        .from("categories").select("id").eq("id", category_id).maybeSingle();
      if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

      // Check for duplicate subcategory under same category — return existing instead of erroring
      const { data: dup } = await DBconnection
        .from("subcategories").select(SUBCAT_COLS)
        .eq("category_id", category_id).ilike("name", normalizedName).limit(1).maybeSingle();
      if (dup) {
        return res.status(200).json({
          success: true,
          already_exists: true,
          message: "Subcategory already exists in this category.",
          data: { ...dup, images: mapImages(dup.images) },
        });
      }

      const now = new Date().toISOString();
      const baseInsert = {
        name: normalizedName,
        description: description ?? null,
        category_id,
        images: JSON.stringify([]),
        created_at: now,
        updated_at: now,
      };
      const insertPayload = req.user?.id
        ? { ...baseInsert, created_by: req.user.id as string }
        : baseInsert;

      const { data: created, error: insErr } = await DBconnection
        .from("subcategories").insert(insertPayload).select(SUBCAT_COLS).single();
      if (insErr) throw new Error(insErr.message);

      if (req.files?.length) {
        const lastTimestampRef = { value: 0 };
        const imagePaths: string[] = [];
        try {
          for (const file of req.files) {
            const filename = generateImageName(normalizedName, file.originalname, lastTimestampRef);
            fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
            imagePaths.push(`/uploads/subcategories/${filename}`);
          }
          const { data: withImages, error: updErr } = await DBconnection
            .from("subcategories")
            .update({ images: JSON.stringify(imagePaths), updated_at: new Date().toISOString() })
            .eq("id", created.id)
            .select(SUBCAT_COLS)
            .single();
          if (updErr) throw new Error(updErr.message);
          return res.status(201).json({
            success: true, message: "Subcategory created successfully",
            data: { ...withImages, images: mapImages(withImages.images) },
          });
        } catch (err) {
          imagePaths.forEach(deleteFile);
          throw err;
        }
      }

      return res.status(201).json({
        success: true, message: "Subcategory created successfully",
        data: { ...created, images: mapImages(created.images) },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      let allowedCategoryIds: string[] | null = null;
      const userPayload = (req as any).user as any;
      if (userPayload?.role_name === "SubAdmin") {
        const { data: hierarchyUsers } = await DBconnection
          .from("users").select("id").eq("sub_admin_id", userPayload.id);
        const hierarchyIds = (hierarchyUsers ?? []).map((u: any) => u.id);

        const { data: adminUsers } = await DBconnection
          .from("users").select("id").in("role_name", ["Admin", "SuperAdmin"]);
        const adminIds = (adminUsers ?? []).map((u: any) => u.id);

        const allowedCreatorIds = [userPayload.id, ...hierarchyIds, ...adminIds];

        const { data: cats } = await (DBconnection.from("categories") as any)
          .select("id").in("created_by", allowedCreatorIds);
        allowedCategoryIds = (cats ?? []).map((c: any) => c.id);
      }

      const { data: allRows, error } = await DBconnection
        .from("subcategories").select(SUBCAT_COLS).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      let rows: any[] = allRows ?? [];

      if (allowedCategoryIds !== null) {
        rows = rows.filter((s: any) => allowedCategoryIds!.includes(s.category_id));
      }
      if (search) {
        rows = rows.filter((s: any) =>
          s.name?.toLowerCase().includes(search) || s.description?.toLowerCase().includes(search)
        );
      }

      const total = rows.length;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const offset = (page - 1) * limit;
        const mapped = rows.slice(offset, offset + limit).map((s: any) => ({ ...s, images: mapImages(s.images) }));
        return res.json({
          success: true,
          message: mapped.length ? "Subcategories fetched successfully" : "No records found",
          data: mapped, total, page, limit,
        });
      }

      const mapped = rows.map((s: any) => ({ ...s, images: mapImages(s.images) }));
      return res.json({
        success: true,
        message: mapped.length ? "Subcategories fetched successfully" : "No records found",
        data: mapped, total,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch subcategories" });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { data, error } = await DBconnection
        .from("subcategories").select(SUBCAT_COLS).eq("id", req.params.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ success: false, message: "Subcategory not found" });
      return res.json({
        success: true, message: "Subcategory retrieved successfully",
        data: { ...data, images: mapImages(data.images) },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async getByCategoryId(req: Request, res: Response) {
    try {
      const categoryId = req.params.category_id as string;
      const userPayload = (req as any).user as any;

      if (userPayload?.role_name === "SubAdmin") {
        const { data: cat } = await DBconnection
          .from("categories").select("id, created_by").eq("id", categoryId).maybeSingle();
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

        const adminOwned = await isCategoryAdminOwned(categoryId);
        if (!adminOwned) {
          const { data: hierarchyUsers } = await DBconnection
            .from("users").select("id").eq("sub_admin_id", userPayload.id);
          const hierarchyIds = (hierarchyUsers ?? []).map((u: any) => u.id);
          const allowedCreatorIds = new Set([userPayload.id, ...hierarchyIds]);

          if (cat.created_by && !allowedCreatorIds.has(cat.created_by)) {
            return res.status(403).json({ success: false, message: "Forbidden: This category does not belong to your scope" });
          }
        }
      }

      const { data: rows, error } = await DBconnection
        .from("subcategories").select(SUBCAT_COLS).eq("category_id", categoryId).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const mapped = (rows ?? []).map((s: any) => ({ ...s, images: mapImages(s.images) }));
      return res.json({ success: true, message: "Subcategories retrieved by category_id successfully", data: mapped });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async update(req: any, res: Response) {
    try {
      const id = req.params.id as string;

      const { data: existing, error: fetchErr } = await DBconnection
        .from("subcategories").select(SUBCAT_COLS).eq("id", id).maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing) return res.status(404).json({ success: false, message: "Subcategory not found" });

      // Guard: SubAdmin/StoreAdmin cannot modify subcategories of admin-owned categories,
      // nor reparent a subcategory into an admin-owned category.
      if (SUBADMIN_ROLES.includes(req.user?.role_name)) {
        const currentIsAdminOwned = await isCategoryAdminOwned(existing.category_id);
        if (currentIsAdminOwned) {
          return res.status(403).json({
            success: false,
            message: "Global categories cannot be modified.",
          });
        }
        if (req.body.category_id && req.body.category_id !== existing.category_id) {
          const targetIsAdminOwned = await isCategoryAdminOwned(req.body.category_id);
          if (targetIsAdminOwned) {
            return res.status(403).json({
              success: false,
              message: "Global categories cannot be modified.",
            });
          }
        }
      }

      if (req.body.category_id) {
        const { data: cat } = await DBconnection
          .from("categories").select("id").eq("id", req.body.category_id).maybeSingle();
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
      }

      let normalizedName: string | undefined;
      if (req.body.name) {
        normalizedName = normalize(req.body.name);
        const targetCategoryId = req.body.category_id || existing.category_id;
        const { data: dup } = await DBconnection
          .from("subcategories").select("id")
          .eq("category_id", targetCategoryId).ilike("name", normalizedName).neq("id", id).maybeSingle();
        if (dup) return res.status(409).json({ success: false, message: "Subcategory already exists in this category" });
      }

      let images: string[] = parseImages(existing.images);
      if (req.files?.length) {
        images.forEach(deleteFile);
        images = [];
        const lastTimestampRef = { value: 0 };
        try {
          for (const file of req.files) {
            const filename = generateImageName(normalizedName || existing.name, file.originalname, lastTimestampRef);
            fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
            images.push(`/uploads/subcategories/${filename}`);
          }
        } catch (err) {
          images.forEach(deleteFile);
          throw err;
        }
      }

      const updatePayload: any = { images: JSON.stringify(images), updated_at: new Date().toISOString() };
      if (normalizedName !== undefined) updatePayload.name = normalizedName;
      if (req.body.description !== undefined) updatePayload.description = req.body.description;
      if (req.body.category_id) updatePayload.category_id = req.body.category_id;
      if (req.body.is_active !== undefined) updatePayload.is_active = req.body.is_active;

      const { data: updated, error: updErr } = await DBconnection
        .from("subcategories").update(updatePayload).eq("id", id).select(SUBCAT_COLS).single();
      if (updErr) throw new Error(updErr.message);

      return res.json({
        success: true, message: "Subcategory updated successfully",
        data: { ...updated, images: mapImages(updated.images) },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async delete(req: any, res: Response) {
    try {
      const { data: existing, error: fetchErr } = await DBconnection
        .from("subcategories").select(SUBCAT_COLS).eq("id", req.params.id).maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing) return res.status(404).json({ success: false, message: "Subcategory not found" });

      // Guard: SubAdmin/StoreAdmin cannot delete subcategories of admin-owned categories
      if (SUBADMIN_ROLES.includes(req.user?.role_name)) {
        const isAdminOwned = await isCategoryAdminOwned(existing.category_id);
        if (isAdminOwned) {
          return res.status(403).json({
            success: false,
            message: "Global categories cannot be modified.",
          });
        }
      }

      const { error: delErr } = await DBconnection.from("subcategories").delete().eq("id", req.params.id);
      if (delErr) throw new Error(delErr.message);

      parseImages(existing.images).forEach(deleteFile);

      return res.json({ success: true, message: "Subcategory deleted successfully" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}
