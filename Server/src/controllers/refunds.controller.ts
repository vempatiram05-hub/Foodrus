import { Request, Response } from "express";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

const uniqueService = new UniqueService();
const TABLE = "refunds";

// ✅ Reusable UniqueController instance for standard CRUD
const uniqueRefundController = new UniqueController(TABLE);

type RefundStatus = "PENDING" | "SUCCESS" | "FAILED";


function isNonEmptyString(val: any): val is string {
  return typeof val === "string" && val.trim() !== "";
}

function isPositiveNumber(val: any): val is number {
  return typeof val === "number" && val > 0;
}

function pickAllowedFields(obj: any, allowed: string[]) {
  const result: any = {};
  for (const key of allowed) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

class RefundController {
  /* Create refund (PENDING)*/
  async create(req: Request, res: Response) {
    try {
      const { payment_id, amount, reason } = req.body;
      if (!isNonEmptyString(payment_id)) {
        return res.status(400).json({ success: false, message: "payment_id is required and must be a non-empty string." });
      }
      const numAmount = typeof amount === "string" ? Number(amount) : amount;
      if (!isPositiveNumber(numAmount)) {
        return res.status(400).json({ success: false, message: "amount must be a positive number." });
      }
      const allowedFields = pickAllowedFields(
        {
          payment_id,
          amount: numAmount,
          reason: isNonEmptyString(reason) ? reason : null,
          status: "PENDING" as RefundStatus,
        },
        ["payment_id", "amount", "reason", "status"]
      );
      const data = await uniqueService.create(TABLE, allowedFields);
      return res.status(201).json({ success: true, message: "Refund created successfully", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }

   /* GET REFUND BY ID */
getById = (req: Request, res: Response) =>
  uniqueRefundController.getById(req, res);
    /* DELETE REFUND */
delete = (req: Request, res: Response) =>
  uniqueRefundController.deleteById(req, res);
  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["status"];

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
          message: data.length ? "Refunds fetched successfully" : "No records found",
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
          message: data.length ? "Refunds fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch refunds" });
    }
  }

  /* UPDATE REFUND STATUS */
  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, provider_refund_id, raw_response } = req.body;
      if (!isNonEmptyString(id)) {
        return res.status(400).json({ success: false, message: "Refund id is required and must be a non-empty string." });
      }
      if (!["PENDING", "SUCCESS", "FAILED"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid refund status." });
      }
      const allowedFields = pickAllowedFields(
        {
          status,
          provider_refund_id: isNonEmptyString(provider_refund_id) ? provider_refund_id : undefined,
          raw_response: raw_response ?? undefined,
        },
        ["status", "provider_refund_id", "raw_response"]
      );
      const data = await uniqueService.updateById(TABLE, id, allowedFields);
      return res.json({ success: true, message: "Refund status updated successfully", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }
   /* MARK REFUND AS FAILED */
  async markRefundFailed(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason, raw_response } = req.body;
      if (!isNonEmptyString(id)) {
        return res.status(400).json({ success: false, message: "Refund id is required and must be a non-empty string." });
      }
      if (!isNonEmptyString(reason)) {
        return res.status(400).json({ success: false, message: "Failure reason is required and must be a non-empty string." });
      }
      const allowedFields = pickAllowedFields(
        {
          status: "FAILED" as RefundStatus,
          reason,
          raw_response: raw_response ?? undefined,
        },
        ["status", "reason", "raw_response"]
      );
      const data = await uniqueService.updateById(TABLE, id, allowedFields);
      return res.json({ success: true, message: "Refund marked as failed", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }
    /* MARK REFUND AS SUCCESS */
  async markRefundSuccess(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { provider_refund_id, raw_response } = req.body;
      if (!isNonEmptyString(id)) {
        return res.status(400).json({ success: false, message: "Refund id is required and must be a non-empty string." });
      }
      if (!isNonEmptyString(provider_refund_id)) {
        return res.status(400).json({ success: false, message: "provider_refund_id is required and must be a non-empty string." });
      }
      const allowedFields = pickAllowedFields(
        {
          status: "SUCCESS" as RefundStatus,
          provider_refund_id,
          raw_response: raw_response ?? undefined,
        },
        ["status", "provider_refund_id", "raw_response"]
      );
      const data = await uniqueService.updateById(TABLE, id, allowedFields);
      return res.json({ success: true, message: "Refund marked as success", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }
}

export const refundController = new RefundController();


