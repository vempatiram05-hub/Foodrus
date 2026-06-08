import { Request, Response } from "express";
import { DBconnection } from "../config/DBConnect";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueController } from "./unique.controller";
import { sendInvoiceEmail } from "../utils/mailer";
import { generateInvoice } from "../utils/generateInvoice";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { logger } from "../utils/logger";
import type { JwtPayload } from "../utils/token";

const TABLE = "order_items";
const uniqueService = new UniqueService();
const uniqueOrderItemController = new UniqueController(TABLE);

class OrderItemsController {

  /*  CREATE ORDER ITEM */
  async create(req: Request, res: Response) {
    try {
      const { order_id, product_id, menus_id, quantity, unit_price, is_food } =
        req.body;

      if (!order_id)
        return res.status(400).json({
          success: false,
          message: "order_id is required",
        });

      if (!product_id && !menus_id)
        return res.status(400).json({
          success: false,
          message: "Either product_id or menus_id is required",
        });

      if (!quantity || quantity <= 0)
        return res.status(400).json({
          success: false,
          message: "quantity must be greater than 0",
        });

      if (!unit_price || unit_price <= 0)
        return res.status(400).json({
          success: false,
          message: "unit_price must be greater than 0",
        });

      const payload: any = {
        order_id,
        product_id: product_id ?? null,
        menus_id: menus_id ?? null,
        quantity,
        unit_price,
        is_food: is_food ?? true,
      };

      logger.info("Creating order item with payload:", payload);

      /* INSERT ORDER ITEM */

      const data = await uniqueService.create("order_items", payload);
      const order = await uniqueService.getDataById(order_id as string, "orders");

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      /* GET ALL ORDER ITEMS */

      const orderItemsRaw = await uniqueService.getDataByField(
        "order_items",
        "order_id",
        order_id
      );

      // Fetch names for items
      const orderItems = await Promise.all(orderItemsRaw.map(async (item: any) => {
        try {
          if (item.product_id) {
            const product = await uniqueService.getDataById(item.product_id, "products");
            item.name = product?.name || "";
          } else if (item.menus_id) {
            const menu = await uniqueService.getDataById(item.menus_id, "menus");
            if (menu?.name) {
              item.name = menu.name;
            } else if (menu?.product_id) {
              const pIds = Array.isArray(menu.product_id) ? menu.product_id : [menu.product_id];
              const pNames = [];
              for (const pid of pIds) {
                const p = await uniqueService.getDataById(pid, "products");
                if (p?.name) pNames.push(p.name);
              }
              item.name = pNames.length > 0 ? pNames.join(", ") : "";
            }
          }
        } catch (fetchErr) {
          logger.warn("Failed to fetch name for order item:", fetchErr);
        }
        return item;
      }));

      /* GET CUSTOMER */
      const customer = await uniqueService.getDataById(order.user_id, "users");

      /* FETCH ADDRESS */
      let addressData = null;
      try {
        if (order.address_id) {
          addressData = await uniqueService.getDataById(order.address_id, "addresses");
        }
      } catch (addrErr) {
        logger.warn("Could not fetch address for invoice:", addrErr);
      }

      /* GENERATE INVOICE */

      let invoicePath: string | null = null;

      try {
        invoicePath = await generateInvoice(order, orderItems, customer, addressData);
      } catch (err) {
        logger.warn("Invoice generation failed:", err);
      }

      /* SEND EMAIL */
      try {
        if (customer?.email && invoicePath) {
          await sendInvoiceEmail(
            [customer.email],
            order,
            orderItems,
            invoicePath,
            addressData,
            customer
          );
        }
      } catch (err) {
        logger.warn("Invoice email failed:", err);
      }

      return res.status(201).json({
        success: true,
        message: "Order item created successfully",
        data,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /* GET BY ID (REUSED) */
  getById = (req: Request, res: Response) =>
    uniqueOrderItemController.getById(req, res);



  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["order_id", "product_id", "menus_id"];

      let data: any[];
      let total: number;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const result = await uniqueService.getDataWithSearch(TABLE, searchColumns, search || undefined, limit, page);
        data = result.data;
        total = result.total;

        return res.json({
          success: true,
          message: data.length ? "Order items fetched successfully" : "No records found",
          data,
          total,
          page,
          limit,
        });
      } else {
        data = await uniqueService.getAllData(TABLE);
        if (search) {
          data = data.filter(c =>
            searchColumns.some(col => c[col]?.toString().toLowerCase().includes(search))
          );
        }
        total = data.length;

        return res.json({
          success: true,
          message: data.length ? "Order items fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch order items" });
    }
  }


  /* GET ITEMS BY ORDER ID */
  async getByOrderId(req: Request, res: Response) {
    try {
      const { order_id } = req.params;

      if (!order_id)
        return res.status(400).json({ success: false, message: "order_id is required" });

      const rawItems = await uniqueService.getDataByField(
        TABLE,
        "order_id",
        order_id as string
      );

      // Enrich items with display names
      const enriched = await Promise.all(rawItems.map(async (item: any) => {
        if (item.product_name) {
          item.name = item.product_name;
        } else if (item.product_id) {
          try {
            const product = await uniqueService.getDataById(item.product_id, "products");
            item.name = product?.name || "";
          } catch { item.name = ""; }
        } else if (item.menus_id) {
          try {
            const menu = await uniqueService.getDataById(item.menus_id, "menus");
            if (menu?.product_id) {
              const pIds = Array.isArray(menu.product_id) ? menu.product_id : [menu.product_id];
              const pNames: string[] = [];
              for (const pid of pIds) {
                const p = await uniqueService.getDataById(pid, "products");
                if (p?.name) pNames.push(p.name);
              }
              item.name = pNames.join(", ");
            }
          } catch { item.name = ""; }
        }
        return item;
      }));

      // StoreAdmin / Employee: filter to only items that belong to their store(s)
      const callerUser = req.user as JwtPayload | undefined;
      const role = callerUser?.role_name;

      if (role === "StoreAdmin" || role === "Employee") {
        // StoreAdmin: all stores they own (multi-store support)
        // Employee: only their single assigned store (store_id from JWT)
        const adminStoreIds = new Set<string>();

        if (role === "StoreAdmin") {
          try {
            const adminStores = await uniqueService.getDataByField("stores", "store_admin_id", callerUser!.id);
            for (const s of adminStores || []) {
              if (s.id) adminStoreIds.add(s.id);
            }
          } catch (err: any) {
            logger.warn("[OrderItems] Failed to resolve store IDs for StoreAdmin:", { adminId: callerUser!.id, error: err.message });
          }
        } else {
          // Employee — use store_id from JWT directly (single store)
          const employeeStoreId = callerUser!.store_id;
          if (employeeStoreId) {
            adminStoreIds.add(employeeStoreId);
          } else {
            logger.warn("[OrderItems] Employee has no store_id in token:", { userId: callerUser!.id });
          }
        }

        // Filter items using the store_id persisted on each row at order creation time
        const filteredItems: any[] = enriched.filter(
          (item: any) => item.store_id && adminStoreIds.has(item.store_id)
        );

        const store_subtotal = parseFloat(
          filteredItems.reduce((sum: number, i: any) => sum + (i.quantity || 0) * (i.unit_price || 0), 0).toFixed(2)
        );

        return res.json({
          success: true,
          message: "Order items retrieved successfully",
          data: filteredItems,
          store_subtotal,
        });
      }

      return res.json({
        success: true,
        message: "Order items retrieved successfully",
        data: enriched,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /* UPDATE ORDER ITEM */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { quantity, unit_price, menus_id, is_food } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, message: "id is required" });
      }

      // Build updates object
      const updates: any = {};
      if (quantity !== undefined) updates.quantity = quantity;
      if (unit_price !== undefined) updates.unit_price = unit_price;
      if (menus_id !== undefined) updates.menus_id = menus_id;
      if (is_food !== undefined) updates.is_food = is_food;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: "No valid fields to update" });
      }

      // Direct Supabase update (no total_price)
      const { data, error } = await DBconnection
        .from(TABLE)
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      return res.json({
        success: true,
        message: "Order item updated successfully",
        data,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /* DELETE (REUSED) */
  delete = (req: Request, res: Response) =>
    uniqueOrderItemController.deleteById(req, res);
}

export const orderItemsController = new OrderItemsController();
