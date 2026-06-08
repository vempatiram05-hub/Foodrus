import { Request, Response, NextFunction } from "express";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { logger } from "../utils/logger";
import type { JwtPayload } from "../utils/token";

const uniqueService = new UniqueService();
const TABLE_NAME = "addresses";
const uniqueAddressController = new UniqueController(TABLE_NAME);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ROLES: JwtPayload["role_name"][] = ["Admin", "SuperAdmin"];

export class AddressController {

  /* CREATE ADDRESS */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const allowedFields = [
        "user_id",
        "line1",
        "line2",
        "city_id",
        "state_id",
        "country_id",
        "postal_code",
        "label",
        "latitude",
        "longitude",
        "is_default"
      ];
      const payload: Record<string, any> = {};
      for (const field of allowedFields) {
        if (Object.hasOwn(req.body, field)) {
          payload[field] = req.body[field];
        }
      }
      if (!payload.user_id || !payload.line1) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: user_id, line1."
        });
      }
      payload.updated_at = new Date().toISOString();

      const created = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({
        success: true,
        message: "Address created successfully",
        data: created,
      });
    } catch (err: any) {
      logger.error("AddressController.create error:", err);
      return res.status(400).json({
        success: false,
        message:
          err?.message ||
          "Unable to create address. Please check your input.",
      });
    }
  }

  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["line1", "line2", "postal_code", "label"];

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
          message: data.length ? "Addresses fetched successfully" : "No records found",
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
          message: data.length ? "Addresses fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch addresses" });
    }
  }

  /* GET BY ID (delegate to UniqueController) */
  static readonly getById: typeof uniqueAddressController.getById = (...args) => uniqueAddressController.getById(...args);

  /* DELETE BY ID — with ownership check */
  static async delete(req: Request, res: Response) {
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ success: false, message: "id is required" });
    }
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid UUID format" });
    }

    try {
      const requestingUser = req.user as JwtPayload | undefined;
      const isAdmin = requestingUser && ADMIN_ROLES.includes(requestingUser.role_name);

      if (!isAdmin) {
        const rows = await uniqueService.getDataById(id, TABLE_NAME);
        const address = Array.isArray(rows) ? rows[0] : rows;
        if (!address) {
          return res.status(404).json({ success: false, message: "Address not found" });
        }
        if (address.user_id !== requestingUser?.id) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You do not have permission to delete this address",
          });
        }
      }

      const related = await uniqueService.getDataByField("orders", "address_id", id);
      if (related && related.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Cannot delete: This address is referenced in existing orders.",
        });
      }

      await uniqueService.deleteData(TABLE_NAME, id);
      return res.status(200).json({ success: true, message: "Address deleted successfully" });
    } catch (err: any) {
      logger.error("AddressController.delete error:", err);
      const status = err?.message === "Record not found" ? 404 : 500;
      return res.status(status).json({
        success: false,
        message: err?.message || "Failed to delete address",
      });
    }
  }

  /* GET ADDRESSES BY USER ID */
  static async getByUserId(req: Request, res: Response, next: NextFunction) {
    try {
      const { user_id } = req.params;

      if (!user_id || typeof user_id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(user_id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing user_id parameter."
        });
      }

      const addresses = await uniqueService.getDataByField(
        TABLE_NAME,
        "user_id",
        user_id
      );

      return res.json({
        success: true,
        message: "Addresses retrieved by user successfully",
        data: addresses,
      });
    } catch (err: any) {
      logger.error("AddressController.getByUserId error:", err);
      return res.status(500).json({
        success: false,
        message:
          err?.message ||
          "Unable to retrieve addresses for this user.",
      });
    }
  }

  /* UPDATE ADDRESS */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing address id."
        });
      }

      const requestingUser = req.user as JwtPayload | undefined;
      const isAdmin = requestingUser && ADMIN_ROLES.includes(requestingUser.role_name);

      if (!isAdmin) {
        const rows = await uniqueService.getDataById(id, TABLE_NAME);
        const address = Array.isArray(rows) ? rows[0] : rows;
        if (!address) {
          return res.status(404).json({ success: false, message: "Address not found" });
        }
        if (address.user_id !== requestingUser?.id) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You do not have permission to update this address",
          });
        }
      }

      const allowedFields = [
        "user_id",
        "line1",
        "line2",
        "state_id",
        "country_id",
        "postal_code",
        "label",
        "latitude",
        "longitude",
        "is_default"
      ];
      const payload: Record<string, any> = {};
      for (const field of allowedFields) {
        if (Object.hasOwn(req.body, field)) {
          payload[field] = req.body[field];
        }
      }
      payload.updated_at = new Date().toISOString();

      const updated = await uniqueService.updateById(
        TABLE_NAME,
        id,
        payload
      );

      return res.json({
        success: true,
        message: "Address updated successfully",
        data: updated,
      });
    } catch (err: any) {
      logger.error("AddressController.update error:", err);
      const status = err.message === "Record not found" ? 404 : 400;
      return res.status(status).json({
        success: false,
        message:
          err?.message ||
          "Unable to update address. Please check your input.",
      });
    }
  }
}
