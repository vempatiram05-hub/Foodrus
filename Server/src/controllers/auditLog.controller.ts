import { Request, Response } from "express";
import { DBconnection } from "../config/DBConnect";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

const TABLE = "audit_logs";
const uniqueService = new UniqueService();
const uniqueAuditController = new UniqueController(TABLE);

class AuditLogController {

  /* CREATE AUDIT LOG */
  async create(req: Request, res: Response) {
    try {
      const { user_id, entity_type, entity_id, action, metadata } = req.body;

      // Validation
      if (!entity_type || typeof entity_type !== "string" || !entity_type.trim()) {
        return res.status(400).json({
          success: false,
          message: "entity_type is required and must be a non-empty string",
        });
      }
      if (!action || typeof action !== "string" || !action.trim()) {
        return res.status(400).json({
          success: false,
          message: "action is required and must be a non-empty string",
        });
      }

      const payload = {
        user_id: user_id ?? null,
        entity_type: entity_type.trim(),
        entity_id: entity_id ?? null,
        action: action.trim(),
        metadata: typeof metadata === "object" && metadata !== null ? metadata : {},
      };

      const data = await uniqueService.create(TABLE, payload);

      return res.status(201).json({
        success: true,
        message: "Audit log created",
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
      const userId = (getQueryString(req.query, "user_id") || "").trim();
      const entityType = (getQueryString(req.query, "entity_type") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["action", "entity_type"];

      let data: any[];
      let total: number;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const result = await uniqueService.getDataWithSearch(TABLE, searchColumns, search || undefined, limit, page);
        data = result.data;
        total = result.total;

        if (userId) {
          data = data.filter(d => d.user_id === userId);
          total = data.length;
        }
        if (entityType) {
          data = data.filter(d => d.entity_type?.toLowerCase() === entityType);
          total = data.length;
        }

        return res.json({
          success: true,
          message: data.length ? "Audit logs fetched successfully" : "No records found",
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
        if (userId) {
          data = data.filter(d => d.user_id === userId);
        }
        if (entityType) {
          data = data.filter(d => d.entity_type?.toLowerCase() === entityType);
        }
        total = data.length;

        return res.json({
          success: true,
          message: data.length ? "Audit logs fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch audit logs" });
    }
  }


  /* GET BY ENTITY */
  async getByEntity(req: Request, res: Response) {
    try {
      const { entity_type, entity_id } = req.params;

      if (!entity_type || typeof entity_type !== "string" || !entity_type.trim() || !entity_id) {
        return res.status(400).json({
          success: false,
          message: "entity_type and entity_id are required",
        });
      }

      const { data, error } = await DBconnection
        .from(TABLE)
        .select("*")
        .eq("entity_type", entity_type.trim())
        .eq("entity_id", entity_id)
        .order("created_at", { ascending: false });

      if (error) throw normalizeSupabaseError(error);

      return res.json({
        success: true,
        message: "Audit logs fetched successfully",
        data,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* GET BY USER */
  async getByUser(req: Request, res: Response) {
    try {
      const { user_id } = req.params;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: "user_id is required",
        });
      }

      const { data, error } = await DBconnection
        .from(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      if (error) throw normalizeSupabaseError(error);

      return res.json({
        success: true,
        message: "Audit logs fetched successfully",
        data,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* UPDATE AUDIT LOG */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const payload = req.body;

      if (!id || typeof id !== "string" || !id.trim()) {
        return res.status(400).json({ success: false, message: "id is required" });
      }

      // Optionally, validate payload fields here
      const updated = await new UniqueService().updateById("audit_logs", id as string, payload);

      return res.json({
        success: true,
        message: "Audit log updated successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || "Unable to update audit log",
      });
    }
  }

    /* GET ALL, GET BY ID, DELETE BY ID */
    getById = async (req: Request, res: Response) => {
      return uniqueAuditController.getById(req, res);
    };
    delete = async (req: Request, res: Response) => {
      return uniqueAuditController.deleteById(req, res);
    };

}

export const auditLogController = new AuditLogController();
