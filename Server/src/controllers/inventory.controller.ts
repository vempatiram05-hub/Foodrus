import { Request, Response, NextFunction } from "express";
import { DBconnection } from "../config/DBConnect";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueService } from "../services/unique.service";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { UniqueController } from "./unique.controller";
import { logger } from "../utils/logger";

const TABLE_NAME = "inventory";
const uniqueService = new UniqueService();

// ✅ Create reusable generic controller
const uniqueInventoryController = new UniqueController(TABLE_NAME);

export class InventoryController {
  /** Create inventory */
  static async create(req: Request, res: Response) {
    try {
      const { product_id, current_stock, stock_threshold } = req.body;

      if (!product_id || typeof product_id !== "string" || !product_id.trim()) {
        return res.status(400).json({
          success: false,
          message: "product_id is required and must be a non-empty string",
        });
      }

      const payload = {
        product_id: product_id.trim(),
        current_stock: typeof current_stock === "number" && !Number.isNaN(current_stock) ? current_stock : 0,
        stock_threshold: typeof stock_threshold === "number" && !Number.isNaN(stock_threshold) ? stock_threshold : 0,
        is_out_of_stock: (typeof current_stock === "number" && !Number.isNaN(current_stock) ? current_stock : 0) <= 0,
      };

      const data = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({
        success: true,
        message: "Inventory created successfully",
        data,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["product_id"];

      let data: any[];
      let total: number;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const result = await uniqueService.getDataWithSearch(TABLE_NAME, searchColumns, search || undefined, limit, page);
        data = result.data;
        total = result.total;

        return res.json({
          success: true,
          message: data.length ? "Inventory fetched successfully" : "No records found",
          data,
          total,
          page,
          limit,
        });
      } else {
        data = await uniqueService.getAllData(TABLE_NAME);
        if (search) {
          data = data.filter(c =>
            searchColumns.some(col => c[col]?.toString().toLowerCase().includes(search))
          );
        }
        total = data.length;

        return res.json({
          success: true,
          message: data.length ? "Inventory fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch inventory" });
    }
  }



  /** Get inventory by product_id */
  static async getByProduct(req: Request, res: Response) {
    try {
      const { product_id } = req.params;

      const data = await uniqueService.getDataByField(
        TABLE_NAME,
        "product_id",
        product_id as string
      );
      return res.status(200).json({
        success: true,
        message: "Inventory fetched successfully",
        data,
      });
    } catch (err: any) {
      return res.status(404).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /** Update stock */
  static async updateStock(req: Request, res: Response) {
    try {
      const { product_id } = req.params;
      const { current_stock, stock_delta } = req.body;

    // ✅ map to stock (no logic change)
    let stock = current_stock;


      if (!product_id || typeof product_id !== "string" || !product_id.trim()) {
        return res.status(400).json({
          success: false,
          message: "product_id is required and must be a non-empty string",
        });
      }

     
    if (typeof stock !== "number" && typeof stock_delta === "number") {
      // we’ll calculate after fetching inventory
      stock = undefined as any;
    }

      // 1️⃣ Get inventory row using product_id
      const inventoryList = await uniqueService.getDataByField(
        TABLE_NAME,
        "product_id",
        product_id.trim()
      );

      if (!inventoryList || inventoryList.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Inventory not found for this product",
        });
      }

      const inventory = inventoryList[0];

         // ✅ handle stock_delta here (minimal addition)
    if (typeof stock !== "number" && typeof stock_delta === "number") {
      stock = inventory.current_stock + stock_delta;
    }

    // ✅ same validation as your code
    if (typeof stock !== "number" || Number.isNaN(stock)) {
      return res.status(400).json({
        success: false,
        message: "stock must be a valid number",
      });
    }
    
      // 2️⃣ Prepare payload
      const payload = {
        current_stock: stock,
        is_out_of_stock: stock <= 0,
        last_restocked_at: stock > 0 ? new Date().toISOString() : null,
      };

      // 3️⃣ Update using INVENTORY ID (not product_id)
      const data = await uniqueService.updateById(
        TABLE_NAME,
        inventory.id, // ✅ correct ID
        payload
      );

      return res.status(200).json({
        success: true,
        message: "Inventory updated successfully",
        data,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }

  /** Get low-stock inventory */
  static async getLowStock(req: Request, res: Response) {
    try {
      const { data, error } = await DBconnection
        .from("inventory")
        .select("*"); // fetch all inventory

      if (error) throw error;

      // Filter in JS where current_stock <= stock_threshold
      const lowStock = data.filter(
        (item: any) => item.current_stock <= item.stock_threshold
      );

      return res.status(200).json({ success: true, message: "Low stock items fetched successfully", data: lowStock });
    } catch (err: any) {
      logger.error("Unexpected Error in getLowStock:", err);
      return res.status(500).json({ success: false, message: err.message || "Internal server error" });
    }
  }

  /** Get inventory by ID */
  static getById(req: Request, res: Response) {
    return uniqueInventoryController.getById(req, res);
  }

  /** Delete inventory by ID */
  static delete(req: Request, res: Response) {
    return uniqueInventoryController.deleteById(req, res);
  }
}

export const inventoryController = new InventoryController();
