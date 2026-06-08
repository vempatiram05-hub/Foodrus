import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryString, getQueryNumber } from "../utils/queryParser";
import { UniqueController } from "./unique.controller";

const TABLE_NAME = "carts";
const uniqueService = new UniqueService();

const cartUniqueController = new UniqueController(TABLE_NAME);

export class CartController {
  // ------ CREATE CART --------
  async create(req: Request, res: Response) {
    try {
      const { user_id, store_id } = req.body;

      if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
        return res.status(400).json({ success: false, message: "user_id is required and must be a non-empty string" });
      }
      if (!store_id || typeof store_id !== "string" || !store_id.trim()) {
        return res.status(400).json({ success: false, message: "store_id is required and must be a non-empty string" });
      }

      // Rely on DB unique constraint (user_id + store_id)
      const data = await uniqueService.create(TABLE_NAME, {
        user_id: user_id.trim(),
        store_id: store_id.trim(),
      });

      return res.status(201).json({
        success: true,
        message: "Cart created successfully",
        data,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      if (
        err?.code === "23505" ||
        /duplicate|already exists/i.test(error.message)
      ) {
        return res.status(409).json({
          success: false,
          message: "Cart already exists for this store",
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ------ GET CART BY ID --------
  findById = (req: Request, res: Response) => {
    return cartUniqueController.getById(req, res);
  };

  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["user_id", "store_id"];

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
          message: data.length ? "Carts fetched successfully" : "No records found",
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
          message: data.length ? "Carts fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch carts" });
    }
  }


  // ------ GET CART BY USER + STORE --------
  async findByUserAndStore(req: Request, res: Response) {
    try {
      const { user_id, store_id } = req.query as {
        user_id?: string;
        store_id?: string;
      };

      if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
        return res.status(400).json({ success: false, message: "user_id is required and must be a non-empty string" });
      }
      if (!store_id || typeof store_id !== "string" || !store_id.trim()) {
        return res.status(400).json({ success: false, message: "store_id is required and must be a non-empty string" });
      }

      // fetch carts for user (may be empty — OK)
      const carts = await uniqueService.getDataByField(
        TABLE_NAME,
        "user_id",
        user_id.trim()
      );

      // find store-specific cart
      const cart = carts.find(
        (c: any) => c.store_id === store_id.trim()
      );

      // NOT an error if cart doesn't exist
      return res.json({
        success: true,
        message: cart
          ? "Cart retrieved successfully"
          : "No active cart for this store",
        data: cart ?? null,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }


  // ------ DELETE CART --------

  delete = (req: Request, res: Response) => {
    return cartUniqueController.deleteById(req, res);
  };
}

export const cartController = new CartController();
