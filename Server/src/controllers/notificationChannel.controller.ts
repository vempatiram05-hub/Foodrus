import { Request, Response, NextFunction } from "express";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { logger } from "../utils/logger";

const TABLE = "notification_channel";
const uniqueService = new UniqueService();
const uniqueController = new UniqueController(TABLE);

export default class NotificationChannelController {
  // ---------------- CREATE ----------------
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      // Only allow specific fields
      const allowedFields = ["name", "provider"];
      const payload: Record<string, any> = {};
      for (const field of allowedFields) {
        if (Object.hasOwn(req.body, field)) {
          payload[field] = req.body[field];
        }
      }
      // Validation: name is required and must be uppercase string
      if (!payload.name || typeof payload.name !== "string" || !/^[A-Z_]+$/.test(payload.name)) {
        return res.status(400).json({
          success: false,
          message: "Field 'name' is required and must be uppercase letters/underscores."
        });
      }
      // Validation: provider is required and must be a non-empty string
      if (!payload.provider || typeof payload.provider !== "string" || !payload.provider.trim()) {
        return res.status(400).json({
          success: false,
          message: "Field 'provider' is required and must be a non-empty string."
        });
      }
      // Prevent duplicate channel names
      const existing = await uniqueService.getDataByField(TABLE, "name", payload.name);
      if (existing && existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Notification channel '${payload.name}' already exists.`
        });
      }
      payload.created_at = new Date().toISOString();
      payload.updated_at = new Date().toISOString();
      const created = await uniqueService.create(TABLE, payload);
      return res.status(201).json({
        success: true,
        message: "Notification channel created successfully",
        data: created,
      });
    } catch (err: any) {
      // Log error for debugging, but don't leak details to client
      logger.error("NotificationChannelController.create error:", err);
      return res.status(400).json({
        success: false,
        message: err?.message || "Unable to create notification channel. Please check your input.",
      });
    }
  }

    //  Make static properties readonly
  public static readonly getById = (req: Request, res: Response, next: NextFunction) =>
    uniqueController.getById(req, res);

  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  static async getList(req: Request, res: Response, next: NextFunction) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["name", "provider"];

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
          message: data.length ? "Notification channels fetched successfully" : "No records found",
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
          message: data.length ? "Notification channels fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch notification channels" });
    }
  }


  // ---------------- UPDATE ----------------
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      // Validate id (basic UUID check)
      if (!id || typeof id !== "string" || !/^[0-9a-fA-F-]{36}$/.test(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing notification channel id."
        });
      }
      // Only allow specific fields
      const allowedFields = ["name", "provider"];
      const payload: Record<string, any> = {};
      for (const field of allowedFields) {
        if (Object.hasOwn(req.body, field)) {
          payload[field] = req.body[field];
        }
      }
      if (payload.name && (typeof payload.name !== "string" || !/^[A-Z_]+$/.test(payload.name))) {
        return res.status(400).json({
          success: false,
          message: "Field 'name' must be uppercase letters/underscores."
        });
      }
      if (payload.provider && (typeof payload.provider !== "string" || !payload.provider.trim())) {
        return res.status(400).json({
          success: false,
          message: "Field 'provider' must be a non-empty string."
        });
      }
      payload.updated_at = new Date().toISOString();
      const updated = await uniqueService.updateById(TABLE, id as string, payload);
      return res.json({
        success: true,
        message: "Notification channel updated successfully",
        data: updated,
      });
    } catch (err: any) {
      // Log error for debugging, but don't leak details to client
      logger.error("NotificationChannelController.update error:", err);
      const status = err.message === "Record not found" ? 404 : 400;
      return res.status(status).json({
        success: false,
        message: err?.message || "Unable to update notification channel. Please check your input.",
      });
    }
  }

  // ---------------- DELETE ----------------
  public static readonly delete = (req: Request, res: Response, next: NextFunction) =>
   uniqueController.deleteById(req, res);
}
