import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueController } from "./unique.controller";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

const TABLE = "order_status_history";
const uniqueService = new UniqueService();
const newOrderStatusHistoryController = new UniqueController(TABLE);


class OrderStatusHistoryController {

  /* CREATE ORDER STATUS HISTORY */
  async create(req: Request, res: Response) {
    try {
      const { order_id, from_status, to_status, changed_by, note } = req.body;
      // Manual validation
      if (!order_id || typeof order_id !== 'string') {
        return res.status(400).json({ success: false, message: "order_id is required and must be a string" });
      }
      if (!to_status || typeof to_status !== 'string') {
        return res.status(400).json({ success: false, message: "to_status is required and must be a string" });
      }
      if (from_status !== undefined && typeof from_status !== 'string') {
        return res.status(400).json({ success: false, message: "from_status must be a string" });
      }
      if (changed_by !== undefined && typeof changed_by !== 'string') {
        return res.status(400).json({ success: false, message: "changed_by must be a string" });
      }
      if (note !== undefined && typeof note !== 'string') {
        return res.status(400).json({ success: false, message: "note must be a string" });
      }
      const payload: any = {
        order_id,
        from_status: from_status ?? null,
        to_status,
        changed_by: changed_by ?? null,
        note: note ?? null,
      };
      const data = await uniqueService.create(TABLE, payload);
      return res.status(201).json({ success: true, message: "Order status history created successfully", data });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
/* GET PAGINATED ORDER STATUS HISTORY (SEARCH + PAGINATION) */
  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["from_status", "to_status", "note"];

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
          message: data.length ? "Order status history fetched successfully" : "No records found",
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
          message: data.length ? "Order status history fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch order status history" });
    }
  }




  /* GET BY ID */
     getById = (req: Request, res: Response) =>
       newOrderStatusHistoryController.getById(req, res);

  /* GET BY ORDER ID */
  async getByOrderId(req: Request, res: Response) {
    try {
      const { order_id } = req.params;
      if (!order_id || typeof order_id !== 'string') {
        return res.status(400).json({ success: false, message: "order_id is required and must be a string" });
      }
      const data = await uniqueService.getDataByField(TABLE, "order_id", order_id);
      return res.json({ success: true, message: "Order status history fetched successfully", data });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /* DELETE ORDER STATUS HISTORY */
     delete = (req: Request, res: Response) =>     
       newOrderStatusHistoryController.deleteById(req, res);
}

export const orderStatusHistoryController =
  new OrderStatusHistoryController();
