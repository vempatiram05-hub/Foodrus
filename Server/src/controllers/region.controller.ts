import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

const uniqueService = new UniqueService();
const TABLE_NAME = "regions";

// ✅ Reusable UniqueController instance for standard CRUD
const uniqueRegionController = new UniqueController(TABLE_NAME);

export class RegionController {

  // CREATE REGION
  static async create(req: Request, res: Response) {
    try {
      const { name, code } = req.body;

      if (!name || !code) {
        return res.status(400).json({
          success: false,
          message: "Region name and code are required",
        });
      }

      // 🔍 Duplicate code check
      const regions = await uniqueService.getData(TABLE_NAME);
      const exists = regions.find((r: any) => r.code === code);

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Region code already exists",
        });
      }

      const region = await uniqueService.create(TABLE_NAME, {
        name,
        code,
      });

      return res.status(201).json({
        success: true,
        message: "Region created successfully",
        data: region,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
  /*  REUSE UNIQUE CONTROLLER */

  static async getById(req: Request, res: Response) {
    return uniqueRegionController.getById(req, res);
  }

  static async delete(req: Request, res: Response) {
    return uniqueRegionController.deleteById(req, res);
  }
  
  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["name", "code"];

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
          message: data.length ? "Regions fetched successfully" : "No records found",
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
          message: data.length ? "Regions fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch regions" });
    }
  }


  // UPDATE REGION
  static async update(req: Request, res: Response) {
    try {
      const { name, code } = req.body;

      if (!name && !code) {
        return res.status(400).json({
          success: false,
          message: "Provide name or code to update",
        });
      }

      // 🔍 Duplicate code check (ignore same ID)
      if (code) {
        const regions = await uniqueService.getData(TABLE_NAME);
        const exists = regions.find(
          (r: any) => r.code === code && r.id !== req.params.id
        );

        if (exists) {
          return res.status(409).json({
            success: false,
            message: "Region code already exists",
          });
        }
      }

      const updated = await uniqueService.updateById(
        TABLE_NAME,
        req.params.id,
        { name, code }
      );

      return res.json({
        success: true,
        message: "Region updated successfully",
        data: updated,
      });
    } catch (error: any) {
      const status = error.message === "Record not found" ? 404 : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
      });
    }
  }
}
