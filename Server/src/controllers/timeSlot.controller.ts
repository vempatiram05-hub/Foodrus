import { Request, Response } from "express";
import { DBconnection } from "../config/DBConnect";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueController } from "./unique.controller";
import { UniqueService } from "../services/unique.service";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

const TABLE_NAME = "time_slots";
// reusable controller
const uniqueTimeSlotController = new UniqueController(TABLE_NAME);
const uniqueService = new UniqueService();

export class TimeSlotController {

  // helper
  static normalize(value: string) {
    return value.trim().toLowerCase();
  }

  /* CREATE */
  static async create(req: Request, res: Response) {
    try {
      const { name, code, ...rest } = req.body;

       if (!name || !code) {
        return res.status(400).json({
          success: false,
          message: "TimeSlot name and code are required",
        });
      }
      const normalized_name = TimeSlotController.normalize(name);
      const normalized_code = TimeSlotController.normalize(code);

           // 🔒 Check duplicates in parallel
      const [{ data: nameExists, error: nameErr }, { data: codeExists, error: codeErr }] =
        await Promise.all([
         DBconnection
            .from(TABLE_NAME)
            .select("id")
            .eq("normalized_name", normalized_name)
            .maybeSingle(),
          DBconnection
            .from(TABLE_NAME)
            .select("id")
            .eq("normalized_code", normalized_code)
            .maybeSingle(),
        ]);

      if (nameErr) throw nameErr;
      if (codeErr) throw codeErr;

      if (nameExists) throw new Error("TimeSlot name already exists");
      if (codeExists) throw new Error("TimeSlot code already exists");


      const payload = {
        name: name.trim(),
        code: code.trim(),
        normalized_name,
        normalized_code,
        ...rest,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await DBconnection
        .from(TABLE_NAME)
        .insert(payload)
        .select("*")
        .single();

      if (error) throw normalizeSupabaseError(error);

      return res.status(201).json({
        success: true,
        message: "TimeSlot created successfully",
        data,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
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
          message: data.length ? "Time slots fetched successfully" : "No records found",
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
          message: data.length ? "Time slots fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch time slots" });
    }
  }

  /* GET BY ID */
  static getById(req: Request, res: Response) {
    return uniqueTimeSlotController.getById(req, res);
  }

  /* UPDATE */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const payload = { ...req.body };

     if (!id) {
        return res.status(400).json({
          success: false,
          message: "TimeSlot ID is required",
        });
      }
      // check existing
      const { data: existing, error: fetchErr } = await DBconnection
        .from(TABLE_NAME)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr) throw normalizeSupabaseError(fetchErr);
      if (!existing) throw new Error("TimeSlot not found");

      // name duplicate
      if (payload.name) {
        const normalized_name = TimeSlotController.normalize(payload.name);

        const { data: nameExists } = await DBconnection
          .from(TABLE_NAME)
          .select("id")
          .eq("normalized_name", normalized_name)
          .neq("id", id)
          .maybeSingle();

        if (nameExists) throw new Error("TimeSlot name already exists");

        payload.name = payload.name.trim();
        payload.normalized_name = normalized_name;
      }

      // code duplicate
      if (payload.code) {
        const normalized_code = TimeSlotController.normalize(payload.code);

        const { data: codeExists } = await DBconnection
          .from(TABLE_NAME)
          .select("id")
          .eq("normalized_code", normalized_code)
          .neq("id", id)
          .maybeSingle();

        if (codeExists) throw new Error("TimeSlot code already exists");

        payload.code = payload.code.trim();
        payload.normalized_code = normalized_code;
      }

      payload.updated_at = new Date().toISOString();

      const { data, error } = await DBconnection
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", id as string)
        .select("*")
        .single();

      if (error) throw normalizeSupabaseError(error);

      return res.json({
        success: true,
        message: "TimeSlot updated successfully",
        data,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* DELETE */
  static delete(req: Request, res: Response) {
    return uniqueTimeSlotController.deleteById(req, res);
  }
}