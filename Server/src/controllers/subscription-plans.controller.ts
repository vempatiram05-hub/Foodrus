import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueController } from "./unique.controller";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

const TABLE_NAME = "subscription_plans";
const uniqueService = new UniqueService();
// Reuse generic controller
const uniqueController = new UniqueController(TABLE_NAME);

export class SubscriptionPlanController {

 /* CREATE PLAN */
  async create(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        max_deliveries,
        period_type,
        price,
        max_radius_km,
        free_trial_deliveries,
        is_active
      } = req.body;

      if (!name) throw new Error("name is required");
      if (!max_deliveries) throw new Error("max_deliveries is required");
      if (!period_type) throw new Error("period_type is required");
      if (!price) throw new Error("price is required");

      if (!["WEEKLY", "MONTHLY"].includes(period_type)) {
        throw new Error("period_type must be WEEKLY or MONTHLY");
      }

      const payload = {
        name: name.trim(),
        description: description ?? null,
        max_deliveries,
        period_type,
        price,
        max_radius_km: max_radius_km ?? null,
        free_trial_deliveries: free_trial_deliveries ?? 0,
        is_active: is_active ?? true,
      };

      const data = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({
        success: true,
        message: "Subscription plan created successfully",
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
 

  /* GET BY ID → reused */
  async getById(req: Request, res: Response) {
    return uniqueController.getById(req, res);
  }

  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["name", "description"];

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
          message: data.length ? "Subscription plans fetched successfully" : "No records found",
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
          message: data.length ? "Subscription plans fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch subscription plans" });
    }
  }



  /* UPDATE PLAN */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) throw new Error("Subscription plan ID is required");

      const updates: any = { ...req.body };

      if (updates.name) {
        updates.name = updates.name.trim();
      }

      if (
        updates.period_type &&
        !["WEEKLY", "MONTHLY"].includes(updates.period_type)
      ) {
        throw new Error("period_type must be WEEKLY or MONTHLY");
      }

      const data = await uniqueService.updateById(
        TABLE_NAME,
        id as string,
        updates
      );

      return res.json({
        success: true,
        message: "Subscription plan updated successfully",
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

  /* DELETE PLAN */
    async delete(req: Request, res: Response) {
    return uniqueController.deleteById(req, res);
  }
}

export const subscriptionPlanController = new SubscriptionPlanController();
