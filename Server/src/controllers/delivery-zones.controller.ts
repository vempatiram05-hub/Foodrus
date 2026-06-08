import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { UniqueController } from "./unique.controller";

const TABLE_NAME = "delivery_zones";
const uniqueService = new UniqueService();

// ✅ Create reusable generic controller
const uniqueDeliveryZoneController = new UniqueController(TABLE_NAME);

export class DeliveryZoneController {
  /** Create a delivery zone */
  static async create(req: Request, res: Response) {
    try {
      const { store_id, max_radius_km, base_delivery_fee, per_km_fee } = req.body;

      // 🔐 Validation
      if (!store_id || typeof store_id !== "string" || !store_id.trim()) {
        return res.status(400).json({ success: false, message: "store_id is required and must be a non-empty string" });
      }
      if (typeof max_radius_km !== "number" || Number.isNaN(max_radius_km)) {
        return res.status(400).json({ success: false, message: "max_radius_km must be a number" });
      }
      if (typeof base_delivery_fee !== "number" || Number.isNaN(base_delivery_fee)) {
        return res.status(400).json({ success: false, message: "base_delivery_fee must be a number" });
      }
      if (per_km_fee !== undefined && (typeof per_km_fee !== "number" || Number.isNaN(per_km_fee))) {
        return res.status(400).json({ success: false, message: "per_km_fee must be a number" });
      }

      // 🔍 Check duplicate for the store (only one delivery zone per store)
      const existing = await uniqueService.getDataByField(TABLE_NAME, "store_id", store_id.trim());
      if (existing && existing.length > 0) {
        return res.status(400).json({ success: false, message: "Delivery zone for this store already exists" });
      }

      // 📝 Normalize (if needed)
      const payload = {
        store_id: store_id.trim(),
        max_radius_km,
        base_delivery_fee,
        per_km_fee: per_km_fee ?? null,
      };

      const data = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({ success: true, message: "Delivery-zone Created Successfully", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }


  static getById(req: Request, res: Response) {
    return uniqueDeliveryZoneController.getById(req, res);
  }

  static delete(req: Request, res: Response) {
    return uniqueDeliveryZoneController.deleteById(req, res);
  }


  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["store_id"];

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
          message: data.length ? "Delivery zones fetched successfully" : "No records found",
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
          message: data.length ? "Delivery zones fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch delivery zones" });
    }
  }


  /** Get delivery zone by store_id */
  static async getByStore(req: Request, res: Response) {
    try {
      const { store_id } = req.params;
      if (!store_id || typeof store_id !== "string" || !store_id.trim()) {
        return res.status(400).json({ success: false, message: "store_id is required and must be a non-empty string" });
      }
      const zones = await uniqueService.getDataByField(TABLE_NAME, "store_id", store_id.trim());

      if (!zones || zones.length === 0) {
        return res.status(404).json({ success: false, message: "Delivery zone not found for this store" });
      }

      return res.status(200).json({ success: true, message: "Delivery-zone Retrived By Store Successfully", data: zones[0] });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }

  /** Update delivery zone */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { max_radius_km, base_delivery_fee, per_km_fee } = req.body;

      if (!id || typeof id !== "string" || !id.trim()) {
        return res.status(400).json({ success: false, message: "id is required and must be a non-empty string" });
      }

      // 🔐 Validation
      const updates: any = {};
      if (max_radius_km !== undefined) {
        if (typeof max_radius_km !== "number" || Number.isNaN(max_radius_km)) {
          return res.status(400).json({ success: false, message: "max_radius_km must be a number" });
        }
        updates.max_radius_km = max_radius_km;
      }
      if (base_delivery_fee !== undefined) {
        if (typeof base_delivery_fee !== "number" || Number.isNaN(base_delivery_fee)) {
          return res.status(400).json({ success: false, message: "base_delivery_fee must be a number" });
        }
        updates.base_delivery_fee = base_delivery_fee;
      }
      if (per_km_fee !== undefined) {
        if (typeof per_km_fee !== "number" || Number.isNaN(per_km_fee)) {
          return res.status(400).json({ success: false, message: "per_km_fee must be a number" });
        }
        updates.per_km_fee = per_km_fee;
      }

      const data = await uniqueService.updateById(TABLE_NAME, id.trim(), updates);

      return res.status(200).json({ success: true, message: "Delivery-zone Updated Successfully", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }

}

export const deliveryZoneController = new DeliveryZoneController();
