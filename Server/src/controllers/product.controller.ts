import { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { UniqueService } from "../services/unique.service";
import { getQueryString, getQueryNumber } from "../utils/queryParser";
import { deleteFile } from "../utils/deleteFile";
import { generateImageName } from "../utils/file.util";
import { generateLocalSignedUrl } from "../utils/localSignedUrl";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { DBconnection } from "../config/DBConnect";
import { generateSKU } from "../utils/sku.util";


const uniqueService = new UniqueService();
const TABLE_NAME = "products";
const UPLOAD_DIR = path.join(process.cwd(), "src/uploads/products");


if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const normalize = (name: string) => name.trim().toLowerCase();

const mapImages = (images?: any): string[] => {
  let parsed = images;
  if (typeof images === "string") {
    try { parsed = JSON.parse(images); } catch (e) {}
  }
  const arr = Array.isArray(parsed) ? parsed : [];
  return arr.map(generateLocalSignedUrl);
};

/**
 * Fetch the store type for a given store_id.
 * Returns the lowercase type string or null if store not found.
 */
async function getStoreType(storeId: string): Promise<string | null> {
  const { data, error } = await DBconnection
    .from("stores")
    .select("type")
    .eq("id", storeId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.type as string).toLowerCase();
}

export class ProductController {
  /* ================= CREATE ================= */
  static async create(req: any, res: Response) {
    try {
      const { name, store_id, category_id, brand_id, template_id } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: "Product name is required" });
      }

      if (!req.files?.length) {
        return res.status(400).json({ success: false, message: "At least one image is required" });
      }

      const normalizedName = normalize(name);

      // Category must already exist — no on-the-fly creation
      if (category_id) {
        const { data: catRow } = await DBconnection
          .from("categories").select("id").eq("id", category_id).maybeSingle();
        if (!catRow) {
          return res.status(400).json({
            success: false,
            message: "Category not found. Categories must be created by a SubAdmin before assigning to products.",
          });
        }
      }

      // Template must already exist
      if (template_id) {
        const { data: templateRow } = await DBconnection
          .from("templates").select("id").eq("id", template_id).maybeSingle();
        if (!templateRow) {
          return res.status(400).json({
            success: false,
            message: "Template not found.",
          });
        }
      }

      // Store-type-aware brand restriction
      if (store_id) {
        const storeType = await getStoreType(store_id);
        if (storeType === null) {
          return res.status(400).json({ success: false, message: "Store not found" });
        }
        if (storeType === "restaurant" && brand_id) {
          return res.status(400).json({
            success: false,
            message: "Restaurant products cannot have a brand. Brands are only for grocery store products.",
          });
        }
      }

      // Variant parsing
      if (req.body.variant_id && typeof req.body.variant_id === "string") {
        req.body.variant_id = JSON.parse(req.body.variant_id);
      }

      // Type coercion for FormData string values
      if (req.body.is_veg !== undefined) req.body.is_veg = req.body.is_veg === "true" || req.body.is_veg === true;
      if (req.body.is_active !== undefined) req.body.is_active = req.body.is_active === "true" || req.body.is_active === true;
      if (req.body.base_price !== undefined) req.body.base_price = parseFloat(req.body.base_price);
      if (req.body.quantity !== undefined) req.body.quantity = parseInt(req.body.quantity, 10);

      // --- SKU Auto-Generation ---
      let generatedSku = "";
      let isUnique = false;
      let categoryName = "GEN";

      // 1. Fetch category name for prefix
      if (category_id) {
        const { data: catData } = await DBconnection
          .from("categories")
          .select("name")
          .eq("id", category_id)
          .maybeSingle();
        if (catData) categoryName = catData.name;
      }

      // 2. Loop until a unique SKU is generated
      let attempts = 0;
      while (!isUnique && attempts < 5) {
        generatedSku = generateSKU(categoryName, name);
        const { data: existingSku } = await DBconnection
          .from(TABLE_NAME)
          .select("id")
          .eq("sku", generatedSku)
          .limit(1);
        
        if (!existingSku || existingSku.length === 0) {
          isUnique = true;
        }
        attempts++;
      }
      // ---------------------------

      const created = await uniqueService.create(TABLE_NAME, {
        ...req.body,
        name: normalizedName,
        sku: generatedSku,
        images: [],
        change_type: "CREATE",
        approval_status: "APPROVED",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const imagePaths: string[] = [];
      const lastTimestampRef = { value: 0 };

      try {
        for (const file of req.files as Express.Multer.File[]) {
          const filename = generateImageName(normalizedName, file.originalname, lastTimestampRef);
          fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
          imagePaths.push(`/uploads/products/${filename}`);
        }

        const updated = await uniqueService.updateById(TABLE_NAME, created.id, { images: imagePaths });

        return res.status(201).json({
          success: true,
          message: "Product created successfully",
          data: updated,
        });
      } catch (err: any) {
        imagePaths.forEach(deleteFile);
        throw normalizeSupabaseError(err);
      }
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* ================= GET LIST — unified pagination, search, type filter and role-scoped store access ================= */
  static async getList(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const type = (getQueryString(req.query, "type") || "").toLowerCase();
      const categoryId = (getQueryString(req.query, "category_id") || "").trim();
      const storeId = (getQueryString(req.query, "store_id") || "").trim();
      const approvalStatus = (getQueryString(req.query, "approval_status") || "").trim().toUpperCase();
      const regionIdParam = (getQueryString(req.query, "region_id") || "").trim();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["name", "description", "sku"];

      // ── 1. Determine allowed store IDs based on role ──────────────────────
      let allowedStoreIds: string[] | null = null;
      let forceApproved = false;

      if (!user || user.role_name === "Customer") {
        forceApproved = true;
        const { data: activeStores } = await DBconnection.from("stores").select("id").eq("is_active", true);
        allowedStoreIds = activeStores?.map((s: any) => s.id) || [];
      } else {
        const role = user.role_name;
        if (role === "StoreAdmin") {
          const { data: stores } = await DBconnection.from("stores").select("id").eq("store_admin_id", user.id);
          allowedStoreIds = stores?.map((s: any) => s.id) || [];
        } else if (role === "SubAdmin") {
          const { data: storeAdmins } = await DBconnection.from("users").select("id").eq("sub_admin_id", user.id).eq("role_name", "StoreAdmin");
          const storeAdminIds = storeAdmins?.map((u: any) => u.id) || [];
          const { data: stores } = await DBconnection.from("stores").select("id").in("store_admin_id", storeAdminIds);
          allowedStoreIds = stores?.map((s: any) => s.id) || [];
        } else if (role === "SuperAdmin") {
          const { data: storeAdmins } = await DBconnection.from("users").select("id").eq("superadmin_id", user.id).eq("role_name", "StoreAdmin");
          const storeAdminIds = storeAdmins?.map((u: any) => u.id) || [];
          const { data: stores } = await DBconnection.from("stores").select("id").in("store_admin_id", storeAdminIds);
          allowedStoreIds = stores?.map((s: any) => s.id) || [];
        } else if (role === "Employee") {
          const { data: stores } = await DBconnection.from("stores").select("id").eq("store_admin_id", user.store_admin_id);
          allowedStoreIds = stores?.map((s: any) => s.id) || [];
        }
        // Admin sees everything — allowedStoreIds stays null
      }

      // ── 2. Intersect query param store_id with role-allowed store IDs ─────
      let finalStoreIds: string[] | null = null;
      if (storeId) {
        const requestedIds = storeId.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (allowedStoreIds !== null) {
          finalStoreIds = requestedIds.filter(id => allowedStoreIds!.includes(id));
        } else {
          finalStoreIds = requestedIds;
        }
      } else if (allowedStoreIds !== null) {
        finalStoreIds = allowedStoreIds;
      }

      // ── 2b. Intersect with region filter ─────────────────────────────────────
      if (regionIdParam) {
        const { data: regionStores, error: regionStoreErr } = await DBconnection.from('stores').select('id').eq('region_id', regionIdParam);
        if (regionStoreErr) throw regionStoreErr;
        const regionStoreIds = (regionStores || []).map((s: any) => s.id);
        if (finalStoreIds !== null) {
          finalStoreIds = finalStoreIds.filter((id: string) => regionStoreIds.includes(id));
        } else {
          finalStoreIds = regionStoreIds;
        }
      }

      // ── 3. Resolve store IDs for type filter (food / grocery / bakery) ──
      let typeStoreIds: string[] | null = null;
      if (["food", "grocery", "bakery"].includes(type)) {
        let storeType = type;
        if (type === "food") storeType = "restaurant";
        const { data: storesByType } = await DBconnection
          .from("stores")
          .select("id")
          .eq("type", storeType);
        typeStoreIds = (storesByType || []).map((s: any) => s.id);

        if (finalStoreIds !== null) {
          finalStoreIds = finalStoreIds.filter(id => typeStoreIds!.includes(id));
        } else {
          finalStoreIds = typeStoreIds;
        }
      }

      // ── 4. Early-exit if role scoping results in an empty allowed store set ─
      if (finalStoreIds !== null && finalStoreIds.length === 0) {
        res.set("Cache-Control", "no-store");
        return res.json({
          success: true,
          message: "No records found",
          data: [],
          total: 0,
          ...(isPaginated ? { page: getQueryNumber(req.query, "page", 1), limit: getQueryNumber(req.query, "limit", 10) } : {}),
        });
      }

      // ── 5. Fetch all products from DB ─────────────────────────────────────
      let allData = await uniqueService.getAllData(TABLE_NAME);

      // Apply search filter
      if (search) {
        allData = allData.filter((p: any) =>
          searchColumns.some(col => p[col]?.toString().toLowerCase().includes(search))
        );
      }

      // Apply category_id filter
      if (categoryId) {
        allData = allData.filter((p: any) => p.category_id === categoryId);
      }

      // Apply role-scoped store_id filter
      if (finalStoreIds !== null) {
        allData = allData.filter((p: any) => finalStoreIds!.includes(p.store_id));
      }

      // Apply approval_status filter
      if (forceApproved) {
        allData = allData.filter((p: any) => (p.approval_status || "").toUpperCase() === "APPROVED" && p.is_active === true);
      } else if (approvalStatus) {
        const statuses = approvalStatus.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          allData = allData.filter((p: any) => statuses.includes((p.approval_status || "").toUpperCase()));
        }
      }

      const total = allData.length;
      const mapped = allData.map((p: any) => ({ ...p, images: mapImages(p.images) }));

      res.set("Cache-Control", "no-store");

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const from = (page - 1) * limit;
        const data = mapped.slice(from, from + limit);

        return res.json({
          success: true,
          message: data.length ? "Products fetched successfully" : "No records found",
          data,
          total,
          page,
          limit,
        });
      }

      return res.json({
        success: true,
        message: mapped.length ? "Products fetched successfully" : "No records found",
        data: mapped,
        total,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: normalizeSupabaseError(err).message || "Failed to fetch products" });
    }
  }


  /* ================= GET ONE ================= */
  static async getOne(req: Request, res: Response) {
    try {
      const product = await uniqueService.getDataById(req.params.id as string, TABLE_NAME);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }

      return res.json({
        success: true,
        message: "Product fetched successfully",
        data: { ...product, images: mapImages(product.images) },
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }

  /* ================= UPDATE ================= */
  static async update(req: any, res: Response) {
    try {
      const existing = await uniqueService.getDataById(req.params.id as string, TABLE_NAME);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }

      if (req.body.name) {
        const normalizedName = normalize(req.body.name);
        req.body.name = normalizedName;
      }

      // Category must already exist — no on-the-fly creation
      if (req.body.category_id) {
        const { data: catRow } = await DBconnection
          .from("categories").select("id").eq("id", req.body.category_id).maybeSingle();
        if (!catRow) {
          return res.status(400).json({
            success: false,
            message: "Category not found. Categories must be created by a SubAdmin before assigning to products.",
          });
        }
      }

      // Template must already exist
      if (req.body.template_id) {
        const { data: templateRow } = await DBconnection
          .from("templates").select("id").eq("id", req.body.template_id).maybeSingle();
        if (!templateRow) {
          return res.status(400).json({
            success: false,
            message: "Template not found.",
          });
        }
      }

      // Store-type-aware brand restriction
      const resolvedStoreId = req.body.store_id || existing.store_id;
      const brandId = req.body.brand_id !== undefined ? req.body.brand_id : existing.brand_id;
      if (resolvedStoreId && brandId) {
        const storeType = await getStoreType(resolvedStoreId);
        if (storeType === "restaurant") {
          return res.status(400).json({
            success: false,
            message: "Restaurant products cannot have a brand. Brands are only for grocery store products.",
          });
        }
      }

      if (req.body.variant_id && typeof req.body.variant_id === "string") {
        req.body.variant_id = JSON.parse(req.body.variant_id);
      }

      // Type coercion for FormData string values
      if (req.body.is_veg !== undefined) req.body.is_veg = req.body.is_veg === "true" || req.body.is_veg === true;
      if (req.body.is_active !== undefined) req.body.is_active = req.body.is_active === "true" || req.body.is_active === true;
      if (req.body.base_price !== undefined) req.body.base_price = parseFloat(req.body.base_price);
      if (req.body.quantity !== undefined) req.body.quantity = parseInt(req.body.quantity, 10);

      let images = existing.images;

      if (req.files?.length) {
        if (Array.isArray(existing.images)) existing.images.forEach(deleteFile);
        images = [];
        const lastTimestampRef = { value: 0 };

        for (const file of req.files as Express.Multer.File[]) {
          const filename = generateImageName(req.body.name || existing.name, file.originalname, lastTimestampRef);
          fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
          images.push(`/uploads/products/${filename}`);
        }
      }

      const updated = await uniqueService.updateById(TABLE_NAME, req.params.id as string, {
        ...req.body,
        images,
        change_type: "UPDATE",
        updated_at: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "Product updated successfully",
        data: { ...updated, images: mapImages(updated.images) },
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }

  /* ================= DELETE ================= */
  static async delete(req: Request, res: Response) {
    try {
      const existing = await uniqueService.getDataById(req.params.id as string, TABLE_NAME);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }

      const actor = req.user as { id: string; role_name: string } | undefined;
      if (actor?.role_name === "StoreAdmin" || actor?.role_name === "Employee") {
        const actorStores = await uniqueService.getDataByField("stores", "store_admin_id", actor.id) as any[];
        const ownedIds = actorStores.map((s: any) => s.id);
        if (!ownedIds.includes(existing.store_id)) {
          return res.status(403).json({ success: false, message: "You can only delete products from your own store" });
        }
      }

      await uniqueService.deleteData(TABLE_NAME, req.params.id as string);

      if (Array.isArray(existing.images)) existing.images.forEach(deleteFile);

      return res.json({ success: true, message: "Product deleted successfully" });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }


}
