import { Request, Response } from "express";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueService } from "../services/unique.service";

const uniqueService = new UniqueService();
const TABLE = "subscription_deliveries";

export class SubscriptionDeliveryController {

  /* CREATE */
  async create(req: Request, res: Response) {
    try {
      const { user_subscription_id, order_id, is_trial_delivery } = req.body;
      if (
        typeof user_subscription_id !== "string" ||
        user_subscription_id.trim() === "" ||
        typeof order_id !== "string" ||
        order_id.trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: "user_subscription_id and order_id are required and must be non-empty strings.",
        });
      }
      const payload = {
        user_subscription_id: user_subscription_id.trim(),
        order_id: order_id.trim(),
        is_trial_delivery: typeof is_trial_delivery === "boolean" ? is_trial_delivery : false,
      };
      const data = await uniqueService.create(TABLE, payload);
      return res.status(201).json({ success: true, message: "Subscription delivery created successfully", data });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err)?.message || err.message,
      });
    }
  }

  /* GET BY SUBSCRIPTION ID */
  async getBySubscription(req: Request, res: Response) {
    try {
      const { user_subscription_id } = req.params;
      if (typeof user_subscription_id !== "string" || user_subscription_id.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "user_subscription_id is required and must be a non-empty string.",
        });
      }
      const data = await uniqueService.getDataByField(
        TABLE,
        "user_subscription_id",
        user_subscription_id.trim()
      );
      return res.status(200).json({ success: true, message: "Subscription deliveries fetched successfully", data });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err)?.message || err.message,
      });
    }
  }

  /* GET BY ORDER ID */
  async getByOrder(req: Request, res: Response) {
    try {
      const { order_id } = req.params;
      if (typeof order_id !== "string" || order_id.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "order_id is required and must be a non-empty string.",
        });
      }
      const data = await uniqueService.getDataByField(
        TABLE,
        "order_id",
        order_id.trim()
      );
      if (!data || data.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Subscription delivery not found for this order",
        });
      }
      return res.status(200).json({ success: true, message: "Subscription delivery fetched successfully", data: data[0] });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err)?.message || err.message,
      });
    }
  }
}
