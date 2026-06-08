
import { Request, Response, NextFunction } from "express";
import { UniqueController } from "./unique.controller";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { DBconnection } from "../config/DBConnect";

const TABLE = "payment_methods";
const uniqueController = new UniqueController(TABLE);
const uniqueService = new UniqueService();

export default class PaymentMethodController {
  /* CREATE PAYMENT METHOD */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      // Only allow specific fields to be inserted (prevent mass assignment)
      const { user_id, last4, method_type, provider, token_reference } = req.body;
      // Input validation
      if (!user_id || typeof user_id !== 'string') {
        return res.status(400).json({ success: false, message: "Valid user_id is required." });
      }
      if (!last4 || typeof last4 !== 'string' || !/^[0-9]{4}$/.test(last4)) {
        return res.status(400).json({ success: false, message: "Valid last4 is required (4 digits)." });
      }
      if (!method_type || typeof method_type !== 'string') {
        return res.status(400).json({ success: false, message: "Valid method_type is required." });
      }
      if (!provider || typeof provider !== 'string') {
        return res.status(400).json({ success: false, message: "Valid provider is required." });
      }
      if (!token_reference || typeof token_reference !== "string") {
  return res.status(400).json({
    success: false,
    message: "Valid token_reference is required."
  });
}

      // Sanitize payload
      const payload = { user_id: user_id.trim(), last4: last4.trim(), method_type: method_type.trim(), provider: provider.trim() , token_reference: token_reference.trim()};
      const created = await UniqueService.prototype.create(TABLE, payload);
      return res.status(201).json({
        success: true,
        message: "Payment method created successfully",
        data: created,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message || "Unable to create payment method.",
      });
    }
  }

  /* GET PAYMENT METHOD BY ID */
static getById(req: Request, res: Response, next: NextFunction) {
  return uniqueController.getById(req, res);
}
  /* DELETE PAYMENT METHOD */
  static async delete(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: "Valid payment method ID is required." });
    }

    // Verify it belongs to the requesting user before deleting
    const userId = (req as any).user?.id;
    if (userId) {
      const { data: existing } = await DBconnection
        .from(TABLE)
        .select("id, user_id")
        .eq("id", id)
        .maybeSingle();

      if (!existing) {
        return res.status(404).json({ success: false, message: "Payment method not found." });
      }
      if (existing.user_id !== userId) {
        return res.status(403).json({ success: false, message: "You are not allowed to delete this payment method." });
      }
    }

    // The real Supabase DB has the payments FK as ON DELETE NO ACTION, so we
    // must manually remove any payment records referencing this payment method
    // before deleting it. Direct postgres DDL is not reachable from this host.
    const { error: paymentsDeleteError } = await DBconnection
      .from("payments")
      .delete()
      .eq("payment_method_id", id);

    if (paymentsDeleteError) {
      return res.status(500).json({
        success: false,
        message: paymentsDeleteError.message || "Failed to unlink payment records.",
      });
    }

    const { error } = await DBconnection
      .from(TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({ success: false, message: error.message || "Failed to delete payment method." });
    }

    return res.status(200).json({ success: true, message: "Payment method deleted successfully." });
  }


  /* UPDATE PAYMENT METHOD */
  static async update(req: Request, res: Response) {
    try {
      // Only allow specific fields to be updated
      const { last4, method_type, provider } = req.body;
      const payload: any = {};
      if (last4 !== undefined) {
        if (typeof last4 !== 'string' || !/^[0-9]{4}$/.test(last4)) {
          return res.status(400).json({ success: false, message: "Valid last4 is required (4 digits)." });
        }
        payload.last4 = last4.trim();
      }
      if (method_type !== undefined) {
        if (typeof method_type !== 'string') {
          return res.status(400).json({ success: false, message: "Valid method_type is required." });
        }
        payload.method_type = method_type.trim();
      }
      if (provider !== undefined) {
        if (typeof provider !== 'string') {
          return res.status(400).json({ success: false, message: "Valid provider is required." });
        }
        payload.provider = provider.trim();
      }
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ success: false, message: "At least one valid field (last4, method_type, provider) is required to update." });
      }
      const updated = await UniqueService.prototype.updateById(
        TABLE,
        req.params.id,
        payload
      );
      return res.json({
        success: true,
        message: "Payment method updated successfully",
        data: updated,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(error.message === "Record not found" ? 404 : 400).json({
        success: false,
        message:
          error.message === "Record not found"
            ? "Sorry, we couldn't find a payment method to update with that ID."
            : error?.message ||
              "Unable to update payment method. Please check your input and try again.",
      });
    }
  }

  /* Get payment methods by user */
  static async getByUser(req: Request, res: Response) {
    try {
      const userId = req.params.userId;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Valid user ID is required.",
        });
      }
      const data = await UniqueService.prototype.getDataByField(
        TABLE,
        "user_id",
        userId.trim()
      );
      return res.json({
        success: true,
        message: "Payment methods retrieved successfully for this user",
        data,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({
        success: false,
        message: error.message || "Unable to retrieve payment methods.",
      });
    }
  }

  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["last4", "method_type", "provider"];

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
          message: data.length ? "Payment methods fetched successfully" : "No records found",
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
          message: data.length ? "Payment methods fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch payment methods" });
    }
  }

}
