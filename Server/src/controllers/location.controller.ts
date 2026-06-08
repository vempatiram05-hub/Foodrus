// src/controllers/location.controller.ts
import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

// Reuse UniqueController for getAll, getById, delete
const countryController = new UniqueController("country");
const stateController = new UniqueController("state");
const cityController = new UniqueController("city");

// Service instance for other operations
const uniqueService = new UniqueService();

export class LocationController {
  /* GET ALL RECORDS (Reuse UniqueController) */

  /* GET BY ID (Reuse UniqueController) */
  public static async getById(req: Request, res: Response) {
    const { table } = req.params;
    switch (table) {
      case "country":
        return countryController.getById(req, res);
      case "state":
        return stateController.getById(req, res);
      case "city":
        return cityController.getById(req, res);
      default:
        return res.status(400).json({ success: false, message: "Invalid table" });
    }
  };

  /* DELETE BY ID (Reuse UniqueController) */
public static async delete(req: Request, res: Response) {
  const { table, id } = req.params;

  try {
    // 🛑 COUNTRY → STATE CHECK
    if (table === "country") {
      const states = await uniqueService.getDataByField(
        "state",
        "country_id",
        id as string
      );

      if (states.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete country: states exist for this country",
        });
      }
    }

    // 🛑 STATE → CITY CHECK
    if (table === "state") {
      const cities = await uniqueService.getDataByField(
        "city",
        "state_id",
        id as string
      );

      if (cities.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete state: cities exist for this state",
        });
      }
    }

    // 🔁 Delegate actual delete to UniqueController
    switch (table) {
      case "country":
        return countryController.deleteById(req, res);
      case "state":
        return stateController.deleteById(req, res);
      case "city":
        return cityController.deleteById(req, res);
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid table",
        });
    }
  } catch (err: any) {
    const error = normalizeSupabaseError(err);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}
  /* CREATE RECORD */
  public static async create(req: Request, res: Response) {
  try {
    const { table, payload } = req.body;

    /* UNIQUENESS VALIDATION */

    if (table === "country") {
      const exists = await uniqueService.getDataByField(
        "country",
        "name",
        payload.name
      );

      if (exists.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Country with this name already exists",
        });
      }
    }

    if (table === "state") {
      const exists = await uniqueService.getDataByMultipleFields(
        "state",
        {
          name: payload.name,
          country_id: payload.country_id,
        }
      );

      if (exists.length > 0) {
        return res.status(409).json({
          success: false,
          message: "State with this name already exists in this country",
        });
      }
    }

    if (table === "city") {
      const exists = await uniqueService.getDataByMultipleFields(
        "city",
        {
          name: payload.name,
          state_id: payload.state_id,
        }
      );

      if (exists.length > 0) {
        return res.status(409).json({
          success: false,
          message: "City with this name already exists in this state",
        });
      }
    }

    /* CREATE */
    const data = await uniqueService.create(table as string, payload);

    return res.status(201).json({
      success: true,
      message: "Record created successfully",
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

  /* UPDATE RECORD */
  public static async update(req: Request, res: Response) {
    try {
      const { table, id } = req.params;
      const payload = req.body;
      const data = await uniqueService.updateById(table as string, id as string, payload);
      return res.status(200).json({ success: true, message: "Record updated successfully", data });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  /* GET WITH SEARCH + PAGINATION */
  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  public static async getList(req: Request, res: Response) {
    try {
      const { table } = req.params;
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      if (!table) return res.status(400).json({ success: false, message: "Table name is required" });

      const searchColumns = ["name"];

      let data: any[];
      let total: number;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const result = await uniqueService.getDataWithSearch(table as string, searchColumns, search || undefined, limit, page);
        data = result.data;
        total = result.total;

        return res.json({
          success: true,
          message: data.length ? `${table} fetched successfully` : "No records found",
          data,
          total,
          page,
          limit,
        });
      } else {
        data = await uniqueService.getAllData(table as string);
        if (search) {
          data = data.filter(c =>
            searchColumns.some(col => c[col]?.toString().toLowerCase().includes(search))
          );
        }
        total = data.length;

        return res.json({
          success: true,
          message: data.length ? `${table} fetched successfully` : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch locations" });
    }
  }

  /* GET STATES BY COUNTRY */
  public static async getStatesByCountry(req: Request, res: Response) {
    try {
      const { country_id } = req.query;
      if (!country_id) throw new Error("country_id is required");

      const data = await uniqueService.getDataByField(
        "state",
        "country_id",
        country_id as string
      );

      return res.status(200).json({ success: true, message: "States fetched successfully", data });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  /* GET CITIES BY STATE */
  public static async getCitiesByState(req: Request, res: Response) {
    try {
      const { state_id } = req.query;
      if (!state_id) throw new Error("state_id is required");

      const data = await uniqueService.getDataByField(
        "city",
        "state_id",
        state_id as string
      );

      return res.status(200).json({ success: true, message: "Cities fetched successfully", data });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
