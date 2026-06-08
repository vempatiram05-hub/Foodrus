import { Request, Response } from "express";
import { DBconnection } from "../config/DBConnect";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryNumber } from "../utils/queryParser";

const TABLE = "order_delivery_assignments";
const uniqueService = new UniqueService();

class OrderDeliveryAssignmentController {
  // ASSIGN DELIVERY PARTNER
  async assign(req: Request, res: Response) {
    try {
      const { order_id, delivery_partner_id } = req.body;
      if (!order_id || typeof order_id !== "string") {
        return res.status(400).json({ success: false, message: "order_id is required and must be a string" });
      }
      if (!delivery_partner_id || typeof delivery_partner_id !== "string") {
        return res.status(400).json({ success: false, message: "delivery_partner_id is required and must be a string" });
      }
      const payload = {
        order_id,
        delivery_partner_id,
        assigned_at: new Date().toISOString(),
      };
      const data = await uniqueService.create(TABLE, payload);
      return res.status(201).json({
        success: true,
        message: "Delivery partner assigned successfully",
        data,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

async getList(req: Request, res: Response) {
  try {
    const isPaginated =
      req.query.page !== undefined || req.query.limit !== undefined;

    let data: any[];
    let total: number;

    if (isPaginated) {
      const page = getQueryNumber(req.query, "page", 1);
      const limit = getQueryNumber(req.query, "limit", 10);

      const result = await uniqueService.getDataWithPagination(
        TABLE,
        limit,
        page
      );

      data = result.data;
      total = result.total;

      return res.json({
        success: true,
        message: data.length
          ? "Order delivery assignments fetched successfully"
          : "No records found",
        data,
        total,
        page,
        limit,
      });
    } else {
      data = await uniqueService.getAllData(TABLE);
      total = data.length;

      return res.json({
        success: true,
        message: data.length
          ? "Order delivery assignments fetched successfully"
          : "No records found",
        data,
        total,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message:
        err?.message || "Failed to fetch order delivery assignments",
    });
  }
}
  // MARK AS PICKED
  async markPicked(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ success: false, message: "Assignment ID is required and must be a string" });
      }
      const { data, error } = await DBconnection
        .from(TABLE)
        .update({ picked_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw normalizeSupabaseError(error);
      return res.json({ success: true, message: "Order marked as picked", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // MARK AS DELIVERED
  async markDelivered(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ success: false, message: "Assignment ID is required and must be a string" });
      }
      const { data, error } = await DBconnection
        .from(TABLE)
        .update({ delivered_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw normalizeSupabaseError(error);
      return res.json({ success: true, message: "Order marked as delivered", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // GET BY ORDER ID
  async getByOrder(req: Request, res: Response) {
    try {
      const { order_id } = req.params;
      if (!order_id || typeof order_id !== "string") {
        return res.status(400).json({ success: false, message: "order_id is required and must be a string" });
      }
      const data = await uniqueService.getDataByField(TABLE, "order_id", order_id);
      if (!data || data.length === 0) {
        return res.status(404).json({ success: false, message: "No delivery assignment found for this order" });
      }
      return res.json({ success: true, message: "Delivery assignment fetched successfully", data: data[0] });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(404).json({ success: false, message: error.message });
    }
  }

  // GET BY DELIVERY PARTNER
  async getByDeliveryPartner(req: Request, res: Response) {
    try {
      const { delivery_partner_id } = req.params;
      if (!delivery_partner_id || typeof delivery_partner_id !== "string") {
        return res.status(400).json({ success: false, message: "delivery_partner_id is required and must be a string" });
      }
      const data = await uniqueService.getDataByField(TABLE, "delivery_partner_id", delivery_partner_id);
      return res.json({ success: true, message: "Delivery assignments fetched successfully", data });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

export const orderDeliveryAssignmentController = new OrderDeliveryAssignmentController();
