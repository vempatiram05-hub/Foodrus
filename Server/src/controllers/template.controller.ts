import { Request, Response } from "express";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { DBconnection } from "../config/DBConnect";

const normalizeName = (name: string) => name.trim().toLowerCase();

const TEMPLATE_COLS = "id, name, is_global, created_at, updated_at, created_by";

const ADMIN_ROLES = ["Admin", "SuperAdmin"];

// Admin ID cache
interface AdminIdCache { ids: Set<string>; fetchedAt: number }
let _adminIdCache: AdminIdCache | null = null;
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;

async function getAdminIdSet(): Promise<Set<string>> {
  const now = Date.now();
  if (_adminIdCache && now - _adminIdCache.fetchedAt < ADMIN_CACHE_TTL_MS) {
    return _adminIdCache.ids;
  }
  const { data } = await DBconnection
    .from("users").select("id").in("role_name", ["Admin", "SuperAdmin"]);
  const ids = new Set<string>((data ?? []).map((u: any) => u.id));
  _adminIdCache = { ids, fetchedAt: now };
  return ids;
}

async function getAdminId(fallbackId: string): Promise<string> {
  const adminIds = await getAdminIdSet();
  return Array.from(adminIds)[0] ?? fallbackId;
}

export class TemplateController {

  static async create(req: any, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, message: "Template name is required" });

      if (req.user?.role_name === 'StoreAdmin') {
        return res.status(403).json({ success: false, message: "StoreAdmins are not authorized to create templates" });
      }

      const normalized = normalizeName(name);

      // Check if a template with this name already exists
      const { data: existing } = await DBconnection
        .from("templates").select(TEMPLATE_COLS).ilike("name", normalized).maybeSingle();

      if (existing) {
        // Already global — return as-is
        if (existing.is_global) {
          return res.status(200).json({
            success: true,
            already_global: true,
            message: "This template is already shared globally.",
            data: existing,
          });
        }

        // Admin/SuperAdmin caller — they see all templates
        if (ADMIN_ROLES.includes(req.user.role_name)) {
          return res.status(200).json({
            success: true,
            already_global: true,
            message: "This template already exists.",
            data: existing,
          });
        }

        // SubAdmin — check hierarchy
        const governingSubAdminId: string | null =
          req.user.role_name === "SubAdmin" ? req.user.id :
          (req.user.sub_admin_id ?? null);

        if (governingSubAdminId) {
          const { data: hierarchyUsers } = await DBconnection
            .from("users").select("id").eq("sub_admin_id", governingSubAdminId);
          const hierarchyIdSet = new Set((hierarchyUsers ?? []).map((u: any) => u.id));
          hierarchyIdSet.add(governingSubAdminId);

          if (existing.created_by && hierarchyIdSet.has(existing.created_by)) {
            return res.status(409).json({ success: false, message: "Template name already exists in your scope" });
          }

          // Foreign hierarchy — promote to global
          const adminId = await getAdminId(req.user.id);
          if (!adminId || adminId === req.user.id) {
            throw new Error("Cannot promote template: no Admin user exists to take ownership. Please contact your administrator.");
          }
          const now = new Date().toISOString();
          const { data: promoted, error: promoteErr } = await DBconnection
            .from("templates")
            .update({ is_global: true, created_by: adminId, updated_at: now })
            .eq("id", existing.id)
            .select(TEMPLATE_COLS)
            .single();
          if (promoteErr) throw new Error(promoteErr.message);

          _adminIdCache = null;

          return res.status(200).json({
            success: true,
            promoted: true,
            message: "This template already existed and has been made available to all stores.",
            data: promoted,
          });
        }

        // Fallback (Employee without sub_admin_id context)
        return res.status(200).json({
          success: true,
          already_global: true,
          message: "This template already exists.",
          data: existing,
        });
      }

      // Create new template
      const callerIsAdmin = ADMIN_ROLES.includes(req.user?.role_name);
      const now = new Date().toISOString();

      const insertPayload: any = {
        name: normalized,
        is_global: callerIsAdmin,
        created_at: now,
        updated_at: now,
        created_by: req.user.id,
      };

      const { data: row, error } = await DBconnection
        .from("templates")
        .insert(insertPayload)
        .select(TEMPLATE_COLS)
        .single();

      if (error) throw new Error(error.message);

      return res.status(201).json({
        success: true,
        message: "Template created successfully",
        data: row,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const userPayload = (req as any).user as any;
      const callerRole: string | undefined = userPayload?.role_name;
      const isScopedRole = callerRole === "SubAdmin" || callerRole === "StoreAdmin" || callerRole === "Employee";

      let governingSubAdminId: string | null = null;
      if (userPayload) {
        if (callerRole === "SubAdmin") {
          governingSubAdminId = userPayload.id;
        } else if (callerRole === "StoreAdmin") {
          governingSubAdminId = userPayload.sub_admin_id ?? null;
        } else if (callerRole === "Employee") {
          governingSubAdminId = userPayload.sub_admin_id ?? null;
          if (!governingSubAdminId && userPayload.store_admin_id) {
            const { data: saUser } = await DBconnection
              .from("users").select("sub_admin_id").eq("id", userPayload.store_admin_id).single();
            governingSubAdminId = (saUser as any)?.sub_admin_id ?? null;
          }
        }
      }

      if (isScopedRole && !governingSubAdminId) {
        const empty = { success: true, message: "No records found", data: [], total: 0 };
        return isPaginated
          ? res.json({ ...empty, page: getQueryNumber(req.query, "page", 1), limit: getQueryNumber(req.query, "limit", 10) })
          : res.json(empty);
      }

      let allowedCreatorIds: string[] | null = null;

      if (governingSubAdminId) {
        // Single query: fetch hierarchy members + global admins in one round-trip
        const { data: scopedUsers } = await DBconnection
          .from("users")
          .select("id")
          .or(`sub_admin_id.eq.${governingSubAdminId},role_name.in.(Admin,SuperAdmin)`);
        allowedCreatorIds = [governingSubAdminId, ...(scopedUsers ?? []).map((u: any) => u.id)];
      }

      let dbQuery = DBconnection
        .from("templates")
        .select(TEMPLATE_COLS, { count: "exact" })
        .order("created_at", { ascending: false });

      if (allowedCreatorIds !== null) {
        // Scoped roles see templates they own (by creator hierarchy) OR global templates
        dbQuery = (dbQuery as any).or(
          `is_global.eq.true,created_by.in.(${allowedCreatorIds.join(",")})`
        );
      }

      if (search) {
        dbQuery = (dbQuery as any).ilike("name", `%${search}%`);
      }

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const offset = (page - 1) * limit;
        const { data, error, count } = await (dbQuery as any).range(offset, offset + limit - 1);
        if (error) throw new Error(error.message);
        const mapped = data ?? [];
        return res.json({
          success: true,
          message: mapped.length ? "Templates fetched successfully" : "No records found",
          data: mapped, total: count ?? 0, page, limit,
        });
      }

      const { data, error, count } = await (dbQuery as any);
      if (error) throw new Error(error.message);
      const mapped = data ?? [];
      return res.json({
        success: true,
        message: mapped.length ? "Templates fetched successfully" : "No records found",
        data: mapped, total: count ?? 0,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch templates" });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { data, error } = await DBconnection
        .from("templates").select(TEMPLATE_COLS).eq("id", req.params.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Template not found");
      return res.json({
        success: true,
        message: "Template retrieved successfully",
        data,
      });
    } catch (err: any) {
      return res.status(404).json({ success: false, message: err.message });
    }
  }

  static async update(req: any, res: Response) {
    try {
      if (req.user?.role_name === 'StoreAdmin') {
        return res.status(403).json({ success: false, message: "StoreAdmins are not authorized to update templates" });
      }
      const { name, is_global } = req.body;

      const { data: existing, error: fetchErr } = await DBconnection
        .from("templates").select(TEMPLATE_COLS).eq("id", req.params.id).maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing) return res.status(404).json({ success: false, message: "Template not found" });

      if (existing.is_global && ['SubAdmin', 'StoreAdmin'].includes(req.user?.role_name)) {
        return res.status(403).json({ success: false, message: "Global templates cannot be modified by SubAdmins or StoreAdmins" });
      }

      let normalizedName = existing.name;
      if (name) {
        normalizedName = normalizeName(name);
        const { data: dup } = await DBconnection
          .from("templates").select("id")
          .ilike("name", normalizedName).neq("id", req.params.id).maybeSingle();
        if (dup) return res.status(409).json({ success: false, message: "A template with this name already exists" });
      }

      const now = new Date().toISOString();

      const updatePayload: any = { name: normalizedName, updated_at: now };
      if (is_global !== undefined) {
        updatePayload.is_global = is_global === true || is_global === "true";
      }

      const { data: row, error: updErr } = await DBconnection
        .from("templates")
        .update(updatePayload)
        .eq("id", req.params.id)
        .select(TEMPLATE_COLS)
        .single();

      if (updErr) throw new Error(updErr.message);

      return res.json({
        success: true,
        message: "Template updated successfully",
        data: row,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async delete(req: any, res: Response) {
    try {
      if (req.user?.role_name === 'StoreAdmin') {
        return res.status(403).json({ success: false, message: "StoreAdmins are not authorized to delete templates" });
      }

      const { data: existing, error: fetchErr } = await DBconnection
        .from("templates").select(TEMPLATE_COLS).eq("id", req.params.id).maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing) return res.status(404).json({ success: false, message: "Template not found" });

      if (existing.is_global && ['SubAdmin', 'StoreAdmin'].includes(req.user?.role_name)) {
        return res.status(403).json({ success: false, message: "Global templates cannot be deleted by SubAdmins or StoreAdmins" });
      }

      const { error: delErr } = await DBconnection.from("templates").delete().eq("id", req.params.id);
      
      if (delErr) {
        if (delErr.code === '23503') {
          return res.status(409).json({ 
            success: false, 
            message: "This template cannot be deleted because it is currently being used by one or more parties or products." 
          });
        }
        throw new Error(delErr.message);
      }

      return res.json({ success: true, message: "Template deleted successfully" });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
