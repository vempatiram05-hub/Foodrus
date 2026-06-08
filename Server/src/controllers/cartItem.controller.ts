import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { UniqueController } from "./unique.controller";
import { DBconnection } from "../config/DBConnect";

const TABLE_NAME = "cart_items";
const uniqueService = new UniqueService();

// Create a unique controller instance for cart_items
const uniqueController = new UniqueController(TABLE_NAME);

export class CartItemController {
    
    // -----------ADD ITEM TO CART----------
  async addItem(req: Request, res: Response) {
    try {
      const { cart_id, product_id, menus_id, quantity, unit_price } = req.body;

      if (!cart_id || typeof cart_id !== "string" || !cart_id.trim()) {
        return res.status(400).json({ success: false, message: "cart_id is required and must be a non-empty string" });
      }
      if ((!product_id || typeof product_id !== "string" || !product_id.trim()) && (!menus_id || typeof menus_id !== "string" || !menus_id.trim())) {
        return res.status(400).json({ success: false, message: "product_id or menu_item_id is required and must be a non-empty string" });
      }
      if (!quantity || typeof quantity !== "number" || quantity <= 0) {
        return res.status(400).json({ success: false, message: "quantity must be a number greater than 0" });
      }
      if (!unit_price || typeof unit_price !== "number" || unit_price <= 0) {
        return res.status(400).json({ success: false, message: "unit_price must be a number greater than 0" });
      }

      /* ── Date guard: reject cart additions for non-today menus ── */
      if (menus_id && typeof menus_id === "string" && menus_id.trim()) {
        const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" UTC
        const { data: menu, error: menuErr } = await DBconnection
          .from("menus")
          .select("date")
          .eq("id", menus_id.trim())
          .single();
        if (menuErr || !menu) {
          return res.status(400).json({ success: false, message: "Menu not found" });
        }
        if (menu.date !== todayStr) {
          return res.status(400).json({
            success: false,
            message: `Ordering is only available for today's menu. This item is scheduled for ${menu.date || "a different day"}.`,
          });
        }
      }

      const payload = {
        cart_id: cart_id.trim(),
        product_id: product_id ? product_id.trim() : null,
        menus_id: menus_id ? menus_id.trim() : null,
        quantity,
        unit_price,
      };

      const item = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({
        success: true,
        message: "Item added to cart",
        data: item,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
  // ------ GET CART ITEM BY ID --------
  getById = (req: Request, res: Response) => uniqueController.getById(req, res);

  // ------ DELETE CART ITEM BY ID --------
  deleteById = (req: Request, res: Response) => {
    return uniqueController.deleteById(req, res);
  };

  // ---------- GET ALL ITEMS IN A CART ---------
  async getByCart(req: Request, res: Response) {
    try {
      const { cart_id } = req.params;
      if (!cart_id || typeof cart_id !== "string" || !cart_id.trim()) {
        return res.status(400).json({ success: false, message: "cart_id is required and must be a non-empty string" });
      }

      const items = await uniqueService.getDataByField(TABLE_NAME, "cart_id", cart_id.trim());

      return res.status(200).json({
        success: true,
        message: "Cart items retrieved",
        data: items,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["cart_id", "product_id", "menus_id"];

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
          message: data.length ? "Cart items fetched successfully" : "No records found",
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
          message: data.length ? "Cart items fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch cart items" });
    }
  }


  // -------UPDATE ITEM QUANTITY --------
  async updateQuantity(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (!id || typeof id !== "string" || !id.trim()) {
        return res.status(400).json({ success: false, message: "cart item ID is required" });
      }
      if (!quantity || typeof quantity !== "number" || quantity <= 0) {
        return res.status(400).json({ success: false, message: "quantity must be a number greater than 0" });
      }

      const item = await uniqueService.updateById(TABLE_NAME, id.trim(), { quantity });

      return res.status(200).json({
        success: true,
        message: "Cart item updated",
        data: item,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
  // ----------CLEAR ENTIRE CART--------
  async clearCart(req: Request, res: Response) {
    try {
      const { cart_id } = req.params;
      if (!cart_id || typeof cart_id !== "string" || !cart_id.trim()) {
        return res.status(400).json({ success: false, message: "cart_id is required and must be a non-empty string" });
      }

      // Fetch all items first
      const items = await uniqueService.getDataByField(TABLE_NAME, "cart_id", cart_id.trim());

      // Delete each item
      for (const item of items) {
        await uniqueService.deleteData(TABLE_NAME, item.id);
      }

      return res.status(200).json({
        success: true,
        message: "Cart cleared successfully",
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const cartItemController = new CartItemController();
