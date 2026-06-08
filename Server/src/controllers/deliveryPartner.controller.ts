import { Request, Response, NextFunction } from "express";
import { UniqueService } from "../services/unique.service";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { UniqueController } from "./unique.controller";

const TABLE_NAME = "delivery_partners";
const uniqueService = new UniqueService();

// ✅ Reusable generic controller
const uniqueDeliveryController = new UniqueController(TABLE_NAME);

export class DeliveryPartnerController {

  /** Create a new delivery partner */
  static async create(req: Request, res: Response) {
    try {
      const { user_id, vehicle_type } = req.body;

      // ✅ Validation
      if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
        return res.status(400).json({ success: false, message: "user_id is required and must be a non-empty string" });
      }

      if (vehicle_type && (!["BIKE", "CAR"].includes(vehicle_type.toUpperCase()))) {
        return res.status(400).json({ success: false, message: "vehicle_type must be BIKE or CAR" });
      }

      // 🔹 Normalize
      const payload = {
        user_id: user_id.trim(),
        vehicle_type: vehicle_type?.toUpperCase() ?? null,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      // 🔹 Duplicate handling (check if user already a delivery partner)
      const existing = await uniqueService.getDataByField(TABLE_NAME, "user_id", payload.user_id);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: "This user is already a delivery partner" });
      }

      // 🔹 Create
      const data = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({ success: true, message: "Delivery partner created successfully", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["user_id", "vehicle_type"];

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
          message: data.length ? "Delivery partners fetched successfully" : "No records found",
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
          message: data.length ? "Delivery partners fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch delivery partners" });
    }
  }



  static getById(req: Request, res: Response, next: NextFunction) {
    return uniqueDeliveryController.getById(req, res);
  }

  static delete(req: Request, res: Response, next: NextFunction) {
    return uniqueDeliveryController.deleteById(req, res);
  }


  /** Update a delivery partner */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { vehicle_type, is_active } = req.body;

      if (!id || typeof id !== "string" || !id.trim()) {
        return res.status(400).json({ success: false, message: "id is required and must be a non-empty string" });
      }

      // Validation
      if (vehicle_type && (!["BIKE", "CAR"].includes(vehicle_type.toUpperCase()))) {
        return res.status(400).json({ success: false, message: "vehicle_type must be BIKE or CAR" });
      }

      const payload: any = {};
      if (vehicle_type) payload.vehicle_type = vehicle_type.toUpperCase();
      if (typeof is_active === "boolean") payload.is_active = is_active;

      payload.updated_at = new Date().toISOString();

      const data = await uniqueService.updateById(TABLE_NAME, id.trim(), payload);

      return res.status(200).json({ success: true, message: "Delivery partner updated successfully", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

}

export const deliveryPartnerController = new DeliveryPartnerController();
