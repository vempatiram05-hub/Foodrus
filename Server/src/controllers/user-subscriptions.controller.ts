import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueController } from "./unique.controller";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

const TABLE_NAME = "user_subscriptions";
const uniqueService = new UniqueService();
// Reusable UniqueController instance
const uniqueUserSubscriptionController = new UniqueController(TABLE_NAME);

export class UserSubscriptionController {
  /* CREATE SUBSCRIPTION */
  async create(req: Request, res: Response) {
    try {
      const {
        user_id,
        subscription_plan_id,
        start_date,
        end_date,
        remaining_deliveries,
        is_trial
      } = req.body;

      if (!user_id) throw new Error("user_id is required");
      if (!subscription_plan_id) throw new Error("subscription_plan_id is required");
      if (!start_date) throw new Error("start_date is required");
      if (!end_date) throw new Error("end_date is required");
      if (remaining_deliveries === undefined)
        throw new Error("remaining_deliveries is required");

      const payload = {
        user_id,
        subscription_plan_id,
        start_date,
        end_date,
        remaining_deliveries,
        is_trial: is_trial ?? false,
        status: "ACTIVE",
      };

      const data = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({
        success: true,
        message: "Subscription created successfully",
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
  /* GET SUBSCRIPTION BY ID */
   getById(req: Request, res: Response) {
    return uniqueUserSubscriptionController.getById(req, res);
  }
  /* DELETE SUBSCRIPTION */
  delete(req: Request, res: Response) {
    return uniqueUserSubscriptionController.deleteById(req, res);
  }

  /* GET SUBSCRIPTIONS BY USER */
  async getByUser(req: Request, res: Response) {
    try {
      const { user_id } = req.params;
      if (!user_id) throw new Error("user_id is required");

      const data = await uniqueService.getDataByField(
        TABLE_NAME,
        "user_id",
        user_id as string
      );

      return res.json({
        success: true,
        message: "User subscriptions retrieved successfully",
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

  /* CANCEL SUBSCRIPTION */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) throw new Error("Subscription ID is required");

      const data = await uniqueService.updateById(
        TABLE_NAME,
        id as string,
        { status: "CANCELLED" }
      );

      return res.json({
        success: true,
        message: "Subscription cancelled successfully",
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

  /* EXPIRE SUBSCRIPTION */
  async expire(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) throw new Error("Subscription ID is required");

      const data = await uniqueService.updateById(
        TABLE_NAME,
        id as string,
        { status: "EXPIRED" }
      );

      return res.json({
        success: true,
        message: "Subscription expired successfully",
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
  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["user_id", "subscription_plan_id", "status"];

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
          message: data.length ? "Subscriptions fetched successfully" : "No records found",
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
          message: data.length ? "Subscriptions fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch subscriptions" });
    }
  }


}

export const userSubscriptionController = new UserSubscriptionController();
