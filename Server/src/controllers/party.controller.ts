import { Request, Response } from "express";
import { DBconnection } from "../config/DBConnect";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { UniqueService } from "../services/unique.service";
import { getQueryNumber, getQueryString } from "../utils/queryParser";

const uniqueService = new UniqueService();
const TABLE_NAME = "party";

interface PartyRecord {
  id: string;
  store_id: string;
  template_id?: string | null;
  product_id?: string[] | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submitted_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  revision_count: number;
  unavailable_items: string[];
  created_at: string;
  updated_at: string;
}

export class PartyController {
  /**
   * ─────────────────────────────────────────────────────────────
   * CREATE PARTY
   * ─────────────────────────────────────────────────────────────
   * • StoreAdmin creates party in draft status
   * • Accepts products array (required, like menus)
   * • Validates all products have APPROVED status
   * • Optionally links to template (template_id)
   * • Stores product_id as UUID array in database
   * • No submission window enforcement (unlike menus)
   * ───────────────────────────────────────────────────────────── 
   */
  static async create(req: Request, res: Response) {
    try {
      const payload = req.body;
      const user = req.user as any;

      // Validate required fields
      if (!payload.store_id) {
        return res.status(400).json({ success: false, message: "store_id is required" });
      }

      if (!user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      // Validate products array (required)
      if (!payload.products?.length) {
        return res.status(400).json({ success: false, message: "products array is required" });
      }

      // Extract product IDs (handle both string and object formats)
      const productIds = payload.products.map((p: any) => (typeof p === "string" ? p : p.product_id));

      // Only allow APPROVED products
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

      // Verify user owns this store (for StoreAdmin)
      if (user.role_name === "StoreAdmin") {
        const { data: store, error: storeErr } = await DBconnection
          .from("stores")
          .select("id")
          .eq("id", payload.store_id)
          .eq("store_admin_id", user.id)
          .maybeSingle();

        if (storeErr) throw storeErr;
        if (!store) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to create parties for this store",
          });
        }
      }

      // Check for duplicate party (same store + template within short timeframe)
      if (payload.template_id) {
        const { data: existing, error: dupErr } = await DBconnection
          .from(TABLE_NAME)
          .select("*")
          .eq("store_id", payload.store_id)
          .eq("template_id", payload.template_id)
          .neq("status", "REJECTED")
          .maybeSingle();

        if (dupErr) throw dupErr;
        if (existing && existing.status !== "APPROVED") {
          return res.status(409).json({
            success: false,
            message: "A party for this template already exists in draft or pending status",
            data: existing,
          });
        }
      }

      // Insert party record
      const insertData = {
        store_id: payload.store_id,
        template_id: payload.template_id || null,
        product_id: productIds,
        status: "PENDING",
        submitted_by: user.id,
        revision_count: 0,
        unavailable_items: payload.unavailable_items || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const created = await uniqueService.create<PartyRecord>(TABLE_NAME, insertData);

      return res.status(201).json({
        success: true,
        message: "Party created successfully",
        data: created,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   * GET LIST
   * ─────────────────────────────────────────────────────────────
   * • Customers: only APPROVED parties from active stores
   * • StoreAdmin: own store's parties
   * • SubAdmin: parties from their region's stores
   * • Admin/SuperAdmin: all parties
   * • Supports filtering by status, store_ids, region_id
   * ───────────────────────────────────────────────────────────── 
   */
  static async getList(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const statusFilter = (getQueryString(req.query, "status") || "").trim().toUpperCase();
      const storeIdsParam = (getQueryString(req.query, "store_ids") || "").trim();
      const regionIdParam = (getQueryString(req.query, "region_id") || "").trim();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
      const page = getQueryNumber(req.query, "page", 1);
      const limit = getQueryNumber(req.query, "limit", 20);

      let allowedStoreIds: string[] | null = null;
      let forceApproved = false;

      // Determine which stores user can access
      if (!user || user.role_name === "Customer") {
        forceApproved = true;
        const { data: activeStores } = await DBconnection
          .from("stores")
          .select("id")
          .eq("is_active", true);
        allowedStoreIds = activeStores?.map((s: any) => s.id) || [];
      } else if (user.role_name === "StoreAdmin") {
        const { data: stores } = await DBconnection
          .from("stores")
          .select("id")
          .eq("store_admin_id", user.id);
        allowedStoreIds = stores?.map((s: any) => s.id) || [];
      } else if (user.role_name === "SubAdmin") {
        // Get store admins under this SubAdmin, then get their stores
        const { data: storeAdmins } = await DBconnection
          .from("users")
          .select("id")
          .eq("sub_admin_id", user.id)
          .eq("role_name", "StoreAdmin");
        const storeAdminIds = storeAdmins?.map((u: any) => u.id) || [];

        if (storeAdminIds.length > 0) {
          const { data: stores } = await DBconnection
            .from("stores")
            .select("id")
            .in("store_admin_id", storeAdminIds);
          allowedStoreIds = stores?.map((s: any) => s.id) || [];
        } else {
          allowedStoreIds = [];
        }
      } else if (user.role_name === "Employee") {
        const { data: stores } = await DBconnection
          .from("stores")
          .select("id")
          .eq("store_admin_id", user.store_admin_id);
        allowedStoreIds = stores?.map((s: any) => s.id) || [];
      }
      // Admin/SuperAdmin: allowedStoreIds stays null (no restriction)

      // Parse store_ids parameter
      let finalStoreIds: string[] | null = null;
      if (storeIdsParam) {
        const requestedIds = storeIdsParam
          .split(",")
          .map((id: string) => id.trim())
          .filter(Boolean);

        if (allowedStoreIds !== null) {
          finalStoreIds = requestedIds.filter((id: string) => allowedStoreIds!.includes(id));
        } else {
          finalStoreIds = requestedIds;
        }
      } else if (allowedStoreIds !== null) {
        finalStoreIds = allowedStoreIds;
      }

      // Region filter: intersect with stores in region
      if (regionIdParam) {
        const { data: regionStores } = await DBconnection
          .from("stores")
          .select("id")
          .eq("region_id", regionIdParam);
        const regionStoreIds = regionStores?.map((s: any) => s.id) || [];

        if (finalStoreIds !== null) {
          finalStoreIds = finalStoreIds.filter((id: string) => regionStoreIds.includes(id));
        } else {
          finalStoreIds = regionStoreIds;
        }
      }

      // Build query
      let query = DBconnection.from(TABLE_NAME).select("*", { count: "exact" });

      // Apply filters
      if (forceApproved) {
        query = query.eq("status", "APPROVED");
      } else if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
        query = query.eq("status", statusFilter);
      }

      if (finalStoreIds && finalStoreIds.length > 0) {
        query = query.in("store_id", finalStoreIds);
      } else if (finalStoreIds !== null && finalStoreIds.length === 0) {
        // User has no access
        return res.json({
          success: true,
          message: "No records found",
          data: [],
          ...(isPaginated && { page, limit, total: 0 }),
        });
      }

      // Pagination
      if (isPaginated) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Get paginated data with count
        const { data: parties, error: queryErr, count } = await query
          .order("created_at", { ascending: false })
          .range(from, to);

        if (queryErr) throw queryErr;

        return res.json({
          success: true,
          message: "Parties retrieved successfully",
          data: parties || [],
          page,
          limit,
          total: count || 0,
        });
      } else {
        const { data: parties, error: queryErr } = await query.order("created_at", { ascending: false });

        if (queryErr) throw queryErr;

        return res.json({
          success: true,
          message: "Parties retrieved successfully",
          data: parties || [],
        });
      }
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   * GET BY ID
   * ───────────────────────────────────────────────────────────── 
   */
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const party = await uniqueService.getDataById<PartyRecord>(id, TABLE_NAME);

      return res.json({
        success: true,
        message: "Party retrieved successfully",
        data: party,
      });
    } catch (err: any) {
      return res.status(404).json({
        success: false,
        message: err.message || "Party not found",
      });
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   * UPDATE PARTY
   * ─────────────────────────────────────────────────────────────
   * • Only draft/pending parties can be updated by creator
   * • Updates template_id, unavailable_items, etc.
   * ───────────────────────────────────────────────────────────── 
   */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const payload = req.body;
      const user = req.user as any;

      if (!user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      // Get current party
      const party = await uniqueService.getDataById<PartyRecord>(id, TABLE_NAME);

      // Can only edit draft/pending parties
      if (party.status === "REJECTED") {
        return res.status(400).json({
          success: false,
          message: "Cannot edit a rejected party. Please create a new one or resubmit.",
        });
      }

      // Verify ownership (for StoreAdmin)
      if (user.role_name === "StoreAdmin") {
        const { data: store, error: storeErr } = await DBconnection
          .from("stores")
          .select("id")
          .eq("id", party.store_id)
          .eq("store_admin_id", user.id)
          .maybeSingle();

        if (storeErr) throw storeErr;
        if (!store) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to edit this party",
          });
        }
      }

      // Handle products update (same as menus)
      const updateData: any = { ...payload };
      if (payload.products && Array.isArray(payload.products) && payload.products.length > 0) {
        const productIds = payload.products.map((p: any) => (typeof p === "string" ? p : p.product_id));
        
        // Only allow APPROVED products
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
        
        updateData.product_id = productIds;
      }

      // Update party
      const finalUpdateData = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };
      delete finalUpdateData.id; // Prevent ID change
      delete finalUpdateData.status; // Prevent status change via update
      delete finalUpdateData.submitted_by; // Prevent ownership change
      delete finalUpdateData.approved_by;
      delete finalUpdateData.rejected_by;
      delete finalUpdateData.products; // Remove products field, use product_id

      const updated = await uniqueService.updateById<PartyRecord>(TABLE_NAME, id, finalUpdateData);

      return res.json({
        success: true,
        message: "Party updated successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   * DELETE PARTY
   * ─────────────────────────────────────────────────────────────
   * • Only draft/pending parties can be deleted
   * • StoreAdmin can delete own store parties
   * ───────────────────────────────────────────────────────────── 
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user as any;

      if (!user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      // Get party
      const party = await uniqueService.getDataById<PartyRecord>(id, TABLE_NAME);

      // Can only delete draft/pending parties
      if (!["PENDING", "REJECTED"].includes(party.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete a ${party.status.toLowerCase()} party`,
        });
      }

      // Verify ownership (for StoreAdmin)
      if (user.role_name === "StoreAdmin") {
        const { data: store, error: storeErr } = await DBconnection
          .from("stores")
          .select("id")
          .eq("id", party.store_id)
          .eq("store_admin_id", user.id)
          .maybeSingle();

        if (storeErr) throw storeErr;
        if (!store) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to delete this party",
          });
        }
      }

      // Delete party
      const { error: deleteErr } = await DBconnection.from(TABLE_NAME).delete().eq("id", id);

      if (deleteErr) throw deleteErr;

      return res.json({
        success: true,
        message: "Party deleted successfully",
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   * SUBMIT PARTY
   * ─────────────────────────────────────────────────────────────
   * • Changes status from PENDING to PENDING (for approval queue)
   * • Marks party as submitted for review
   * • Can be re-submitted after rejection (increments revision_count)
   * ───────────────────────────────────────────────────────────── 
   */
  static async submit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { submitted_by } = req.body;
      const user = req.user as any;

      if (!user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      // Get party
      const party = await uniqueService.getDataById<PartyRecord>(id, TABLE_NAME);

      if (party.status === "APPROVED") {
        return res.status(400).json({
          success: false,
          message: "Cannot re-submit an approved party",
        });
      }

      // Verify ownership (for StoreAdmin)
      if (user.role_name === "StoreAdmin") {
        const { data: store, error: storeErr } = await DBconnection
          .from("stores")
          .select("id")
          .eq("id", party.store_id)
          .eq("store_admin_id", user.id)
          .maybeSingle();

        if (storeErr) throw storeErr;
        if (!store) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to submit this party",
          });
        }
      }

      // Update submission info
      const updateData: Partial<PartyRecord> = {
        status: "PENDING",
        submitted_by: submitted_by || user.id,
        updated_at: new Date().toISOString(),
      };

      // If re-submitting after rejection, increment revision count (max 3)
      if (party.status === "REJECTED") {
        if (party.revision_count >= 3) {
          return res.status(400).json({
            success: false,
            message: "Maximum re-submission limit reached (3 revisions)",
          });
        }
        updateData.revision_count = party.revision_count + 1;
      }

      const updated = await uniqueService.updateById<PartyRecord>(TABLE_NAME, id, updateData);

      return res.json({
        success: true,
        message: "Party submitted successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   * APPROVE PARTY
   * ─────────────────────────────────────────────────────────────
   * • Only SubAdmin/Admin can approve
   * • Changes status from PENDING to APPROVED
   * • Records approver and timestamp
   * ───────────────────────────────────────────────────────────── 
   */
  static async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const user = req.user as any;

      if (!user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      if (!["SubAdmin", "Admin", "SuperAdmin"].includes(user.role_name)) {
        return res.status(403).json({
          success: false,
          message: "Only SubAdmin or Admin can approve parties",
        });
      }

      // Get party
      const party = await uniqueService.getDataById<PartyRecord>(id, TABLE_NAME);

      if (party.status === "APPROVED") {
        return res.status(400).json({
          success: false,
          message: "Party is already approved",
        });
      }

      // Approve party
      const updateData: Partial<PartyRecord> = {
        status: "APPROVED",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updated = await uniqueService.updateById<PartyRecord>(TABLE_NAME, id, updateData);

      return res.json({
        success: true,
        message: "Party approved successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   * REJECT PARTY
   * ─────────────────────────────────────────────────────────────
   * • Only SubAdmin/Admin can reject
   * • Changes status from PENDING to REJECTED
   * • Records rejector and timestamp
   * • Allows re-submission with revision counting
   * ───────────────────────────────────────────────────────────── 
   */
  static async reject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const user = req.user as any;

      if (!user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      if (!["SubAdmin", "Admin", "SuperAdmin"].includes(user.role_name)) {
        return res.status(403).json({
          success: false,
          message: "Only SubAdmin or Admin can reject parties",
        });
      }

      // Get party
      const party = await uniqueService.getDataById<PartyRecord>(id, TABLE_NAME);

      if (party.status === "REJECTED") {
        return res.status(400).json({
          success: false,
          message: "Party is already rejected",
        });
      }

      // Reject party
      const updateData: Partial<PartyRecord> = {
        status: "REJECTED",
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updated = await uniqueService.updateById<PartyRecord>(TABLE_NAME, id, updateData);

      return res.json({
        success: true,
        message: "Party rejected successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   * TOGGLE ITEM AVAILABILITY
   * ─────────────────────────────────────────────────────────────
   * • Marks specific products as unavailable in party
   * • Used by StoreAdmin to mark items out of stock
   * ───────────────────────────────────────────────────────────── 
   */
  static async toggleItemAvailability(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { product_id, available } = req.body;
      const user = req.user as any;

      if (!user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      if (!product_id) {
        return res.status(400).json({ success: false, message: "product_id is required" });
      }

      // Get party
      const party = await uniqueService.getDataById<PartyRecord>(id, TABLE_NAME);

      // Verify ownership
      if (user.role_name === "StoreAdmin") {
        const { data: store, error: storeErr } = await DBconnection
          .from("stores")
          .select("id")
          .eq("id", party.store_id)
          .eq("store_admin_id", user.id)
          .maybeSingle();

        if (storeErr) throw storeErr;
        if (!store) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to modify this party",
          });
        }
      }

      // Update unavailable items
      let unavailableItems = party.unavailable_items || [];

      if (available === false) {
        // Add to unavailable
        if (!unavailableItems.includes(product_id)) {
          unavailableItems = [...unavailableItems, product_id];
        }
      } else {
        // Remove from unavailable
        unavailableItems = unavailableItems.filter((id: string) => id !== product_id);
      }

      const updateData: Partial<PartyRecord> = {
        unavailable_items: unavailableItems,
        updated_at: new Date().toISOString(),
      };

      const updated = await uniqueService.updateById<PartyRecord>(TABLE_NAME, id, updateData);

      return res.json({
        success: true,
        message: `Item ${available === false ? "marked unavailable" : "marked available"} successfully`,
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }
}
