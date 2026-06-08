import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { getQueryNumber,getQueryString } from "../utils/queryParser";

const TABLE_NAME = "delivery_locations";
const uniqueService = new UniqueService();

export class DeliveryLocationController {

  /** Record a new location */
  async record(req: Request, res: Response) {
    try {
      const { delivery_partner_id, latitude, longitude, order_id } = req.body;

      // ✅ Validation
      if (!delivery_partner_id || typeof delivery_partner_id !== "string" || !delivery_partner_id.trim()) {
        return res.status(400).json({ success: false, message: "delivery_partner_id is required and must be a non-empty string" });
      }
      if (typeof latitude !== "number" || Number.isNaN(latitude) || typeof longitude !== "number" || Number.isNaN(longitude)) {
        return res.status(400).json({ success: false, message: "latitude and longitude must be valid numbers" });
      }

      // 🔹 Prepare payload
      const payload = {
        delivery_partner_id: delivery_partner_id.trim(),
        latitude,
        longitude,
        order_id: order_id ?? null,
        recorded_at: new Date().toISOString(),
      };

      // 🔹 Save using uniqueService
      const data = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({ success: true, message: "Delivery location created successfully", data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["delivery_partner_id", "order_id"];

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
          message: data.length ? "Delivery locations fetched successfully" : "No records found",
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
          message: data.length ? "Delivery locations fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch delivery locations" });
    }
  }

  /** Get latest location by order */
  async getLatestByOrder(req: Request, res: Response) {
    try {
      const { order_id } = req.params;
      if (!order_id) return res.status(400).json({ success: false, message: "order_id is required" });

      // 🔹 Fetch all locations for this order
      const locations = await uniqueService.getDataByField(TABLE_NAME, "order_id", order_id);

      if (!locations || locations.length === 0) {
        return res.status(404).json({ success: false, message: "No locations found for this order" });
      }

      // 🔹 Get latest based on recorded_at
      const latest = locations.reduce(
        (prev: any, curr: any) =>
          new Date(curr.recorded_at).getTime() > new Date(prev.recorded_at).getTime() ? curr : prev,
        locations[0]
      );

      return res.status(200).json({ success: true, message: "Latest location fetched successfully", data: latest });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /** Get latest location by delivery partner */
  async getLatestByDeliveryPartner(req: Request, res: Response) {
    try {
      const { delivery_partner_id } = req.params;
      if (!delivery_partner_id) return res.status(400).json({ success: false, message: "delivery_partner_id is required" });

      // 🔹 Fetch all locations for this partner
      const locations = await uniqueService.getDataByField(TABLE_NAME, "delivery_partner_id", delivery_partner_id);

      if (!locations || locations.length === 0) {
        return res.status(404).json({ success: false, message: "No locations found for this delivery partner" });
      }

      // 🔹 Get latest based on recorded_at
      const latest = locations.reduce(
        (prev: any, curr: any) =>
          new Date(curr.recorded_at).getTime() > new Date(prev.recorded_at).getTime() ? curr : prev,
        locations[0]
      );

      return res.status(200).json({ success: true, message: "Latest location fetched successfully", data: latest });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

export const deliveryLocationController = new DeliveryLocationController();
