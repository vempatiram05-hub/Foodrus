import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueController } from "./unique.controller";
import { DBconnection } from "../config/DBConnect";
import { getQueryString, getQueryNumber } from "../utils/queryParser";

const uniqueService = new UniqueService();
const TABLE_NAME = "variants";
const uniqueVariantController = new UniqueController(TABLE_NAME);

export class VariantController {
  /* CREATE VARIANT */
  async create(req: Request, res: Response) {
    try {
      const { name, description } = req.body;

      if (!name) throw new Error("Variant name is required");

      const payload = {
        name: name.trim(),
        description: description ?? null,
      };

      const data = await uniqueService.create(TABLE_NAME, payload);

      return res.status(201).json({
        success: true,
        message: "Variant created successfully",
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
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["name", "description"];

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
          message: data.length ? "Variants fetched successfully" : "No records found",
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
          message: data.length ? "Variants fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch variants" });
    }
  }

  /* UPDATE VARIANT */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) throw new Error("Variant ID is required");

      const payload: any = { ...req.body };

      if (payload.name) {
        payload.name = payload.name.trim();
      }

      const data = await uniqueService.updateById(
        TABLE_NAME,
        id as string,
        payload
      );

      return res.status(200).json({
        success: true,
        message: "Variant updated successfully",
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

  /* GET VARIANT BY ID */
  getById(req: Request, res: Response) {
    return uniqueVariantController.getById(req, res); 
  }

  /* DELETE VARIANT */
  delete(req: Request, res: Response) {
    return uniqueVariantController.deleteById(req, res);
  }
}

export const variantController = new VariantController();
