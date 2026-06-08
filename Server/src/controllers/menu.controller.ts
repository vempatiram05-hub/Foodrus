import { Request, Response } from "express";
import { DBconnection } from "../config/DBConnect";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueService } from "../services/unique.service";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { UniqueController } from "./unique.controller";
import { mapToIntegerDay, mapToStringDay } from "../utils/day.util";
import { checkSubmissionWindow } from "../utils/submissionWindow";
import { notifySubAdminsOfSubmission, notifyStoreOfDecision, notifyStoreAdminOfFinalRevision } from "../services/menuNotification.service";
import { notifyPostgrestReload } from "../config/sessionConnection";


const uniqueService = new UniqueService();
const TABLE_NAME = "menus";
const uniqueMenuController = new UniqueController(TABLE_NAME);

export class MenuController {
  private static formatMenu(menu: any): any {
    if (!menu) return menu;
    if (Array.isArray(menu)) {
      return menu.map((m) => MenuController.formatMenu(m));
    }
    return {
      ...menu,
      weekday: mapToStringDay(menu.weekday) || menu.weekday,
    };
  }

  /* ─── helpers ─── */
  private static async getStoreAndSlotNames(storeId: string, slotId: string): Promise<{ storeName: string; slotName: string }> {
    const [{ data: store }, { data: slot }] = await Promise.all([
      DBconnection.from("stores").select("name").eq("id", storeId).single(),
      DBconnection.from("time_slots").select("name").eq("id", slotId).single(),
    ]);
    return { storeName: store?.name ?? "Store", slotName: slot?.name ?? "—" };
  }

  /* ─────────────────────────────────────────────────────────────
   * CREATE MENU
   * ─────────────────────────────────────────────────────────────
   * For date-based menus:
   *  • Enforces submission window (opens 7 days before, closes 40h before).
   *  • Detects re-submission after rejection: increments revision_count,
   *    resets status to PENDING, max 3 revisions.
   *  • Notifies SubAdmins in the store's region.
   * ───────────────────────────────────────────────────────────── */
  static async create(req: Request, res: Response) {
    try {
      const payload = req.body;

      if (!payload.products?.length) {
        return res.status(400).json({ success: false, message: "products array is required" });
      }

      const productIds = payload.products.map((p: any) => (typeof p === "string" ? p : p.product_id));

      /* ── Submission window check (date-based menus only) ── */
      if (payload.date) {
        const win = checkSubmissionWindow(payload.date);
        if (!win.valid) {
          return res.status(400).json({
            success: false,
            message: win.message,
            data: { opens_at: win.opensAt, closes_at: win.closesAt },
          });
        }
      }

      /* ── Only allow APPROVED products ── */
      if (productIds.length > 0) {
        const { data: approvedProds } = await DBconnection.from("products")
          .select("id")
          .in("id", productIds)
          .eq("approval_status", "APPROVED");
        const approvedIds = new Set((approvedProds ?? []).map((p: any) => p.id));
        const notApproved = productIds.filter((pid: string) => !approvedIds.has(pid));
        if (notApproved.length > 0) {
          return res.status(400).json({
            success: false,
            message: "All products must have APPROVED status",
            data: { not_approved: notApproved },
          });
        }
      }

      /* ── Check for existing REJECTED menu (re-submission path) ── */
      if (payload.date) {
        const doRejectedQuery = () =>
          DBconnection
            .from(TABLE_NAME)
            .select("*")
            .eq("store_id", payload.store_id)
            .eq("time_slot_id", payload.time_slot_id)
            .eq("date", payload.date)
            .eq("status", "REJECTED")
            .is("weekday", null)
            .maybeSingle();

        const { data: rejected, error: rejectedErr } = await doRejectedQuery();
        if (rejectedErr) {
          (rejectedErr as any)._query = "rejected-menu-check";
          throw rejectedErr;
        }

        if (rejected) {
          if (rejected.revision_count >= 3) {
            return res.status(400).json({
              success: false,
              message: "Maximum re-submission limit reached (3 revisions). This menu plan cannot be re-submitted.",
            });
          }

          const updated = await uniqueService.updateById(TABLE_NAME, rejected.id, {
            product_id: productIds,
            status: "PENDING",
            submitted_by: payload.submitted_by,
            notes: payload.notes || null,
            revision_count: rejected.revision_count + 1,
            rejected_at: null,
            rejected_by: null,
          });

          const { storeName, slotName } = await MenuController.getStoreAndSlotNames(payload.store_id, payload.time_slot_id);
          notifySubAdminsOfSubmission({
            storeId: payload.store_id,
            storeName,
            targetDate: payload.date,
            slotName,
            revisionCount: updated.revision_count,
          }).catch(() => {});

          if (updated.revision_count === 3) {
            notifyStoreAdminOfFinalRevision({
              storeId: payload.store_id,
              storeName,
              targetDate: payload.date,
              slotName,
            }).catch(() => {});
          }

          return res.status(200).json({
            success: true,
            message: "Menu re-submitted successfully",
            data: MenuController.formatMenu(updated),
          });
        }
      }

      /* ── Duplicate check (non-rejected) ── */
      let duplicateQuery = DBconnection
        .from(TABLE_NAME)
        .select("*")
        .eq("store_id", payload.store_id)
        .eq("time_slot_id", payload.time_slot_id)
        .neq("status", "REJECTED");

      if (payload.date) {
        duplicateQuery = duplicateQuery.eq("date", payload.date).is("weekday", null);
      } else if (payload.weekday !== undefined) {
        const weekdayInt = mapToIntegerDay(payload.weekday);
        duplicateQuery = duplicateQuery.eq("weekday", weekdayInt).is("date", null);
      }

      const { data: existing, error } = await duplicateQuery;
      if (error) {
        (error as any)._query = "duplicate-check";
        throw error;
      }

      if (existing && existing.length > 0) {
        return res.status(200).json({
          success: true,
          message: "Menu already exists for this store and slot",
          data: MenuController.formatMenu(existing[0]),
        });
      }

      const insertData = {
        store_id: payload.store_id,
        product_id: productIds,
        date: payload.date || null,
        weekday: mapToIntegerDay(payload.weekday) ?? null,
        time_slot_id: payload.time_slot_id,
        submitted_by: payload.submitted_by,
        status: "PENDING",
        notes: payload.notes || null,
        // revision_count omitted: DB column has DEFAULT 0, so Postgres fills it in.
      };

      let created: any;
      try {
        created = await uniqueService.create(TABLE_NAME, insertData);
      } catch (insertErr: any) {
        (insertErr as any)._query = "menu-insert";
        throw insertErr;
      }

      /* ── Notify SubAdmins ── */
      if (payload.date) {
        const { storeName, slotName } = await MenuController.getStoreAndSlotNames(payload.store_id, payload.time_slot_id);
        notifySubAdminsOfSubmission({
          storeId: payload.store_id,
          storeName,
          targetDate: payload.date,
          slotName,
          revisionCount: 0,
        }).catch(() => {});
      }

      return res.status(201).json({
        success: true,
        message: "Menu created successfully",
        data: MenuController.formatMenu(created),
      });
    } catch (err: any) {
      if (err?.code === "42703" || err?.code === "PGRST204") {
        console.error("[MenuController.create] schema error detected", {
          query: err?._query ?? "unknown",
          code: err?.code,
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
        });
        notifyPostgrestReload(
          (msg) => console.log(`[MenuController.create] ${msg}`),
          (msg) => console.warn(`[MenuController.create] ${msg}`)
        ).catch(() => {});
        return res.status(500).json({ success: false, message: "A database schema error occurred. Please try again shortly." });
      }
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err).message });
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * GET LIST
   * ─────────────────────────────────────────────────────────────
   * Customers: only APPROVED menus, filtered by slot start time and
   * unavailable_items.
   * ───────────────────────────────────────────────────────────── */
  static async getList(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
      const dateFilter = (getQueryString(req.query, "date") || "").trim();
      const storeIdParam = (getQueryString(req.query, "store_id") || "").trim();
      const regionIdParam = (getQueryString(req.query, "region_id") || "").trim();

      let allowedStoreIds: string[] | null = null;
      let forceApproved = false;

      if (!user || user.role_name === "Customer") {
        forceApproved = true;
        // Customers and guests only see menus from active stores
        const { data: activeStores } = await DBconnection.from("stores").select("id").eq("is_active", true);
        allowedStoreIds = activeStores?.map(s => s.id) || [];
      } else {
        const role = user.role_name;
        if (role === "StoreAdmin") {
          const { data: stores } = await DBconnection.from("stores").select("id").eq("store_admin_id", user.id);
          allowedStoreIds = stores?.map((s: any) => s.id) || [];
        } else if (role === "SubAdmin") {
          const { data: storeAdmins } = await DBconnection.from("users").select("id").eq("sub_admin_id", user.id).eq("role_name", "StoreAdmin");
          const storeAdminIds = storeAdmins?.map(u => u.id) || [];
          const { data: stores } = await DBconnection.from("stores").select("id").in("store_admin_id", storeAdminIds);
          allowedStoreIds = stores?.map((s: any) => s.id) || [];
        } else if (role === "SuperAdmin") {
          const { data: storeAdmins } = await DBconnection.from("users").select("id").eq("superadmin_id", user.id).eq("role_name", "StoreAdmin");
          const storeAdminIds = storeAdmins?.map(u => u.id) || [];
          const { data: stores } = await DBconnection.from("stores").select("id").in("store_admin_id", storeAdminIds);
          allowedStoreIds = stores?.map((s: any) => s.id) || [];
        } else if (role === "Employee") {
          const { data: stores } = await DBconnection.from("stores").select("id").eq("store_admin_id", user.store_admin_id);
          allowedStoreIds = stores?.map(s => s.id) || [];
        }
        // Admin sees everything, allowedStoreIds stays null
      }

      let finalStoreIds: string[] | null = null;
      if (storeIdParam) {
        const requestedIds = storeIdParam.split(",").map((id: string) => id.trim()).filter(Boolean);
        if (allowedStoreIds !== null) {
          finalStoreIds = requestedIds.filter((id: string) => allowedStoreIds!.includes(id));
        } else {
          finalStoreIds = requestedIds;
        }
      } else if (allowedStoreIds !== null) {
        finalStoreIds = allowedStoreIds;
      }

      // ── Region filter: intersect finalStoreIds with stores belonging to the requested region ──
      if (regionIdParam) {
        const { data: regionStores, error: regionStoreErr } = await DBconnection.from('stores').select('id').eq('region_id', regionIdParam);
        if (regionStoreErr) throw regionStoreErr;
        const regionStoreIds = (regionStores || []).map((s: any) => s.id);
        if (finalStoreIds !== null) {
          finalStoreIds = finalStoreIds.filter(id => regionStoreIds.includes(id));
        } else {
          finalStoreIds = regionStoreIds;
        }
      }

      let data: any[];
      let total: number;

      const page = getQueryNumber(req.query, "page", 1);
      const limit = getQueryNumber(req.query, "limit", 10);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = DBconnection.from(TABLE_NAME).select("*", { count: "exact" });

      if (forceApproved) {
        query = query.eq("status", "APPROVED");
      } else {
        const statusParam = getQueryString(req.query, "status");
        if (statusParam) {
          const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"];
          if (!VALID_STATUSES.includes(statusParam.toUpperCase())) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
          }
          query = query.eq("status", statusParam.toUpperCase());
        }
      }
      if (finalStoreIds) {
        if (finalStoreIds.length === 0) {
          return res.json({
            success: true,
            message: "No records found",
            data: [],
            total: 0,
            ...(isPaginated ? { page, limit } : {}),
          });
        }
        query = query.in("store_id", finalStoreIds);
      }
      if (dateFilter) {
        query = query.eq("date", dateFilter);
      }
      if (search) {
        query = query.or(`status.ilike.%${search}%,notes.ilike.%${search}%`);
      }

      if (isPaginated) {
        query = query.range(from, to).order("created_at", { ascending: false });
        const { data: results, count, error } = await query;
        if (error) throw error;
        let formatted = MenuController.formatMenu(results);

        if (forceApproved) {
          formatted = await MenuController.applyCustomerFilters(formatted);
        }

        total = count || 0;
        return res.json({ success: true, message: formatted.length ? "Menus fetched successfully" : "No records found", data: formatted, total, page, limit });
      } else {
        query = query.order("created_at", { ascending: false }).limit(1000);
        const { data: results, count, error } = await query;
        if (error) throw error;
        let formatted = MenuController.formatMenu(results);

        if (forceApproved) {
          formatted = await MenuController.applyCustomerFilters(formatted);
        }

        total = count || formatted.length;
        return res.json({ success: true, message: formatted.length ? "Menus fetched successfully" : "No records found", data: formatted, total });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch menus" });
    }
  }

  /**
   * For customer-facing responses:
   * - Filter out unavailable_items from product_id.
   * - Only show if current time >= slot start_time.
   */
  private static async applyCustomerFilters(menus: any[]): Promise<any[]> {
    if (!menus?.length) return menus;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    const slotIds = [...new Set(menus.map((m: any) => m.time_slot_id).filter(Boolean))];
    let slotMap: Record<string, any> = {};
    if (slotIds.length > 0) {
      const { data: slots } = await DBconnection.from("time_slots").select("id, start_time, end_time").in("id", slotIds);
      slotMap = Object.fromEntries((slots ?? []).map((s: any) => [s.id, s]));
    }

    return menus
      .map((menu: any) => {
        /* ── For today's menus, enforce time-slot window ── */
        if (!menu.date || menu.date === todayStr) {
          const slot = slotMap[menu.time_slot_id];
          if (slot?.start_time) {
            const [sh, sm] = (slot.start_time as string).split(":").map(Number);
            const slotStart = (sh || 0) * 60 + (sm || 0);
            if (currentTimeMinutes < slotStart) return null;
          }
          if (slot?.end_time) {
            const [eh, em] = (slot.end_time as string).split(":").map(Number);
            const slotEnd = (eh || 0) * 60 + (em || 0) + 30;
            if (currentTimeMinutes > slotEnd) return null;
          }
        }

        /* ── Strip unavailable items from product list ── */
        const unavailable: string[] = Array.isArray(menu.unavailable_items) ? menu.unavailable_items : [];
        const approvedIds: string[] = Array.isArray(menu.product_id) ? menu.product_id : [];
        const menuDate: string | null = menu.date ?? null;
        return {
          ...menu,
          product_id: approvedIds.filter((id: string) => !unavailable.includes(id)),
          menu_date: menuDate,
          is_today: menuDate === todayStr,
        };
      })
      .filter(Boolean);
  }

  /* GET MENU BY ID */
  static async getMenuById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, message: "id is required" });
      const data = await uniqueService.getDataById(id as string, TABLE_NAME);
      return res.status(200).json({ success: true, message: "Menu fetched successfully", data: MenuController.formatMenu(data) });
    } catch (err: any) {
      return res.status(404).json({ success: false, message: err.message || "Menu not found" });
    }
  }

  /* UPDATE MENU */
  static async update(req: Request, res: Response) {
    try {
      const { status, user_id, products, ...rest } = req.body;

      if (products && Array.isArray(products) && products.length > 0) {
        rest.product_id = products.map((p: any) => (typeof p === "string" ? p : p.product_id));
      }

      const id = req.params.id as string;

      /* ── Fetch existing menu to get its date and validate window ── */
      const existing = await uniqueService.getDataById(id, TABLE_NAME);

      /* Window check: applies to product/content updates & PENDING submissions,
         but NOT to APPROVED/REJECTED decisions by SubAdmins. */
      const isDecision = status === "APPROVED" || status === "REJECTED";
      if (!isDecision) {
        const effectiveDate: string | undefined = rest.date || (existing?.date ?? undefined);
        if (effectiveDate) {
          const win = checkSubmissionWindow(effectiveDate);
          if (!win.valid) {
            return res.status(400).json({
              success: false,
              message: win.message,
              data: { opens_at: win.opensAt, closes_at: win.closesAt },
            });
          }
        }
      }

      /* ── Only allow APPROVED products when updating product list ── */
      if (rest.product_id?.length > 0) {
        const { data: approvedProds } = await DBconnection.from("products")
          .select("id")
          .in("id", rest.product_id)
          .eq("approval_status", "APPROVED");
        const approvedIds = new Set((approvedProds ?? []).map((p: any) => p.id));
        const notApproved = rest.product_id.filter((pid: string) => !approvedIds.has(pid));
        if (notApproved.length > 0) {
          return res.status(400).json({
            success: false,
            message: "All products must have APPROVED status",
            data: { not_approved: notApproved },
          });
        }
      }

      let updatePayload: any = { ...rest };

      if (status === "APPROVED") {
        updatePayload.status = "APPROVED";
        updatePayload.approved_by = user_id;
        updatePayload.approved_at = new Date();
      }
      if (status === "REJECTED") {
        updatePayload.status = "REJECTED";
        updatePayload.rejected_by = user_id;
        updatePayload.rejected_at = new Date();
      }
      if (rest.weekday !== undefined) {
        updatePayload.weekday = mapToIntegerDay(rest.weekday);
      }

      const updated = await uniqueService.updateById(TABLE_NAME, id, updatePayload);
      return res.json({ success: true, message: "Menu updated successfully", data: MenuController.formatMenu(updated) });
    } catch (err: any) {
      const statusCode = err.message === "Record not found" ? 404 : 400;
      return res.status(statusCode).json({ success: false, message: err.message });
    }
  }

  /* UPDATE STATUS */
  static async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      const allowedStatuses = ["PENDING", "APPROVED", "REJECTED"];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status value" });
      }
      const updated = await uniqueService.updateById(TABLE_NAME, req.params.id as string, { status });
      return res.json({ success: true, message: "Menu status updated successfully", data: MenuController.formatMenu(updated) });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  /* DELETE MENU */
  static async delete(req: Request, res: Response) {
    return uniqueMenuController.deleteById(req, res);
  }

  /* ─────────────────────────────────────────────────────────────
   * REGION AUTHORIZATION HELPER
   * Returns true if the user is allowed to act on the given menu:
   *   - Admin / SuperAdmin → always allowed
   *   - SubAdmin           → only if the store's StoreAdmin has sub_admin_id = subAdmin.id
   *   - others             → not allowed (blocked by requireRole middleware)
   * ───────────────────────────────────────────────────────────── */
  private static async isAuthorizedForMenuRegion(
    user: any,
    menuStoreId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    // Admin and SuperAdmin can approve any menu regardless of hierarchy
    const adminRoles = ["Admin", "SuperAdmin"];
    if (adminRoles.includes(user?.role_name)) return { ok: true };

    if (!user?.id) {
      return { ok: false, reason: "You do not have permission to approve menus for this store." };
    }

    // Step 1: Get the store's assigned StoreAdmin
    const { data: store, error: storeErr } = await DBconnection
      .from("stores")
      .select("store_admin_id")
      .eq("id", menuStoreId)
      .single();

    if (storeErr || !store?.store_admin_id) {
      return { ok: false, reason: "Store not found or has no StoreAdmin assigned." };
    }

    // Step 2: Verify the StoreAdmin's sub_admin_id matches this SubAdmin.
    // This is the correct hierarchy check: stores → StoreAdmin → SubAdmin.
    // A SubAdmin may only approve menus for stores whose StoreAdmin is under them.
    const { data: storeAdmin } = await DBconnection
      .from("users")
      .select("sub_admin_id")
      .eq("id", store.store_admin_id)
      .single();

    if (!storeAdmin || storeAdmin.sub_admin_id !== user.id) {
      return {
        ok: false,
        reason: "You do not have permission to approve menus for this store.",
      };
    }

    return { ok: true };
  }

  /* ─────────────────────────────────────────────────────────────
   * APPROVE MENU
   * ─────────────────────────────────────────────────────────────
   * Two scenarios:
   *  1. Normal approval — menu.status is PENDING → set APPROVED.
   *  2. Pending-products — merge pending_products into product_id.
   * After approval, notifies the store.
   * ───────────────────────────────────────────────────────────── */
  static async approveMenu(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { user_id, notes } = req.body;
      const user = req.user as any;

      const menu = await uniqueService.getDataById(id as string, TABLE_NAME);

      /* ── Region authorization ── */
      const approveAuthResult = await MenuController.isAuthorizedForMenuRegion(user, menu.store_id);
      if (!approveAuthResult.ok) {
        return res.status(403).json({ success: false, message: approveAuthResult.reason });
      }

      const hasPendingProducts = Array.isArray(menu.pending_products) && menu.pending_products.length > 0;

      const actorId = user?.id ?? user_id;
      const updateData: any = { approved_by: actorId, approved_at: new Date() };
      if (notes) updateData.notes = notes;

      let decision: "APPROVED" | "PARTIALLY_APPROVED" = "APPROVED";

      if (hasPendingProducts) {
        const existingProducts: string[] = Array.isArray(menu.product_id) ? menu.product_id : [];
        const pendingProducts: string[] = menu.pending_products;
        const merged = Array.from(new Set([...existingProducts, ...pendingProducts]));
        if (merged.length === 0) {
          updateData.status = "REJECTED";
          updateData.rejected_at = new Date();
          updateData.rejected_by = actorId;
          updateData.pending_products = null;
          const updated = await uniqueService.updateById(TABLE_NAME, id as string, updateData);
          if (menu.submitted_by && menu.date) {
            const { storeName, slotName } = await MenuController.getStoreAndSlotNames(menu.store_id, menu.time_slot_id);
            notifyStoreOfDecision({ submittedByUserId: menu.submitted_by, decision: "REJECTED", storeName, targetDate: menu.date, slotName, comment: "All pending products removed — menu automatically rejected" }).catch(() => {});
          }
          return res.json({ success: true, message: "No products remaining — menu automatically rejected", data: MenuController.formatMenu(updated) });
        }
        updateData.product_id = merged;
        updateData.pending_products = null;
        updateData.status = "APPROVED";
        decision = "PARTIALLY_APPROVED";
      } else {
        const effectiveProducts: string[] = Array.isArray(menu.product_id) ? menu.product_id : [];
        if (effectiveProducts.length === 0) {
          updateData.status = "REJECTED";
          updateData.rejected_at = new Date();
          updateData.rejected_by = actorId;
          const updated = await uniqueService.updateById(TABLE_NAME, id as string, updateData);
          if (menu.submitted_by && menu.date) {
            const { storeName, slotName } = await MenuController.getStoreAndSlotNames(menu.store_id, menu.time_slot_id);
            notifyStoreOfDecision({ submittedByUserId: menu.submitted_by, decision: "REJECTED", storeName, targetDate: menu.date, slotName, comment: "No products on menu — menu automatically rejected" }).catch(() => {});
          }
          return res.json({ success: true, message: "No products on menu — menu automatically rejected", data: MenuController.formatMenu(updated) });
        }
        updateData.status = "APPROVED";
      }

      const updated = await uniqueService.updateById(TABLE_NAME, id as string, updateData);

      if (menu.submitted_by && menu.date) {
        const { storeName, slotName } = await MenuController.getStoreAndSlotNames(menu.store_id, menu.time_slot_id);
        notifyStoreOfDecision({
          submittedByUserId: menu.submitted_by,
          decision,
          storeName,
          targetDate: menu.date,
          slotName,
          comment: notes,
        }).catch(() => {});
      }

      return res.json({
        success: true,
        message: hasPendingProducts ? "Pending products approved and merged into the menu successfully" : "Menu approved successfully",
        data: MenuController.formatMenu(updated),
      });
    } catch (err: any) {
      if (err?.code === "42703" || err?.code === "PGRST204") {
        return res.status(500).json({ success: false, message: "A database schema error occurred. Please try again shortly." });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * REJECT MENU
   * ─────────────────────────────────────────────────────────────
   * After rejection, notifies the store.
   * ───────────────────────────────────────────────────────────── */
  static async rejectMenu(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { user_id, notes, removed_product_ids } = req.body;
      const user = req.user as any;

      const menu = await uniqueService.getDataById(id, TABLE_NAME);

      /* ── Region authorization ── */
      const rejectAuthResult = await MenuController.isAuthorizedForMenuRegion(user, menu.store_id);
      if (!rejectAuthResult.ok) {
        return res.status(403).json({ success: false, message: rejectAuthResult.reason });
      }

      const actorId = user?.id ?? user_id;
      const updateData: any = {
        status: "REJECTED",
        rejected_by: actorId,
        rejected_at: new Date(),
      };
      if (notes) updateData.notes = notes;

      if (removed_product_ids?.length) {
        const current: string[] = Array.isArray(menu.product_id) ? menu.product_id : [];
        const removed = new Set(removed_product_ids);
        const remaining = current.filter((pid: string) => !removed.has(pid));
        if (remaining.length === 0) {
          updateData.status = "REJECTED";
        } else {
          updateData.product_id = remaining;
        }
      }

      const updated = await uniqueService.updateById("menus", id as string, updateData);

      if (menu.submitted_by && menu.date) {
        const { storeName, slotName } = await MenuController.getStoreAndSlotNames(menu.store_id, menu.time_slot_id);

        let removedNames: string[] | undefined;
        if (removed_product_ids?.length) {
          const { data: removedProds } = await DBconnection.from("products").select("name").in("id", removed_product_ids);
          removedNames = removedProds?.map((p: any) => p.name);
        }

        notifyStoreOfDecision({
          submittedByUserId: menu.submitted_by,
          decision: "REJECTED",
          storeName,
          targetDate: menu.date,
          slotName,
          comment: notes,
          removedItems: removedNames,
        }).catch(() => {});
      }

      return res.json({ success: true, message: "Menu rejected successfully", data: MenuController.formatMenu(updated) });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * ADD PENDING PRODUCTS  (Store Admin only)
   * ─────────────────────────────────────────────────────────────
   * Appends new product UUIDs to the `pending_products` staging
   * column of an already-APPROVED menu.
   * ───────────────────────────────────────────────────────────── */
  static async addPendingProducts(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { products } = req.body;

      if (!products?.length) {
        return res.status(400).json({ success: false, message: "products array is required" });
      }

      const incomingIds: string[] = products.map((p: any) => (typeof p === "string" ? p : p.product_id));
      const menu = await uniqueService.getDataById(id as string, TABLE_NAME);

      if (menu.status !== "APPROVED") {
        return res.status(400).json({ success: false, message: "Products can only be added to an APPROVED menu" });
      }

      const existingPending: string[] = Array.isArray(menu.pending_products) ? menu.pending_products : [];
      const approvedProducts: string[] = Array.isArray(menu.product_id) ? menu.product_id : [];

      const alreadyApproved = incomingIds.filter((pid: string) => approvedProducts.includes(pid));
      if (alreadyApproved.length > 0) {
        return res.status(409).json({
          success: false,
          message: "One or more products are already approved in this menu",
          data: { already_approved: alreadyApproved },
        });
      }

      const mergedPending = Array.from(new Set([...existingPending, ...incomingIds]));
      const updated = await uniqueService.updateById(TABLE_NAME, id as string, { pending_products: mergedPending });

      return res.status(200).json({
        success: true,
        message: "Products added to pending list successfully. Awaiting Sub Admin approval.",
        data: MenuController.formatMenu(updated),
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * REJECT PENDING PRODUCTS  (Sub Admin / Admin / SuperAdmin)
   * ─────────────────────────────────────────────────────────────
   * Clears the `pending_products` staging column without merging.
   * Notifies the store.
   * ───────────────────────────────────────────────────────────── */
  static async rejectPendingProducts(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { user_id, notes } = req.body;
      const user = req.user as any;

      const menu = await uniqueService.getDataById(id as string, TABLE_NAME);

      /* ── Region authorization ── */
      const rejectPendingAuthResult = await MenuController.isAuthorizedForMenuRegion(user, menu.store_id);
      if (!rejectPendingAuthResult.ok) {
        return res.status(403).json({ success: false, message: rejectPendingAuthResult.reason });
      }

      const hasPendingProducts = Array.isArray(menu.pending_products) && menu.pending_products.length > 0;
      if (!hasPendingProducts) {
        return res.status(400).json({ success: false, message: "No pending products found on this menu" });
      }

      const actorId = user?.id ?? user_id;
      const updateData: any = { pending_products: null, rejected_by: actorId, rejected_at: new Date() };
      if (notes) updateData.notes = notes;

      const updated = await uniqueService.updateById(TABLE_NAME, id as string, updateData);

      if (menu.submitted_by && menu.date) {
        const { storeName, slotName } = await MenuController.getStoreAndSlotNames(menu.store_id, menu.time_slot_id);
        const { data: removedProds } = await DBconnection.from("products").select("name").in("id", menu.pending_products);
        const removedNames = removedProds?.map((p: any) => p.name);

        notifyStoreOfDecision({
          submittedByUserId: menu.submitted_by,
          decision: "REJECTED",
          storeName,
          targetDate: menu.date,
          slotName,
          comment: notes,
          removedItems: removedNames,
        }).catch(() => {});
      }

      return res.json({ success: true, message: "Pending products rejected and removed from the menu", data: MenuController.formatMenu(updated) });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * TOGGLE ITEM AVAILABILITY  (StoreAdmin / Employee)
   * ─────────────────────────────────────────────────────────────
   * PATCH /ToggleItemAvailability/:id
   * Body: { product_id: string, available: boolean }
   * Adds/removes from unavailable_items array.
   * ───────────────────────────────────────────────────────────── */
  static async toggleItemAvailability(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { product_id, available } = req.body;
      const user = req.user as any;

      if (!product_id || typeof available !== "boolean") {
        return res.status(400).json({ success: false, message: "product_id and available (boolean) are required" });
      }

      /* ── Only StoreAdmin or Employee may toggle availability ── */
      const allowedRoles = ["StoreAdmin", "Employee"];
      if (!allowedRoles.includes(user?.role_name)) {
        return res.status(403).json({ success: false, message: "Only StoreAdmin or Employee can toggle item availability" });
      }

      const menu = await uniqueService.getDataById(id, TABLE_NAME);

      /* ── Scope check: verify user has access to this menu's store ── */
      if (user.role_name === "StoreAdmin") {
        const { data: myStores } = await DBconnection.from("stores").select("id").eq("store_admin_id", user.id);
        const myStoreIds = new Set((myStores ?? []).map((s: any) => s.id));
        if (!myStoreIds.has(menu.store_id)) {
          return res.status(403).json({ success: false, message: "You do not have access to this menu" });
        }
      } else if (user.role_name === "Employee") {
        if (user.store_id) {
          if (user.store_id !== menu.store_id) {
            return res.status(403).json({ success: false, message: "You do not have access to this menu" });
          }
        } else if (user.store_admin_id) {
          const { data: myStores } = await DBconnection.from("stores").select("id").eq("store_admin_id", user.store_admin_id);
          const myStoreIds = new Set((myStores ?? []).map((s: any) => s.id));
          if (!myStoreIds.has(menu.store_id)) {
            return res.status(403).json({ success: false, message: "You do not have access to this menu" });
          }
        } else {
          return res.status(403).json({ success: false, message: "You do not have access to this menu" });
        }
      }

      /* ── Only APPROVED menus may be toggled ── */
      if (menu.status !== "APPROVED") {
        return res.status(400).json({ success: false, message: "Item availability can only be toggled on APPROVED menus" });
      }

      /* ── Only today's date-based menus ── */
      if (menu.date) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (menu.date !== todayStr) {
          return res.status(400).json({ success: false, message: "Item availability can only be toggled for today's menu" });
        }
      }

      let unavailable: string[] = Array.isArray(menu.unavailable_items) ? menu.unavailable_items : [];

      if (available) {
        unavailable = unavailable.filter((pid: string) => pid !== product_id);
      } else {
        if (!unavailable.includes(product_id)) {
          unavailable.push(product_id);
        }
      }

      const updated = await uniqueService.updateById(TABLE_NAME, id, { unavailable_items: unavailable });
      return res.json({ success: true, message: `Item ${available ? "shown to" : "hidden from"} customers`, data: MenuController.formatMenu(updated) });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
