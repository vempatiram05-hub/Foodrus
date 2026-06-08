
import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";

const TABLE_NAME = "product_change_logs";
const uniqueService = new UniqueService();

function isNonEmptyString(val: any): val is string {
  return typeof val === "string" && val.trim() !== "";
}

function pickAllowedFields(obj: any, allowed: string[]) {
  const result: any = {};
  for (const key of allowed) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

export class ProductChangeLogsController {
  /* ================= CREATE LOG ================= */
  async create(req: Request, res: Response) {
    try {
      const { product_id, changed_by, change_type, old_value, new_value } = req.body;
      // Validate required fields
      if (!isNonEmptyString(product_id) || !isNonEmptyString(changed_by) || !isNonEmptyString(change_type)) {
        return res.status(400).json({
          success: false,
          message: "product_id, changed_by, and change_type are required and must be non-empty strings."
        });
      }
      // Only allow whitelisted fields
      const allowedFields = pickAllowedFields(
        {
          product_id,
          changed_by,
          change_type, // e.g. PRICE_UPDATE | STOCK_UPDATE | DESCRIPTION_UPDATE | OTHER
          old_value,
          new_value,
          created_at: new Date().toISOString(),
        },
        ["product_id", "changed_by", "change_type", "old_value", "new_value", "created_at"]
      );
      const data = await uniqueService.create(TABLE_NAME, allowedFields);
      return res.status(201).json({
        success: true,
        message: "Product change log created successfully",
        data,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* ================= GET BY PRODUCT ================= */
  async getByProduct(req: Request, res: Response) {
    try {
      const { product_id } = req.params;
      if (!isNonEmptyString(product_id)) {
        return res.status(400).json({
          success: false,
          message: "product_id is required and must be a non-empty string."
        });
      }
      const logs = await uniqueService.getData(TABLE_NAME);
      const filtered = logs.filter((log: any) => log.product_id === product_id);
      const sorted = [...filtered].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return res.json({
        success: true,
        message: "Product change logs fetched successfully",
        data: sorted,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* ================= GET BY USER ================= */
  async getByUser(req: Request, res: Response) {
    try {
      const { user_id } = req.params;
      if (!isNonEmptyString(user_id)) {
        return res.status(400).json({
          success: false,
          message: "user_id is required and must be a non-empty string."
        });
      }
      const logs = await uniqueService.getData(TABLE_NAME);
      const filtered = logs.filter((log: any) => log.changed_by === user_id);
      const sorted = [...filtered].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return res.json({
        success: true,
        message: "Product change logs fetched successfully",
        data: sorted,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* ================= GET RECENT ================= */
  async getRecent(req: Request, res: Response) {
    try {
      const limit = Number(req.query.limit) || 20;
      const logs = await uniqueService.getData(TABLE_NAME);
      const sorted = [...logs].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const recent = sorted.slice(0, limit);
      return res.json({
        success: true,
        message: "Recent product change logs fetched successfully",
        data: recent,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }
}

export const productChangeLogsController = new ProductChangeLogsController();
