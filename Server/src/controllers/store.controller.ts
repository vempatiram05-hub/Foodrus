import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryString, getQueryNumber } from "../utils/queryParser";
import { DBconnection } from "../config/DBConnect";


const TABLE_NAME = "stores";
const uniqueService = new UniqueService();
const uniqueController = new UniqueController(TABLE_NAME);

export class StoreController {
  /* CREATE STORE */
  static async create(req: Request, res: Response) {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          success: false,
          message: "Request body is required",
        });
      }


      const { latitude, longitude } = req.body;
      if (latitude !== undefined && latitude !== null) {
        const lat = parseFloat(latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          return res.status(400).json({ success: false, message: 'Latitude must be between -90 and 90.' });
        }
      }
      if (longitude !== undefined && longitude !== null) {
        const lng = parseFloat(longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          return res.status(400).json({ success: false, message: 'Longitude must be between -180 and 180.' });
        }
      }

      const created = await uniqueService.create(TABLE_NAME, req.body);

      return res.status(201).json({
        success: true,
        message: "Store created successfully",
        data: created,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* GET LIST - supports optional search, store_ids (comma-separated), paginated if page/limit provided */
  static async getList(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const storeIdsRaw = getQueryString(req.query, "store_ids") || "";
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["name"];

      // ── 1. Determine allowed store IDs based on role ──────────────────────────────────────
      let allowedStoreIds: string[] | null = null;

      if (user && user.role_name !== "Admin") {
        const role = user.role_name;
        if (role === "StoreAdmin") {
          const { data: stores } = await DBconnection.from("stores").select("id").eq("store_admin_id", user.id);
          allowedStoreIds = stores?.map(s => s.id) || [];
        } else if (role === "SubAdmin") {
          const { data: storeAdmins } = await DBconnection.from("users").select("id").eq("sub_admin_id", user.id).eq("role_name", "StoreAdmin");
          const storeAdminIds = storeAdmins?.map(u => u.id) || [];
          const { data: stores } = await DBconnection.from("stores").select("id").in("store_admin_id", storeAdminIds);
          allowedStoreIds = stores?.map(s => s.id) || [];
        } else if (role === "SuperAdmin") {
          const { data: storeAdmins } = await DBconnection.from("users").select("id").eq("superadmin_id", user.id).eq("role_name", "StoreAdmin");
          const storeAdminIds = storeAdmins?.map(u => u.id) || [];
          const { data: stores } = await DBconnection.from("stores").select("id").in("store_admin_id", storeAdminIds);
          allowedStoreIds = stores?.map(s => s.id) || [];
        }
      } else if (!user || user.role_name === "Customer") {
        // Customers and guests only see active stores
        const { data: stores } = await DBconnection.from("stores").select("id").eq("is_active", true);
        allowedStoreIds = stores?.map(s => s.id) || [];
      }

      // ── 2. Intersect query param store_ids with role-allowed store IDs ───────────────────
      let finalStoreIds: string[] | null = null;
      if (storeIdsRaw) {
        const requestedIds = storeIdsRaw.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (allowedStoreIds !== null) {
          finalStoreIds = requestedIds.filter(id => allowedStoreIds!.includes(id));
        } else {
          finalStoreIds = requestedIds;
        }
      } else if (allowedStoreIds !== null) {
        finalStoreIds = allowedStoreIds;
      }

      // ── 3. Early-exit if role scoping results in an empty allowed store set ───────────────
      if (finalStoreIds !== null && finalStoreIds.length === 0) {
        return res.json({
          success: true,
          message: "No records found",
          data: [],
          total: 0,
          ...(isPaginated ? { page: getQueryNumber(req.query, "page", 1), limit: getQueryNumber(req.query, "limit", 10) } : {}),
        });
      }

      // ── 4. Fetch all data and apply filters ──────────────────────────────────────────────
      let allData = await uniqueService.getAllData(TABLE_NAME);

      // Apply role-scoped store_id filter
      if (finalStoreIds !== null) {
        allData = allData.filter(s => finalStoreIds!.includes(s.id));
      }

      // Apply search filter
      if (search) {
        allData = allData.filter(s =>
          searchColumns.some(col => s[col]?.toString().toLowerCase().includes(search))
        );
      }

      const total = allData.length;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const from = (page - 1) * limit;
        const data = allData.slice(from, from + limit);

        return res.json({
          success: true,
          message: data.length ? "Stores fetched successfully" : "No records found",
          data,
          total,
          page,
          limit,
        });
      }

      return res.json({
        success: true,
        message: allData.length ? "Stores fetched successfully" : "No records found",
        data: allData,
        total,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: normalizeSupabaseError(err).message || "Failed to fetch stores" });
    }
  }


  /* GET STORE BY ID */
  static getById(req: Request, res: Response) {
    return uniqueController.getById(req, res);
  }

  /* DELETE STORE */
  static remove(req: Request, res: Response) {
    return uniqueController.deleteById(req, res);
  }

  /* UPDATE STORE */
  static async update(req: Request, res: Response) {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          success: false,
          message: "Update payload cannot be empty",
        });
      }


      const { latitude, longitude } = req.body;
      if (latitude !== undefined && latitude !== null) {
        const lat = parseFloat(latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          return res.status(400).json({ success: false, message: 'Latitude must be between -90 and 90.' });
        }
      }
      if (longitude !== undefined && longitude !== null) {
        const lng = parseFloat(longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          return res.status(400).json({ success: false, message: 'Longitude must be between -180 and 180.' });
        }
      }

      const payload = { ...req.body };
      if (req.body.is_active !== undefined) {
        payload.prev_is_active = req.body.is_active;
      }

      const updated = await uniqueService.updateById(
        TABLE_NAME,
        req.params.id as string,
        payload
      );

      return res.json({
        success: true,
        message: "Store updated successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* GET STORES BY ADMIN */
  static async getByAdmin(req: Request, res: Response) {
    try {
      const { adminId } = req.params as { adminId: string };

      if (!adminId) {
        return res.status(400).json({
          success: false,
          message: "Admin ID is required",
        });
      }

      const pageParam = getQueryNumber(req.query, "page");
      const limitParam = getQueryNumber(req.query, "limit");
      const search = getQueryString(req.query, "search");

      if (pageParam !== undefined || limitParam !== undefined) {
        const page = pageParam ?? 1;
        const limit = limitParam ?? 10;
        const result = await uniqueService.getDataByFieldPaginated(
          TABLE_NAME,
          "store_admin_id",
          adminId,
          limit,
          page,
          ["name", "city", "state"],
          search
        );
        return res.json({
          success: true,
          message: "Stores by admin retrieved successfully",
          data: result.data,
          total: result.total,
          page,
          limit,
        });
      }

      const stores = await uniqueService.getDataByField(
        TABLE_NAME,
        "store_admin_id",
        adminId as string
      );

      return res.json({
        success: true,
        message: "Stores by admin retrieved successfully",
        data: stores,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* GET STORES BY REGION */
  static async getByRegion(req: Request, res: Response) {
    try {
      const { regionId } = req.params as { regionId: string };

      if (!regionId) {
        return res.status(400).json({
          success: false,
          message: "Region ID is required",
        });
      }

      const stores = await uniqueService.getDataByField(
        TABLE_NAME,
        "region_id",
        regionId
      );

      return res.json({
        success: true,
        message: "Stores by region retrieved successfully",
        data: stores,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* GET NEAREST STORES BY COORDINATES (public — no auth required) */
  static async getNearestByCoords(req: Request, res: Response) {
    try {
      const lat = parseFloat((req.query.lat as string) || '');
      const lng = parseFloat((req.query.lng as string) || '');

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ success: false, message: 'Valid lat and lng query params are required.' });
      }

      const { data: stores, error } = await DBconnection
        .from(TABLE_NAME)
        .select('id, name, region_id, latitude, longitude, city, state, is_active')
        .eq('is_active', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;

      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const haversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const withDistance = (stores || [])
        .map((s: any) => ({
          ...s,
          distance_km: haversine(lat, lng, parseFloat(s.latitude), parseFloat(s.longitude)),
        }))
        .sort((a: any, b: any) => a.distance_km - b.distance_km)
        .slice(0, 10);

      return res.json({
        success: true,
        message: withDistance.length ? 'Nearest stores fetched successfully' : 'No stores found near this location',
        data: withDistance,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to find nearest stores' });
    }
  }

}
