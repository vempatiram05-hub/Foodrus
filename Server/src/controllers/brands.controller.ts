import { Request, Response } from "express";
import { getQueryString, getQueryNumber } from "../utils/queryParser";
import { DBconnection } from "../config/DBConnect";

const normalize = (name: string) => name.trim().toLowerCase();

const BRAND_COLS = "id, name, store_id, category_id, subcategory_id, description, is_active, created_at, updated_at";

/** Cached check — true once Supabase has the store_id column on brands */
let _storeIdExists: boolean | null = null;
async function detectStoreIdCol(): Promise<boolean> {
  if (_storeIdExists !== null) return _storeIdExists;
  const { error } = await (DBconnection.from("brands") as any).select("store_id").limit(1);
  _storeIdExists = !error || !error.message.includes("store_id");
  if (!_storeIdExists) {
    console.warn(
      "[brands] ⚠️  brands.store_id column not found in Supabase.\n" +
      "  Run this SQL in your Supabase SQL editor to restore store association:\n" +
      "  ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS store_id UUID;\n" +
      "  CREATE INDEX IF NOT EXISTS idx_brands_store_id ON public.brands (store_id);"
    );
  }
  return _storeIdExists;
}

function supabaseErrorResponse(err: any): { status: number; message: string } {
  const code: string = err?.code ?? "";
  if (code === "23505") return { status: 409, message: "A brand with this name already exists for the store" };
  if (code === "23503") return { status: 400, message: "Referenced record does not exist (FK violation)" };
  if (code === "23502") return { status: 400, message: "A required field is missing" };
  if (code === "22P02") return { status: 400, message: "Invalid UUID format" };
  return { status: 500, message: err?.message || "Database error" };
}

export class BrandController {

  async create(req: Request, res: Response) {
    try {
      const { name, store_id, category_id, subcategory_id, description, is_active } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "Brand name is required and must be a non-empty string" });
      }
      if (!store_id) {
        return res.status(400).json({ success: false, message: "store_id is required" });
      }

      // Validate store exists and is a grocery store
      const { data: store } = await DBconnection
        .from("stores").select("id, type").eq("id", store_id).maybeSingle();
      if (!store) return res.status(400).json({ success: false, message: "Store not found" });
      if ((store.type as string).toLowerCase() !== "grocery") {
        return res.status(400).json({
          success: false,
          message: "Brands can only be created for grocery stores. Restaurant stores do not support brands.",
        });
      }

      if (category_id) {
        const { data: cat } = await DBconnection
          .from("categories").select("id").eq("id", category_id).maybeSingle();
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
      }

      if (subcategory_id) {
        const { data: sub } = await DBconnection
          .from("subcategories").select("id").eq("id", subcategory_id).maybeSingle();
        if (!sub) return res.status(404).json({ success: false, message: "Subcategory not found" });
      }

      const normalizedName = normalize(name);
      const now = new Date().toISOString();
      const storeIdExists = await detectStoreIdCol();

      const insertPayload: any = {
        name: normalizedName,
        category_id: category_id ?? null,
        subcategory_id: subcategory_id ?? null,
        description: typeof description === "string" ? description : null,
        is_active: typeof is_active === "boolean" ? is_active : true,
        created_at: now,
        updated_at: now,
      };
      if (storeIdExists) insertPayload.store_id = store_id;

      const { data: created, error } = await (DBconnection.from("brands") as any)
        .insert(insertPayload)
        .select(BRAND_COLS)
        .single();

      if (error) {
        const { status, message } = supabaseErrorResponse(error);
        return res.status(status).json({ success: false, message });
      }

      return res.status(201).json({ success: true, message: "Brand created successfully", data: created });
    } catch (err: any) {
      const { status, message } = supabaseErrorResponse(err);
      return res.status(status).json({ success: false, message });
    }
  }

  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const storeIdFilter = (req.query.store_id as string | undefined)?.trim();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const storeIdExists = await detectStoreIdCol();

      // Build query — apply server-side store_id filter when column exists
      let dbQuery = (DBconnection.from("brands") as any)
        .select(BRAND_COLS)
        .order("created_at", { ascending: false });

      if (storeIdFilter && storeIdExists) {
        dbQuery = dbQuery.eq("store_id", storeIdFilter);
      }

      const { data: allRows, error } = await dbQuery;
      if (error) {
        const { status, message } = supabaseErrorResponse(error);
        return res.status(status).json({ success: false, message });
      }

      let rows: any[] = allRows ?? [];

      if (storeIdFilter) rows = rows.filter((b: any) => b.store_id === storeIdFilter);
      if (search) {
        rows = rows.filter((b: any) =>
          b.name?.toLowerCase().includes(search) || b.description?.toLowerCase().includes(search)
        );
      }

      const total = rows.length;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const offset = (page - 1) * limit;
        const data = rows.slice(offset, offset + limit);
        return res.json({
          success: true,
          message: data.length ? "Brands fetched successfully" : "No records found",
          data, total, page, limit,
        });
      }

      return res.json({
        success: true,
        message: rows.length ? "Brands fetched successfully" : "No records found",
        data: rows, total,
      });
    } catch (err: any) {
      const { status, message } = supabaseErrorResponse(err);
      return res.status(status).json({ success: false, message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const { data, error } = await DBconnection
        .from("brands").select(BRAND_COLS).eq("id", req.params.id).maybeSingle();
      if (error) {
        const { status, message } = supabaseErrorResponse(error);
        return res.status(status).json({ success: false, message });
      }
      if (!data) return res.status(404).json({ success: false, message: "Brand not found" });
      return res.json({ success: true, message: "Brand retrieved successfully", data });
    } catch (err: any) {
      const { status, message } = supabaseErrorResponse(err);
      return res.status(status).json({ success: false, message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== "string" || !id.trim()) {
        return res.status(400).json({ success: false, message: "Brand ID is required" });
      }

      const { data: existing } = await DBconnection
        .from("brands").select(BRAND_COLS).eq("id", id).maybeSingle();
      if (!existing) return res.status(404).json({ success: false, message: "Brand not found" });

      const { name, store_id, category_id, subcategory_id, description, is_active } = req.body;

      if (category_id) {
        const { data: cat } = await DBconnection
          .from("categories").select("id").eq("id", category_id).maybeSingle();
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
      }

      if (subcategory_id) {
        const { data: sub } = await DBconnection
          .from("subcategories").select("id").eq("id", subcategory_id).maybeSingle();
        if (!sub) return res.status(404).json({ success: false, message: "Subcategory not found" });
      }

      const storeIdExists = await detectStoreIdCol();
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updatePayload.name = normalize(name);
      if (description !== undefined) updatePayload.description = description;
      if (category_id !== undefined) updatePayload.category_id = category_id;
      if (subcategory_id !== undefined) updatePayload.subcategory_id = subcategory_id;
      if (is_active !== undefined) updatePayload.is_active = is_active;
      if (store_id !== undefined && storeIdExists) updatePayload.store_id = store_id;

      if (Object.keys(updatePayload).length === 1) {
        return res.status(400).json({ success: false, message: "No fields provided to update" });
      }

      const { data: updated, error } = await (DBconnection.from("brands") as any)
        .update(updatePayload)
        .eq("id", id)
        .select(BRAND_COLS)
        .single();

      if (error) {
        const { status, message } = supabaseErrorResponse(error);
        return res.status(status).json({ success: false, message });
      }

      return res.json({ success: true, message: "Brand updated successfully", data: updated });
    } catch (err: any) {
      const { status, message } = supabaseErrorResponse(err);
      return res.status(status).json({ success: false, message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { data: existing } = await DBconnection
        .from("brands").select("id").eq("id", req.params.id).maybeSingle();
      if (!existing) return res.status(404).json({ success: false, message: "Brand not found" });

      const { error } = await DBconnection.from("brands").delete().eq("id", req.params.id);
      if (error) {
        const { status, message } = supabaseErrorResponse(error);
        return res.status(status).json({ success: false, message });
      }

      return res.json({ success: true, message: "Brand deleted successfully" });
    } catch (err: any) {
      const { status, message } = supabaseErrorResponse(err);
      return res.status(status).json({ success: false, message });
    }
  }
}

export const brandController = new BrandController();
